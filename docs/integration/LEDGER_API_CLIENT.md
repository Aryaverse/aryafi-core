# Canton Ledger API Client & Command Submission Patterns

## 1. Overview & Architecture

The **Canton Ledger API** (version 2 in Canton 3) is the gRPC and HTTP JSON interface through which external enterprise systems (trading desks, core banking platforms, risk systems, and settlement engines) interact with Daml smart contracts deployed on Canton.

Unlike traditional relational databases or public blockchains, Canton enforces **fine-grained sub-transaction privacy**:
- Each participant node only hosts contracts and transaction sub-trees where its hosted parties are **signatories**, **controllers**, or **explicit observers**.
- Transactions can span multiple independent Canton participants, synchronized through a Canton synchronizer (sequencer and mediator).

This specification covers the client architecture, command submission, authentication, stream consumption, and deduplication needed to integrate with AryaFi Core on Canton 3.5.

---

## 2. API Architecture & Protocol Surfaces

Each participant in the reference topology (`deploy/canton/canton.conf`) exposes both surfaces: gRPC on port `xxx2` and JSON on port `xxx3` (for example `10012` and `10013` for the bank node).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Enterprise Applications                         │
│       (Trading Engine | Core Banking | Treasury | Risk Portal)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
      [gRPC Ledger API v2 (e.g. 10012)]   [JSON Ledger API v2 (e.g. 10013)]
      • CommandService                     • POST /v2/commands/submit-and-wait
      • CommandCompletionService           • POST /v2/commands/submit-and-wait-for-transaction
      • UpdateService                      • POST /v2/updates (and WebSocket)
      • StateService (ACS, ledger end)     • POST /v2/state/active-contracts
      • PartyManagementService             • GET  /v2/state/ledger-end
      • UserManagementService              • POST /v2/parties, /v2/users
                 │                                     │
                 └──────────────────┬──────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Canton Participant Node (3.5)                        │
│       (Ledger API Server | Contract Store | Crypto Engine)             │
└────────────────────────────────────────────────────────────────────────┘
```

The JSON Ledger API's OpenAPI and AsyncAPI specifications ship in the Canton release under `openapi/json-ledger-api/`.

Template IDs use the **package-name** form, `#<package-name>:<Module>:<Template>`, for example `#aryafi-core:AryaFi.Finance.Cash:CashPosition`. The package-ID form is deprecated. With the package name, the participant picks the vetted version of `aryafi-core`, so clients do not change when the package is upgraded.

---

## 3. Authentication & User Rights

In Canton 3, a Ledger API client authenticates as a **user**. The JWT identifies the user; the parties it may act or read as are **user rights** stored on the participant (User Management Service), not claims in the token.

```json
{
  "iss": "https://auth.aryaverse.io",
  "sub": "treasury-engine-01",
  "aud": "https://daml.com/jwt/aud/participant/<participant-id>",
  "exp": 1795000000,
  "scope": "daml_ledger_api"
}
```

The participant operator grants the user its rights once:

```
POST /v2/users/treasury-engine-01/rights
{ "userId": "treasury-engine-01",
  "rights": [ { "kind": { "CanActAs": { "value": { "party": "DealerBankB::1220..." } } } } ] }
```

### Authorization Rules:
1. `actAs`: Parties on whose behalf the user submits commands. The user needs `CanActAs` for each, and each must be hosted on this participant.
2. `readAs`: Parties whose contracts the user may read (`CanReadAs`) in the Active Contract Set and update streams.

The reference topology in `deploy/` runs without authentication, for local testing only.

---

## 4. Multi-Party Command Submission

Many AryaFi contracts (such as `PaymentInstruction`, `AssetTransferRequest`, and `DvpInstruction`) have **several signatories** (e.g. `payer` + `payee` + `settlementAgent`). Creating one needs all of them in `actAs` of a single submission.

```
┌──────────────┐                                         ┌──────────────┐
│  Participant │                                         │ Synchronizer │
│   Node A     │                                         │ (seq + med)  │
└──────┬───────┘                                         └──────┬───────┘
       │                                                        │
       │ 1. submit-and-wait (actAs: [A1, A2]) — both parties    │
       │    must be hosted on Node A                            │
       │───────────────────────────────────────────────────────>│
       │                     2. Confirmation by the stakeholders' │
       │                        participants, verdict by mediator │
       │<───────────────────────────────────────────────────────│
       │    Transaction committed                               │
```

A single submission cannot act for parties hosted on different participants. Until AryaFi provides propose/accept workflows (see [KNOWN_LIMITATIONS.md §4](../KNOWN_LIMITATIONS.md#4-multi-party-workflows-and-compliance)), all signatories of such a contract must be hosted on the submitting participant. Across participants, create a `MultiPartyProposal` (`#aryafi-core:AryaFi.Contracts.Proposal:MultiPartyProposal`) instead: the proposer creates it with the contract's terms, each other signatory exercises `AcceptProposal` from its own participant, and the last acceptance creates the contract. A choice that several parties control (locking a position, rolling a repo, releasing an escrow) is proposed the same way, as `ExerciseJointly` with the contract ID and the choice's arguments. Token-standard transfers and `TokenDvpInstruction` do not have this limit either (§6.3): each party submits from its own participant.

---

## 5. Idempotency & Deduplication

In high-throughput financial environments, network disconnects or gateway timeouts can occur after a command is sent but before a response is received. To prevent double-spending or duplicate payments:

1. **Command ID (`commandId`)**:
   - Derive the `commandId` from the business idempotency key (for example the ISO 20022 `MsgId`), so a retry of the same business request carries the same command ID.
   - Canton deduplicates submissions with the same change ID, `(userId, commandId, actAs)`, within the deduplication period. Set it per submission, e.g. `"deduplicationPeriod": { "DeduplicationDuration": { "value": { "seconds": 86400, "nanos": 0 } } }`; the participant's configured maximum applies.
2. **`IdempotencyKey` on contracts**:
   - Templates such as `PaymentInstruction` store an `IdempotencyKey` for traceability only. The ledger does not enforce its uniqueness (Daml-LF 2.2 has no contract keys), so deduplication relies on the command ID. When the settlement agent executes a payment instruction on the ledger (`ExecutePayment`), the token-standard transfer's metadata carries the key and the correlation ID (`aryafi.io/idempotency-key`, `aryafi.io/correlation-id`), so wallets and reconciliation see them on the transfer.

---

## 6. Real-Time Event Streaming & Active Contract Set (ACS)

### 6.1 Bootstrap Phase: Active Contract Set Snapshot
Upon startup, the client pulls the current active state:
- Get the current offset: `GET /v2/state/ledger-end` (gRPC `StateService.GetLedgerEnd`).
- Query: `POST /v2/state/active-contracts` (gRPC `StateService.GetActiveContracts`) with `activeAtOffset` set to that offset.
- Filter: party plus template ID (e.g. `#aryafi-core:AryaFi.Finance.Cash:CashPosition`). The API does not filter on contract fields; filter by account, currency, or ISIN in the client.

```json
{
  "eventFormat": {
    "filtersByParty": {
      "DealerBankB::1220...": {
        "cumulative": [
          { "identifierFilter": { "TemplateFilter": { "value": {
              "templateId": "#aryafi-core:AryaFi.Finance.Cash:CashPosition",
              "includeCreatedEventBlob": false } } } }
        ]
      }
    },
    "verbose": true
  },
  "activeAtOffset": 4211
}
```

### 6.2 Streaming Phase: Update Stream
- Service: `POST /v2/updates` or its WebSocket form (gRPC `UpdateService.GetUpdates`).
- Parameter: `beginExclusive` set to the offset of the ACS snapshot.
- Streams transactions whose events are `CreatedEvent` and `ArchivedEvent` (ACS-delta shape).

```typescript
// Event Sourcing Loop Pattern
let currentOffset = snapshotOffset;

const stream = ledgerClient.getUpdates({
  beginExclusive: currentOffset,
  updateFormat: {
    includeTransactions: {
      transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      eventFormat: {
        filtersByParty: {
          [treasuryParty]: {
            cumulative: [
              { identifierFilter: { TemplateFilter: { value: { templateId: "#aryafi-core:AryaFi.Finance.Cash:CashPosition" } } } },
              { identifierFilter: { TemplateFilter: { value: { templateId: "#aryafi-core:AryaFi.Finance.Payment:PaymentInstruction" } } } }
            ]
          }
        }
      }
    }
  }
});

stream.on('data', (update) => {
  const tx = update.update?.Transaction?.value;
  if (tx) {
    for (const event of tx.events) {
      if (event.CreatedEvent) {
        handleContractCreated(event.CreatedEvent);
      } else if (event.ArchivedEvent) {
        handleContractArchived(event.ArchivedEvent);
      }
    }
    currentOffset = tx.offset;
    persistOffsetCheckpoint(currentOffset);
  }
});
```

### 6.3 Token-Standard Holdings, Transfers, and Settlement
Wallets and apps can list, send, and settle AryaFi cash and securities through the Canton Network Token Standard's interfaces, without AryaFi's template IDs. Query by interface (`InterfaceFilter` with `"includeInterfaceView": true`), and use the interface ID as the `templateId` of an exercise command:

| What | Interface ID |
|:---|:---|
| Holdings | `#splice-api-token-holding-v2:Splice.Api.Token.HoldingV2:Holding` (CIP-56: `#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding`) |
| The bank's or custodian's transfer factory | `#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferFactory` |
| Pending transfers | `#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferInstruction` |
| The bank's or custodian's allocation factory | `#splice-api-token-allocation-instruction-v2:Splice.Api.Token.AllocationInstructionV2:AllocationFactory` |
| The same factory, for settling | `#splice-api-token-allocation-v2:Splice.Api.Token.AllocationV2:SettlementFactory` |
| Allocations | `#splice-api-token-allocation-v2:Splice.Api.Token.AllocationV2:Allocation` |

A holdings query returns every holding the party can see. That includes a sender's locked holding while a transfer to the party is pending, so list a party's own holdings by `account.owner`.

To send, exercise `TransferFactory_Transfer` on the factory, naming the holdings that fund the transfer. `requestedAt` must be in the past and `executeBefore` in the future; the sender must be among the `actors`:

```json
{
  "commands": [ { "ExerciseCommand": {
    "templateId": "#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferFactory",
    "contractId": "00de1c92f6b8...",
    "choice": "TransferFactory_Transfer",
    "choiceArgument": {
      "transfer": {
        "sender":   { "owner": "Bob::1220...",   "provider": "Bank::1220...", "id": "ACC-BOB" },
        "receiver": { "owner": "Alice::1220...", "provider": "Bank::1220...", "id": "ACC-ALICE" },
        "amount": "300.0",
        "instrumentId": { "admin": "Bank::1220...", "id": "USD" },
        "requestedAt": "2026-10-01T05:06:22Z",
        "executeBefore": "2026-10-02T05:07:22Z",
        "inputHoldingCids": [ "008e46330953..." ],
        "meta": { "values": {} } },
      "actors": [ "Bob::1220..." ],
      "extraArgs": { "context": { "values": {} }, "meta": { "values": {} } } } } } ],
  "commandId": "transfer-1",
  "userId": "wallet-backend",
  "actAs": [ "Bob::1220..." ]
}
```

The sender's change comes back at once. The transferred amount stays in the sender's account, locked to the bank, until the receiver exercises `TransferInstruction_Accept` (or `TransferInstruction_Reject`) on the pending instruction, or the sender exercises `TransferInstruction_Withdraw`:

```json
{
  "commands": [ { "ExerciseCommand": {
    "templateId": "#splice-api-token-transfer-instruction-v2:Splice.Api.Token.TransferInstructionV2:TransferInstruction",
    "contractId": "<pending instruction>",
    "choice": "TransferInstruction_Accept",
    "choiceArgument": { "actors": [ "Alice::1220..." ],
                        "extraArgs": { "context": { "values": {} }, "meta": { "values": {} } } } } } ],
  "commandId": "accept-1",
  "userId": "wallet-backend",
  "actAs": [ "Alice::1220..." ]
}
```

If the receiver is among the `actors` of `TransferFactory_Transfer` too, the transfer completes in one step.

To settle a trade, for example a bond for cash, every account allocates its sides of the legs at each registry with `AllocationFactory_Allocate`. The seller's bond allocation, funded from its bond holdings:

```json
{
  "commands": [ { "ExerciseCommand": {
    "templateId": "#splice-api-token-allocation-instruction-v2:Splice.Api.Token.AllocationInstructionV2:AllocationFactory",
    "contractId": "<custodian's factory>",
    "choice": "AllocationFactory_Allocate",
    "choiceArgument": {
      "settlement": { "executors": [ "Agent::1220..." ], "id": "TRADE-1", "cid": null, "meta": { "values": {} } },
      "allocation": {
        "admin": "Custodian::1220...",
        "authorizer": { "owner": "Seller::1220...", "provider": "Custodian::1220...", "id": "ACC-SELLER-SEC" },
        "transferLegSides": [ {
          "transferLegId": "bond", "side": "SenderSide",
          "otherside": { "owner": "Buyer::1220...", "provider": "Custodian::1220...", "id": "ACC-BUYER-SEC" },
          "amount": "1000000.0", "instrumentId": "US912828ZM50", "meta": { "values": {} } } ],
        "settlementDeadline": null, "nextIterationFunding": null, "committed": false, "meta": { "values": {} } },
      "requestedAt": "2026-10-01T05:40:00Z",
      "inputHoldingCids": [ "<seller's bond holding>" ],
      "extraArgs": { "context": { "values": {} }, "meta": { "values": {} } },
      "actors": [ "Seller::1220..." ] } } } ],
  "commandId": "alloc-1",
  "userId": "settlement-app",
  "actAs": [ "Seller::1220..." ]
}
```

The buyer allocates the receiving side of the bond leg with no holdings, and the two do the same for the cash leg at the bank. The settlement agent then settles both registries' batches in one submission, so both legs settle or neither does:

```json
{
  "commands": [
    { "ExerciseCommand": {
      "templateId": "#splice-api-token-allocation-v2:Splice.Api.Token.AllocationV2:SettlementFactory",
      "contractId": "<custodian's factory>",
      "choice": "SettlementFactory_SettleBatch",
      "choiceArgument": {
        "settlement": { "executors": [ "Agent::1220..." ], "id": "TRADE-1", "cid": null, "meta": { "values": {} } },
        "transferLegs": [ { "transferLegId": "bond", "sender": { "...": "seller's account" }, "receiver": { "...": "buyer's account" },
                            "amount": "1000000.0", "instrumentId": "US912828ZM50", "meta": { "values": {} } } ],
        "allocations": [ { "allocationCid": "<seller's bond allocation>", "extraTransferLegSides": [], "nextIterationFunding": null },
                         { "allocationCid": "<buyer's bond allocation>", "extraTransferLegSides": [], "nextIterationFunding": null } ],
        "actors": [ "Agent::1220..." ],
        "extraArgs": { "context": { "values": {} }, "meta": { "values": {} } } } } },
    { "ExerciseCommand": { "...": "the same at the bank's factory, for the cash leg" } } ],
  "commandId": "settle-1",
  "userId": "settlement-app",
  "actAs": [ "Agent::1220..." ]
}
```

Each registry settles only if the allocations authorize exactly both sides of each of its legs, and only for the settlement's executors. Until then the agent can cancel an allocation (`Allocation_Cancel`) and its owner can withdraw it (`Allocation_Withdraw`). These requests were run against a Canton 3.5 participant.

AryaFi's `TokenDvpInstruction` (`#aryafi-core:AryaFi.Finance.TokenDvp:TokenDvpInstruction`) does this for a settlement agent. The agent creates it alone and exercises `RequestTokenDvpAllocations`; seller and buyer then see an allocation request (`#splice-api-token-allocation-request-v2:Splice.Api.Token.AllocationRequestV2:AllocationRequest`) listing the allocations to make. `ExecuteTokenDvp` takes one batch per registry (its settlement factory, the allocations made there, and the choice context the registry asks for) and settles them in one transaction. A registry other than AryaFi's, such as Canton Coin's, supplies the choice context and the contracts to disclose through its off-ledger API; pass them in the batch's `extraArgs` and the submission's `disclosedContracts`.

### 6.4 Compliance Evidence

A bank or custodian whose factory has compliance requirements (`SetTransferCompliance`, `SetAllocationCompliance`) evaluates KYC attestations, sanctions attestations, and transfer restriction rules in the transfer, acceptance, or allocation itself. The submitter lists them in the choice context under `aryafi.io/compliance-evidence`, and discloses the ones its participant does not see (a counterparty's attestations, the instrument's rule), as the registry's off-ledger API would supply them:

```json
"extraArgs": {
  "context": { "values": {
    "aryafi.io/compliance-evidence": { "tag": "AV_List", "value": [
      { "tag": "AV_ContractId", "value": "<sender's KYC attestation>" },
      { "tag": "AV_ContractId", "value": "<sender's sanctions attestation>" },
      { "tag": "AV_ContractId", "value": "<receiver's KYC attestation>" },
      { "tag": "AV_ContractId", "value": "<receiver's sanctions attestation>" },
      { "tag": "AV_ContractId", "value": "<the bond's transfer restriction rule>" },
      { "tag": "AV_ContractId", "value": "<the bond's ownership restriction>" } ] } } },
  "meta": { "values": {} } }
```

with each contract the submitter cannot see in the submission's `disclosedContracts` (its template ID, contract ID, and `createdEventBlob`, which the authority or registry reads from its own participant). A refused transfer or allocation is not an error: the result is `TransferInstructionResult_Failed` or `AllocationInstructionResult_Failed`, no holdings are spent or locked, and the reason is in the result's `meta` under `aryafi.io/compliance-refusal`, for example `SANCTIONED: OFAC-SDN`, `JURISDICTION_NOT_PERMITTED: KP`, or `NO_KYC_ATTESTATION for <party>`. The decision is also recorded as an `AuditLog` (`#aryafi-core:AryaFi.Common.Events:AuditLog`) for the registry and the submitter. The Daml Script tests (`ComplianceGateTest`, `runComplianceAcrossNodes`) make these calls; the JSON form above follows from the Daml types.

---

## 7. Concrete Client Implementation (TypeScript)

The following reference implementation exercises `SplitCash` through the Canton 3.5 JSON Ledger API. Idempotency comes from the **command ID**: it is derived from the caller's idempotency key, so a retry of the same business request reuses the same command ID and the ledger rejects the duplicate within the deduplication period.

The choice result is read from the transaction: `submit-and-wait-for-transaction` with the ledger-effects shape returns the `ExercisedEvent`, whose `exerciseResult` is the pair of new contract IDs.

```typescript
export interface SplitCashRequest {
  cashCid: string;
  splitAmount: string;      // Daml Decimal as a string, e.g. "4975000.00", to avoid float rounding
  ownerParty: string;       // full party ID, e.g. "DealerBankB::1220..."
  idempotencyKey: string;   // stable per business request, e.g. the upstream MsgId
}

export class AryaFiLedgerClient {
  constructor(private endpoint: string, private userId: string, private jwtToken?: string) {}

  /**
   * Exercises SplitCash. Retries with the same idempotencyKey are deduplicated by the
   * ledger because they carry the same commandId.
   */
  async splitCashPosition(req: SplitCashRequest): Promise<{ splitCid: string; remainderCid: string }> {
    const body = {
      commands: {
        commands: [{
          ExerciseCommand: {
            templateId: "#aryafi-core:AryaFi.Finance.Cash:CashPosition",
            contractId: req.cashCid,
            choice: "SplitCash",
            choiceArgument: { splitAmount: req.splitAmount }
          }
        }],
        commandId: `aryafi-split-${req.idempotencyKey}`,
        userId: this.userId,
        actAs: [req.ownerParty],
        deduplicationPeriod: { DeduplicationDuration: { value: { seconds: 86400, nanos: 0 } } }
      },
      transactionFormat: {
        transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
        eventFormat: { filtersByParty: { [req.ownerParty]: {} }, verbose: false }
      }
    };

    const response = await fetch(`${this.endpoint}/v2/commands/submit-and-wait-for-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.jwtToken ? { "Authorization": `Bearer ${this.jwtToken}` } : {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      // A duplicate-command error means an earlier attempt already committed:
      // look the result up by commandId instead of resubmitting.
      throw new Error(`Ledger API submission failed (${response.status}): ${await response.text()}`);
    }

    // SplitCash returns (ContractId CashPosition, ContractId CashPosition): (split, remainder)
    const { transaction } = await response.json();
    const exercised = transaction.events
      .map((e: any) => e.ExercisedEvent)
      .find((e: any) => e && e.choice === "SplitCash");
    return { splitCid: exercised.exerciseResult._1, remainderCid: exercised.exerciseResult._2 };
  }
}
```

---

## 8. Concrete Client Implementation (Python)

Creates a `PaymentInstruction` through the JSON Ledger API. Arguments use the Daml JSON encoding: records for the identifier newtypes, `{"tag", "value"}` for variants, strings for `Decimal`, and `null` for an empty `Optional`.

```python
import requests

class AryaFiPythonClient:
    def __init__(self, endpoint: str, user_id: str, token: str | None = None):
        self.endpoint = endpoint          # e.g. "http://localhost:10013"
        self.user_id = user_id
        self.headers = {"Content-Type": "application/json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def create_payment_instruction(self, payer: str, payee: str, agent: str,
                                   payer_acct: str, payee_acct: str,
                                   amount: str, currency: str,
                                   correlation_id: str, idempotency_key: str) -> dict:
        """
        Submits a PaymentInstruction creation. payer, payee, and agent are all
        signatories, so all three must be hosted on this participant.
        """
        body = {
            "commands": [{
                "CreateCommand": {
                    "templateId": "#aryafi-core:AryaFi.Finance.Payment:PaymentInstruction",
                    "createArguments": {
                        "payer": payer,
                        "payee": payee,
                        "settlementAgent": agent,
                        "payerAccountId": {"unAccountId": payer_acct},
                        "payeeAccountId": {"unAccountId": payee_acct},
                        "currency": currency,
                        "amount": amount,  # Decimal as a string, e.g. "12500000.00"
                        "purpose": {"tag": "GeneralPayment", "value": "Treasury intercompany funding"},
                        "obligationRef": None,
                        "correlationId": {"unCorrelationId": correlation_id},
                        "idempotencyKey": {"unIdempotencyKey": idempotency_key},
                        "networkRef": None,
                        "status": {"tag": "PendingSettlement", "value": {}},
                        "observers": [],
                    },
                }
            }],
            # Same business request, same command ID: a retry is deduplicated.
            "commandId": f"aryafi-pay-{idempotency_key}",
            "userId": self.user_id,
            "actAs": [payer, payee, agent],
        }
        resp = requests.post(f"{self.endpoint}/v2/commands/submit-and-wait",
                             json=body, headers=self.headers, timeout=30)
        resp.raise_for_status()
        return resp.json()  # {"updateId": ..., "completionOffset": ...}
```

---

## 9. Error Classification & Recovery Matrix

| Ledger API Status / Error Code | Cause in AryaFi Context | Recommended Client Recovery Action |
|:---|:---|:---|
| `UNAUTHENTICATED (16)` | Expired or invalid JWT token. | Refresh JWT token via OAuth2 / OIDC IdP and retry immediately. |
| `PERMISSION_DENIED (7)` | The user lacks `CanActAs` for a party in `actAs`. | Check the user's rights and party hosting. Do not retry automatically. |
| `INVALID_ARGUMENT (3)` | Malformed command, or `DAML_AUTHORIZATION_ERROR`: a signatory or controller the transaction needs is missing from `actAs`. | Fix the request or the party set. Do not retry unchanged. |
| `FAILED_PRECONDITION (9)` | `DAML_FAILURE`: a Daml `ensure` or `require` check failed (e.g. `amount <= 0.0`, wrong status). | Reject the request upstream at the business layer. Log the validation error. |
| `NOT_FOUND (5)` | Referenced contract ID has already been consumed or archived (contention). | Query the ACS for the current contract ID and retry with it. |
| `ALREADY_EXISTS (6)` | `DUPLICATE_COMMAND` (HTTP 409 on the JSON API): the same change ID was accepted within the deduplication period. | Treat as success; look up the earlier result by `commandId`. |
| `ABORTED (10)` | Contention: another transaction consumed the same contract first. | Exponential backoff (50ms, 100ms, 200ms) with jitter, then re-query the ACS and retry. |
| `RESOURCE_EXHAUSTED (8)` | Rate limit or traffic limit reached on the participant or synchronizer. | Queue commands locally; throttle the outbound rate. |
