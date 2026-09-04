# Aryaverse Institutional Financial Contract Library

## Technical & Business Requirements (2026)


ARYAVERSEINSTITUTIONAL FINANCIAL CONTRACT LIBRARY
Technical & Business Requirements Document
Reusable Daml Modules for Canton-Based Institutional Finance
Research baseline: September 2026

Executive Summary
This document proposes an institutional-grade reusable financial contract library built in Daml for Canton.The library is intended to provide composable primitives for assets, cash, accounts, obligations, payments, settlement,financing, collateral and compliance. These primitives can then be assembled into applications for institutional lending,repo, reverse repo, securities lending, treasury, tokenized securities, private credit, collateral management anddelivery-versus-payment.The market case is strengthening. U.S. banking regulators stated in March 2026 that eligible tokenized securitiesgenerally receive the same regulatory-capital treatment as their non-tokenized form and that the capital rule istechnology neutral. The SEC has separately published 2026 material on tokenized securities. The European Commissionhas described DLT/tokenisation as capable of reducing settlement friction, improving liquidity management, enablingprogrammability and streamlining reconciliation.At the infrastructure level, 2026 institutional activity around Canton includes tokenized U.S. Treasuries, repo,cross-border collateral mobility and tokenized cash. DTCC has moved toward production use of tokenized securities,and Tradeweb has demonstrated on-chain U.S. Treasury settlement paired with tokenized cash on Canton.The product thesis is therefore: instead of rebuilding financial-contract logic separately for every institutionalapplication, create a rigorously tested, versioned and security-reviewed foundation that implementation teams canreuse. The library should become software infrastructure—not a collection of sample contracts.
1. Product Vision
Build a reusable Daml contract library that turns common institutional financial concepts and workflows into modular, composable, privacy-aware contracts.
Institutional Applications        | Lending | Repo | Treasury | Collateral | Tokenization | Settlement        |        vReusable Financial Contract Library        |+-------+-----------+------------+| Finance Primitives | Contracts | Compliance |+--------------------+-----------+        |      Daml        |      Canton
2. Market Situation
Financial institutions are moving from blockchain experimentation toward selected production financial workflows.
Tokenized securities are becoming part of regulated market infrastructure.
Tokenized cash/deposits are increasingly important as the settlement leg for tokenized assets.
Repo and collateral mobility are emerging as high-value institutional use cases.
Privacy-preserving DLT is relevant because financial counterparties cannot expose all transaction information to every participant.
Legacy banking, custody, treasury and market-infrastructure systems will remain, creating major integration demand.
Security, identity, compliance, observability and reconciliation will be required around the contract layer.
The opportunity is not that every institution will replace its core systems with Canton. The more credible opportunity is that DLT becomes an additional coordination, contractual and settlement layer for selected multi-party workflows.
3. Research Evidence
Development
2026 Evidence
Product Implication
U.S. regulatory-capital clarification
OCC/Fed/FDIC: eligible tokenized securities generally receive the same capital treatment as non-tokenized securities; technology is not the determining factor.
Model legal/economic rights explicitly; support collateral and risk workflows.
SEC tokenized securities
SEC published a January 2026 statement describing tokenized securities and their structures.
Separate token representation from legal/economic rights.
EU DLT/tokenisation
European Commission says DLT/tokenisation can reduce settlement friction, improve liquidity management, enable programmability and streamline reconciliation.
Strong fit for settlement, treasury and capital markets.
Canton investment-bank survey
Canton reported in July 2026 that 90% of surveyed investment banks reported increased demand for collateral mobility and 54% had collateral/repo/liquidity initiatives underway.
Prioritize collateral, repo and liquidity modules.
DTCC tokenization
DTCC announced production testing of tokenized DTC-held securities and a 2026 tokenization-service rollout.
Asset lifecycle and custody integration become important.
Tradeweb Treasury transaction
Tradeweb announced a July 2026 on-chain U.S. Treasury transaction pairing a tokenized Treasury with tokenized cash on Canton.
Synchronized DvP should be a core capability.
Cross-border repo
Canton's industry working group announced a cross-border intraday repo involving tokenized Gilts in February 2026.
Repo, collateral and settlement should be first-class modules.
4. Scope
Financial Primitives
Party
Account
Asset
Cash
Security
Collateral
Obligation
Payment
Settlement
Contract Primitives
Loan
Repo
Reverse Repo
Securities Lending
Margin
Escrow
Subscription
Redemption
Transfer
Pledge
Compliance Primitives
KYC Status
Jurisdiction
Eligibility
Sanctions Status
Transfer Restrictions
Ownership Restrictions
Regulatory Reporting
Cross-Cutting
Identifiers
Lifecycle states
Authorization
Observers/privacy
Time and numeric conventions
Errors
Events/audit metadata
Versioning
Policies
5. Design Principles
Composable: small modules with explicit responsibilities.
Privacy-aware: visibility is designed intentionally for Canton/Daml.
Authorization-first: every state transition has explicit controllers/signatories.
Financially precise: amounts, units, dates, rates and obligations must be unambiguous.
Legal-rights aware: token representation must not automatically be treated as legal ownership.
Lifecycle-oriented: creation, activation, amendment, settlement, default and closure are explicit.
Policy-driven: institution-specific compliance rules should be configurable rather than hard-coded into generic contracts.
Versioned and auditable: releases are immutable, documented and reproducible.
Production-focused: examples are separate from production-ready modules.
Integration-ready: external banking, custody, treasury, KYC and market-infrastructure systems are first-class concerns.
6. Financial Primitive Requirements
Party
Represent a participant in a financial relationship. Support role/metadata without embedding sensitive identity data.
Account
Represent an account or holding relationship with explicit owner/controller semantics and permitted operations.
Asset
Generic owned/controlled asset representation with identifier, issuer, quantity and restrictions.
Cash
Monetary asset with currency, amount, precision and settlement semantics.
Security
Financial instrument/position with instrument identifier, issuer, quantity and lifecycle metadata.
Collateral
Asset designated or pledged to secure an obligation, with eligibility, valuation reference, status and release/substitution.
Obligation
Duty owed by one party to another, with value, due date, status and discharge conditions.
Payment
Payment instruction or completed monetary movement; separate instruction from final settlement.
Settlement
Completion of an exchange, including delivery-versus-payment and synchronized completion patterns.
7. Contract Primitive Requirements
Loan
Principal, lender, borrower, currency, rate, maturity, payment schedule, collateral, covenants, status and default/closeout.
Repo
Opening sale/financing leg, repurchase leg, security, cash, maturity, haircut, margin and default mechanics.
Reverse Repo
Provide counterparty-side composition without unnecessarily duplicating repo core logic.
Securities Lending
Lender, borrower, security, quantity, collateral, fee, recall, return, substitution and default.
Margin
Requirement, posted amount, eligible collateral, valuation, call, settlement, dispute and release.
Escrow
Controlled holding with explicit release conditions and authorized release parties.
Subscription
Investor subscription, eligibility, allocation, funding and confirmation.
Redemption
Redemption request, eligibility, valuation reference, approval, payment and completion.
Transfer
Controlled change of ownership/control subject to eligibility and restrictions.
Pledge
Creation and lifecycle of a pledge/security interest, with relevant registration/perfection references where required.
8. Compliance Primitive Requirements
KYC Status
Pending/verified/rejected/expired status, verification source, timestamps and responsible authority. Avoid storing unnecessary personal data.
Jurisdiction
Applicable jurisdiction for party, asset or transaction with effective dates.
Eligibility
Whether a party or asset satisfies a configurable policy.
Sanctions Status
Screening status and metadata, independent of any particular screening vendor.
Transfer Restrictions
Rules based on jurisdiction, investor type, holding period, whitelist or regulatory category.
Ownership Restrictions
Limits on who may own/control an asset and permitted ownership structures.
Regulatory Reporting
Reportable event and reporting status; core contracts should emit/report data rather than hard-code every jurisdiction's report format.
9. Domain Architecture
Party | +-- Account |    +-- Cash |    +-- Asset |    +-- Security | +-- Obligation |    +-- Loan |    +-- Repo |    +-- Securities Lending |    +-- Margin |    +-- Pledge | +-- Compliance / Eligibility | +-- Payment       |    Settlement
Avoid a monolithic contract. Use small contracts and controlled composition so a lending application can reuse the same Party, Cash, Obligation, Collateral, Eligibility, Payment and Settlement modules used by other applications.
10. Reference Workflow — Secured Institutional Loan
Loan Request     |Eligibility / KYC     |Loan Agreement     |Approval     |Funding Instruction     |Settlement     |Active Loan     |Payment Schedule     |Repayment OR Default     |Closeout
Loan does not own the KYC database or sanctions engine.
Loan references compliance/eligibility decisions through controlled interfaces.
Collateral is separately modeled and linked to the secured obligation.
Payment and settlement are separate lifecycle concepts.
Default and closeout rules must be explicit and legally reviewed.
11. Reference Workflow — Repo
Security + Cash      |Repo Agreement      |Opening Settlement      |Active Repo      |Margin / Substitution      |Maturity / Early Close      |Repurchase / Return      |Closeout
Opening and closing legs must be independently identifiable.
Haircut and margin requirements must be explicit.
Collateral substitution must re-run eligibility rules.
Default/closeout logic must be configurable.
Settlement should support synchronized exchange of security and cash.
12. Reference Workflow — Tokenized Security Transfer
Transfer Request      |Ownership / Eligibility      |KYC / Sanctions / Jurisdiction      |Transfer Restrictions      |Authorization      |Asset Transfer      |Settlement / Payment      |Audit Event
The transfer engine should be generic. Policy modules should determine whether a particular transfer is allowed.
13. Technical Architecture
                         Consumer Applications                                  |                         APIs / SDK / Events                                  |                    Application Service Layer                                  |       +--------------------------+-------------------------+       |                          |                         | Financial Contracts        Compliance Policies        Settlement       |                          |                         |       +--------------------------+-------------------------+                                  |                       Reusable Daml Modules                                  |                +-----------------+----------------+                |                 |                |            Primitives         Contracts       Compliance                |                 |                |                +-----------------+----------------+                                  |                               Canton                                  |       +--------------------------+-------------------------+       |                          |                         | Banks / Custody          Market Infrastructure       External Networks
14. Suggested Repository
daml/  src/    Finance/      Party.daml      Account.daml      Asset.daml      Cash.daml      Security.daml      Collateral.daml      Obligation.daml      Payment.daml      Settlement.daml    Contracts/      Loan.daml      Repo.daml      ReverseRepo.daml      SecuritiesLending.daml      Margin.daml      Escrow.daml      Subscription.daml      Redemption.daml      Transfer.daml      Pledge.daml    Compliance/      KYC.daml      Jurisdiction.daml      Eligibility.daml      Sanctions.daml      TransferRestrictions.daml      OwnershipRestrictions.daml      RegulatoryReporting.daml    Common/      Types.daml      Errors.daml      Events.daml      Identifiers.daml      Time.daml      Policies.daml  test/    Unit/    Scenarios/    Negative/    Privacy/    Authorization/    Integration/  docs/    architecture/    modules/    security/    compliance/  examples/    lending/    repo/    tokenization/    treasury/
15. API & Integration Requirements
Stable application-facing APIs that hide implementation details.
Synchronous command submission plus asynchronous status/event consumption.
Idempotency keys for externally initiated operations.
Correlation IDs across multi-system financial workflows.
Authorized disclosure only; do not expose private contract data through generic APIs.
Reconciliation interfaces between Canton state and external systems.
Explicit retry and failure semantics.
Adapters for custody, core banking, treasury, KYC/AML, market data and reporting.
16. Privacy Requirements
Minimize observers and disclose only necessary information.
Document visibility for every contract and choice.
Separate public/reference metadata from private transaction state.
Test privacy from every participant's viewpoint.
Prevent leakage through API responses, events and logs.
Treat privacy behavior as a security requirement, not an implementation detail.
17. Security Requirements
Least-privilege authorization.
Explicit controllers/signatories for every state transition.
Separate administrative authority from economic ownership.
Explicit controls for issuance, minting, cancellation and asset movement.
Key-management and participant-node security outside the contract layer.
Threat model for every high-value module.
Adversarial testing and negative authorization tests.
Independent security review before production designation.
18. Testing Strategy
Unit tests for all types and choices.
End-to-end lifecycle scenario tests.
Negative tests for unauthorized actions.
Privacy tests for every participant viewpoint.
Boundary tests for amounts, quantities, rates, dates and rounding.
Default/closeout tests.
Concurrency/race-condition tests where relevant.
Integration tests against representative Canton environments.
Regression suite required for every release.
Property-based tests for critical invariants where practical.
19. Audit & Assurance Model
“Audited” must be a release status, not a marketing adjective. Internal tests and code review are not substitutes for independent security review.
Design  |Internal Review  |Automated Tests  |Threat Model  |Independent Security Review  |Fix / Retest  |Production Release
Financial semantics review.
Daml/Canton code review.
Authorization review.
Privacy/observer review.
Adversarial testing.
Independent security assessment.
Documented findings and remediation.
Release-specific assurance report.
20. Versioning & Governance
Semantic versioning.
Immutable release tags.
Changelog.
Deprecation policy.
Migration guidance.
Compatibility matrix for Daml SDK/Canton versions.
Security advisory process.
Maturity labels: Experimental, Beta, Production Candidate, Production Reviewed.
Keep experimental examples separate from production modules.
21. Documentation Requirements
Architecture guide
Module reference
Contract lifecycle diagrams
Authorization matrix
Privacy/observer matrix
Financial semantics
Integration guide
Threat model
Security assumptions
Example applications
Testing guide
Deployment guide
Upgrade/migration guide
Known limitations
22. What Must Stay Outside the Core
Institution-specific business rules
Hard-coded KYC/sanctions vendors
Jurisdiction-specific legal conclusions presented as universal logic
UI code
Bank-specific database schemas
Customer PII
Secrets/private keys
Unreviewed experimental financial logic
Generic bridges that bypass compliance controls
23. Reference Applications
Tokenized Treasury + Cash DvP
Institutional Repo
Secured Institutional Loan
Securities Lending
Collateral and Margin Management
Private-Credit Subscription and Redemption
Institutional Treasury Transfer
These applications should prove composability and production design without turning the core library into a collection of application-specific contracts.
24. Commercial Opportunity
The library can support several business models:
Enterprise implementation projects using the library
Enterprise licensing
Commercial support and maintenance
Security/assurance packages
Managed Daml/Canton engineering
Custom modules built on the core
Integration projects
Training and technical enablement
Long-term upgrade and lifecycle support
The strongest strategic asset is reusable IP that reduces implementation time across multiple customers and workflows.
25. Product Packaging
Package
Contents
Primary Users
Target Phase
Core Finance
Party, Account, Asset, Cash, Security, Obligation, Payment
Developers / integrators
MVP
Settlement
Settlement, DvP and lifecycle primitives
Capital markets
MVP
Financing
Loan, Repo, Reverse Repo, Securities Lending, Margin
Banks / financing
Phase 2
Collateral
Collateral, Pledge, Eligibility, valuation interfaces
Treasury / risk
Phase 2
Compliance
KYC, jurisdiction, eligibility, sanctions, restrictions
Compliance / platform
Phase 2
Institutional Extensions
Private credit, treasury, asset servicing
Enterprise
Phase 3
Assurance
Security reports, compatibility, release assurance
Enterprise buyers
Continuous
26. MVP Requirements
Common types, identifiers, time and numeric conventions.
Party and Account.
Asset, Cash and Security.
Obligation and Payment.
Transfer.
Settlement with basic DvP.
Eligibility and Transfer Restrictions.
KYC status and Jurisdiction references.
Tokenized Treasury + Cash DvP reference application.
Comprehensive unit, privacy and authorization tests.
Threat model and independent security review of the MVP.
27. Phase 2 Requirements
Loan.
Collateral and Pledge.
Margin.
Repo and Reverse Repo.
Securities Lending.
Expanded compliance policies.
Collateral eligibility and valuation interfaces.
Reconciliation/event model.
Production deployment templates.
28. Phase 3 Requirements
Private credit.
Subscription and Redemption.
Advanced treasury workflows.
Asset servicing.
Regulatory reporting adapters.
Interoperability adapters.
Enterprise SDKs.
Observability and operations tooling.
Formal release-assurance program.
29. Team Requirements
Lead Daml/Canton architect
2–4 Daml smart-contract engineers
Backend/integration engineers
Financial-domain SME
Security engineer
QA/test engineer
DevOps/platform engineer
Technical writer
External legal/financial reviewers for relevant modules
30. Definition of Done — Production Module
Purpose and financial semantics documented.
Contract lifecycle documented.
Controllers/signatories documented.
Privacy/observer model documented.
Threat model completed.
Unit, scenario, negative and authorization tests completed.
Integration behavior documented.
Independent security review completed where designated.
Known limitations recorded.
Version tagged and reproducible.
Migration notes provided.
Reference composition example provided.
31. Key Risks
Incorrect financial semantics can create economic/legal risk.
Privacy errors can expose confidential financial information.
Over-generalization can make contracts unsafe or difficult to use.
Under-generalization can create customer-specific forks.
Regulatory requirements differ across jurisdictions.
Token representation may not equal legal ownership.
External-system failures can break end-to-end workflows.
Some modules require legal opinions in addition to technical review.
Platform version changes can create compatibility risk.
32. Strategic Differentiation
Reusable Code     +Financial Semantics     +Privacy     +Security     +Compliance     +Production Reference Implementations     =Institutional Contract Infrastructure
The defensible asset is not the number of templates. It is the combination of correct financial semantics, composability, privacy-aware design, authorization, compliance-policy composition, testing, security assurance and production reference implementations.
33. Success Metrics
Number of production-ready modules.
Automated test coverage and regression reliability.
Number of workflows built without changing core modules.
Time to implement a new institutional use case.
Security findings and remediation time.
Number of reference applications.
Supported Daml/Canton versions.
Reconciliation/exception rates.
Developer and enterprise reuse.
Implementation time saved through the library.
34. Final Thesis
A new institutional software layer is emerging between financial institutions and DLT networks. Institutions need more than a ledger: they need financial contracts, identity, permissions, compliance, privacy, settlement, integration, security and operations.
A reusable Daml library can occupy a foundational part of this layer. If it is engineered as disciplined infrastructure—with modular contracts, rigorous testing, independent security review, clear financial semantics, strong documentation and reference implementations—it can support many institutional applications instead of being tied to one use case.
Core thesis: Build reusable contractual infrastructure from which many institutional financial applications can be built.
35. Research Sources
SEC — Statement on Tokenized Securities, Jan. 28, 2026: https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities
OCC — Interagency FAQs on Regulatory Capital: Tokenized Securities, Mar. 5, 2026: https://www.occ.gov/news-issuances/bulletins/2026/bulletin-2026-7.html
European Commission — DLT and tokenisation: paving the way for an ‘internet of value’, Apr. 21, 2026: https://finance.ec.europa.eu/news/dlt-and-tokenisation-paving-way-internet-value-2026-04-21_en
Canton Network — Survey Findings: Where Investment Banks are Investing in Tokenization, Jul. 8, 2026: https://www.canton.network/blog/tokenization-investment-banks-report-2026
Canton Network — Tradeweb On-Chain U.S. Treasuries Transaction, Jul. 1, 2026: https://www.canton.network/canton-network-press-releases/tradeweb-on-chain-us-treasuries-canton
Canton Network — Cross-Border Collateral Mobility / Intraday Repo, Feb. 24, 2026: https://www.canton.network/canton-network-press-releases/cantons-industry-working-group-advances-cross-border-collateral-mobility-on-canton
DTCC — Tokenization Service Development, May 4, 2026: https://www.dtcc.com/news/2026/may/04/dtcc-advances-development-of-new-tokenization-service
DTCC — Tokenized Assets Used in Production Trades, Jul. 15, 2026: https://www.dtcc.com/news/2026/july/15/dtcc-turns-tokenization-into-reality