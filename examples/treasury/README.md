# Reference Application: Institutional Treasury & Cash Mobility

## Overview
Demonstrates enterprise multi-currency liquidity pooling, concentration sweeps, intercompany netting, liquidity encumbrance, and payment clearing across distributed ledger accounts over Canton Network.

In global banking and enterprise treasury operations, corporate treasurers manage capital across distributed legal entities, correspondent banks, and real-time payment rails. This reference application implements:
- **Multi-Account Topology**: Master concentration pool and operating subsidiary accounts segregated across legal entities.
- **Liquidity Sweeping & Concentration**: Target balancing and zero-balance sweeping (ZBS) via atomic `SplitCash`, `TransferCash`, and `MergeCash` operations without ledger re-issuance.
- **Intercompany Payment Clearing & Cash Locking**: Earmarking liquidity by locking it to the settlement bank (`LockCash` with a lock holder), which then delivers it (`SettleLockedCash`) and confirms the `PaymentInstruction`.
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
                      (TreasuryHQ, SubUS, and GlobalBank co-sign an
                       8M USD PaymentInstruction)
                                         │
                                         v
                      7. Split & Lock Cash (Liquidity Staging)
                      (TreasuryHQ splits 8M from concentration pool
                       and locks it to GlobalBank as lock holder)
                                         │
                                         v
                      8. Payment Execution & Settlement
                      (GlobalBank delivers the locked cash to SubUS
                       and confirms the payment as Settled)
```

---

## Detailed Step-by-Step Implementation

The snippets below are taken from [TreasuryCashScenario.daml](../../daml/src/AryaFi/Test/Scenarios/TreasuryCashScenario.daml), which runs as part of `daml test`.

### 1. Multi-Currency Cash Position Setup
Operating entities and the treasury center hold tokenized cash positions issued by the transaction bank:
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
    lockReference = None
    lockHolder = None
    observers = [treasuryHQ, regulator]
```
SubEU (20M EUR) and TreasuryHQ (10M USD) are funded the same way.

### 2. Surplus Identification & Concentration Sweep
```daml
-- SplitCash returns (split amount, remainder): 15M to sweep, 10M retained
(subUsSweepCid, subUsWorkingCid) <- submit subUS do
  exerciseCmd subUsCashCid SplitCash with
    splitAmount = 15000000.0

-- Sender, bank, and receiver all authorize the transfer; observers are cleared
sweptHqCid <- submitMulti [subUS, globalBank, treasuryHQ] [] do
  exerciseCmd subUsSweepCid TransferCash with
    newOwner = treasuryHQ
    newAccountId = hqAccount
    correlationId = CorrelationId "SWEEP-US-TO-HQ-001"

-- TreasuryHQ consolidates the 25M pool
mergedHqCid <- submit treasuryHQ do
  exerciseCmd hqCashCid MergeCash with
    otherCid = sweptHqCid
```

### 3. Intercompany Payment Clearing
```daml
-- Payer, payee, and settlement agent co-sign the payment instruction
paymentInstructionCid <- submitMulti [treasuryHQ, subUS, globalBank] [] do
  createCmd PaymentInstruction with
    payer = treasuryHQ
    payee = subUS
    settlementAgent = globalBank
    payerAccountId = hqAccount
    payeeAccountId = usAccount
    currency = "USD"
    amount = 8000000.0
    purpose = GeneralPayment "Intercompany supplier funding"
    obligationRef = None
    correlationId = CorrelationId "CORR-PAY-001"
    idempotencyKey = IdempotencyKey "IDEMP-PAY-INTERCOMPANY-001"
    networkRef = None
    status = PendingSettlement
    observers = [regulator]

-- HQ earmarks 8M and locks it to the bank; HQ can no longer withdraw it
(hqPaymentCashCid, hqRemainingCid) <- submit treasuryHQ do
  exerciseCmd mergedHqCid SplitCash with splitAmount = 8000000.0
lockedPaymentCashCid <- submitMulti [treasuryHQ, globalBank] [] do
  exerciseCmd hqPaymentCashCid LockCash with
    lockRef = "LOCK-PAY-INTERCOMPANY-001"
    holder = globalBank

-- The bank, as lock holder, delivers the cash to SubUS and confirms settlement
paidToSubUsCid <- submitMulti [globalBank, subUS] [] do
  exerciseCmd lockedPaymentCashCid SettleLockedCash with
    newOwner = subUS
    newAccountId = usAccount
settledPaymentCid <- submit globalBank do
  exerciseCmd paymentInstructionCid ConfirmPaymentSettlement
```

### 4. Privacy Verification
```daml
-- SubUS sees neither SubEU's EUR position nor HQ's remaining pool
euFromUs <- queryContractId subUS subEuCashCid
assertMsg "SubUS cannot see SubEU's EUR position" (euFromUs == None)
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
               │ LockCash (owner + bank, naming a lock holder)
               v
       ┌────────────────┐  SettleLockedCash   ┌────────────────┐
       │  CashPosition  ├────────────────────>│ Receiver owns  │
       │    (Locked)    │ (lock holder +      │  (Available)   │
       └───────┬────────┘   receiver)         └────────────────┘
               │ UnlockCash (lock holder only)
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
   - `PaymentInstruction` records the agreed payment; the settlement agent confirms it (`ConfirmPaymentSettlement`) or rejects it with a reason. The cash itself moves through the lock-holder flow in step 3.

3. **Lock-Holder Encumbrance**:
   - Neither owner nor bank can lock cash alone: `LockCash` needs both and names a lock holder. From then on only the lock holder can release the cash (`UnlockCash`) or deliver it to a receiver who co-authorizes (`SettleLockedCash`), so earmarked liquidity cannot be withdrawn mid-payment.

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
daml test --files daml/src/AryaFi/Test/Scenarios/TreasuryCashScenario.daml
```
*Implemented in [TreasuryCashScenario.daml](../../daml/src/AryaFi/Test/Scenarios/TreasuryCashScenario.daml).*
