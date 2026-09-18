# Canton Ledger API Client & Command Submission Patterns

## 1. Overview & Architecture

The **Canton Ledger API** is the primary gRPC and HTTP JSON interface through which external enterprise systems (trading desks, core banking platforms, risk systems, and settlement engines) interact with Daml smart contracts deployed on Canton.

Unlike traditional relational databases or public blockchains, Canton enforces **fine-grained sub-transaction privacy**:
- Each participant node only hosts contracts and transaction sub-trees where its hosted parties are **signatories**, **controllers**, or **explicit observers**.
- Transactions can span multiple independent Canton participants through decentralized multi-party commitments.

This specification details the client application architecture, command submission patterns, multi-party authorization tokens, stream consumption models, and deduplication mechanics required to integrate with AryaFi Core.

---

## 2. API Architecture & Protocol Surfaces

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Enterprise Applications                         │
│       (Trading Engine | Core Banking | Treasury | Risk Portal)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
      [gRPC Services (Port 5011)]         [HTTP JSON API v2 (Port 7575)]
      • CommandSubmissionService           • POST /v2/commands/submit-wait
      • CommandCompletionService           • GET  /v2/state/active-contracts
      • TransactionService                 • POST /v2/state/updates (Stream)
      • StateService (ACS)                 • POST /v2/user-management
                 │                                     │
                 └──────────────────┬──────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Canton Participant Node Daemon                       │
│       (Ledger API Server | Contract Store | Crypto Engine)             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Party Authorization Tokens

All calls to the Ledger API must supply a cryptographically signed JSON Web Token (JWT) signed by the participant node's identity provider (IdP) using RS256 or ES256:

```json
{
  "iss": "https://auth.aryaverse.io",
  "sub": "service-treasury-engine-01",
  "aud": "canton-participant-node",
  "exp": 1795000000,
  "scope": "daml_ledger_api",
  "https://daml.com/ledger-api": {
    "ledgerId": "arya-mainnet-domain-01",
    "applicationId": "AryaFi_Treasury_Portal",
    "actAs": [
      "SiemensGlobalTreasury::1220a4b7f8c1...",
      "SiemensUSA::12209d81e3a2..."
    ],
    "readAs": [
      "FederalReserve::12203e87b21a..."
    ],
    "admin": false
  }
}
```

### Authorization Rules:
1. `actAs`: Parties on whose behalf the client can submit commands and exercise contract choices. Must be hosted on this participant node.
2. `readAs`: Parties whose contract visibility is granted for reading the Active Contract Set (ACS) and streaming transaction updates.

---

## 4. Multi-Party Command Submission (`submitAndWait`)

Many AryaFi contracts (such as `PaymentInstruction`, `AssetTransferRequest`, and `DvpInstruction`) require **co-signatures** from two or more distinct parties (e.g. `payer` + `payee` + `settlementAgent`).

### Multi-Party Submission Flow

```
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  Participant │             │  Participant │             │ Canton Order │
│   Node A     │             │   Node B     │             │  Sequencer   │
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       │ 1. submitMulti(actAs: [A, B])                           │
       │────────────────────────────────────────────────────────>│
       │                            │  2. Signature verification │
       │                            │<───────────────────────────│
       │                            │                            │
       │                            │  3. Multi-party commit     │
       │<────────────────────────────────────────────────────────│
       │    Transaction committed (Status: OK)                   │
```

---

## 5. Idempotency & Deduplication Engine

In high-throughput financial environments, network disconnects or gateway timeouts can occur after a command is sent but before a response is received. To prevent double-spending or duplicate payments:

1. **Client Command ID (`commandId`)**:
   - Each submission must carry a unique `commandId` (UUIDv4).
   - Canton deduplicates incoming commands matching the tuple `(actAs, commandId)` within a configurable deduplication duration (typically 30 seconds to 5 minutes).
2. **Domain-Level `IdempotencyKey`**:
   - For persistent business deduplication across long-running asynchronous workflows, the AryaFi Daml layer enforces contract keys or invariant assertions on `IdempotencyKey` inside templates like `PaymentInstruction`.

---

## 6. Real-Time Event Streaming & Active Contract Set (ACS)

### 6.1 Bootstrap Phase: Active Contract Set Snapshot
Upon startup, the client pulls the current active state:
- Service: `StateService.GetActiveContracts`
- Filter: Template ID (e.g., `AryaFi.Finance.Cash:CashPosition`) + Party filter.
- Returns all currently active, unconsumed contract instances and their contract keys.

### 6.2 Streaming Phase: Transaction Update Stream
- Service: `UpdateService.GetUpdates`
- Parameter: `begin_exclusive` set to the offset returned by the ACS response.
- Streams real-time `CreatedEvent` and `ArchivedEvent` objects.

```typescript
// Event Sourcing Loop Pattern
let currentOffset = acsResponse.offset;

const stream = ledgerClient.getUpdates({
  beginExclusive: currentOffset,
  filter: {
    filtersByParty: {
      [treasuryParty]: {
        inclusive: {
          templateIds: [
            "AryaFi.Finance.Cash:CashPosition",
            "AryaFi.Finance.Payment:PaymentInstruction"
          ]
        }
      }
    }
  }
});

stream.on('data', (update) => {
  if (update.transaction) {
    for (const event of update.transaction.events) {
      if (event.created) {
        handleContractCreated(event.created);
      } else if (event.archived) {
        handleContractArchived(event.archived);
      }
    }
    currentOffset = update.transaction.offset;
    persistOffsetCheckpoint(currentOffset);
  }
});
```

---

## 7. Concrete Client Implementation (TypeScript)

The following reference implementation demonstrates client connection, command submission with idempotency, and error handling using the Daml / Canton SDK:

```typescript
import { ChannelCredentials } from '@grpc/grpc-js';
import { v4 as uuidv4 } from 'uuid';

export interface SplitCashRequest {
  cashCid: string;
  splitAmount: number;
  ownerParty: string;
  bankParty: string;
}

export class AryaFiLedgerClient {
  private endpoint: string;
  private jwtToken: string;

  constructor(endpoint: string, jwtToken: string) {
    this.endpoint = endpoint;
    this.jwtToken = jwtToken;
  }

  /**
   * Submits an atomic SplitCash choice exercise with guaranteed idempotency.
   */
  async splitCashPosition(req: SplitCashRequest): Promise<{ newCid1: string; newCid2: string }> {
    const commandId = `CMD-SPLIT-${uuidv4()}`;
    
    const payload = {
      commands: {
        commandId,
        actAs: [req.ownerParty],
        applicationId: "AryaFi_CashConcentration_Service",
        commands: [
          {
            exercise: {
              templateId: "AryaFi.Finance.Cash:CashPosition",
              contractId: req.cashCid,
              choice: "SplitCash",
              choiceArgument: {
                splitAmount: req.splitAmount.toFixed(4)
              }
            }
          }
        ]
      }
    };

    const response = await fetch(`${this.endpoint}/v2/commands/submit-wait`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.jwtToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Canton submission failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const exerciseResult = result.completion.exerciseResult;
    return {
      newCid1: exerciseResult._1,
      newCid2: exerciseResult._2
    };
  }
}
```

---

## 8. Concrete Client Implementation (Python)

```python
import uuid
import grpc
import json

class AryaFiPythonClient:
    def __init__(self, host: str, port: int, token: str):
        self.channel = grpc.insecure_channel(f"{host}:{port}")
        self.token = token

    def create_payment_instruction(self, payer: str, payee: str, agent: str,
                                   payer_acct: str, payee_acct: str,
                                   amount: float, currency: str, idempotency_key: str):
        """
        Submits a multi-party PaymentInstruction creation request.
        """
        command_id = f"CMD-PAY-{uuid.uuid4()}"
        
        # Prepare submission command payload
        command_payload = {
            "commands": {
                "commandId": command_id,
                "actAs": [payer, payee, agent],
                "applicationId": "AryaFi_Treasury_Engine",
                "commands": [
                    {
                        "create": {
                            "templateId": "AryaFi.Finance.Payment:PaymentInstruction",
                            "arguments": {
                                "payer": payer,
                                "payee": payee,
                                "settlementAgent": agent,
                                "payerAccountId": payer_acct,
                                "payeeAccountId": payee_acct,
                                "currency": currency,
                                "amount": f"{amount:.4f}",
                                "purpose": {"GeneralPayment": "Treasury Intercompany Funding"},
                                "obligationRef": None,
                                "correlationId": f"CORR-{uuid.uuid4()}",
                                "idempotencyKey": idempotency_key,
                                "networkRef": None,
                                "status": {"PendingSettlement": {}},
                                "observers": []
                            }
                        }
                    }
                ]
            }
        }
        return command_payload
```

---

## 9. Error Classification & Recovery Matrix

| Ledger API Status / Error Code | Cause in AryaFi Context | Recommended Client Recovery Action |
|:---|:---|:---|
| `UNAUTHENTICATED (16)` | Expired or invalid JWT token. | Refresh JWT token via OAuth2 / OIDC IdP and retry immediately. |
| `PERMISSION_DENIED (7)` | Submitting client lacks required `actAs` claims for controllers. | Check party allocation and JWT claim scope. Do not retry automatically. |
| `INVALID_ARGUMENT (3)` | Contract assertion failure (e.g. `amount <= 0.0`, invalid ISIN format). | Reject transaction upstream at business layer. Log validation error. |
| `NOT_FOUND (5)` | Referenced ContractId has already been consumed/archived (contention). | Query ACS for current active ContractId and retry transaction with new CID. |
| `ABORTED (10)` / `CONFLICT` | Concurrent choices exercised on same contract key / double-spend attempt. | Exponential backoff (50ms, 100ms, 200ms) with jitter, then re-query ACS and retry. |
| `RESOURCE_EXHAUSTED (8)` | Rate limit or transaction buffer exceeded on Canton domain. | Queue commands locally; throttle outbound rate to participant node. |
