# Reference Application: Institutional Treasury & Cash Mobility

## Overview
Demonstrates institutional cash concentration, multi-currency liquidity pooling, cross-border payment orchestration, and liquidity encumbrance management using `CashPosition`, `PaymentInstruction`, and `Account` over Canton Network.

In global banking and enterprise treasury operations, corporate treasurers manage capital across distributed legal entities, correspondent banks, and real-time payment rails. This reference application implements:
- **Multi-Account Topology**: Master treasury and operating subsidiary accounts segregated across legal entities.
- **Liquidity Sweeping & Concentration**: Target balancing and zero-balance sweeping (ZBS) via atomic `SplitCash`, `TransferCash`, and `MergeCash` operations.
- **Tri-Party Payment Instruction Orchestration**: Separation of payment intent (`payer` + `payee`) from operational execution (`settlementAgent`).
- **Payment Network Tracing & Idempotency**: SWIFT UETR / Fedwire IMAD tracking and deduplication keys.
- **Liquidity Staging & Encumbrance**: Scoped lock/unlock mechanics for margin and DvP escrow without broad portfolio freezing.
- **Canton Sub-Transaction Privacy**: Operating subsidiary accounts and intercompany transfers remain private to the transacting parties and account bank, preventing front-running or corporate structure leakage.

---

## Participants

| Party | Role | Description |
|:------|:-----|:------------|
| `TreasuryBank` | Central Cash / Custody Bank | Issues tokenized cash positions, maintains custody accounts, and enforces ledger invariants |
| `GlobalTreasurer` | Enterprise Treasury Head | Oversees enterprise-wide cash pooling, liquidity concentration, and cross-border funding |
| `USSubsidiary` | Operating Entity (US) | Generates USD operational revenue; participates in daily cash sweeping |
| `EUSubsidiary` | Operating Entity (Europe) | Manages EUR-denominated liquidity; executes intercompany funding instructions |
| `SettlementAgent` | Correspondent / Clearing Agent | Operationally clears and settles inter-bank payment instructions across rails (Fedwire, CHIPS, Target2) |
| `SupplierPayee` | Commercial Beneficiary | Counterparty receiving institutional commercial disbursements |
| `TreasuryAuditor` | Audit & Regulatory Authority (Observer) | Receives selective observer visibility for audit trails and liquidity compliance |

---

## Workflow

```
                    ┌──────────────────────────────────────────┐
                    │  Phase 1: Multi-Account Topology Setup   │
                    └──────────────────────────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   v                                           v
    1. Operating Accounts (US & EU)             2. Master Treasury Pool Account
    (Segregated custody at TreasuryBank)        (Omnibus concentration pool)
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         │
                    ┌──────────────────────────────────────────┐
                    │ Phase 2: Cash Concentration & Sweeping   │
                    └──────────────────────────────────────────┘
                                         │
                                         v
                      3. SplitCash (Operating Reserve)
                      (US Subsidiary splits $50M operating balance:
                       $10M retained locally, $40M marked for sweep)
                                         │
                                         v
                      4. TransferCash (Sweeping Leg)
                      (US Subsidiary transfers $40M to Master Treasury)
                                         │
                                         v
                      5. MergeCash (Pool Consolidation)
                      (Master Treasury consolidates $40M sweep into
                       existing corporate pool balance)
                                         │
                    ┌──────────────────────────────────────────┐
                    │  Phase 3: Intercompany / Vendor Payment  │
                    └──────────────────────────────────────────┘
                                         │
                                         v
                      6. PaymentInstruction Origination
                      (Payer + Payee + SettlementAgent tri-party agreement:
                       Unique IdempotencyKey + CorrelationId)
                                         │
                                         v
                      7. AttachNetworkRef
                      (SettlementAgent assigns SWIFT UETR / Fedwire IMAD)
                                         │
                                         v
                      8. ConfirmPaymentSettlement
                      (SettlementAgent marks instruction Settled;
                       Triggers atomic on-ledger cash transfer)
                                         │
                    ┌──────────────────────────────────────────┐
                    │   Phase 4: Liquidity Encumbrance & Escrow│
                    └──────────────────────────────────────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │                                           │
                   v                                           v
      9. LockCash (Margin Staging)                10. UnlockCash (Release)
      (Encumber $15M for DvP escrow                (Release encumbrance once
       with lockReference tag)                      settlement completes)
```

---

## Detailed Step-by-Step Implementation

### 1. Account Setup: Master & Operating Custody
Establish segregated and omnibus accounts at `TreasuryBank`:
```daml
-- Master corporate concentration pool
masterAccountCid <- submitMulti [treasuryBank, globalTreasurer] [] do
  createCmd Account with
    custodian = treasuryBank
    owner = globalTreasurer
    accountId = AccountId "ACC-TREAS-MASTER-001"
    accountType = OmnibusAccount
    currency = "USD"
    isFrozen = False
    observers = [treasuryAuditor]

-- US Subsidiary operating account
usOperatingAccountCid <- submitMulti [treasuryBank, usSubsidiary] [] do
  createCmd Account with
    custodian = treasuryBank
    owner = usSubsidiary
    accountId = AccountId "ACC-US-OPS-001"
    accountType = SegregatedCustody
    currency = "USD"
    isFrozen = False
    observers = []
```

### 2. Operating Cash Provisioning
`TreasuryBank` and `USSubsidiary` hold an active tokenized cash position:
```daml
usCashCid <- submitMulti [treasuryBank, usSubsidiary] [] do
  createCmd CashPosition with
    bank = treasuryBank
    owner = usSubsidiary
    accountId = AccountId "ACC-US-OPS-001"
    currency = "USD"
    amount = 50000000.0 -- $50M initial balance
    isLocked = False
    lockReference = None
    observers = []
```

### 3. Target Balancing: Split Local Reserve from Swept Liquidity
To retain a $10M working capital buffer and sweep the $40M excess, the subsidiary calls `SplitCash`. The total quantity invariant is strictly preserved ($10\text{M} + $40\text{M} = $50\text{M}$):
```daml
(localReserveCid, sweepAmountCid) <- submit usSubsidiary do
  exerciseCmd usCashCid SplitCash with
    splitAmount = 10000000.0 -- $10M stays in operating account
```

### 4. Cash Concentration Sweep to Master Treasury
The $40M sub-position is transferred into the `GlobalTreasurer` concentration account:
```daml
sweptToMasterCid <- submitMulti [usSubsidiary, treasuryBank] [] do
  exerciseCmd sweepAmountCid TransferCash with
    newOwner = globalTreasurer
    newAccountId = AccountId "ACC-TREAS-MASTER-001"
    correlationId = CorrelationId "CORR-SWEEP-2026-09-001"
```

### 5. Pool Consolidation: Merging Cash Positions
`GlobalTreasurer` merges the newly swept position with an existing $100M treasury pool position:
```daml
consolidatedPoolCid <- submit globalTreasurer do
  exerciseCmd existingMasterPoolCid MergeCash with
    otherCid = sweptToMasterCid
```

### 6. Payment Instruction: Tri-Party Agreement with Idempotency
To disburse $12.5M to `SupplierPayee`, `GlobalTreasurer`, `SupplierPayee`, and `SettlementAgent` co-sign a `PaymentInstruction`:
```daml
paymentInstructionCid <- submitMulti [globalTreasurer, supplierPayee, settlementAgent] [] do
  createCmd PaymentInstruction with
    payer = globalTreasurer
    payee = supplierPayee
    settlementAgent = settlementAgent
    payerAccountId = AccountId "ACC-TREAS-MASTER-001"
    payeeAccountId = AccountId "ACC-SUPPLIER-USD-001"
    currency = "USD"
    amount = 12500000.0
    purpose = GeneralPayment "Q3 Institutional Equipment Procurement"
    obligationRef = Some "PO-2026-SUPPLIER-9921"
    correlationId = CorrelationId "CORR-PAY-2026-8831"
    idempotencyKey = IdempotencyKey "IDEMP-2026-09-18-001"
    networkRef = None
    status = PendingSettlement
    observers = [treasuryAuditor]
```

### 7. Network Reference Attachment (SWIFT / Fedwire Tracing)
`SettlementAgent` submits the transfer into the institutional clearing rail and attaches the payment network reference:
```daml
paymentWithRefCid <- submit settlementAgent do
  exerciseCmd paymentInstructionCid AttachNetworkRef with
    ref = PaymentNetworkRef "SWIFT-UETR-e1a49f82-3d92-4f10-bf91-b3b281f9a12c"
```

### 8. Final Settlement Confirmation
Upon confirmation from the payment rail, `SettlementAgent` executes `ConfirmPaymentSettlement`:
```daml
settledPaymentCid <- submit settlementAgent do
  exerciseCmd paymentWithRefCid ConfirmPaymentSettlement
```

### 9. Liquidity Encumbrance & Escrow (Lock / Unlock)
When pledging liquidity for an intraday DvP transaction or clearing margin, positions can be encumbered without removing them from the owner's balance sheet:
```daml
-- 1. Split off $5M for margin requirement
(unencumberedPoolCid, marginStagingCid) <- submit globalTreasurer do
  exerciseCmd consolidatedPoolCid SplitCash with
    splitAmount = 135000000.0 -- Leaves $5M in staging

-- 2. Lock the $5M staging position
lockedMarginCid <- submitMulti [globalTreasurer, treasuryBank] [] do
  exerciseCmd marginStagingCid LockCash with
    lockRef = "ESCROW-DVP-SETTLEMENT-REF-2026-0042"

-- 3. Release lock upon settlement completion
unlockedMarginCid <- submitMulti [globalTreasurer, treasuryBank] [] do
  exerciseCmd lockedMarginCid UnlockCash
```

### 10. Exception Handling: Rejection & Cancellation
If payment criteria fail or the payer cancels prior to execution:
```daml
-- Case A: Settlement Agent rejects due to sanctions or insufficient credit
failedPaymentCid <- submit settlementAgent do
  exerciseCmd pendingPaymentCid RejectPaymentSettlement with
    reason = "Beneficiary account flagged during OFAC Sanctions screening"

-- Case B: Payer cancels before execution
cancelledPaymentCid <- submit globalTreasurer do
  exerciseCmd pendingPaymentCid CancelPayment with
    cancellationReason = "Purchase order duplicate submission"
```

---

## State Machine: PaymentInstruction Lifecycle

```
                           ┌─────────────────────────┐
                           │    Payment Created      │
                           │  (Status: Pending)      │
                           └────────────┬────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
                 v                      v                      v
     [SettlementAgent confirms]  [SettlementAgent rejects] [Payer cancels]
                 │                      │                      │
                 v                      v                      v
        ┌─────────────────┐   ┌───────────────────┐  ┌───────────────────┐
        │     Settled     │   │   Failed (Reason) │  │ Cancelled (Reason)│
        └─────────────────┘   └───────────────────┘  └───────────────────┘
```

---

## State Machine: CashPosition Management

```
       ┌────────────────┐     SplitCash      ┌────────────────┐
       │                ├───────────────────>│ Sub-Position A │
       │  CashPosition  │                    └────────────────┘
       │  (Available)   │     SplitCash      ┌────────────────┐
       │                ├───────────────────>│ Sub-Position B │
       └───────┬────────┘                    └────────┬───────┘
               │                                      │
               │ TransferCash                         │ MergeCash (with C)
               v                                      v
       ┌────────────────┐                    ┌────────────────┐
       │ New Owner/Acct │                    │ Combined Pool  │
       └────────────────┘                    └────────────────┘
               │
               │ LockCash (owner + bank)
               v
       ┌────────────────┐
       │  CashPosition  │
       │    (Locked)    │
       └───────┬────────┘
               │ UnlockCash (owner + bank)
               v
       ┌────────────────┐
       │  CashPosition  │
       │  (Available)   │
       └────────────────┘
```

---

## Key Invariants & Design Patterns

1. **Strict Balance Preservation (Conservation of Value)**:
   $$\sum_{i} \text{Output Position Amounts} = \sum_{j} \text{Input Position Amounts}$$
   - `SplitCash` enforces $A_{1} + A_{2} = A_{\text{total}}$ with $A_{1} > 0$ and $A_{2} > 0$.
   - `MergeCash` archives the incoming contract and adds its balance to the destination position with strict bank, owner, account, and currency equality checks.

2. **Separation of Intent and Settlement Execution**:
   - `PaymentInstruction` isolates the multi-party contract creation (`payer`, `payee`, `settlementAgent`) from the operational settlement trigger (`ConfirmPaymentSettlement`). This accommodates real-world batching, RTGS netting cycles, and cross-border cutoffs.

3. **Dual-Signatory Encumbrance**:
   - Neither the owner nor the bank can unilaterally freeze or unlock cash. `LockCash` and `UnlockCash` require co-authorization from both parties, protecting corporate clients against arbitrary freezes while guaranteeing banks legal enforceability during margin pledge.

4. **Idempotency & Audit Traceability**:
   - Every `PaymentInstruction` carries an `IdempotencyKey` to eliminate double-disbursement risks in automated ERP integrations.
   - `PaymentNetworkRef` bridges on-ledger smart contracts with legacy SWIFT (ISO 20022 UETR) and Fedwire networks.

---

## Canton Sub-Transaction Privacy

The multi-entity structure leverages Canton's fine-grained data isolation:
- **Subsidiary Confidentiality**: `USSubsidiary` and `EUSubsidiary` operating accounts are visible only to the respective operating entity and `TreasuryBank`. Neither subsidiary sees the other's operational liquidity or individual vendor disbursements.
- **Master Pool Isolation**: External vendors and counterparty banks only observe `PaymentInstruction` contracts to which they are signatories or explicit observers. They cannot inspect corporate liquidity reserves held in `ACC-TREAS-MASTER-001`.
- **Regulatory Audit Scoping**: Regulatory and audit observers (`TreasuryAuditor`) can be attached via `AddPaymentObserver` to specific payment contracts or accounts for compliance monitoring without exposing unrelated corporate treasury operations.
