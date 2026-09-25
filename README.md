# AryaFi Core (`aryafi-core`)

[![Daml](https://img.shields.io/badge/Daml-2.10.0-blue.svg)](https://daml.com)
[![Canton](https://img.shields.io/badge/Canton-Protocol_v30-green.svg)](https://canton.network)
[![Release](https://img.shields.io/badge/Release-v1.0.0--rc1-purple.svg)](CHANGELOG.md)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Terminal-black.svg?logo=vercel)](https://aryafi-core.vercel.app)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

🌐 **Live Institutional Digital Asset Terminal & Canton Explorer**: **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**  
📖 **Comprehensive User & Operator Guide**: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**  
📐 **Platform & Smart Contract Specification**: **[docs/PLATFORM_SPECIFICATION.md](docs/PLATFORM_SPECIFICATION.md)**  

**AryaFi Core** is an institutional-grade, privacy-aware smart contract library engineered in **Daml** for the **Canton Network Protocol v30**. It turns complex wholesale capital markets, central bank money, and institutional treasury operations into composable, mathematically verified, and legally sound financial contracts.

---

## Interactive Institutional Web Terminal (Live on Vercel)

The live web terminal at **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)** allows institutional counterparties, risk officers, and auditors to inspect the Canton network and simulate complex financial workflows in real time.

```
+-----------------------------------------------------------------------------------------+
|  AryaFi Core | Institutional Digital Asset Terminal & Canton Explorer                   |
|  [ Topology ] [ Simulator ] [ Contracts & Math ] [ ISO 20022 Hub ] [ Security ] [ Code ]|
+-----------------------------------------------------------------------------------------+
|  • Canton Network Topology: Interactive SVG map of 5 segregated participant nodes       |
|  • Scenario Simulator: Step-by-step & automated execution of DvP, Repo, & Lending       |
|  • Lemma 1 Invariant Calculator: Algebraic proof of value conservation (Δ = 0.00)       |
|  • ISO 20022 Hub: Bidirectional SWIFT MX XML ↔ Daml Ledger API JSON payload translation  |
|  • Security & Rules: STRIDE threat model mitigations, OCC/Fed/FDIC capital neutrality   |
|  • Daml Code Dossier: Live interactive smart contract source code viewer                |
|  • Institutional Themes: High-contrast Dark Mode (default) & Crisp Light Mode toggle    |
+-----------------------------------------------------------------------------------------+
```

### Key Terminal Features:
1. **Canton Multi-Participant Topology Visualizer**: Inspect cryptographic node boundaries, participant segregation, gRPC/JSON endpoints, hosted parties, and sub-transaction privacy rules for Federal Reserve Bank, Global Custodian, Primary Dealer A (Goldman Sachs), Primary Dealer B (Morgan Stanley), and SEC / Supervisory Observer.
2. **Multi-Party Lifecycle Simulator**: Execute end-to-end multi-signatory contract lifecycles with live streaming transaction logs:
   * **Tokenized US Treasury + Cash DvP** (with automated SEC CAT audit report emission)
   * **Institutional Securities Lending** (102% cash collateral pledge, Act/360 fee accrual, mark-to-market revaluations, and recalls)
   * **Treasury Cash Mobility & Zero-Balance Sweeps** (surplus identification, concentration pool consolidation, and SWIFT UETR payment tracing)
3. **Lemma 1 Invariant Proof Calculator**: Real-time verification that $\sum \text{Outputs} \equiv \sum \text{Inputs}$ with zero token inflation or rounding leakage ($\Delta = 0.00$) across arbitrary deposit amounts. Includes one-click quick presets ($1M, $25M, $100M).
4. **ISO 20022 Financial Messaging Hub**: Side-by-side inspection and 1-click clipboard copying for `pacs.008` (Customer Credit Transfer), `sese.023` (DvP Settlement), `camt.053` (Bank Statement), and `semt.002` (Custody Holding Statement).
5. **Daml Smart Contract Source Dossier**: Review production Daml contract code (`Cash.daml`, `Security.daml`, `Collateral.daml`, `Loan.daml`, `Repo.daml`, `TransferRestrictions.daml`) with syntax highlighting and 1-click source copying.

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
│   │       └── Test/              # Complete Hardened Test Suite
│   │           ├── Unit/          # 11 Unit test suites across all primitives & contracts
│   │           ├── Scenarios/     # 8 End-to-end multi-party lifecycle scenarios
│   │           ├── Negative/      # Unauthorized access, violation & invalid transition tests
│   │           ├── Privacy/       # Canton sub-transaction privacy & observer visibility tests
│   │           ├── Authorization/ # Multi-signatory bilateral & tri-party consent tests
│   │           └── Integration/   # Canton node integration test runners
│   └── test/                      # Standalone test scaffolds & integration documentation
├── deploy/
│   ├── canton/canton.conf         # Multi-participant Canton topology (5 nodes)
│   └── docker/                    # Containerized multi-node Canton testing sandbox
├── docs/
│   ├── USER_GUIDE.md              # Complete Web Terminal & Operator User Guide
│   ├── PLATFORM_SPECIFICATION.md  # Mathematical formulas, contract matrix & architecture
│   ├── ROADMAP.md                 # Production candidate roadmap tracking matrix
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
- **`Cash`**: High-precision tokenized deposit positions with atomic `SplitCash`, `MergeCash`, `TransferCash`, `LockCash`, and `UnlockCash`.
- **`Security`**: Tokenized fixed-income, equity, and US Treasury safekeeping with encumbrance tracking.
- **`Collateral`**: Haircut valuation ($V = M \times (1 - h)$), mark-to-market revaluation, substitution, and default liquidation.
- **`Settlement`**: Atomic Delivery-versus-Payment (`DvpInstruction`) with BIS CPSS Model 1 finality.
- **`Payment`**: Tri-party payment separation with SWIFT UETR and Fedwire IMAD network reference tracking.

### 2. Financial Contracts (`AryaFi.Contracts`)
- **`Loan`**: Secured institutional credit facilities and term loan agreements with interest waterfalls and auto-close logic.
- **`Repo` & `ReverseRepo`**: Repurchase agreements, DvP settlement legs, mark-to-market valuation, and closeout.
- **`SecuritiesLending`**: Institutional stock loans, Act/360 borrow fee accruals, cash collateral rebates, and recall notices.
- **`Margin`**: Initial and variation margin call workflows with dispute arbitration.
- **`Subscription` & `Redemption`**: Institutional private credit fund commitments, capital calls, liquidity gates, and NAV redemptions.
- **`Transfer`, `Pledge` & `Escrow`**: Compliance-gated transfers, tri-party collateral perfection (UCC Article 8/12), and conditional holding.

### 3. Compliance & Policy Engine (`AryaFi.Compliance`)
- **`KYC` & `Sanctions`**: Privacy-preserving institutional attestations with automatic expiry enforcement.
- **`Eligibility`**: Dynamic collateral and counterparty validation rules.
- **`TransferRestrictions` & `OwnershipRestrictions`**: Programmatic enforcement of Reg D 506(c), Reg S, and Rule 144A holding periods.
- **`RegulatoryReporting`**: Automated event audit trails for SEC CAT, FINRA TRACE, and EMIR reporting.

---

## Getting Started

### Prerequisites
- [Daml SDK](https://docs.daml.com/) (Version 2.10.0 or later)
- Git & Docker (for Canton multi-node testing)

### Build and Test
```bash
# Build the Daml Archive (DAR)
daml build

# Run the comprehensive test suite (Unit, Scenarios, Negative, Privacy, Authorization)
daml test
```

### Run Local Multi-Node Canton Sandbox
```bash
# Launch 5 participant nodes with local sequencer
cd deploy/docker
docker compose up -d

# Check participant health
docker compose ps
```

---

## Documentation Suite

| Category | Guide | Description |
|:---|:---|:---|
| **User & Operations** | **[User Guide](docs/USER_GUIDE.md)** | Step-by-step user guide for the live Vercel web terminal & simulator |
| | **[Platform Specification](docs/PLATFORM_SPECIFICATION.md)** | Complete mathematical formulas, contract matrix & architecture manual |
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
| | [Authorization Matrix](docs/security/AUTHORIZATION_MATRIX.md) | Exhaustive template choice, controller, and signatory reference |
| | [Audit Dossier](docs/security/AUDIT_DOSSIER.md) | Invariant proofs, test breakdown, and external auditor runbook |
| | [Regulatory Alignment](docs/compliance/REGULATORY_ALIGNMENT.md) | US OCC/Fed/FDIC capital neutrality and SEC tokenization guidance |
| **Governance** | [Roadmap Tracking](docs/ROADMAP.md) | v1.0.0 Production Candidate roadmap tracking matrix |
| | [Versioning Policy](docs/governance/VERSIONING_AND_RELEASE.md) | Semantic versioning policy and module maturity labels |
| | [Migration Guide](docs/governance/MIGRATION_GUIDE.md) | Contract upgrade strategies, batch migrations, and verification |
| | [Changelog](CHANGELOG.md) | Comprehensive record of milestones and release notes |

---

## License
Licensed under the [Apache License, Version 2.0](LICENSE).
