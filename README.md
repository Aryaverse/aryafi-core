# AryaFi Core (`aryafi-core`)

[![Daml](https://img.shields.io/badge/Daml_SDK-3.5.12-blue.svg)](https://docs.digitalasset.com)
[![Canton](https://img.shields.io/badge/Canton-3.5_(protocol_35)-green.svg)](deploy/canton/canton.conf)
[![Release](https://img.shields.io/badge/Release-v3.0.0-purple.svg)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/dpm_test-290_passing-brightgreen.svg)](daml/test/AryaFi/Test)
[![Status](https://img.shields.io/badge/Status-Beta_/_Experimental-orange.svg)](docs/KNOWN_LIMITATIONS.md)
[![Website](https://img.shields.io/badge/Vercel-Website-black.svg?logo=vercel)](https://aryafi-core.vercel.app)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

🌐 **Website, with a step-by-step trade walkthrough**: **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**  
📖 **Comprehensive User & Operator Guide**: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**  
📐 **Platform & Smart Contract Specification**: **[docs/PLATFORM_SPECIFICATION.md](docs/PLATFORM_SPECIFICATION.md)**  

**AryaFi Core** is a privacy-aware smart contract library written in **Daml 3** (SDK 3.5) for **Canton 3.5**, the platform the Canton Network runs. It models wholesale capital markets, tokenized cash, and institutional treasury workflows as Daml contracts with explicit signatories, controllers, and observers.

> **Status.** Core primitives and atomic DvP settlement are **Beta**; financing contracts and compliance policies are **Experimental**. The library has **not** had an independent security review. Read [Known Limitations](docs/KNOWN_LIMITATIONS.md) before building on it, and [Improvement Plan](docs/IMPROVEMENT_PLAN.md) for what comes next.

---

## Website (Live on Vercel)

**[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)** explains AryaFi Core in plain language for the people evaluating it, with the technical detail one click away:

1. **Overview**: what the library does, why it matters (neither side pays first, only the right party can act, each firm sees only its own business), who takes part in a trade, and an honest *works today / not yet* status.
2. **See a trade settle**: a step-by-step replay of the tested bond-for-cash scenario (`TreasuryDvpScenario`). Cards show what each of the six institutions holds and stores at every step; **Whose view?** hides everything a chosen institution's node does not store; **What if…?** tries what the contracts prevent (a seller taking back a locked bond, a short delivery, an agent cancelling alone, settling twice), each backed by a named test in `DvpSettlementTest`. It is a replay, not a live ledger.
3. **What's inside**: settlement, financing and compliance contracts in plain words, each area labelled Beta or Experimental, what comes next, and a collateral calculator.
4. **Developers**: quick start, running on a local Canton network or TestNet, ISO 20022 messages (`pacs.008`, `sese.023`, `camt.053`, `semt.002`) next to the JSON Ledger API v2 request each becomes with real checks (XML, ISIN and LEI check digits, UETR, currency, XML/JSON consistency), and the contract source loaded from this repository.
5. **Docs**: the key documents (known limitations, improvement plan, changelog, integration and security guides, TestNet runbook) rendered from this repository's Markdown, with links between them kept on the site.

Only the files the site uses are deployed: [`.vercelignore`](.vercelignore) lists them, so the rest of the repository stays off the public site. When the site shows a new document or module, add it there.

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
├── index.html                     # Website: overview, trade walkthrough, contents, developer tools
├── styles.css                     # Website styles (light and dark themes)
├── app.js                         # Website logic: views, trade replay, ISO 20022 checks, source viewer
├── vercel.json                    # Production Vercel Deployment & Security Headers
├── daml.yaml                      # Production package (aryafi-core), Daml SDK 3.5.12
├── multi-package.yaml             # Builds the production and test packages together
├── CHANGELOG.md                   # Complete semantic release log
├── LICENSE                        # Apache-2.0 License
├── README.md                      # Project documentation
├── daml/
│   ├── src/                       # Production Daml Compilation Root
│   │   └── AryaFi/
│   │       ├── Common/            # Domain types, errors, day-count time algorithms
│   │       ├── Finance/           # Cash, Security, Account, Collateral, Settlement, Payment
│   │       ├── Contracts/         # Loan, Repo, SecuritiesLending, Margin, Subscription, Redemption
│   │       └── Compliance/        # KYC, Sanctions, Eligibility, TransferRestrictions
│   └── test/                      # Test package (aryafi-core-test), depends on the production DAR
│       ├── daml.yaml
│       └── AryaFi/Test/           # Daml Script test suite (290 scripts, run by `dpm test`)
│           ├── Unit/              # 11 unit suites across primitives, contracts & compliance
│           ├── Scenarios/         # 9 end-to-end multi-party lifecycle scenarios
│           ├── Negative/          # Unauthorized access, violation & invalid transition tests
│           ├── Privacy/           # Observer visibility tests
│           ├── Authorization/     # Multi-signatory consent tests
│           ├── Network/           # Smoke test for shared networks (deploy/testnet)
│           └── Integration/       # Cross-module workflow tests (single ledger)
├── scripts/
│   └── gen_authorization_matrix.py # Regenerates docs/security/AUTHORIZATION_MATRIX.md from source
├── deploy/
│   ├── canton/canton.conf         # Multi-participant Canton topology (5 nodes)
│   └── docker/                    # Containerized multi-node Canton testing sandbox
├── docs/
│   ├── USER_GUIDE.md              # Website guide and local development
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
- Daml SDK 3.5.12 (pinned in `daml.yaml`), installed with the Digital Asset package manager `dpm`:
  `curl https://get.digitalasset.com/install/install.sh | sh -s 3.5.12`
- Java 17 or 21 (used by Daml Script and Canton)
- Docker (optional, for the multi-participant Canton topology)

### Build and Test
```bash
# Build both packages: aryafi-core (production) and aryafi-core-test
dpm build --all

# Run the test suite (290 scripts); --all includes the production templates in the coverage report
cd daml/test
dpm test --all --show-coverage
```

> Daml SDK 3.5 cannot resolve the test package's dependency when the repository path contains a space
> (`openBinaryFile: does not exist`). Clone into a path without spaces.

### Run Local Multi-Node Canton Topology
```bash
# Build first; the container uploads every .dar in .daml/dist (the production DAR)
dpm build --all

# Launch 5 in-memory Canton 3.5 participants and a synchronizer (sequencer + mediator)
cd deploy/docker
docker compose up -d --build

# Check participant health
docker compose ps
```

---

## Documentation Suite

| Category | Guide | Description |
|:---|:---|:---|
| **User & Operations** | **[User Guide](docs/USER_GUIDE.md)** | Guide to the website and to running the library locally |
| | **[Known Limitations](docs/KNOWN_LIMITATIONS.md)** | Maturity status and what the library does not do yet |
| | **[Improvement Plan](docs/IMPROVEMENT_PLAN.md)** | Next-level product and engineering plan |
| | **[Platform Specification](docs/PLATFORM_SPECIFICATION.md)** | Formulas, contract matrix & architecture manual |
| | [Operations Guide](docs/deployment/OPERATIONS_GUIDE.md) | HSM/KMS key management, active-passive HA, backup/PITR runbooks |
| **Architecture** | [Architecture Guide](docs/architecture/ARCHITECTURE.md) | High-level component decomposition and Canton transaction flows |
| | [Privacy Model](docs/architecture/PRIVACY_MODEL.md) | Canton sub-transaction privacy guarantees and observer models |
| | [Security Assurance](docs/architecture/SECURITY_ASSURANCE.md) | Authorization invariants, error handling, and security guarantees |
| **Market Integration**| [ISO 20022 Mappings](docs/integration/ISO20022_MAPPINGS.md) | Canonical mapping between Daml contracts and pacs/camt/semt/sese |
| | [Ledger API Client](docs/integration/LEDGER_API_CLIENT.md) | gRPC and JSON Ledger API v2 patterns, multi-party submission, and TypeScript/Python SDKs |
| | [EOD Reconciliation](docs/integration/RECONCILIATION.md) | Three-way on-ledger vs Core Banking / CSD reconciliation protocols |
| | [Rail Adapters](docs/integration/ADAPTERS_SPEC.md) | Fedwire, SWIFT, DTCC DvP, and AML screening microservices |
| **Deployment & Ops** | [Canton Topology](deploy/canton/canton.conf) | Multi-participant Canton node configuration (Bank, Custodian, Dealers) |
| | [Docker Sandbox](deploy/docker/docker-compose.yml) | Local multi-node Canton container environment with auto-bootstrap |
| | [TestNet Runbook](deploy/testnet/README.md) | Prerequisites and smoke test for a first run on the Canton Network TestNet |
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
