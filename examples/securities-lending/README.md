# Reference Application: Institutional Securities Lending

## Overview
Demonstrates institutional stock loan and bond borrowing lifecycle management with tri-party custody, borrow fee accrual, mark-to-market collateral revaluation, formal recall execution, and default enforcement over Canton Network.

This reference application exercises the AryaFi Securities Lending module through a realistic bilateral lending workflow between a beneficial owner (pension fund / asset manager) and a borrower (broker-dealer), with full collateral management and fee servicing.

## Participants

| Party | Role | Description |
|:------|:-----|:------------|
| BeneficialOwner | Lender / Beneficial Owner | Pension fund or asset manager lending securities from portfolio for fee income |
| BorrowerDealer | Borrower / Broker-Dealer | Broker-dealer borrowing securities for short sale coverage or settlement needs |
| LendingCustodian | Tri-Party Custodian | Safekeeps lent securities and manages posted collateral |
| AgentLender | Agent Lender (Observer) | Securities lending intermediary with visibility into the arrangement |
| Regulator | Regulatory Authority (Observer) | Receives observer visibility for supervisory monitoring |

## Workflow

```
                    ┌──────────────────────────────────────────┐
                    │  Phase 1: Trade Inception & Collateral   │
                    └──────────────────────────────────────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  │                                            │
                  v                                            v
  1. SecuritiesLendingAgreement              2. AssetPledge (Cash Collateral)
  (Lender + Borrower + Custodian             (Borrower posts 102% of MV)
   co-sign tri-party agreement)
                  │                                            │
                  └─────────────────────┼─────────────────────┘
                                        │
                    ┌──────────────────────────────────────────┐
                    │  Phase 2: Ongoing Fee Accrual & Service  │
                    └──────────────────────────────────────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  │                                            │
                  v                                            v
  3. AccrueLendingFee                        4. PayLendingFee
  (Lender accrues periodic                  (Borrower settles accrued
   borrow fees: Qty × Rate × Days/360)       fee balance via cash payment)
                  │                                            │
                  └─────────────────────┼─────────────────────┘
                                        │
                    ┌──────────────────────────────────────────┐
                    │  Phase 3: Mark-to-Market Revaluation     │
                    └──────────────────────────────────────────┘
                                        │
                                        v
                         5. RevalueCollateral
                         (Bilateral agreement on new
                          collateral value after MtM)
                                        │
                    ┌──────────────────────────────────────────┐
                    │  Phase 4: Recall & Return                │
                    └──────────────────────────────────────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  │                                            │
                  v                                            v
  6. RecallSecurities                        7. ReturnSecurities
  (Lender issues formal recall               (Borrower returns recalled
   with contractual deadline)                 securities + pro-rata release)
                  │                                            │
                  └─────────────────────┼─────────────────────┘
                                        │
                    ┌──────────────────────────────────────────┐
                    │  Phase 5: Full Close-Out                 │
                    └──────────────────────────────────────────┘
                                        │
                                        v
                  8. ReturnSecurities (remaining balance)
                  → Auto-transition to LendingClosed
                  → Collateral pledge released
```

### 1. Trade Inception: Securities Lending Agreement
Beneficial Owner lends 5M face value US Treasuries to Broker-Dealer at 75 bps annual borrow fee with 102% cash collateral:
```daml
lendingCid <- submitMulti [beneficialOwner, borrowerDealer, lendingCustodian] [] do
  createCmd SecuritiesLendingAgreement with
    lendingId = "SECLEND-2026-001"
    lender = beneficialOwner
    borrower = borrowerDealer
    custodian = lendingCustodian
    isin = "US912828ZM50"
    borrowedQuantity = 5000000.0
    borrowAccountId = AccountId "ACC-DEALER-BORROW-001"
    lendingFeeRate = 0.0075
    rebateRate = 0.005
    collateralCurrency = "USD"
    collateralAmount = 5100000.0
    collateralPledgeRef = None
    accruedLendingFee = 0.0
    startDate = now
    status = LendingActive
    correlationId = CorrelationId "CORR-SECLEND-2026-001"
    observers = [agentLender]
```

### 2. Collateral Pledge
Borrower posts cash collateral under tri-party custody arrangement:
```daml
pledgeCid <- submitMulti [borrowerDealer, beneficialOwner, lendingCustodian] [] do
  createCmd AssetPledge with
    pledgeId = "PLEDGE-SECLEND-001"
    pledgor = borrowerDealer
    pledgee = beneficialOwner
    custodian = lendingCustodian
    accountId = AccountId "ACC-COLL-DEALER-001"
    assetId = "CASH-USD-5100000"
    quantity = 5100000.0
    perfectionReference = "SECLEND-COLL-REF-001"
    correlationId = CorrelationId "CORR-SECLEND-2026-001"
    status = Active
    ...
```

### 3. Borrow Fee Accrual & Settlement
Both counterparties agree each period's fee (Act/360 convention), and the lender confirms payment, so neither side can change what the borrower owes on its own:
```daml
-- Lender and borrower agree the 30-day borrow fee: 5M × 0.0075 × 30/360 = 3,125 USD
accruedCid <- submitMulti [beneficialOwner, borrowerDealer] [] do
  exerciseCmd lendingCid AccrueLendingFee with
    additionalFee = 3125.0

-- Lender confirms receipt of the fee payment
feesPaidCid <- submit beneficialOwner do
  exerciseCmd accruedCid PayLendingFee with
    paymentAmount = 3125.0
```

### 4. Mark-to-Market Collateral Revaluation
When the underlying security's market value changes, both parties agree to adjust collateral:
```daml
-- Bilateral agreement on updated collateral value
revaluedCid <- submitMulti [beneficialOwner, borrowerDealer] [] do
  exerciseCmd feesPaidCid RevalueCollateral with
    newCollateralAmount = 5200000.0
```

### 5. Recall & Partial Return
Lender can issue a formal recall for some or all lent securities with a contractual deadline:
```daml
-- Lender issues recall for 2M of the 5M lent securities
recalledCid <- submit beneficialOwner do
  exerciseCmd revaluedCid RecallSecurities with
    recallQuantity = 2000000.0
    deadline = recallDeadline

-- Borrower returns 2M with pro-rata collateral release.
-- Pro-rata: 5.2M * (2M / 5M) = 2,080,000 USD. Releasing more than the pro-rata share
-- is rejected; a partial return under recall keeps the rest of the recall in force.
returnedCid <- submit borrowerDealer do
  exerciseCmd recalledCid ReturnSecurities with
    returnedQuantity = 2000000.0
    collateralReleaseAmount = 2080000.0
```

### 6. Full Close-Out & Default Path
```daml
-- Borrower returns remaining 3M → borrowed quantity is exactly 0 and, with no fees
-- outstanding, the agreement auto-closes
closedCid <- submit borrowerDealer do
  exerciseCmd feesPaidCid2 ReturnSecurities with
    returnedQuantity = 3000000.0
    collateralReleaseAmount = 3120000.0

-- Alternative: lender declares default if borrower fails to return
defaultedCid <- submit beneficialOwner do
  exerciseCmd recalledCid DeclareSecLendingDefault with
    reason = "FAILURE_TO_RETURN_RECALLED_SECURITIES"
```

## Contract State Machine

```
                    ┌───────────────┐
                    │ LendingActive │
                    └───────┬───────┘
                            │
           ┌────────────────┼─────────────────┐
           │                │                  │
           v                v                  v
  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
  │ LendingRecallIssued│  │ LendingClosed│  │ LendingDefaulted │
  │ (qty, deadline)  │  │  (all returned│  │ (reason text)    │
  └────────┬─────────┘  │   + fees paid)│  └──────────────────┘
           │            └──────────────┘
           │                   ▲
           └───────────────────┘
           (ReturnSecurities
            → if all returned + fees = 0)
```

## Key Design Patterns

| Pattern | Description |
|:--------|:------------|
| **Tri-Party Custody** | Lender + Borrower + Custodian co-sign all agreements |
| **Fee Accrual / Servicing** | Periodic fee calculation with Act/360 day count convention |
| **Mark-to-Market Revaluation** | Bilateral collateral adjustment based on market movements |
| **Partial Recall / Return** | Granular control over partial returns with pro-rata collateral release |
| **Auto-Close on Full Return** | Agreement automatically transitions to `LendingClosed` when all securities returned and fees settled |
| **Default Enforcement** | Lender can declare default upon failure to satisfy recall deadline |
| **Observer-Based Privacy** | Agent lenders and regulators added as observers, not signatories |

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
daml test --files daml/src/AryaFi/Test/Scenarios/SecuritiesLendingScenario.daml
```
*Implemented in [SecuritiesLendingScenario.daml](../../daml/src/AryaFi/Test/Scenarios/SecuritiesLendingScenario.daml).*
