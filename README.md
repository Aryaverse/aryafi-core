# AryaFi Core (`aryafi-core`)

[![Daml](https://img.shields.io/badge/Daml-2.10.0-blue.svg)](https://daml.com)
[![Canton](https://img.shields.io/badge/Canton-Protocol_v30-green.svg)](https://canton.network)
[![Release](https://img.shields.io/badge/Release-v1.0.0--rc1-purple.svg)](CHANGELOG.md)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Explorer-black.svg?logo=vercel)](https://aryafi-core.vercel.app)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

🌐 **Live Institutional Explorer & Simulator**: [https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)

**AryaFi Core** is an institutional-grade, privacy-aware smart contract library engineered in **Daml** for **Canton Network** and distributed ledger infrastructure. It turns complex capital markets, banking, and treasury concepts into modular, composable, and legally sound financial contracts.

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

## Directory Schema

```
aryafi-core/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI build & test pipeline
├── daml.yaml                      # Daml SDK package manifest
├── LICENSE                        # Apache-2.0 License
├── README.md                      # Project documentation
├── daml/
│   ├── src/
│   │   └── AryaFi/
│   │       ├── Common/            # Common domain types & utilities
│   │       │   ├── Errors.daml
│   │       │   ├── Events.daml
│   │       │   ├── Identifiers.daml
│   │       │   ├── Policies.daml
│   │       │   ├── Time.daml
│   │       │   └── Types.daml
│   │       ├── Finance/           # Core financial primitives
│   │       │   ├── Account.daml
│   │       │   ├── Asset.daml
│   │       │   ├── Cash.daml
│   │       │   ├── Collateral.daml
│   │       │   ├── Obligation.daml
│   │       │   ├── Party.daml
│   │       │   ├── Payment.daml
│   │       │   ├── Security.daml
│   │       │   └── Settlement.daml
│   │       ├── Contracts/         # High-level financial contracts
│   │       │   ├── Escrow.daml
│   │       │   ├── Loan.daml
│   │       │   ├── Margin.daml
│   │       │   ├── Pledge.daml
│   │       │   ├── Redemption.daml
│   │       │   ├── Repo.daml
│   │       │   ├── ReverseRepo.daml
│   │       │   ├── SecuritiesLending.daml
│   │       │   ├── Subscription.daml
│   │       │   └── Transfer.daml
│   │       └── Compliance/        # Compliance & regulatory engines
│   │           ├── Eligibility.daml
│   │           ├── Jurisdiction.daml
│   │           ├── KYC.daml
│   │           ├── OwnershipRestrictions.daml
│   │           ├── RegulatoryReporting.daml
│   │           ├── Sanctions.daml
│   │           └── TransferRestrictions.daml
│   └── test/
│       └── AryaFi/Test/
│           ├── Unit/              # Unit tests for types & logic
│           ├── Scenarios/         # End-to-end multi-party workflows
│           ├── Negative/          # Authorization & violation tests
│           ├── Privacy/           # Sub-transaction disclosure tests
│           ├── Authorization/     # Multi-signatory permission tests
│           └── Integration/       # Canton live node integration tests
├── docs/
│   ├── architecture/              # System architecture & threat models
│   ├── modules/                   # Detailed module specifications
│   ├── requirements/              # Technical & business requirements
│   └── governance/                # Versioning & release policies
└── examples/
    ├── tokenization/              # Tokenized US Treasury + Cash DvP
    ├── repo/                      # Institutional Repo & Margin
    ├── lending/                   # Secured Term Loans
    └── treasury/                  # Enterprise Cash Management
```

---

## Core Domains & Primitives

### 1. Finance Primitives (`AryaFi.Finance`)
- **`Party`**: Institutional profiles and LEI identities.
- **`Account`**: Custody, omnibus, and settlement accounts.
- **`Cash`**: High-precision tokenized deposit positions with split, merge, lock, and transfer semantics.
- **`Security`**: Tokenized fixed-income, equity, and Treasury instruments.
- **`Settlement`**: Delivery-versus-Payment (DvP) and atomic cross-asset settlement.

### 2. Financial Contracts (`AryaFi.Contracts`)
- **`Loan`**: Secured institutional credit facilities and term loan agreements.
- **`Repo` & `ReverseRepo`**: Repurchase agreements, DvP settlement legs, and counterparty views.
- **`SecuritiesLending`**: Institutional stock loans, fee accruals, rebates, and recalls.
- **`Margin`**: Initial and variation margin call workflows with dispute arbitration.
- **`Subscription` & `Redemption`**: Institutional fund commitments, capital calls, liquidity gates, and NAV redemptions.
- **`Transfer`, `Pledge` & `Escrow`**: Compliance-gated transfers, tri-party collateral perfection, and conditional lockups.


### 3. Compliance & Policy Engine (`AryaFi.Compliance`)
- **`KYC` & `Sanctions`**: Privacy-preserving institutional attestations.
- **`Eligibility`**: Dynamic collateral and counterparty validation.
- **`TransferRestrictions`**: Reg D, Reg S, Rule 144A holding periods.
- **`RegulatoryReporting`**: Audit trails for CAT, EMIR, and MiFIR reporting.

---

## Getting Started

### Prerequisites
- [Daml SDK](https://docs.daml.com/) (Version 2.10.0 or later)
- Git

### Build and Test
```bash
# Build the Daml Archive (DAR)
daml build

# Run the test suite
daml test
```

---

## Documentation Suite

| Category | Guide | Description |
|:---|:---|:---|
| **Architecture** | [Architecture Guide](docs/architecture/ARCHITECTURE.md) | High-level component decomposition and Canton transaction flows |
| | [Privacy Model](docs/architecture/PRIVACY_MODEL.md) | Canton sub-transaction privacy guarantees and observer models |
| | [Security Assurance](docs/architecture/SECURITY_ASSURANCE.md) | Authorization invariants, error handling, and security guarantees |
| **Market Integration**| [ISO 20022 Mappings](docs/integration/ISO20022_MAPPINGS.md) | Canonical mapping between Daml contracts and pacs/camt/semt/sese |
| | [Ledger API Client](docs/integration/LEDGER_API_CLIENT.md) | gRPC / JSON API patterns, submitMulti, and TypeScript/Python SDKs |
| | [EOD Reconciliation](docs/integration/RECONCILIATION.md) | Three-way on-ledger vs Core Banking / CSD reconciliation protocols |
| | [Rail Adapters](docs/integration/ADAPTERS_SPEC.md) | Fedwire, SWIFT, DTCC DvP, and AML screening microservices |
| **Deployment & Ops** | [Canton Topology](deploy/canton/canton.conf) | Multi-participant Canton node configuration (Bank, Custodian, Dealers) |
| | [Docker Sandbox](deploy/docker/docker-compose.yml) | Local multi-node Canton container environment with auto-bootstrap |
| | [Operations Guide](docs/deployment/OPERATIONS_GUIDE.md) | HSM/KMS key management, active-passive HA, backup/PITR runbooks |
| **Security & Audit** | [STRIDE Threat Model](docs/security/THREAT_MODEL.md) | Formal STRIDE security evaluation across all contract modules |
| | [Authorization Matrix](docs/security/AUTHORIZATION_MATRIX.md) | Exhaustive template choice, controller, and signatory reference |
| | [Audit Dossier](docs/security/AUDIT_DOSSIER.md) | Invariant proofs, test breakdown, and external auditor runbook |
| | [Regulatory Alignment](docs/compliance/REGULATORY_ALIGNMENT.md) | US OCC/Fed/FDIC capital neutrality and SEC tokenization guidance |
| **Governance** | [Versioning Policy](docs/governance/VERSIONING_AND_RELEASE.md) | Semantic versioning policy and module maturity labels |
| | [Migration Guide](docs/governance/MIGRATION_GUIDE.md) | Contract upgrade strategies, batch migrations, and verification |
| | [Changelog](CHANGELOG.md) | Comprehensive record of milestones and release notes |

---

## Roadmap

- **MVP (Completed)**: Core Finance Primitives, DvP Settlement, Transfer Controls, KYC/Sanctions Status, Tokenized Treasury Reference Application.
- **Phase 2 (Completed)**: Institutional Repo, Secured Loans, Collateral & Pledge Lifecycle, Margin Management, Securities Lending.
- **Phase 3 (Completed)**: Private Credit, Subscriptions & Redemptions, Test Hardening, Reference Application Guides.
- **Phase 4 (Completed)**: External Market Rail Integration (ISO 20022), Canton Deployment Topologies, STRIDE Threat Modeling, and v1.0.0 Production Release.

👉 **For the complete production roadmap tracking matrix, see [docs/ROADMAP.md](docs/ROADMAP.md).**

---

## License
Licensed under the [Apache License, Version 2.0](LICENSE).
