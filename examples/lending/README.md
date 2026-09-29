# Reference Application: Secured Institutional Loan Facility

## Overview
Demonstrates institutional credit facility origination, multi-drawdown execution, collateral perfection via `AssetPledge`, day-count interest calculation, payment waterfall servicing, and default enforcement over Canton Network.

## Workflow

```
       1. Compliance Onboarding (KYC & Sanctions)
               |
               v
       2. Collateral Perfection (AssetPledge)
          (Pledgor + Pledgee + Custodian co-sign)
               |
               v
       3. Facility Origination (InstitutionalLoan)
          (Lender + Borrower co-sign with Facility Limit)
               |
               v
       4. Drawdown & Interest Servicing
          (Borrower draws down principal; the contract accrues Act/360 interest from ledger time)
               |
               v
       5. Repayment & Closeout / Default Enforcement
          (Principal paydown to 0 -> Auto-Close -> Collateral release)
```

### 1. Compliance Onboarding
Institutional counterparties establish verified identity and clear sanctions status:
- Lender and Borrower hold active `KycAttestation` contracts (status `KycVerified`), checked with `IsKycValid` by the KYC authority.
- Both parties are screened clear via `SanctionsAttestation` (`IsSanctionsClear`, exercised by the screening authority).

### 2. Collateral Perfection (`AssetPledge`)
Borrower pledges eligible collateral (e.g. 12,000,000 face value US Treasuries) under custody:
```daml
pledgeCid <- submitMulti [borrower, lender, custodian] [] do
  createCmd AssetPledge with
    pledgeId = "PLEDGE-UST-2026-BX01"
    pledgor = borrower
    pledgee = lender
    custodian = custodian
    accountId = AccountId "ACC-CUSTODY-01"
    assetId = "ISIN-US912828ZM50"
    quantity = 12000000.0
    perfectionReference = "UCC-FILING-NY-2026-8812734"
    correlationId = CorrelationId "CORR-FACILITY-2026-BX"
    status = Active
    enforceTimestamp = None
    observers = [agentBank, regulator]
```

### 3. Credit Facility Origination & Drawdown
Lender and Borrower create the bilateral credit facility and link the collateral perfection:
```daml
-- Originate facility with 10M limit and 5M initial drawn
loanCid <- submitMulti [lender, borrower] [] do
  createCmd InstitutionalLoan with
    loanId = "FACILITY-2026-BX-01"
    lender = lender
    borrower = borrower
    agentBank = Some agentBank
    currency = "USD"
    facilityLimit = 10000000.0
    drawnPrincipal = 5000000.0
    accruedInterest = 0.0
    interestRate = 0.0575
    dayCountConvention = Act360
    startDate = now
    interestAccruedThrough = now   -- interest accrues from here
    maturityDate = maturityDate
    collateralPledgeRef = None
    status = Active
    defaultReason = None
    correlationId = CorrelationId "CORR-FACILITY-2026-BX"
    observers = [regulator]

-- Link collateral pledge
loanCidLinked <- submit borrower do
  exerciseCmd loanCid LinkCollateralPledge with
    pledgeRef = "PLEDGE-UST-2026-BX01"

-- Drawdown additional 3M principal (drawn becomes 8M)
loanCidDrawn <- submit borrower do
  exerciseCmd loanCidLinked DrawdownPrincipal with
    drawdownAmount = 3000000.0
```

### 4. Interest Servicing
The contract computes interest itself from the rate, the day-count convention, and ledger time; nobody types in an amount. Payments are recorded by the lender, so the borrower cannot reduce its own debt:
```daml
-- 90 days later the lender triggers accrual: 8M * 5.75% * 90 / 360 = 115,000 USD
setTime (addRelTime now (days 90))
loanCidAccrued <- submit lender do
  exerciseCmd loanCidDrawn AccrueInterest

-- Lender confirms receipt of the borrower's interest payment
loanCidInterestPaid <- submit lender do
  exerciseCmd loanCidAccrued PayAccruedInterest with
    paymentAmount = 115000.0
```

### 5. Final Repayment and Collateral Discharge
```daml
-- Lender confirms receipt of the remaining 8M principal (the loan auto-closes)
loanCidClosed <- submit lender do
  exerciseCmd loanCidInterestPaid PayDownPrincipal with
    paymentAmount = 8000000.0

-- Lender unlinks pledge and releases collateral
loanCidUnlinked <- submit lender do
  exerciseCmd loanCidClosed UnlinkCollateralPledge

pledgeCidReleased <- submit lender do
  exerciseCmd pledgeCid ReleasePledge
```

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
daml test --files daml/src/AryaFi/Test/Scenarios/SecuredLoanScenario.daml
```
*Implemented in [SecuredLoanScenario.daml](../../daml/src/AryaFi/Test/Scenarios/SecuredLoanScenario.daml).*
