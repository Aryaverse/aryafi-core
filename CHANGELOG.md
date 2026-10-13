# Changelog

All notable changes to the **AryaFi Core** library are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- CI checks that every build is an upgrade of the latest release (`dpm upgrade-check` against the release's DAR), so an incompatible change fails before it reaches a participant.

### Fixed
- The 3.2.0 entry is dated 2026-10-13, the day it was released, not the day it was prepared.

## [3.2.0] - 2026-10-13

An upgrade-compatible release: Canton's participant upgrade check accepts it as an upgrade of 3.1.0, so participants running 3.1.0 can move to it without migrating contracts. AryaFi cash and securities can now be sent and settled through the Canton Network Token Standard, not only listed, and a new delivery-versus-payment settles through the standard against AryaFi cash or another registry's token, with each institution on its own node. It has not yet been run against Canton Coin itself, which needs a Canton Network; see [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md#2-platform).

### Added
- **Token-standard transfers.** Cash and securities can be sent with the Canton Network Token Standard's V2 transfer interfaces (CIP-0112, `Splice.Api.Token.TransferInstructionV2`), so wallets and apps can move AryaFi positions as well as list them. A bank or custodian creates a `PositionTransferFactory` for its clients. The sender instructs a transfer, naming the holdings that fund it, and gets its change back at once. The amount stays in the sender's account, locked to the bank or custodian, until the receiver accepts or rejects it or the sender withdraws it. The receiver still signs every position it receives; if the receiver instructs the transfer together with the sender, it completes in one step. See [`AryaFi.Finance.TokenTransfer`](daml/src/AryaFi/Finance/TokenTransfer.daml). The interface package is vendored from Splice 0.8.3.
- **Token-standard settlement.** Cash and securities can be settled with the token standard's V2 allocation interfaces (CIP-0112, `Splice.Api.Token.AllocationV2` and `AllocationInstructionV2`), so settlement apps can settle trades in AryaFi positions through the standard, alongside other registries' tokens. A bank or custodian creates a `PositionAllocationFactory` for its clients and the settlement agents. Each account allocates its sides of a settlement's legs: what it sends net of what it receives is locked to the registry, and an allocation that only receives is the receiver's consent. The settlement agent then calls `SettlementFactory_SettleBatch` at each registry in one transaction. The registry settles only if the allocations authorize exactly both sides of every leg; it archives the locked funding and creates each account's net receipts, with the instrument details copied from the delivered positions. An allocation never settles on its own (`Allocation_Settle` is refused), so nothing is created or destroyed outside a checked batch. Until settlement, the agent can cancel an allocation and the owner can withdraw it (a committed one only after its settlement deadline). See [`AryaFi.Finance.TokenAllocation`](daml/src/AryaFi/Finance/TokenAllocation.daml).
- **Token-standard DvP.** `TokenDvpInstruction` settles delivery versus payment through the standard's allocations, at any V2 registry: a bond against AryaFi cash, or against another registry's token. The settlement agent alone records the trade and asks for allocations: seller and buyer each get an `AllocationRequest` (`Splice.Api.Token.AllocationRequestV2`) that their wallets show, and allocate from their own nodes. `ExecuteTokenDvp` then calls each registry's `SettlementFactory_SettleBatch` in one transaction, so both legs settle or neither does; `CancelTokenDvp` cancels the allocations instead. Because each party acts in its own submission, this DvP does not need the parties on one participant: `runTokenDvpAcrossNodes` runs it on the five-participant topology with custodian, bank, seller, buyer, and agent each on their own node, issuing the positions across nodes with token-standard transfers, locally and in CI. See [`AryaFi.Finance.TokenDvp`](daml/src/AryaFi/Finance/TokenDvp.daml).
- `TokenDvpTest`: six tests, including a bond settled against Splice's reference V2 token (`splice-test-token-v2`, vendored for the tests only), standing in for tokens such as Canton Coin; a party that does not allocate; the deadline; the allocation requests wallets see; and the agent's checks. CI runs them on the five-participant Canton topology.
- `TokenAllocationTest`: eleven tests, including bond-for-cash through two registries in one transaction, netting, the checks at allocation and settlement, an incomplete batch leaving the other registry's batch unsettled, cancellation, withdrawal, committed allocations, and who sees what. CI runs them on the five-participant Canton topology.
- `TokenTransferTest`: ten tests covering two-step transfers of cash and securities, rejection, withdrawal, expiry, one-step transfers, the registry's checks (instrument, account provider, clients, inputs, deadlines), who may act, and a wallet's view. CI runs them on the five-participant Canton topology as well.
- [Ledger API client guide §6.3](docs/integration/LEDGER_API_CLIENT.md#63-token-standard-holdings-transfers-and-settlement): listing, sending, and settling holdings with only the token standard's interface IDs, including a DvP that settles at two registries in one submission. The requests were run against a Canton 3.5 participant.
- The website's code viewer shows `TokenTransfer.daml`, `TokenAllocation.daml`, and `TokenDvp.daml`.

### Changed
- The authorization matrix lists the token-standard choices AryaFi implements, with the parties each implementation requires among the `actors`.

### Fixed
- The TestNet runbook and the user guide no longer say that AryaFi does not implement the token standard.

## [3.1.0] - 2026-10-01

An upgrade-compatible release: Canton's participant upgrade check accepts it as an upgrade of 3.0.0, so participants running 3.0.0 can move to it without migrating contracts. It makes AryaFi positions Canton Network Token Standard holdings and rebuilds the website.

### Added
- **Canton Network Token Standard holdings.** `CashPosition`, `SecurityPosition`, and `AssetHolding` implement the `Holding` interface of CIP-56 (`Splice.Api.Token.HoldingV1`) and of the approved V2 standard, CIP-0112 (`HoldingV2`), so wallets and apps that read token-standard holdings see AryaFi positions. The V2 account is the owner, the bank or custodian as provider, and the AryaFi account ID; the instrument is the currency, ISIN, or asset ID under the bank, custodian, or issuer; a lock shows the lock holder with the trade reference as context. The interface packages are vendored from Splice 0.8.3 in `daml/deps/splice`. See [`AryaFi.Finance.TokenStandard`](daml/src/AryaFi/Finance/TokenStandard.daml).
- `TokenStandardTest`: six tests for the holding views, including locks during DvP and holdings changing hands at settlement. On a Canton 3.5 participant, a JSON Ledger API query filtered by the standard's `Holding` interfaces returns the settled positions with the right instrument, amount and account, and nothing to an outsider.

### Website
- **Rebuilt for the people evaluating AryaFi Core.** The six technical tabs (Topology, Simulator, Contracts & Math, ISO 20022, Security & Rules, Daml Code) are replaced by four views that answer a visitor's questions: **Overview** (what it does, why it matters, who takes part, what works today and what doesn't), **See a trade settle**, **What's inside**, and **Developers**. Links to the old tabs open the matching view.
- **See a trade settle** replays the tested bond-for-cash scenario step by step, with a card per institution showing what it holds and stores. **Whose view?** hides everything a chosen institution's node does not store, and **What if…?** tries what the contracts prevent, each result naming the test that checks it.
- Removed claims the code does not support: the Security tab's ticks for regulatory outcomes (capital neutrality, Basel III treatment, UCC perfection) and the regulatory labels on the collateral calculator.
- The site follows the system light or dark setting, works at phone width without sideways scrolling, and no longer has the hotkey panel or the split calculator.
- **Docs view.** Eleven key documents are rendered on the site from the repository's Markdown, so readers without access to the private repository can read them. Links between documents, including links to sections, stay on the site.
- **Only the site's own files are deployed.** Deploys uploaded the whole repository, so everything in it (tests, deployment configuration, the requirements document) could be downloaded from the site. `.vercelignore` now limits the deployment to the site, the published documents, and the seven contract modules the source viewer shows.
- The GitHub link is removed from the header, because the repository is private.

### Changed
- **Release notes come from this file.** The release workflow publishes the CHANGELOG section for the tagged version as the GitHub release notes, with links made absolute, and fails before building if the section is missing. GitHub's generated notes listed pull requests by merge commit, so v3.0.0's first notes named the wrong pull request. The steps are in [VERSIONING_AND_RELEASE.md §3](docs/governance/VERSIONING_AND_RELEASE.md).

---

## [3.0.0] - 2026-09-30

This release moves AryaFi Core to **Daml 3** (Daml SDK 3.5.12, Daml-LF 2.2) and **Canton 3.5**, the platform the Canton Network runs, as decided in [IMPROVEMENT_PLAN.md §2](docs/IMPROVEMENT_PLAN.md). It is a major version: the DAR no longer runs on Canton 2, contract keys are removed, and clients must use Ledger API v2. Template fields and choices are otherwise unchanged from v2.0.0. See [MIGRATION_GUIDE.md §6](docs/governance/MIGRATION_GUIDE.md) for upgrade notes.

### Changed
- **Platform.** Daml SDK 3.5.12, installed with `dpm`; Daml-LF 2.2; tested on Canton 3.5.19 with protocol version 35.
- **Contract keys removed** from `Account`, `InstitutionalParty`, `FinancialObligation`, `KycAttestation`, `SanctionsAttestation`, `TransferRestrictionRule`, and `OwnershipRestriction`. Daml-LF 2.2 has no contract keys. The library never looked them up, but the ledger no longer rejects duplicates; see [KNOWN_LIMITATIONS.md §2](docs/KNOWN_LIMITATIONS.md).
- **Separate test package.** The production package `aryafi-core` (in `daml/src`) no longer depends on `daml-script`; the tests are the `aryafi-core-test` package in `daml/test`. `multi-package.yaml` builds both with `dpm build --all`. Releases publish only the production DAR.
- **Reference topology** (`deploy/`) runs on Canton 3.5.19: one synchronizer (BFT sequencer and mediator) and five participants, each with a gRPC Ledger API (`xxx2`) and a JSON Ledger API (`xxx3`). The Docker image uses Java 21.
- **CI** builds and tests with `dpm` (coverage across both packages with `dpm test --all`), and the `canton-topology` job runs the DvP suites on the Canton 3.5 topology.

### Added
- **TestNet readiness** ([deploy/testnet](deploy/testnet/README.md)): a network smoke test (`AryaFi.Test.Network.SmokeTest`) that allocates five run-scoped parties and settles one DvP, a runner script that uploads only the production DAR and supports JWT and TLS, and a runbook for a first run on the Canton Network TestNet. CI runs it against the `deploy/` topology.

### Web Terminal
- The ISO 20022 hub shows **JSON Ledger API v2** requests (`/v2/commands/submit-and-wait`, `/v2/state/active-contracts`) with package-name template IDs, and the validator checks their structure: template ID form, command ID matching the message ID, and every signatory in `actAs`. Each request was accepted by a Canton 3.5 sandbox.

### Fixed
- The `expectFailure` test helper caught its own "expected failure but succeeded" abort, so it could never fail. It now uses `tryFailureStatus` and fails when the action succeeds.
- The DvP test suite allocated the same party names in every test, which a Canton 3 ledger rejects; each test now allocates its own parties, so the suite runs against real participants.

### Documentation
- [LEDGER_API_CLIENT.md](docs/integration/LEDGER_API_CLIENT.md) rewritten for Ledger API v2: user tokens and rights, package-name template IDs, change-ID deduplication, update streams, and TypeScript and Python examples checked against a Canton 3.5 sandbox.
- [MIGRATION_GUIDE.md §6](docs/governance/MIGRATION_GUIDE.md) covers moving from v2.0.0; the operations runbook uses Canton 3 upgrade checks (`dpm upgrade-check`).
- README, user guide, platform specification, audit dossier, integration docs, and examples updated for `dpm`, the test package, and Canton 3.5.

---

## [2.0.0] - 2026-09-29

This release makes the library build, makes its test suite run, and corrects the behaviour and documentation that did not match the code. It is a major version because of the breaking contract changes below, as required by [VERSIONING_AND_RELEASE.md](docs/governance/VERSIONING_AND_RELEASE.md). **Breaking:** several choices changed controllers or arguments (listed under *Changed*); see [MIGRATION_GUIDE.md](docs/governance/MIGRATION_GUIDE.md) for upgrade notes.

### Fixed
- **Build.** `daml build` failed with 13 errors in 12 production modules (a `Text`/`ISIN` type error in `Repo.daml`, multi-field constructors in `SecuritiesLending.daml` and `Redemption.daml`, and `-Werror` warnings). It now builds with `-Wall -Werror`; only `-Wno-name-shadowing` is disabled, for the `maintainer key._1` idiom.
- **Test suite.** The tests had never compiled: 91 further errors referenced APIs that did not exist (`KYCAttestation`, `SanctionsScreeningAttestation`, `ExecutePayment`, `asOf`, raw `Text` for `ISIN`/`LEI`/`CUSIP`). All 289 test scripts now compile and pass.
- **DvP settlement did not move assets.** `ExecuteDvpSettlement` only set a status flag. It now takes the two locked legs, validates owner, account, ISIN, quantity, currency, amount, lock holder, and lock reference, and delivers the security and the cash in one transaction.
- **Locks could be withdrawn mid-settlement.** Owner and custodian could unlock a leg after agreeing a DvP. Locks now name a lock holder, who alone can release or settle the position.
- **Transfers failed at runtime.** `TransferCash`, `TransferSecurity`, and `TransferAsset` created a position for a receiver without its authority. They now require the receiver, and clear observers so the previous owner's viewers do not follow the asset.
- **`SplitCash` always failed** with a unique-key violation: both halves shared the `CashPosition` contract key, which has been removed.
- **Borrowers could erase their own debt.** `PayDownPrincipal` and `PayAccruedInterest` are now recorded by the lender. `AccrueInterest` computes interest from rate, day count, and ledger time instead of accepting an amount from the lender.
- **Securities lending:** a full return left 0.01 phantom units on loan (now exactly zero); a partial return silently cancelled a recall (the recall now persists with the remaining quantity); the borrower could release all collateral while returning one share (release is capped pro rata); the borrower could confirm its own fee payment (now the lender); fees need both counterparties.
- **Margin:** the payer could mark a call satisfied without paying. Fulfilment is now two-step (`ConfirmMarginReceipt` / `RejectMarginFulfilment`), and default can only be declared after the deadline.
- **Dead-end states:** an amended `FinancialObligation` could never be paid or defaulted, and only one partial payment was possible; substituted `CollateralPosition`s could not be substituted, disputed, or revalued again. Both state machines are fixed.
- **Repo:** the custodian could close an active repo early on its own; `RollRepo` accepted an earlier end date.
- **`EvaluateTransfer`** (replaces `IsTransferAllowed`) now checks holding period, whitelist, and regulatory category, not just the lockup, and an inactive rule no longer blocks every transfer.
- **Backdatable timestamps:** KYC, sanctions, pledge enforcement, redemption settlement, and report amendments now record ledger time instead of a caller-supplied value.
- **Day counts:** Act/Act ISDA (was actual/365.25) and 30/360 (was actual/360) now follow ISDA 2006 §4.16.
- **Disclosure:** adding an observer to a loan, repo, securities loan, margin call, pledge, or collateral position now requires both counterparties.
- **Invalid identifiers:** the example ISINs (e.g. `US912828ZM24`) and CUSIP failed their check digits; replaced with valid ones throughout.
- **Build and deploy configuration:** `init-script` pointed at a missing function; the Canton config used Canton 3 settings (protocol version 30) with a Daml 2.10 SDK and referenced a `canton-open-source:3.0.0` image that does not exist; the bootstrap script mixed shell commands into its Scala and uploaded a mis-named DAR. The topology now boots on Canton 2.10 and the DvP suites pass against it with `daml script`.
- **CI:** the SDK cache could restore a different SDK version; the release workflow published DARs without running tests. Both fixed; CI also publishes JUnit results and coverage.

### Changed
- `LockCash` / `LockSecurity` take a `holder`; `LockAsset`'s `lockingParty` becomes the lock holder. `UnlockCash` / `UnlockSecurity` / `UnlockAsset` are controlled by the lock holder. New `SettleLockedCash` / `SettleLockedSecurity`.
- `ExecuteDvpSettlement` takes `sellerSecurityCid` and `buyerCashCid` and returns `DvpSettlementResult`.
- `InstitutionalLoan` gains `interestAccruedThrough`; `AccrueInterest` has no arguments.
- `SecLendingStatus.LendingRecallIssued` and `RedemptionStatus.RedemptionSettled` use named fields.
- `TransferRestrictionRule` gains `whitelist`, `AddToWhitelist`, `RemoveFromWhitelist`; `IsTransferAllowed` is replaced by `EvaluateTransfer`, which returns a `PolicyDecision`.
- Timestamp arguments removed from `UpdateKycStatus`, `RevokeKyc`, `UpdateSanctionsStatus`, `BlockParty`, `ClearParty`, `EnforcePledge`, `ExecuteRedemptionSettlement`, and `SubmitAmendment`.
- `CashPosition` no longer has a contract key.

### Web Terminal
- Removed simulated figures presented as live data: the random volume ticker, "BFT commit" latency, "Zero-Knowledge Proofs", and "PROVEN / COMPLIANT" export stamps. The simulator and exports are labelled as a scripted simulation.
- The ISO 20022 "validator" always reported success; it now runs real checks (XML/JSON well-formedness, required elements, ISIN/LEI check digits, UETR, currency, XML/JSON consistency). Payloads are real Daml JSON API v1 bodies for the actual templates.
- The code viewer showed hand-written code that did not exist in the repository (e.g. a different `Loan.daml`); it now loads the real source files.
- Real institutions (Federal Reserve, Goldman Sachs, Morgan Stanley, DTCC, BNY, SEC) are no longer depicted as network participants.
- The split calculator uses exact 10-decimal fixed-point arithmetic, like Daml `Decimal`, instead of floating point.

### Documentation
- Added [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) and [IMPROVEMENT_PLAN.md](docs/IMPROVEMENT_PLAN.md).
- [AUTHORIZATION_MATRIX.md](docs/security/AUTHORIZATION_MATRIX.md) is now generated from the source by `scripts/gen_authorization_matrix.py`; the previous version listed choices and templates that did not exist.
- Corrected claims that did not hold: "mathematically verified", "audited", "Production Candidate", Canton "Protocol v30", automated SEC CAT emission, the audit dossier's lock-exclusivity lemma (it did not prevent double-pledging), and Basel Group 1a criteria marked "MET".
- Removed the unused `daml/test/` directory (duplicates outside the build).

---

## [1.0.1] - 2026-09-25

### Added
- **Institutional Design System & Themes**:
  - Default crisp Light Mode (pure institutional black-on-white) and High-Contrast Dark Mode (pure white-on-black) without electric blue/navy tints.
  - Native Terminal Hotkey Navigation (`1`-`6` for tabs, `T` for theme toggle, `R` for scenario run, `?` for interactive cheatsheet modal, `Esc` to dismiss).
- **Simulator & Analytics Enhancements**:
  - Real-time BFT consensus commit latency meters and sub-transaction zero-leakage verification.
  - Lifecycle advancement progress bar with live phase completion percentage.
  - Regulatory-grade audit trail export in CSV and JSON formats for SEC CAT and FINRA compliance.
- **Collateral & Risk Valuation Matrix**:
  - Interactive collateral haircut calculator supporting US Treasuries (2%), GSE Agency (3%), G10 Sovereigns (2.5%), and Corporate debt (5%-15%).
  - Real-time maintenance margin threshold and Basel III Level 1/2A HQLA eligibility evaluation.
- **ISO 20022 Hub Upgrades**:
  - Bi-directional translation toggle between inbound SWIFT MX XML and outbound synthesized MX messages.
  - Interactive schema field mapping lexicon aligning SWIFT MX XML elements with Canton Daml ledger commands.
  - Real-time XML/JSON validation engine with status toast feedback.

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
