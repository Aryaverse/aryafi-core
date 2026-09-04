# AryaFi Core: Technical Architecture Guide

## 1. Architectural Overview
AryaFi Core is an institutional-grade, modular smart-contract framework built on Daml and Canton. It provides a standardized contract infrastructure layer between institutional core banking/custody systems and privacy-enabled distributed ledgers.

```
+-------------------------------------------------------------------------+
|                       Consumer Applications Layer                       |
|   (Treasury Portals | Repo Trading | Lending Desk | Investor Portals)   |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                   APIs / SDK & Event Orchestration                      |
|       (JSON Ledger API | gRPC | Kafka Event Bridges | Webhooks)         |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                     AryaFi Contract Infrastructure                      |
|                                                                         |
|  +--------------------+  +--------------------+  +-------------------+  |
|  | Finance Primitives |  | Contract Workflows |  | Compliance Engines|  |
|  | Party, Account,    |  | Loan, Repo, DvP,   |  | KYC, Sanctions,   |  |
|  | Cash, Security,    |  | Sec Lending,       |  | Jurisdiction,     |  |
|  | Collateral,        |  | Margin, Escrow,    |  | Transfer Restr.,  |  |
|  | Settlement         |  | Transfer, Pledge   |  | Reg Reporting     |  |
|  +--------------------+  +--------------------+  +-------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Common Layer: Types | Identifiers | Time | Errors | Audit Events  |  |
|  +-------------------------------------------------------------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+------------------------------------+------------------------------------+
|                         Canton Network Layer                            |
|             (Participant Nodes | Sequencers | Mediators)                |
+-------------------------------------------------------------------------+
```

## 2. Core Architectural Tenets
1. **Composability**: Modules have bounded contexts with clean interfaces. Financial primitives assemble into complex workflows (e.g. Cash + Security -> DvP -> Repo).
2. **Sub-Transaction Privacy**: Visibility is strictly scoped. Counterparties in bilateral trades share data only with permitted custodians, regulators, and settlement agents.
3. **Authorization-First Model**: Every ledger mutation requires explicit authorization from legitimate economic owners and fiduciary custodians.
4. **Policy Decoupling**: Business rules and compliance checks are evaluated via explicit policy contracts rather than hardcoded logic.
