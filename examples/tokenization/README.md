# Reference Application: Tokenized US Treasury + Cash DvP

## Overview
Demonstrates atomic Delivery-versus-Payment (DvP) of Tokenized US Treasuries against Tokenized Cash/Deposits between institutional primary dealers over Canton, with full compliance gating, regulatory reporting, and multi-party privacy.

This reference application exercises every core layer of the AryaFi platform in a single realistic trade lifecycle:
- **Common Layer**: Identifiers (ISIN, CUSIP, LEI), CorrelationId, Types
- **Compliance Layer**: KYC attestation, Sanctions screening, Eligibility policy evaluation
- **Finance Layer**: SecurityPosition, CashPosition, DvpInstruction, Settlement
- **Regulatory Reporting**: SEC CAT report submission and acknowledgement

## Participants

| Party | Role | Description |
|:------|:-----|:------------|
| CentralBank | Cash Issuer | Issues USD tokenized cash positions |
| GlobalCustodian | Securities Custodian | Holds US Treasury security positions in safekeeping |
| KycAuthority | KYC Attestation Authority | Issues and validates KYC verifications for institutional counterparties |
| ScreeningAuthority | Sanctions Screening Provider | Screens counterparties against OFAC, EU, and UN sanctions lists |
| ComplianceOfficer | Compliance Gating | Reviews and approves asset transfers after verifying compliance attestations |
| SecuritiesRegulator | Regulatory Authority | Receives and acknowledges CAT trade reports |
| SettlementAgent | Settlement Agent | Holds both locked legs and executes the atomic DvP |
| DealerBankA (Seller) | Primary Dealer | Sells US Treasury bonds; submits regulatory reports |
| DealerBankB (Buyer) | Primary Dealer | Buys US Treasury bonds with USD cash |
| CentralSecuritiesDepository | Central Securities Depository | Receives observer visibility into DvP instructions |

## Workflow

```
                    ┌──────────────────────────────────┐
                    │  Phase 1: Compliance Onboarding  │
                    └──────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                          │                            │
        v                          v                            v
  1. KYC Attestation       2. Sanctions Screening      3. Eligibility Policy
  (Both Dealers)           (Both Dealers)              (US Treasury asset class)
        │                          │                            │
        └───────────────────────────┼───────────────────────────┘
                                    │
                    ┌──────────────────────────────────┐
                    │   Phase 2: Position Setup        │
                    └──────────────────────────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                                    │
                  v                                    v
     4. SecurityPosition                     5. CashPosition
     (Seller: 5M US Treasury)               (Buyer: 5M USD)
                  │                                    │
                  └─────────────────┼─────────────────┘
                                    │
                    ┌──────────────────────────────────┐
                    │    Phase 3: DvP Settlement       │
                    └──────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                         │                           │
         v                         v                           v
  6. Lock Security          7. Lock Cash              8. DvP Instruction
  (Pre-DvP condition)      (Pre-DvP condition)       (3-party co-sign)
         │                         │                           │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    v
                         9. Execute DvP Atomically
                         (Settlement Agent triggers)
                                    │
                                    v
                         10. Verify Settled State
                         (Both parties confirm)
                                    │
                    ┌──────────────────────────────────┐
                    │  Phase 4: Regulatory Reporting   │
                    └──────────────────────────────────┘
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                                    │
                  v                                    v
     11. Submit CAT Report              12. SEC Acknowledges Report
     (DealerBankA → SEC)                (Report marked acknowledged)
```

### Phase 1: Compliance Onboarding
Institutional counterparties must establish verified identities and clear sanctions screening before any trading activity:
```daml
-- KYC attestation for Seller (DealerBankA)
sellerKycCid <- submit kycAuthority do
  createCmd KycAttestation with
    authority = kycAuthority
    subjectParty = seller
    lei = Some (LEI "5493001KJTIIGC8Y1R12")
    status = KycVerified
    verificationTimestamp = now
    expiryTimestamp = futureKyc
    jurisdiction = "US"
    riskTier = "STANDARD"
    providerRef = None
    observers = [compliance, agent]

-- Sanctions screening for both dealers
sellerSanCid <- submit screening do
  createCmd SanctionsAttestation with
    screeningAuthority = screening
    subjectParty = seller
    lei = Some (LEI "5493001KJTIIGC8Y1R12")
    status = SanctionsClear
    screeningProviderRef = "WORLD-CHECK-2026-DEALER-A"
    ...

-- Eligibility policy for US Treasuries
eligibilityCid <- submit agent do
  createCmd EligibilityPolicy with
    policyManager = agent
    policyName = "US-Treasury-Eligible-Collateral"
    allowedJurisdictions = ["US", "GB", "DE", "CH", "SG", "JP"]
    allowedAssetClasses = ["GovernmentSecurity", "AgencySecurity"]
    minCreditRating = "AA-"
    isActive = True
```

### Phase 2: Position Setup
Positions are created as tokenized claims on the Canton ledger with dual-signatory custody:
```daml
-- Seller creates US Treasury 4.25% Nov 2026 position (5M face value)
sellerSecCid <- submit (actAs [custodian, seller]) do
  createCmd SecurityPosition with
    custodian = custodian
    owner = seller
    accountId = securityAccId
    isin = ISIN "US912828ZM50"
    cusip = Some (CUSIP "912828ZM5")
    instrumentName = "US Treasury 4.25% Nov 2026"
    instrumentType = GovernmentBond
    quantity = 5000000.0
    ...

-- Buyer creates USD cash position (5M) at the central bank
buyerCashCid <- submit (actAs [cashBank, buyer]) do
  createCmd CashPosition with
    bank = cashBank
    owner = buyer
    accountId = cashAccId
    currency = "USD"
    amount = 5000000.0
    ...
```

### Phase 3: DvP Settlement
Both legs are locked to the settlement agent, which then delivers them in one transaction:
```daml
-- Seller locks the bond; only the settlement agent can release or settle it from now on
lockedSecCid <- submit (actAs [seller, custodian]) do
  exerciseCmd sellerSecCid LockSecurity with lockRef = dvpLockRef; holder = agent

-- Buyer carves out exactly the consideration (5M face x 99.5% = 4,975,000) and locks it
(considerationCid, buyerRemainderCid) <- submit buyer do
  exerciseCmd buyerCashCid SplitCash with splitAmount = 4975000.0
lockedCashCid <- submit (actAs [buyer, cashBank]) do
  exerciseCmd considerationCid LockCash with lockRef = dvpLockRef; holder = agent

-- Create DvP instruction (all three parties sign)
dvpCid <- submit (actAs [agent, seller, buyer]) do
  createCmd DvpInstruction with
    settlementAgent = agent
    seller = seller
    buyer = buyer
    tradeId = TradeId "TRD-US-TREAS-4P25-NOV26-001"
    isin = ISIN "US912828ZM50"
    securityQuantity = 5000000.0
    cashAmount = 4975000.0  -- 99.5% of par
    dvpModel = DvpModel1
    status = PendingSettlement
    ...

-- Settlement agent validates both legs and delivers them in a single transaction
result <- submit agent do
  exerciseCmd dvpCid ExecuteDvpSettlement with
    sellerSecurityCid = lockedSecCid
    buyerCashCid = lockedCashCid

-- The buyer now owns the bond and the seller owns the cash
Some bond <- queryContractId buyer result.deliveredSecurityCid
Some cash <- queryContractId seller result.paidCashCid
```

### Phase 4: Regulatory Reporting
Post-trade compliance reporting to the SEC via Consolidated Audit Trail (CAT):
```daml
-- DealerBankA submits CAT report
catReportCid <- submit seller do
  createCmd RegulatoryReportRecord with
    reportingParty = seller
    regulator = sec
    regime = SEC_CAT
    reportPayload = "{...trade details...}"
    isAcknowledged = False
    ...

-- SEC acknowledges the report
ackedReportCid <- submit sec do
  exerciseCmd catReportCid AcknowledgeReport
```

## Key Design Patterns Demonstrated

| Pattern | Description |
|:--------|:------------|
| **Multi-Signatory DvP** | Settlement requires 3-party co-sign (agent + seller + buyer) |
| **Agent-Held Locks** | Both legs are locked to the settlement agent; neither owner nor custodian can withdraw them |
| **Atomic Delivery** | `ExecuteDvpSettlement` validates both legs and moves them in one transaction, or nothing moves |
| **Compliance Checks** | KYC, sanctions, and eligibility are checked by their authorities before the trade (not yet enforced inside the DvP transaction; see Known Limitations) |
| **Sub-Transaction Privacy** | Only signatories and observers see contract data |
| **Parallel Independence** | Multiple DvP instructions can settle without interference |
| **Observer-Based Visibility** | CSD, regulators, and agent banks added as needed |

## Additional Scenarios

### Multi-Dealer Parallel DvP
The reference application also includes a parallel DvP test demonstrating that two independent DvP instructions (between different dealer pairs) can be created and settled simultaneously without interference — verifying Canton's sub-transaction privacy guarantees.

---

## Scenario Verification
To execute the complete multi-party test scenario:
```bash
cd daml/test
dpm test --files AryaFi/Test/Scenarios/TreasuryDvpScenario.daml
```
*Implemented in [TreasuryDvpScenario.daml](../../daml/test/AryaFi/Test/Scenarios/TreasuryDvpScenario.daml).*
