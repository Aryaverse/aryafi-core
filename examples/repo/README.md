# Reference Application: Institutional Repo & Margin Management

## Overview
Demonstrates bilateral and tri-party repurchase agreement (Repo) lifecycle management with collateral margin allocation, mark-to-market revaluation, variation margin calls, collateral substitution, and maturity closeout over Canton Network.

## Workflow

```
       1. Trade Agreement & DvP Opening Settlement
          (Seller + Buyer + Custodian execute opening leg)
               |
               v
       2. Mark-to-Market Valuation & Margin Call
          (Collateral revalued; Margin deficit detected; Variation margin served)
               |
               v
       3. Margin Satisfaction
          (Seller satisfies margin via cash Fedwire or collateral pledge)
               |
               v
       4. Dynamic Collateral Substitution (Optional)
          (Seller swaps out collateral with equivalent eligible securities)
               |
               v
       5. Maturity Closing Leg DvP & Closeout
          (Repurchase cash delivered -> Collateral returned -> RepoSettled)
```

### 1. Repo Agreement Creation & Opening DvP Leg
Primary Dealer A (Seller) and Institutional Investor B (Buyer) agree on a 14-day repo with 10M US Treasuries at a 2% haircut and 5.25% repo rate:
```daml
repoCid <- submitMulti [seller, buyer, custodian] [] do
  createCmd RepoAgreement with
    repoId = "REPO-2026-GS-BLK-001"
    seller = seller
    buyer = buyer
    tripartyAgent = Some triparty
    custodian = custodian
    isin = "US912828ZM50"
    collateralQuantity = 10000000.0
    collateralAccountId = AccountId "ACC-TRI-PARTY-01"
    haircut = 0.02
    currency = "USD"
    purchasePrice = 9800000.0
    repurchasePrice = 9820008.33
    repoRate = 0.0525
    dayCountConvention = Act360
    startDate = now
    endDate = repoEndDate
    status = RepoPendingOpening
    openingSettlementRef = None
    closingSettlementRef = None
    correlationId = CorrelationId "CORR-REPO-TRADESTORE-001"
    observers = [regulator]

-- Custodian executes opening leg
repoCidActive <- submit custodian do
  exerciseCmd repoCid ExecuteOpeningLeg with
    settlementRef = "SETTLE-OPEN-DVP-001"
```

### 2. Mark-to-Market Valuation & Variation Margin Call
When collateral market price drops, the buyer's book entry (`ReverseRepoPosition`) detects a margin deficit:
```daml
-- Collateral drops from 10.0M to 9.6M
revPosCidUpdated <- submit buyer do
  exerciseCmd revPosCid UpdateMarkToMarket with
    newMarketValue = 9600000.0

-- Buyer detects deficit of 396,000 USD (Required = 9.8M * 1.02 = 9.996M)
deficit <- submit buyer do
  exerciseCmd revPosCidUpdated CalculateMarginDeficit with
    requiredMarginRatio = 0.02

-- Buyer serves Variation Margin Call
marginCallCid <- submitMulti [buyer, seller] [] do
  createCmd MarginCall with
    marginCallId = "MC-VAR-2026-001"
    caller = buyer
    payer = seller
    custodian = custodian
    marginType = VariationMargin
    relatedAgreementRef = "REPO-2026-GS-BLK-001"
    currency = "USD"
    requiredAmount = 396000.0
    deadline = marginDeadline
    status = MarginCallIssued
    correlationId = CorrelationId "CORR-MARGIN-001"
    observers = [regulator]
```

### 3. Margin Fulfillment
The seller submits a cash payment; the call is only satisfied once the buyer (the caller) confirms receipt:
```daml
marginCallSubmittedCid <- submit seller do
  exerciseCmd marginCallCid SatisfyWithCash with
    paymentRef = "FEDWIRE-IMAD-20260908-001234"

marginCallSatisfiedCid <- submit buyer do
  exerciseCmd marginCallSubmittedCid ConfirmMarginReceipt
```
If the funds never arrive, the buyer runs `RejectMarginFulfilment` instead, and can declare default only after the call's deadline.

### 4. Collateral Substitution & Maturity Closeout
```daml
-- Counterparties execute collateral substitution
repoCidSubstituted <- submitMulti [seller, buyer] [] do
  exerciseCmd repoCidActive SubstituteCollateral with
    newIsin = ISIN "US912828XG01"
    newQuantity = 10100000.0
    newHaircut = 0.02

-- Seller initiates the closing leg; the custodian then confirms settlement.
-- (The custodian alone can only close a repo that has reached its end date.)
repoCidPendingClose <- submit seller do
  exerciseCmd repoCidSubstituted InitiateClosingLeg

repoCidSettled <- submit custodian do
  exerciseCmd repoCidPendingClose ExecuteClosingLeg with
    settlementRef = "SETTLE-CLOSE-DVP-001"
```

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
daml test --files daml/src/AryaFi/Test/Scenarios/RepoScenario.daml
```
*Implemented in [RepoScenario.daml](../../daml/src/AryaFi/Test/Scenarios/RepoScenario.daml).*
