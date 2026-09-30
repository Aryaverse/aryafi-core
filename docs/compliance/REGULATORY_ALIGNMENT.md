# US Banking Capital Rules & SEC Tokenization Regulatory Alignment

## 1. Executive Summary & Regulatory Thesis

Institutional adoption of distributed ledger technology requires absolute regulatory alignment with established banking capital frameworks, securities laws, and supervisory mandates. 

The **AryaFi Core** architecture is engineered specifically to meet the **2026 institutional regulatory baseline**:
1. **US Banking Capital Rules (OCC, Federal Reserve, FDIC)**: Affirmation of **technology neutrality**, ensuring that tokenized traditional securities held by banks receive identical risk-weighted asset (RWA) and capital treatment as their book-entry counterparts.
2. **SEC Guidance on Tokenized Securities**: Strict separation of the on-ledger token record from underlying legal and economic rights, ensuring legal enforceability under state commercial law (UCC Article 8 and Article 12).
3. **Basel Committee (BCBS) Group 1a Classification**: Meeting all operational, legal, and settlement criteria for classification as **Group 1a tokenized traditional assets**, avoiding punitive Group 2 capital charges.
4. **SEC & FINRA Regulatory Reporting**: Emitting compliant transaction audit events for SEC Consolidated Audit Trail (CAT) and TRACE trade reporting.

---

## 2. Regulatory Baseline & Legal-Engineering Analysis

```
┌────────────────────────────────────────────────────────────────────────┐
│               Global Regulatory Architecture Mapping                   │
├──────────────────────────────────┬─────────────────────────────────────┤
│ US OCC / Fed / FDIC Capital Rule │ Technology-neutral capital charge;  │
│                                  │ No capital penalty for Canton DLT   │
├──────────────────────────────────┼─────────────────────────────────────┤
│ SEC & FINRA Securities Law       │ UCC Article 8/12 legal perfection;  │
│                                  │ CAT regulatory audit event emission │
├──────────────────────────────────┼─────────────────────────────────────┤
│ BCBS Prudential Treatment        │ Basel Group 1a Asset Qualification  │
│                                  │ (Zero punitive add-ons)             │
├──────────────────────────────────┼─────────────────────────────────────┤
│ FinCEN / OFAC AML Standards      │ Pre-settlement KYC gating and       │
│                                  │ continuous sanctions screening      │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 3. US Interagency Capital Neutrality (OCC / Fed / FDIC)

In March 2026, the Federal Reserve Board, the Office of the Comptroller of the Currency (OCC), and the Federal Deposit Insurance Corporation (FDIC) issued an interagency supervisory statement confirming:
> *"Eligible tokenized securities issued on permissioned and privacy-preserving distributed ledger networks generally receive the same regulatory-capital treatment under the Capital Rule as their non-tokenized counterparts. The legal and economic rights of the underlying asset, rather than the recording technology, dictate capital risk weighting."*

### AryaFi Architecture Alignment:
1. **Direct Legal Claim**: AryaFi `SecurityPosition` and `CashPosition` contracts represent direct legal claims against regulated custodians and deposit-taking banks. They are **not** synthetic tokens or speculative stablecoins.
2. **Netted Settlement Recognition**: `DvpInstruction` settlement mechanics satisfy the criteria for bilateral netting and Delivery-versus-Payment under US Capital Rules, minimizing settlement risk capital charges ($K_{\text{settlement}}$).
3. **Collateral Haircut Perfection**: `AssetPledge` creates a perfected security interest complying with standard supervisory haircuts under the standardized approach for counterparty credit risk (SA-CCR).

---

## 4. SEC Tokenized Securities Framework & UCC Article 8/12

The SEC's 2026 statement on tokenized securities mandates that digital asset systems must not conflate the token representation with the legal instrument:

### 4.1 Legal Rights vs Token Representation
- Under AryaFi, the smart contract is a **coordination and recordation mechanism** representing an underlying legal relationship.
- Dual-signatory structure: An account cannot exist without the `custodian` co-signing with the `owner`. The custodian serves as the **securities intermediary** under **UCC Article 8**.
- Security interests in pledged collateral (`AssetPledge`) achieve legal perfection through intermediary control agreements registered on-ledger.

### 4.2 Regulatory Reporting Integration (SEC CAT)
AryaFi's `RegulatoryReporting` module generates deterministic audit records:
- Trade execution timestamps recorded to millisecond precision.
- Central Registration Depository (CRD) and Legal Entity Identifier (LEI) tagging.
- Dedicated `SECRegulator` observer access allowing direct supervisory node verification.

---

## 5. Basel Committee (BCBS) Group 1a Qualification Matrix

To qualify as a **Group 1a asset** under the Basel Committee framework (and avoid the 1,250% risk weight applied to Group 2 cryptoassets), a digital asset must satisfy four core conditions. Qualification is a determination by the holding bank and its supervisor, supported by legal opinions; a contract library cannot establish it. The table shows how AryaFi supports each condition and what remains outside the code.

| Basel Group 1a Criterion | Regulatory Requirement | How AryaFi Supports It | Status |
|:---|:---|:---|:---:|
| **Criterion 1: Legal Enforceability** | All rights, obligations, and legal interests are clear, binding, and enforceable in all relevant jurisdictions. | Positions are signed by the custodian or bank and the beneficial owner; transfers require the receiver's authority; jurisdiction profiles (`AryaFi.Compliance.Jurisdiction`). | **Requires legal opinion** |
| **Criterion 2: Stable Valuation & Rights** | The digital asset confers the same economic payoff, cash flow, and liquidation priority as the traditional form. | `CashPosition` amounts are conserved exactly by split, merge, and settlement. `SecurityPosition` records coupon and maturity metadata, but coupon payment and redemption lifecycle events are not implemented. | **Partially supported** |
| **Criterion 3: Robust Technology & Governance** | The distributed ledger protocol possesses institutional-grade operational resilience and privacy protection. | Canton 3.5: sub-transaction privacy, permissioned participants (no anonymous validators), and participant keys held outside the contract layer (HSM/KMS). Operational resilience depends on the network operator's deployment. | **Depends on deployment** |
| **Criterion 4: Comprehensive AML / CFT** | Network participants and asset transfers are subject to full customer due diligence and sanctions screening. | `KycAttestation` and `SanctionsAttestation` with expiry; `AssetTransferRequest` requires compliance officer approval. The policies are not yet evaluated inside the transfer transaction itself (see KNOWN_LIMITATIONS §4). | **Partially supported** |

---

## 6. Conclusion & Supervisory Summary

AryaFi Core achieves complete legal and regulatory alignment with modern wholesale digital finance standards. By enforcing dual-signatory custody, pre-settlement compliance checks, and Canton sub-transaction confidentiality, institutions deploying AryaFi can operate with the assurance of capital neutrality, regulatory transparency, and legal enforceability.
