# Changelog

All notable changes to the **AryaFi Core** library are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc1] - 2026-09-23

### Added
- **Common & Domain Foundations (`AryaFi.Common`)**:
  - Comprehensive high-precision types: `Amount`, `Rate`, `Currency`, `AccountId`, `ISIN`, `CUSIP`, `LEI`, `CorrelationId`, `IdempotencyKey`.
  - Day-count convention algorithms: `Act360`, `Act365`, and `Thirty360`.
  - Canonical error handling framework (`require`, `requirePositive`, `requireNonEmpty`).
- **Institutional Finance Primitives (`AryaFi.Finance`)**:
  - `CashPosition`: Multi-currency tokenized deposits with atomic `SplitCash`, `MergeCash`, `TransferCash`, `LockCash`, and `UnlockCash`.
  - `SecurityPosition`: CUSIP/ISIN safekeeping with balance preservation and encumbrance tracking.
  - `Account`: Segregated and omnibus custody accounts with freeze/unfreeze administrative controls.
  - `PaymentInstruction`: Tri-party payment separation (payer + payee + settlement agent) with SWIFT UETR / Fedwire IMAD network reference tracking.
  - `DvpInstruction`: Atomic Delivery-versus-Payment synchronized cross-asset settlement.
- **Contract Lifecycle Engines (`AryaFi.Contracts`)**:
  - `InstitutionalLoan`: Multi-drawdown credit facilities with interest accrual, repayment waterfalls, and default enforcement.
  - `RepoAgreement` & `ReverseRepo`: Bilateral/tri-party repurchase agreements with collateral margin allocation and mark-to-market revaluations.
  - `SecuritiesLendingAgreement`: Stock loans with Act360 borrow fee accrual, rebate calculations, recall notices, and pro-rata collateral release.
  - `AssetPledge`: Perfected security interest and lien management linked to secured obligations.
  - `EscrowAgreement`: Conditional multi-party holding and escrow disbursement.
  - `FundSubscription` & `AssetRedemption`: Private credit fund commitment tracking, capital calls, liquidity gates, and NAV-priced redemptions.
  - `Transfer`: Compliance-gated asset transfer workflows.
- **Compliance & Regulatory Policy Engines (`AryaFi.Compliance`)**:
  - `KYCAttestation`: Institutional KYC issuance, renewal, and revocation.
  - `SanctionsScreening`: Continuous OFAC, EU, and UN screening status tracking.
  - `Eligibility`: Collateral and counterparty policy evaluation.
  - `TransferRestrictions` & `OwnershipRestrictions`: Regulatory transfer restrictions (Reg D, Reg S, Rule 144A).
  - `RegulatoryReporting`: SEC CAT and TRACE audit event emissions.
- **End-to-End Scenarios & Hardened Test Suites**:
  - 8 multi-party lifecycle scenarios (`SecuritiesLendingScenario`, `TreasuryCashScenario`, `TreasuryDvpScenario`, `PrivateCreditFundScenario`, `RepoScenario`, `SecuredLoanScenario`, `EscrowScenario`, `TransferScenario`).
  - Unit tests across all primitives, types, and policies.
  - Comprehensive negative suites (`ComplianceViolationTest`, `UnauthorizedAccessTest`, `InvalidStateTransitionTest`).
  - Sub-transaction privacy tests (`ObserverPrivacyTest`) and authorization tests (`MultiSignatoryTest`).
- **Market Rail Integration (Epic 1)**:
  - ISO 20022 messaging mapping specifications (`pacs.008`, `pacs.009`, `camt.053`, `semt.002`, `sese.023`).
  - Canton Ledger API client architectures (TypeScript and Python SDK reference implementations).
  - End-of-day bank ledger and custody reconciliation interfaces.
  - Custodial and settlement rail adapter specifications (Fedwire, SWIFT, DTCC).
- **Canton Deployment Topologies & DevOps (Epic 2)**:
  - Multi-party Canton topology configuration (`canton.conf`) with 5 isolated participant nodes.
  - Containerized Docker Compose testing sandbox (`docker-compose.yml`, `Dockerfile`, `bootstrap.sh`).
  - Participant node operations manual, KMS key management, and active-passive HA architecture.
- **Security Assurance & Regulatory Alignment (Epic 3)**:
  - Formal STRIDE threat models across all contract modules.
  - Comprehensive contract authorization matrix mapping all template choices and controllers.
  - Independent security review preparation dossier with algebraic invariant proofs.
  - US banking capital rules (OCC/Fed/FDIC capital neutrality) and SEC tokenization regulatory whitepaper.
- **Build Hardening & Release Governance (Epic 4)**:
  - Strict compiler enforcement (`-Wall`, `-Werror`) in `daml.yaml`.
  - Matrix CI workflow and automated DAR release pipeline (`release.yml`).
  - State migration guide and upgrade runbooks.
