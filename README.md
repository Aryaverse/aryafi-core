# AryaFi Core (`aryafi-core`)

[![Daml](https://img.shields.io/badge/Daml-2.10.0-blue.svg)](https://daml.com)
[![Canton](https://img.shields.io/badge/Canton-2.10_(protocol_5)-green.svg)](deploy/canton/canton.conf)
[![Release](https://img.shields.io/badge/Release-v1.0.2--unreleased-purple.svg)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/daml_test-289_passing-brightgreen.svg)](daml/src/AryaFi/Test)
[![Status](https://img.shields.io/badge/Status-Beta_/_Experimental-orange.svg)](docs/KNOWN_LIMITATIONS.md)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Terminal-black.svg?logo=vercel)](https://aryafi-core.vercel.app)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

🌐 **Live Institutional Digital Asset Terminal & Canton Explorer**: **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**  
📖 **Comprehensive User & Operator Guide**: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**  
📐 **Platform & Smart Contract Specification**: **[docs/PLATFORM_SPECIFICATION.md](docs/PLATFORM_SPECIFICATION.md)**  

**AryaFi Core** is a privacy-aware smart contract library written in **Daml 2.10** for **Canton 2.10**. It models wholesale capital markets, tokenized cash, and institutional treasury workflows as Daml contracts with explicit signatories, controllers, and observers.

> **Status.** Core primitives and atomic DvP settlement are **Beta**; financing contracts and compliance policies are **Experimental**. The library has **not** had an independent security review. Read [Known Limitations](docs/KNOWN_LIMITATIONS.md) before building on it, and [Improvement Plan](docs/IMPROVEMENT_PLAN.md) for what comes next.

---

## Interactive Institutional Web Terminal (Live on Vercel)

The web terminal at **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)** explains the library's topology and replays its test scenarios step by step. It is a **scripted simulation**: it does not connect to a ledger. Its code viewer loads the real Daml source from this repository.

```
+-----------------------------------------------------------------------------------------+
|  AryaFi Core | Institutional Digital Asset Terminal & Canton Explorer                   |
|  [ Topology ] [ Simulator ] [ Contracts & Math ] [ ISO 20022 Hub ] [ Security ] [ Code ]|
+-----------------------------------------------------------------------------------------+
|  • Canton Network Topology: Interactive SVG map of 5 segregated participant nodes       |
|  • Scenario Simulator: Scripted replay of the DvP, Securities Lending & Treasury tests   |
|  • Split Calculator: SplitCash value conservation in exact 10-dp Decimal arithmetic     |
|  • ISO 20022 Hub: MX messages mapped to Daml JSON API requests, with real field checks  |
|  • Security & Rules: STRIDE threat model, regulatory mapping (not independently audited)|
|  • Daml Code Dossier: Loads the actual module source from this repository              |
|  • Institutional Themes: Crisp Light Mode (default) & White-on-Black Dark Mode toggle   |
+-----------------------------------------------------------------------------------------+
```

### Key Terminal Features:
1. **Canton Multi-Participant Topology Visualizer**: The five-participant reference topology from [`deploy/`](deploy/canton/canton.conf): Cash Settlement Bank, Global Custodian / Settlement Agent, Dealer Bank A, Dealer Bank B, and Supervisory Authority, with each node's hosted party, endpoint, and privacy boundary.
2. **Multi-Party Lifecycle Simulator**: Step through scripted replays of the library's scenario tests:
   * **Tokenized US Treasury + Cash DvP** (both legs locked to the settlement agent and delivered atomically, followed by a regulatory report record)
   * **Institutional Securities Lending** (102% cash collateral pledge, Act/360 fee accrual, mark-to-market revaluations, and recalls)
   * **Treasury Cash Mobility & Zero-Balance Sweeps** (surplus identification, concentration pool consolidation, and SWIFT UETR payment tracing)
3. **Split Conservation Calculator**: Illustrates `SplitCash` using the same exact 10-decimal-place arithmetic as Daml `Decimal` (JavaScript floats would drift). The on-ledger behaviour is covered by the Daml tests.
4. **ISO 20022 Financial Messaging Hub**: `pacs.008`, `sese.023`, `camt.053`, and `semt.002` messages side by side with the Daml JSON API request each maps to. The validator runs real checks: XML well-formedness, required elements, ISIN (ISO 6166) and LEI (ISO 17442) check digits, UETR format, currency codes, and XML/JSON consistency.
5. **Daml Source Viewer**: Loads `Cash.daml`, `Security.daml`, `Settlement.daml`, `Collateral.daml`, `Loan.daml`, `Repo.daml`, and `TransferRestrictions.daml` directly from this repository, so it always shows the current code.

---

## Architecture Overview

```
                         Consumer Applications Layer
    (Treasury Portals | Repo Trading | Lending Desk | Investor Portals)
                                  |
                                  v
                   APIs / SDK & Event Orchestration
       (JSON Ledger API | gRPC | Kafka Event Bridges | Webhooks)
                                  |
                                  v
                   AryaFi Contract Infrastructure Layer
   +--------------------+  +--------------------+  +-------------------+
   | Finance Primitives |  | Contract Workflows |  | Compliance Engines|
   | Party, Account,    |  | Loan, Repo, DvP,   |  | KYC, Sanctions,   |
   | Cash, Security,    |  | Sec Lending,       |  | Jurisdiction,     |
   | Collateral,        |  | Margin, Escrow,    |  | Transfer Restr.,  |
   | Settlement         |  | Transfer, Pledge   |  | Reg Reporting     |
   +--------------------+  +--------------------+  +-------------------+
                                  |
               +--------------------------------------+
               | Common: Types | Identifiers | Events |
               +--------------------------------------+
                                  |
                                  v
                        Canton Network Layer
             (Participant Nodes | Sequencers | Mediators)
```

---

## Repository Schema

```
aryafi-core/
├── index.html                     # Institutional Web Terminal (HTML5 / WAI-ARIA)
├── styles.css                     # Institutional Dark/Light Design System
├── app.js                         # Interactive Canton Terminal & Simulator Logic
├── vercel.json                    # Production Vercel Deployment & Security Headers
├── daml.yaml                      # Daml SDK v2.10.0 Package Configuration
├── CHANGELOG.md                   # Complete semantic release log
├── LICENSE                        # Apache-2.0 License
├── README.md                      # Project documentation
├── daml/
│   ├── src/                       # Production Daml Compilation Root
│   │   └── AryaFi/
│   │       ├── Common/            # Domain types, errors, day-count time algorithms
│   │       ├── Finance/           # Cash, Security, Account, Collateral, Settlement, Payment
│   │       ├── Contracts/         # Loan, Repo, SecuritiesLending, Margin, Subscription, Redemption
│   │       ├── Compliance/        # KYC, Sanctions, Eligibility, TransferRestrictions
│   │       └── Test/              # Daml Script test suite (289 scripts, run by `daml test`)
│   │           ├── Unit/          # 11 unit suites across primitives, contracts & compliance
│   │           ├── Scenarios/     # 9 end-to-end multi-party lifecycle scenarios
│   │           ├── Negative/      # Unauthorized access, violation & invalid transition tests
│   │           ├── Privacy/       # Observer visibility tests
│   │           ├── Authorization/ # Multi-signatory consent tests
│   │           └── Integration/   # Cross-module workflow tests (single ledger)
├── scripts/
│   └── gen_authorization_matrix.py # Regenerates docs/security/AUTHORIZATION_MATRIX.md from source
├── deploy/
│   ├── canton/canton.conf         # Multi-participant Canton topology (5 nodes)
│   └── docker/                    # Containerized multi-node Canton testing sandbox
├── docs/
│   ├── USER_GUIDE.md              # Complete Web Terminal & Operator User Guide
│   ├── PLATFORM_SPECIFICATION.md  # Mathematical formulas, contract matrix & architecture
│   ├── KNOWN_LIMITATIONS.md       # What the library does not do yet (read first)
│   ├── IMPROVEMENT_PLAN.md        # Next-level product and engineering plan
│   ├── ROADMAP.md                 # Original v1.0.0 delivery roadmap
│   ├── architecture/              # Component decomposition, privacy & security assurance
│   ├── integration/               # ISO 20022 mappings, Ledger API client, rail adapters
│   ├── deployment/                # Node operations, KMS key management & HA runbooks
│   └── security/                  # STRIDE threat model, authorization matrix & audit dossier
└── examples/
    ├── tokenization/              # Tokenized US Treasury + Cash DvP guide
    ├── repo/                      # Institutional Repo & Margin guide
    ├── lending/                   # Secured Term Loans guide
    └── treasury/                  # Enterprise Cash Management guide
```

---

## Core Domains & Primitives

### 1. Finance Primitives (`AryaFi.Finance`)
- **`Party`**: Institutional profiles and LEI identities.
- **`Account`**: Custody, omnibus, and settlement accounts with administrative freeze controls.
- **`Cash`**: Tokenized deposit positions with `SplitCash`, `MergeCash`, receiver-authorized `TransferCash`, and locks held by a named lock holder (`LockCash`, `UnlockCash`, `SettleLockedCash`).
- **`Security`**: Tokenized fixed-income and equity safekeeping with the same lock-holder model (`LockSecurity`, `SettleLockedSecurity`).
- **`Collateral`**: Haircut valuation ($V = M \times (1 - h)$), mark-to-market revaluation, substitution, and default liquidation.
- **`Settlement`**: Atomic Delivery-versus-Payment. `ExecuteDvpSettlement` validates both locked legs and delivers the security and the cash in a single transaction (BIS Model 1).
- **`Payment`**: Tri-party payment separation with SWIFT UETR and Fedwire IMAD network reference tracking.

### 2. Financial Contracts (`AryaFi.Contracts`)
- **`Loan`**: Credit facilities with interest computed from rate, day count, and ledger time; repayments are confirmed by the lender.
- **`Repo` & `ReverseRepo`**: Repurchase agreements, DvP settlement legs, mark-to-market valuation, and closeout.
- **`SecuritiesLending`**: Stock loans with jointly agreed fees, recalls that persist until satisfied, and pro-rata-capped collateral release.
- **`Margin`**: Initial and variation margin calls: the payer submits, the caller confirms receipt; default only after the deadline.
- **`Subscription` & `Redemption`**: Institutional private credit fund commitments, capital calls, liquidity gates, and NAV redemptions.
- **`Transfer`, `Pledge` & `Escrow`**: Compliance-gated transfers, tri-party collateral perfection (UCC Article 8/12), and conditional holding.

### 3. Compliance & Policy Engine (`AryaFi.Compliance`)
- **`KYC` & `Sanctions`**: Privacy-preserving institutional attestations with automatic expiry enforcement.
- **`Eligibility`**: Dynamic collateral and counterparty validation rules.
- **`TransferRestrictions` & `OwnershipRestrictions`**: `EvaluateTransfer` checks lockup, holding period, whitelist, and Reg D / Reg S / Rule 144A investor category, reporting every failed rule.
- **`RegulatoryReporting`**: Report records and regulator acknowledgement for SEC CAT, FINRA TRACE, EMIR, and MiFIR.

---

## Getting Started

### Prerequisites
- [Daml SDK](https://docs.daml.com/) 2.10.0 (pinned in `daml.yaml`)
- Java 11 or 17 (used by `daml test`)
- Docker (optional, for the multi-participant Canton topology)

### Build and Test
```bash
# Build the Daml Archive (DAR)
daml build

# Run the test suite (289 scripts) with choice coverage
daml test --show-coverage
```

### Run Local Multi-Node Canton Topology
```bash
# Build the DAR first; the container uploads every .dar in .daml/dist
daml build

# Launch 5 in-memory Canton 2.10 participants and a domain
cd deploy/docker
docker compose up -d --build

# Check participant health
docker compose ps
```

---

## Documentation Suite

| Category | Guide | Description |
|:---|:---|:---|
| **User & Operations** | **[User Guide](docs/USER_GUIDE.md)** | Step-by-step user guide for the live Vercel web terminal & simulator |
| | **[Known Limitations](docs/KNOWN_LIMITATIONS.md)** | Maturity status and what the library does not do yet |
| | **[Improvement Plan](docs/IMPROVEMENT_PLAN.md)** | Next-level product and engineering plan |
| | **[Platform Specification](docs/PLATFORM_SPECIFICATION.md)** | Formulas, contract matrix & architecture manual |
| | [Operations Guide](docs/deployment/OPERATIONS_GUIDE.md) | HSM/KMS key management, active-passive HA, backup/PITR runbooks |
| **Architecture** | [Architecture Guide](docs/architecture/ARCHITECTURE.md) | High-level component decomposition and Canton transaction flows |
| | [Privacy Model](docs/architecture/PRIVACY_MODEL.md) | Canton sub-transaction privacy guarantees and observer models |
| | [Security Assurance](docs/architecture/SECURITY_ASSURANCE.md) | Authorization invariants, error handling, and security guarantees |
| **Market Integration**| [ISO 20022 Mappings](docs/integration/ISO20022_MAPPINGS.md) | Canonical mapping between Daml contracts and pacs/camt/semt/sese |
| | [Ledger API Client](docs/integration/LEDGER_API_CLIENT.md) | gRPC / JSON API patterns, submitMulti, and TypeScript/Python SDKs |
| | [EOD Reconciliation](docs/integration/RECONCILIATION.md) | Three-way on-ledger vs Core Banking / CSD reconciliation protocols |
| | [Rail Adapters](docs/integration/ADAPTERS_SPEC.md) | Fedwire, SWIFT, DTCC DvP, and AML screening microservices |
| **Deployment & Ops** | [Canton Topology](deploy/canton/canton.conf) | Multi-participant Canton node configuration (Bank, Custodian, Dealers) |
| | [Docker Sandbox](deploy/docker/docker-compose.yml) | Local multi-node Canton container environment with auto-bootstrap |
| **Security & Audit** | [STRIDE Threat Model](docs/security/THREAT_MODEL.md) | Formal STRIDE security evaluation across all contract modules |
| | [Authorization Matrix](docs/security/AUTHORIZATION_MATRIX.md) | Signatories, observers, choices & controllers, generated from source |
| | [Audit Dossier](docs/security/AUDIT_DOSSIER.md) | Invariant arguments, test breakdown, and briefing for an external review |
| | [Regulatory Alignment](docs/compliance/REGULATORY_ALIGNMENT.md) | US OCC/Fed/FDIC capital neutrality and SEC tokenization guidance |
| **Governance** | [Roadmap Tracking](docs/ROADMAP.md) | Original v1.0.0 delivery roadmap |
| | [Versioning Policy](docs/governance/VERSIONING_AND_RELEASE.md) | Semantic versioning policy and module maturity labels |
| | [Migration Guide](docs/governance/MIGRATION_GUIDE.md) | Contract upgrade strategies, batch migrations, and verification |
| | [Changelog](CHANGELOG.md) | Comprehensive record of milestones and release notes |

---

## License
Licensed under the [Apache License, Version 2.0](LICENSE).
