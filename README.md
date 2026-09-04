# AryaFi Core (`aryafi-core`)

[![Daml](https://img.shields.io/badge/Daml-2.10.0-blue.svg)](https://daml.com)
[![Canton](https://img.shields.io/badge/Canton-Enabled-green.svg)](https://canton.network)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

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
- **`Loan`**: Secured institutional term loan agreements.
- **`Repo` & `ReverseRepo`**: Repurchase agreements and counterparty views.
- **`SecuritiesLending`**: Stock loan, recall, fee accrual, and return flows.
- **`Margin`**: Initial and variation margin call mechanisms.
- **`Transfer` & `Escrow`**: Compliance-gated asset movements and conditional lockups.

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

## Roadmap

- **MVP**: Core Finance Primitives, DvP Settlement, Transfer Controls, KYC/Sanctions Status, Tokenized Treasury Reference Application.
- **Phase 2**: Institutional Repo, Secured Loans, Collateral & Pledge Lifecycle, Margin Management, Securities Lending.
- **Phase 3**: Private Credit, Subscriptions & Redemptions, Regulatory Adapters, Enterprise SDKs.

---

## License
Licensed under the [Apache License, Version 2.0](LICENSE).
