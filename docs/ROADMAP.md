# AryaFi Core: Production Roadmap (v1.0.0)

> **Status note (2026-09-29, v2.0.0).** This is the original delivery roadmap, kept for history. The "completed" status below was recorded before the project had been built or tested: at that point `daml build` failed and the test suite had never compiled. v2.0.0 fixed the build, the tests (289 passing), atomic DvP, and the authorization defects; see [CHANGELOG.md](../CHANGELOG.md). Current maturity is in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md); the forward plan is [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md).

## Executive Summary

AryaFi Core is an institutional-grade smart contract library built in **Daml** for **Canton Network**. It provides modular, composable, and privacy-preserving primitives for digital assets, tokenized cash, custody accounts, bilateral and tri-party financing, and regulatory compliance.

As of **September 2026**, the core Daml contracts, compliance engines, test suites, and reference applications are complete (~80% of total project scope). This document outlines the remaining **14 to 16 commits** required to bring AryaFi Core to **Production Candidate (v1.0.0)** status, ready for institutional deployment and external independent security audit.

---

## Current Status (Completed Work)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETED COMPONENTS (~80%)                             │
├────────────────────────────┬───────────────────────────────────────────────────┤
│ Common Primitives          │ Types, Errors, Events, Identifiers, Time, Policies│
│ Finance Primitives         │ Party, Account, Asset, Cash, Security, Collateral, │
│                            │ Obligation, Payment, Settlement                   │
│ Compliance Primitives      │ KYC, Sanctions, Jurisdiction, Eligibility,        │
│                            │ TransferRestrictions, OwnershipRestrictions,       │
│                            │ RegulatoryReporting (SEC CAT)                     │
│ Financial Contracts        │ Loan, Repo, ReverseRepo, SecuritiesLending,       │
│                            │ Margin, Escrow, Subscription, Redemption,         │
│                            │ Transfer, Pledge                                  │
│ Test Suites & Hardening    │ Unit Tests (Common, Finance, Contracts, Funds)    │
│                            │ Scenarios (Loan, Repo, DvP, Escrow, Fund, SecLend)│
│                            │ Negative Tests, Privacy Tests, Authorization Tests│
│ Reference Applications     │ 1. Tokenized Treasury + Cash DvP                  │
│                            │ 2. Institutional Repo & Margin Management         │
│                            │ 3. Secured Institutional Loan Facility            │
│                            │ 4. Institutional Securities Lending               │
│                            │ 5. Institutional Treasury & Cash Mobility         │
└────────────────────────────┴───────────────────────────────────────────────────┘
```

---

## Remaining Work to v1.0.0 Release (~14–16 Commits)

The remaining work is organized into **4 core epics**:

```
                                AryaFi v1.0.0 Roadmap
                                          │
            ┌──────────────────┬──────────┴──────────┬──────────────────┐
            ▼                  ▼                     ▼                  ▼
     [Epic 1: Rails]   [Epic 2: Canton]      [Epic 3: Security]  [Epic 4: Release]
      4 Commits          3-4 Commits           4 Commits           3-4 Commits
```

---

### Epic 1: External Market Rail & ISO 20022 Integration (4 Commits)

Institutional adoption requires bidirectional interoperability between on-ledger Daml contracts and traditional capital markets messaging standards (SWIFT, ISO 20022, FIX).

#### Commit 1.1: ISO 20022 Financial Messaging Mapping Specification
- **Target File**: `docs/integration/ISO20022_MAPPINGS.md`
- **Scope**:
  - `PaymentInstruction` $\leftrightarrow$ `pacs.008` (Customer Credit Transfer) and `pacs.009` (Financial Institution Transfer).
  - `CashPosition` $\leftrightarrow$ `camt.053` (Bank-to-Customer Statement) and `camt.054` (Debit/Credit Notification).
  - `SecurityPosition` $\leftrightarrow$ `semt.002` (Custody Statement of Holdings) and `semt.003` (Statement of Accounting Holdings).
  - `DvpInstruction` $\leftrightarrow$ `sese.023` (Settlement Transaction Instruction) and `sese.025` (Settlement Confirmation).
- **Acceptance Criteria**: Full field-level mapping tables including ISO 20022 XML element paths, Daml record fields, validation rules, and transformation logic.

#### Commit 1.2: Canton Ledger API Client & Command Submission Patterns
- **Target File**: `docs/integration/LEDGER_API_CLIENT.md`
- **Scope**:
  - Architecture specification for external application services interacting via gRPC and HTTP JSON Ledger API.
  - Multi-party submission patterns for co-signed contracts (`submitMulti`).
  - Transaction stream consumption and flat transaction filtering.
  - Deduplication architecture leveraging `IdempotencyKey` and `CorrelationId`.
- **Acceptance Criteria**: Complete code snippets in TypeScript and Python illustrating client-side connection, command submission, and event listener setups.

#### Commit 1.3: End-of-Day Ledger & Custody Reconciliation Interfaces
- **Target File**: `docs/integration/RECONCILIATION.md`
- **Scope**:
  - Protocol for reconciling on-ledger Daml positions against external custody books of record (DTCC, Euroclear) and core banking systems (FIS, Temenos).
  - Discrepancy handling: breaks, pending settlement adjustments, and audit assertions.
  - Automated reconciliation batch workflow specification.
- **Acceptance Criteria**: Defined reconciliation file schema (CSV/JSON), matching algorithms, and resolution workflows for quantity or cash discrepancies.

#### Commit 1.4: Custodial & Settlement Rail Adapter Specifications
- **Target File**: `docs/integration/ADAPTERS_SPEC.md`
- **Scope**:
  - Specification for off-ledger adapter microservices bridging Canton Ledger API to Fedwire, CHIPS, Target2, and SWIFT Alliance.
  - Asynchronous event hooks for processing external settlement confirmations into `ConfirmPaymentSettlement`.
- **Acceptance Criteria**: Architecture diagrams, sequence diagrams for off-ledger rail confirmations, error handling, and timeout policies.

---

### Epic 2: Canton Deployment Topologies & Environment Automation (3–4 Commits)

Production environments require isolated participant nodes per legal entity, dedicated sequencers, and automated deployment topologies.

#### Commit 2.1: Multi-Party Canton Topology Configuration
- **Target File**: `deploy/canton/canton.conf`
- **Scope**:
  - Canton multi-participant topology defining:
    - Central Bank / Cash Issuer Node (`bank_node`)
    - Global Custodian Node (`custodian_node`)
    - Primary Dealer Nodes (`dealer_a_node`, `dealer_b_node`)
    - Regulatory Authority Node (`regulator_node`)
  - Shared domain sequencer and mediator configurations with TLS and authentication stubs.
- **Acceptance Criteria**: Valid Canton configuration file that parses cleanly with Canton CLI tools.

#### Commit 2.2: Local Multi-Participant Docker Sandbox Environment
- **Target Files**: `deploy/docker/docker-compose.yml`, `deploy/docker/Dockerfile`, `deploy/docker/bootstrap.sh`
- **Scope**:
  - Containerized local testing cluster spinning up Canton participants, domain sequencer, and Postgres storage engines.
  - Automated bootstrap script that initializes parties, uploads the AryaFi DAR, and verifies node connectivity.
- **Acceptance Criteria**: Single-command startup (`docker compose up`) yielding a running multi-node Canton network ready for scenario execution.

#### Commit 2.3: Participant Node Operations & Key Management Guide
- **Target File**: `docs/deployment/OPERATIONS_GUIDE.md`
- **Scope**:
  - Hardware Security Module (HSM) and cloud Key Management Service (AWS KMS, Azure Key Vault, HashiCorp Vault) integration for signing keys.
  - Node backup, state snapshotting, disaster recovery, and contract pruning procedures.
  - Node identity and participant onboarding workflows.
- **Acceptance Criteria**: Step-by-step institutional operations manual meeting ISO 27001 and SOC 2 security compliance guidelines.

---

### Epic 3: Security Assurance, Threat Modeling & Audit Dossier (4 Commits)

Required by Sections 17 & 19 of `TECHNICAL_BUSINESS_REQUIREMENTS.md` for institutional release qualification.

#### Commit 3.1: STRIDE Threat Model per Contract Module
- **Target File**: `docs/security/THREAT_MODEL.md`
- **Scope**:
  - Systematic STRIDE threat analysis across all Daml modules:
    - **S**poofing: Identity masquerading, key theft, unauthorized signers.
    - **T**ampering: Unauthorized state modification, parameter manipulation.
    - **R**epudiation: Denial of executed trades or instructions.
    - **I**nformation Disclosure: Sub-transaction privacy leakage, observer eavesdropping.
    - **D**enial of Service: State bloat, unspendable UTXO lockouts, archival griefing.
    - **E**levation of Privilege: Choice execution without required controller rights.
- **Acceptance Criteria**: Complete threat matrix with identified attack vectors, impact severity ratings (CVSS), and implemented contract mitigations.

#### Commit 3.2: Complete Contract Authorization Matrix & Trust Boundaries
- **Target File**: `docs/security/AUTHORIZATION_MATRIX.md`
- **Scope**:
  - Exhaustive reference matrix covering every Daml template across `Finance/`, `Contracts/`, and `Compliance/`.
  - Maps every choice to: Required Signatories, Choice Controllers, Observers, and Precondition Asserts.
- **Acceptance Criteria**: Auditable tabular breakdown enabling external security reviewers to verify least-privilege enforcement.

#### Commit 3.3: Independent Security Review Preparation Dossier
- **Target File**: `docs/security/AUDIT_DOSSIER.md`
- **Scope**:
  - Auditor package for external review firms (e.g. NCC Group, Trail of Bits, OpenZeppelin).
  - Mathematical balance invariant proofs ($\sum \text{outputs} = \sum \text{inputs}$).
  - Known edge cases, boundary test results, and self-audit remediation log.
- **Acceptance Criteria**: Structured audit dossier ready to be handed directly to an independent cryptography and smart contract audit team.

#### Commit 3.4: US Banking Capital Rules & SEC Tokenization Regulatory Alignment
- **Target File**: `docs/compliance/REGULATORY_ALIGNMENT.md`
- **Scope**:
  - Detailed legal-engineering analysis aligning AryaFi architecture with:
    - OCC / Federal Reserve / FDIC capital treatment rules (technology-neutral risk weighting).
    - SEC tokenized securities guidance (distinction between token representation and legal/economic claim).
    - European Union DLT Pilot Regime & MiCA transfer restriction requirements.
- **Acceptance Criteria**: Comprehensive compliance whitepaper documenting how each contract primitive maps to regulatory requirements.

---

### Epic 4: Build Hardening, CI/CD Packaging & v1.0.0 Release (3–4 Commits)

Final compiler hardening, automated CI packaging, and formal release governance.

#### Commit 4.1: Compiler Configuration & Scenario Init-Script Hardening
- **Target File**: `daml.yaml`
- **Scope**:
  - Configure default scenario entrypoint (`init-script`).
  - Re-enable strict compiler enforcement (`--ghc-option=-Werror`).
  - Audit dependencies (`daml-prim`, `daml-stdlib`, `daml-script`) and lock SDK version.
- **Acceptance Criteria**: `daml.yaml` configured with zero compiler warnings permitted during build.

#### Commit 4.2: CI/CD Build Matrix & Automated DAR Release Workflow
- **Target Files**: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- **Scope**:
  - Automated build matrix testing against supported Daml SDK versions.
  - Automated DAR artifact compilation, SHA-256 checksum generation, and GitHub Release asset uploading on version tag pushes (`v*`).
- **Acceptance Criteria**: Fully tested GitHub Actions workflows generating reproducible binary artifacts.

#### Commit 4.3: Version 1.0.0 Release Documentation & Migration Guide
- **Target Files**: `CHANGELOG.md`, `docs/governance/MIGRATION_GUIDE.md`, root `README.md`
- **Scope**:
  - Comprehensive `CHANGELOG.md` documenting all milestones from initial primitives to v1.0.0-rc1.
  - Contract upgrade and state migration procedures for future version bumps.
  - Update root `README.md` with links to the new integration, deployment, and security guides.
- **Acceptance Criteria**: Complete, publication-ready release notes adhering to Keep a Changelog standards.

---

## Progress Tracking Matrix

| Epic | Sub-Task | Target File | Status |
|:---|:---|:---|:---:|
| **Foundations** | Core Primitives, Finance, Contracts, Compliance | `daml/src/AryaFi/*` | [x] Completed |
| **Foundations** | Comprehensive Test Suites & Scenarios | `daml/test/*`, `daml/src/AryaFi/Test/*` | [x] Completed |
| **Foundations** | 5 Reference Application Guides | `examples/*/README.md` | [x] Completed |
| **Epic 1** | ISO 20022 Financial Messaging Mappings | `docs/integration/ISO20022_MAPPINGS.md` | [x] Completed |
| **Epic 1** | Canton Ledger API Client Specification | `docs/integration/LEDGER_API_CLIENT.md` | [x] Completed |
| **Epic 1** | EOD Ledger & Custody Reconciliation | `docs/integration/RECONCILIATION.md` | [x] Completed |
| **Epic 1** | Settlement Rail Adapter Architecture | `docs/integration/ADAPTERS_SPEC.md` | [x] Completed |
| **Epic 2** | Multi-Party Canton Topology Config | `deploy/canton/canton.conf` | [x] Completed |
| **Epic 2** | Local Docker Compose Sandbox | `deploy/docker/*` | [x] Completed |
| **Epic 2** | Participant Node Operations Guide | `docs/deployment/OPERATIONS_GUIDE.md` | [x] Completed |
| **Epic 3** | STRIDE Threat Model per Module | `docs/security/THREAT_MODEL.md` | [x] Completed |
| **Epic 3** | Contract Authorization Matrix | `docs/security/AUTHORIZATION_MATRIX.md` | [x] Completed |
| **Epic 3** | Independent Audit Preparation Dossier | `docs/security/AUDIT_DOSSIER.md` | [x] Completed |
| **Epic 3** | US Capital & SEC Regulatory Whitepaper | `docs/compliance/REGULATORY_ALIGNMENT.md` | [x] Completed |
| **Epic 4** | Strict `daml.yaml` Build Configuration | `daml.yaml` | [x] Completed |
| **Epic 4** | Automated CI/CD & DAR Release Workflow | `.github/workflows/*` | [x] Completed |
| **Epic 4** | v1.0.0 Changelog & Migration Guide | `CHANGELOG.md`, `docs/governance/*` | [x] Completed |
