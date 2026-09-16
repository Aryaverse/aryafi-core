# Reference Application: Institutional Treasury & Cash Mobility

## Overview
Demonstrates enterprise multi-currency liquidity pooling, concentration sweeps, intercompany netting, and payment clearing across distributed ledger accounts over Canton Network.

## Workflow

```
       1. Multi-Entity / Multi-Currency Account Architecture
          (SubUS [USD] | SubEU [EUR] | TreasuryHQ [Concentration USD])
                               |
                               v
       2. End-of-Day Surplus Identification & Split
          (SubUS splits 15M USD surplus from operating working capital)
                               |
                               v
       3. Concentration Sweeping & Pool Consolidation
          (SubUS sweeps 15M -> TreasuryHQ merges with base pool -> 25M Total Pool)
                               |
                               v
       4. Cross-Border Intercompany Funding & Payment Clearing
          (TreasuryHQ creates 8M USD PaymentInstruction -> Locks cash -> Bank clears)
                               |
                               v
       5. Real-Time Settlement & Scoped Audit Trails
          (Central bank and corporate regulators observe; entities maintain sub-transaction privacy)
```

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

-- TreasuryHQ consolidates swept cash into single master pool
mergedHqCid <- submit treasuryHQ do
  exerciseCmd hqCashCid MergeCash with
    otherCid = sweptHqCid
```

### 3. Intercompany Payment Clearing & Cash Locking
Corporate treasury funds cross-border entity operations through targeted payments with cash locking:
```daml
-- Initiate formal payment instruction
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

-- Lock allocated cash prior to settlement execution
lockedPaymentCashCid <- submitMulti [treasuryHQ, globalBank] [] do
  exerciseCmd hqPaymentCashCid LockCash with
    lockReference = "LOCK-PAY-INTERCOMPANY-001"

-- Bank executes payment clearing and transfers funds
settledPaymentCid <- submit globalBank do
  exerciseCmd paymentInstructionCid ExecutePayment with
    settlementTime = cutOffTime
```

---

## Canton Privacy Model for Enterprise Treasury
- **Intercompany Confidentiality:** European operating entities cannot see US operating entity cash balances or internal sweeps.
- **Treasury Aggregation:** TreasuryHQ has observer permission over all operating cash pools to calculate global consolidated liquidity in real time.
- **Regulatory Visibility:** Central banks and regulatory observers receive certified transaction audit trails without access to proprietary commercial data.

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
daml test --test-pattern TreasuryCashScenario
```
*Implemented in [TreasuryCashScenario.daml](file:///Users/pankaj/Desktop/DAML%20Projects/aryafi-core/daml/src/AryaFi/Test/Scenarios/TreasuryCashScenario.daml).*
