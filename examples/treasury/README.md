# Reference Application: Institutional Treasury & Cash Mobility

## Overview
Demonstrates enterprise multi-currency liquidity pooling, concentration sweeps, intercompany netting, liquidity encumbrance, and payment clearing across distributed ledger accounts over Canton Network.

In global banking and enterprise treasury operations, corporate treasurers manage capital across distributed legal entities, correspondent banks, and real-time payment rails. This reference application implements:
- **Multi-Account Topology**: Master concentration pool and operating subsidiary accounts segregated across legal entities.
- **Liquidity Sweeping & Concentration**: Target balancing and zero-balance sweeping (ZBS) via atomic `SplitCash`, `TransferCash`, and `MergeCash` operations without ledger re-issuance.
- **Intercompany Payment Clearing & Cash Locking**: Staging liquidity through dual-signatory `LockCash` / `UnlockCash` and atomic payment execution.
- **Canton Sub-Transaction Privacy**: Operating subsidiary accounts and internal sweeps remain private to the transacting entities and bank, preventing corporate structure or liquidity leakage.

---

## Participants

| Party | Role | Description |
|:------|:-----|:------------|
| `GlobalBank` | Cash Custody & Transaction Bank | Issues tokenized cash positions, maintains custody accounts, and enforces ledger invariants |
| `TreasuryHQ` | Corporate Global Treasury Center | Oversees enterprise-wide cash pooling, liquidity concentration, and cross-border funding |
| `SubUS` | US Operating Subsidiary | Generates USD operational revenue; executes daily cash sweeping and funding |
| `SubEU` | European Operating Subsidiary | Manages EUR-denominated liquidity with sub-transaction privacy |
| `Regulator` | Central Bank / Regulatory Authority | Receives certified transaction audit trails without access to proprietary commercial data |

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
    1. Operating Accounts (SubUS [USD] & SubEU [EUR])  2. TreasuryHQ Master Pool
    (Segregated custody at GlobalBank)                 (Concentration account)
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         │
                    ┌──────────────────────────────────────────┐
                    │ Phase 2: Cash Concentration & Sweeping   │
                    └──────────────────────────────────────────┘
                                         │
                                         v
                      3. SplitCash (Surplus Identification)
                      (SubUS splits 25M USD operating balance:
                       10M retained locally, 15M marked for sweep)
                                         │
                                         v
                      4. TransferCash (Sweeping Leg)
                      (SubUS sweeps 15M USD surplus to TreasuryHQ pool)
                                         │
                                         v
                      5. MergeCash (Pool Consolidation)
                      (TreasuryHQ merges 15M sweep into existing 10M pool
                       -> 25M Total Concentration Balance)
                                         │
                    ┌──────────────────────────────────────────┐
                    │  Phase 3: Intercompany Funding & Locking │
                    └──────────────────────────────────────────┘
                                         │
                                         v
                      6. PaymentInstruction Origination
                      (TreasuryHQ issues 8M USD PaymentInstruction
                       for targeted entity funding)
                                         │
                                         v
                      7. Split & Lock Cash (Liquidity Staging)
                      (TreasuryHQ splits 8M from concentration pool
                       and locks position with payment reference)
                                         │
                                         v
                      8. Payment Execution & Settlement
                      (GlobalBank clears payment; cash is unlocked
                       and transferred atomically to SubUS)
```

---

## Detailed Step-by-Step Implementation

### 1. Multi-Currency Cash Position Setup
Operating entities and corporate treasury center hold tokenized cash positions with custody banks:
```daml
-- SubUS funded with 25M USD
subUsCashCid <- submitMulti [globalBank, subUS] [] do
  createCmd CashPosition with
    bank = globalBank
    accountId = usAccount
    owner = subUS
    currency = "USD"
    amount = 25000000.0
    isLocked = False
    lockRef = None
    observers = [treasuryHQ, regulator]

-- SubEU funded with 20M EUR
subEuCashCid <- submitMulti [globalBank, subEU] [] do
  createCmd CashPosition with
    bank = globalBank
    accountId = euAccount
    owner = subEU
    currency = "EUR"
    amount = 20000000.0
    isLocked = False
    lockRef = None
    observers = [treasuryHQ, regulator]

-- TreasuryHQ funded with 10M USD base concentration cash
hqCashCid <- submitMulti [globalBank, treasuryHQ] [] do
  createCmd CashPosition with
    bank = globalBank
    accountId = hqAccount
    owner = treasuryHQ
    currency = "USD"
    amount = 10000000.0
    isLocked = False
    lockRef = None
    observers = [regulator]
```

### 2. End-of-Day Concentration Sweeping
Operating entities identify excess operating cash and split it atomically without ledger re-issuance:
```daml
-- Split 15M surplus from working capital (10M retained locally)
(subUsWorkingCid, subUsSweepCid) <- submit subUS do
  exerciseCmd subUsCashCid SplitCash with
    splitAmount = 15000000.0

-- Sweep surplus to TreasuryHQ concentration account
sweptHqCid <- submitMulti [subUS, globalBank] [] do
  exerciseCmd subUsSweepCid TransferCash with
    newOwner = treasuryHQ
    newAccountId = hqAccount
    correlationId = CorrelationId "SWEEP-US-TO-HQ-001"

-- TreasuryHQ consolidates swept cash into single master pool (15M + 10M = 25M)
mergedHqCid <- submit treasuryHQ do
  exerciseCmd hqCashCid MergeCash with
    otherCid = sweptHqCid
```

### 3. Intercompany Payment Clearing & Cash Locking
Corporate treasury funds cross-border entity operations through targeted payments with cash locking:
```daml
-- 1. Initiate formal payment instruction
paymentInstructionCid <- submit treasuryHQ do
  createCmd PaymentInstruction with
    instructionId = "PAY-INTERCOMPANY-001"
    sender = treasuryHQ
    receiver = subUS
    senderAccountId = hqAccount
    receiverAccountId = usAccount
    currency = "USD"
    amount = 8000000.0
    settlementDate = cutOffTime
    status = PaymentPending
    correlationId = CorrelationId "CORR-PAY-001"
    observers = [globalBank, regulator]

-- 2. Split 8M from concentration pool for payment funding
(hqRemainingCid, hqPaymentCashCid) <- submit treasuryHQ do
  exerciseCmd mergedHqCid SplitCash with
    splitAmount = 8000000.0

-- 3. Lock allocated cash prior to settlement execution
lockedPaymentCashCid <- submitMulti [treasuryHQ, globalBank] [] do
  exerciseCmd hqPaymentCashCid LockCash with
    lockReference = "LOCK-PAY-INTERCOMPANY-001"

-- 4. Unlock and execute payment transfer to SubUS
unlockedPaymentCashCid <- submit treasuryHQ do
  exerciseCmd lockedPaymentCashCid UnlockCash

paidToSubUsCid <- submitMulti [treasuryHQ, globalBank] [] do
  exerciseCmd unlockedPaymentCashCid TransferCash with
    newOwner = subUS
    newAccountId = usAccount
    correlationId = CorrelationId "CORR-PAY-001"

-- 5. Bank executes payment clearing and marks instruction settled
settledPaymentCid <- submit globalBank do
  exerciseCmd paymentInstructionCid ExecutePayment with
    settlementTime = cutOffTime
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
     [GlobalBank settles]      [GlobalBank rejects]      [Payer cancels]
                 │                      │                      │
                 v                      v                      v
        ┌─────────────────┐   ┌───────────────────┐  ┌───────────────────┐
        │ PaymentSettled  │   │   Failed (Reason) │  │ Cancelled (Reason)│
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
   - `PaymentInstruction` isolates the payment instruction creation from the operational execution and clearing trigger (`ExecutePayment`), accommodating real-world batching, RTGS netting cycles, and cutoff schedules.

3. **Dual-Signatory Encumbrance**:
   - Neither the owner nor the bank can unilaterally freeze or unlock cash. `LockCash` and `UnlockCash` require co-authorization from both parties, protecting corporate clients against arbitrary freezes while guaranteeing banks legal enforceability during staging.

4. **Idempotency & Audit Traceability**:
   - Every `PaymentInstruction` carries unique identifiers and `CorrelationId` to eliminate double-disbursement risks in automated ERP integrations and track multi-leg flows.

---

## Canton Privacy Model for Enterprise Treasury

- **Intercompany Confidentiality**: European operating entities (`SubEU`) cannot see US operating entity (`SubUS`) cash balances or internal sweeps.
- **Treasury Aggregation**: `TreasuryHQ` has observer permission over operating cash pools to calculate global consolidated liquidity in real time without exposing individual vendor payments.
- **Regulatory Visibility**: Central banks and regulatory observers receive certified transaction audit trails without access to proprietary commercial data.

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
daml test --test-pattern TreasuryCashScenario
```
*Implemented in [TreasuryCashScenario.daml](file:///Users/pankaj/Desktop/DAML%20Projects/aryafi-core/daml/src/AryaFi/Test/Scenarios/TreasuryCashScenario.daml).*
