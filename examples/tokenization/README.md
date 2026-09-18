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
| FederalReserveBank | Cash Custodian | Issues and holds USD tokenized cash positions |
| GlobalCustodian | Securities Custodian | Holds US Treasury security positions in safekeeping |
| KycAuthority | KYC Attestation Authority | Issues and validates KYC verifications for institutional counterparties |
| ScreeningAuthority | Sanctions Screening Provider | Screens counterparties against OFAC, EU, and UN sanctions lists |
| ComplianceOfficer | Compliance Gating | Reviews and approves asset transfers after verifying compliance attestations |
| SECRegulator | Regulatory Authority | Receives and acknowledges CAT trade reports |
| DTCCSettlementAgent | Settlement Agent | Executes atomic DvP settlement instructions |
| DealerBankA (Seller) | Primary Dealer | Sells US Treasury bonds; submits regulatory reports |
| DealerBankB (Buyer) | Primary Dealer | Buys US Treasury bonds with USD cash |
| DTC | Central Securities Depository | Receives observer visibility into settled DvP instructions |

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
    observers = [compliance, dtcc]

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
eligibilityCid <- submit dtcc do
  createCmd EligibilityPolicy with
    policyManager = dtcc
    policyName = "DTCC-US-Treasury-Eligible-Collateral"
    allowedJurisdictions = ["US", "GB", "DE", "CH", "SG", "JP"]
    allowedAssetClasses = ["GovernmentSecurity", "AgencySecurity"]
    minCreditRating = "AA-"
    isActive = True
```

### Phase 2: Position Setup
Positions are created as tokenized claims on the Canton ledger with dual-signatory custody:
```daml
-- Seller creates US Treasury 4.25% Nov 2026 position (5M face value)
sellerSecCid <- submitMulti [custodian, seller] [] do
  createCmd SecurityPosition with
    custodian = custodian
    owner = seller
    accountId = securityAccId
    isin = ISIN "US912828ZM24"
    cusip = Some (CUSIP "912828ZM2")
    instrumentName = "US Treasury 4.25% Nov 2026"
    instrumentType = GovernmentBond
    quantity = 5000000.0
    ...

-- Buyer creates USD cash position (5M) at Federal Reserve
buyerCashCid <- submitMulti [fedReserve, buyer] [] do
  createCmd CashPosition with
    bank = fedReserve
    owner = buyer
    accountId = cashAccId
    currency = "USD"
    amount = 5000000.0
    ...
```

### Phase 3: DvP Settlement
Atomic settlement requires pre-locking of both legs followed by three-party instruction creation:
```daml
-- Lock security and cash for DvP
lockedSecCid <- submitMulti [seller, custodian] [] do
  exerciseCmd sellerSecCid LockSecurity with lockRef = dvpLockRef

lockedCashCid <- submitMulti [buyer, fedReserve] [] do
  exerciseCmd buyerCashCid LockCash with lockRef = dvpLockRef

-- Create DvP instruction (all three parties sign)
dvpCid <- submitMulti [dtcc, seller, buyer] [] do
  createCmd DvpInstruction with
    settlementAgent = dtcc
    seller = seller
    buyer = buyer
    tradeId = TradeId "TRD-US-TREAS-4P25-NOV26-001"
    isin = ISIN "US912828ZM24"
    securityQuantity = 5000000.0
    cashAmount = 4975000.0  -- 99.5% of par
    dvpModel = DvpModel1
    status = PendingSettlement
    ...

-- Settlement agent executes atomically
settledCid <- submit dtcc do
  exerciseCmd dvpCid ExecuteDvpSettlement
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
| **Pre-Settlement Locking** | Positions are locked before settlement to prevent double-spend |
| **Compliance Gating** | KYC + Sanctions + Eligibility must all clear before trading |
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
daml test --test-pattern TreasuryDvpScenario
```
*Implemented in [TreasuryDvpScenario.daml](file:///Users/pankaj/Desktop/DAML%20Projects/aryafi-core/daml/src/AryaFi/Test/Scenarios/TreasuryDvpScenario.daml).*
