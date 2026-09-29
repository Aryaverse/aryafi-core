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
      [gRPC Ledger API (e.g. 10012)]      [HTTP JSON API v1 (Port 7575)]
      • CommandSubmissionService           • POST /v1/create, /v1/exercise
      • CommandCompletionService           • POST /v1/query (ACS)
      • TransactionService                 • WS   /v1/stream/query
      • ActiveContractsService             • POST /v1/parties/allocate
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
- Service: `ActiveContractsService.GetActiveContracts`
- Filter: Template ID (e.g., `AryaFi.Finance.Cash:CashPosition`) + Party filter.
- Returns all currently active, unconsumed contract instances and their contract keys.

### 6.2 Streaming Phase: Transaction Update Stream
- Service: `TransactionService.GetTransactions`
- Parameter: `begin` set to the offset returned with the ACS snapshot.
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

The following reference implementation submits a `SplitCash` exercise through the Daml 2.10 HTTP JSON API (v1). Idempotency comes from the **command ID**: it is derived from the caller's idempotency key, so a retry of the same business request reuses the same command ID and the ledger rejects the duplicate within the deduplication period. (The `IdempotencyKey` fields stored on contracts are for traceability only; the ledger does not enforce them.)

```typescript
export interface SplitCashRequest {
  cashCid: string;
  splitAmount: string;      // Daml Decimal as a string, e.g. "4975000.00", to avoid float rounding
  ownerParty: string;       // full party ID, e.g. "DealerBankB::1220..."
  idempotencyKey: string;   // stable per business request, e.g. the upstream MsgId
}

export class AryaFiLedgerClient {
  constructor(private endpoint: string, private jwtToken: string) {}

  /**
   * Exercises SplitCash. Retries with the same idempotencyKey are deduplicated by the
   * ledger because they carry the same commandId.
   */
  async splitCashPosition(req: SplitCashRequest): Promise<{ splitCid: string; remainderCid: string }> {
    const body = {
      templateId: "AryaFi.Finance.Cash:CashPosition",
      contractId: req.cashCid,
      choice: "SplitCash",
      argument: { splitAmount: req.splitAmount },
      meta: {
        commandId: `aryafi-split-${req.idempotencyKey}`,
        actAs: [req.ownerParty],
        deduplicationPeriod: { durationInMillis: 24 * 60 * 60 * 1000, type: "Duration" }
      }
    };

    const response = await fetch(`${this.endpoint}/v1/exercise`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.jwtToken}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // A 409 with a duplicate-command error means an earlier attempt already committed:
      // look the result up by commandId instead of resubmitting.
      throw new Error(`JSON API submission failed (${response.status}): ${await response.text()}`);
    }

    // SplitCash returns (ContractId CashPosition, ContractId CashPosition): (split, remainder)
    const { result } = await response.json();
    return { splitCid: result.exerciseResult._1, remainderCid: result.exerciseResult._2 };
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
