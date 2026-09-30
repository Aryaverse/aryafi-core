# Known Limitations

This page records what AryaFi Core does **not** do yet, so that nobody builds on an assumption the code does not support. It is required by the *Definition of Done — Production Module* (Technical & Business Requirements §21, §30) and is updated with every release.

Last reviewed: 2026-09-30, against the code at v3.0.0.

---

## 1. Maturity Status

Maturity labels follow [VERSIONING_AND_RELEASE.md](governance/VERSIONING_AND_RELEASE.md#2-module-maturity-levels). No module has had an independent security review, so none is `Production Candidate` or `Production Reviewed`.

| Module | Status | Why |
|:---|:---|:---|
| `Common.*` (Types, Identifiers, Time, Errors, Policies, Events) | Beta | Used by all modules and unit-tested; day-count conventions verified against ISDA examples. |
| `Finance.Cash`, `Finance.Security`, `Finance.Asset` | Beta | Lock-holder model, receiver-authorized transfers, and split/merge are tested, including negative and privacy tests. |
| `Finance.Settlement` (DvP) | Beta | Atomic Model 1 DvP moves real positions and is tested for leg mismatch, lock integrity, retry, and cancellation. |
| `Finance.Account`, `Finance.Party`, `Finance.Obligation`, `Finance.Payment`, `Finance.Collateral` | Experimental | State records; not yet linked to the positions they describe. |
| `Contracts.*` (Loan, Repo, ReverseRepo, SecuritiesLending, Margin, Pledge, Escrow, Transfer, Subscription, Redemption) | Experimental | Lifecycle state machines with corrected authorization, but no on-ledger movement of cash or securities (see §3). |
| `Compliance.*` | Experimental | Policies evaluate correctly but cannot yet be called from business workflows (see §4). |

## 2. Platform

- **Daml 3 / Canton 3.5.** The DAR targets Daml-LF 2.2 (Daml SDK 3.5.12) and is tested on Canton 3.5.19 with protocol version 35. It does not run on Canton 2.x. It has not yet been deployed to the Canton Network; [deploy/testnet](../deploy/testnet/README.md) has the smoke test and runbook for a first TestNet run (TestNet runs Canton 3.5.18 as of 2026-09-30).
- **No uniqueness guarantees.** Daml-LF 2.2 has no contract keys, so the ledger does not stop a second `Account` with the same custodian and account ID, a second `KycAttestation` or `SanctionsAttestation` for the same authority and subject, or a second `TransferRestrictionRule` or `OwnershipRestriction` for the same ISIN. The issuing party must check its active contracts before creating one.
- **Upgrades are checked by Canton.** Canton 3 validates every package with the same name (`aryafi-core`) as an upgrade of the versions already on the participant. A release that changes templates incompatibly must use a new package name or a separate participant. Releases are not yet checked with `dpm upgrade-check` in CI.

## 3. Composition and Asset Movement

- **Only DvP moves assets.** `ExecuteDvpSettlement` delivers locked `SecurityPosition` and `CashPosition` contracts atomically. Every other workflow (`InstitutionalLoan`, `RepoAgreement`, `SecuritiesLendingAgreement`, `MarginCall`, `AssetPledge`, `ConditionalEscrow`, `AssetTransferRequest`, `FundSubscription`, `AssetRedemption`, `PaymentInstruction`) records lifecycle state only. Cash and securities move off-ledger or through separate transfers.
- **References are text, not contract IDs.** Pledges, collateral positions, margin calls, loans, and repos identify assets and payments by text reference, so the ledger does not stop one asset being pledged to several agreements.
- **Exact-size legs.** A DvP leg must match the instructed quantity or amount exactly; split the position first. Partial settlement is not supported.
- **Netted settlement.** `DvpModel2` and `DvpModel3` exist as reference data; only Model 1 executes.
- **Failed or cancelled DvP.** Both legs stay locked to the settlement agent, who must release them with `UnlockSecurity` / `UnlockCash`.

## 4. Multi-Party Workflows and Compliance

- **No propose/accept workflows.** Every multi-signatory contract is created with multi-party submission (`submit (actAs [...])` in Daml Script, several `actAs` parties on the Ledger API). On a real multi-participant topology, parties hosted on different participants cannot co-submit, so these workflows need proposal templates first. The reference topology in `deploy/` boots and accepts the DAR, but no cross-participant workflow is scripted yet.
- **Compliance checks are not composable.** `IsKycValid`, `IsSanctionsClear`, `EvaluateEligibility`, `EvaluateTransfer`, and `CheckOwnershipLimit` are controlled by the policy owner. Transfer approval (`ApproveTransfer`) is a manual decision by the compliance officer; it does not evaluate the policies itself.
- **Simplified policies.** `EvaluateTransfer` maps regulatory categories to investor flags supplied by the caller; it is not legal advice. `EligibilityPolicy.minCreditRating` is stored but not evaluated. Asset classes are free text rather than the `AssetClass` type. `OwnershipRestriction` percentages are supplied by the caller, not computed from holdings. `JurisdictionProfile` has no effective dates.
- **Identifiers are not validated on-ledger.** ISIN, CUSIP, and LEI values are wrapped in newtypes but their check digits are not verified by any template.

## 5. Financial Semantics

- **Interest is computed only for loans.** `InstitutionalLoan` accrues interest from rate, day count, and ledger time. Securities-lending fees are agreed by both counterparties; the rebate rate is stored but not applied. Repo repurchase prices are agreed, not checked against the repo rate.
- **Day counts.** Act/360 and Act/365F count elapsed 24-hour periods between timestamps; Act/Act ISDA and 30/360 (US Bond Basis only) use UTC calendar dates. There is no business-day calendar or date adjustment.
- **Rounding.** Amounts use Daml `Decimal` (10 decimal places). The `RoundingMode` type exists but no calculation applies a currency-specific rounding convention.

## 6. Integration and Operations

- **Idempotency keys are stored, not enforced.** Use the Ledger API command ID and deduplication period for idempotent submission.
- **Audit events are not emitted automatically.** `AuditLog` and `RegulatoryReportRecord` contracts are created by the reporting party; no workflow emits them on settlement.
- **Local test topology only.** `deploy/` runs five in-memory Canton 3.5 participants and one synchronizer (sequencer and mediator) for integration testing. The config and bootstrap script have been run against Canton 3.5.19, and the DvP scenario and test suites (`runTreasuryDvpScenario`, `runDvpSettlementTests`) pass with `dpm script` against one of its participants. CI builds the Docker image, boots the topology, and runs both suites against it on every push and pull request (`canton-topology` job). Scripts that call `setTime` only run on the test ledger.
- **No field filters on the JSON Ledger API.** The v2 active-contracts endpoint filters by template and party only, so statement reconciliation (`camt.053`, `semt.002`) filters positions by account, currency, or ISIN in the client. A participant query store (PQS) would move that filtering into SQL.
- **The website is a replay.** The trade walkthrough at https://aryafi-core.vercel.app replays the tested DvP scenario and does not connect to a ledger. Its code viewer shows the real source files.

## 7. Test Coverage

`dpm test` runs 290 scripts, all passing. Coverage: 26 of 27 templates created (96%) and 138 of 206 choices exercised (67%, including each template's implicit `Archive`). `JurisdictionProfile` is never created in tests. Property-based tests and multi-participant integration tests do not exist yet.

See [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) for how these limitations are addressed.
