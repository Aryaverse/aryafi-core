# AryaFi Core: Improvement Plan — Taking the Library to the Next Level

**Audience:** engineering and product leads deciding what AryaFi Core builds next.
**Baseline:** v3.0.0 (2026-09-30), the first release on Daml 3 / Canton 3.5. **Companion documents:** [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) (what is true today) and the [Technical & Business Requirements](requirements/TECHNICAL_BUSINESS_REQUIREMENTS.md) (what the product must become).

---

## 1. Where We Are

v2.0.0 made the library honest and working, and v3.0.0 moved it to Daml 3 / Canton 3.5, the platform the Canton Network runs. It builds with `-Wall -Werror`, 290 test scripts pass, and atomic DvP moves real positions on a real five-participant Canton 3.5 topology. Authorization defects are fixed: receiver-authorized transfers, locks held by a named lock holder, and no party able to reduce its own obligation. The docs and web terminal now describe the code as it is.

What v3.0.0 is **not** yet is what the requirements call for: *"software infrastructure — not a collection of sample contracts."* Today, only DvP composes primitives. Every other workflow (loan, repo, securities lending, margin, pledge, escrow, subscription, redemption, transfer) is a standalone status record that references assets by text. Compliance policies are correct but cannot be called from those workflows. Every multi-party contract depends on co-submission, which does not work across separate participants.

| Requirement (TBRD) | v3.0.0 | Gap closed by |
|:---|:---|:---|
| Composable primitives (§5, §9) | DvP composes Cash + Security; nothing else does | Workstreams 1, 4 |
| Synchronized DvP (§3, §26) | Done, Model 1, single-participant tested | Workstream 2 (cross-participant) |
| Loan references compliance via controlled interfaces (§10) | No | Workstream 3 |
| Repo substitution re-runs eligibility (§11) | No | Workstreams 3, 5 |
| Generic, policy-driven transfer engine (§12) | Manual officer approval | Workstream 3 |
| Idempotency, correlation, reconciliation interfaces (§15) | Fields exist; not enforced | Workstreams 6, 9 |
| Privacy tested from every participant (§16, §18) | Single-ledger tests only | Workstream 7 |
| Property-based and concurrency tests (§18) | None | Workstream 7 |
| Maturity labels and release assurance (§19, §20) | Labels assigned; no review | Workstream 8 |

---

## 2. Target Platform (decided: Option B)

**Decided 2026-09-30: Option B.** v3.0.0 moves the library to Daml SDK 3.5 (Daml-LF 2.2) and Canton 3.5: the seven contract keys are removed, the tests are a separate package, and the `deploy/` topology and CI run on Canton 3.5.19. Aligning holdings and DvP with CIP-56 is Workstream 1, the next step.

The options as they were weighed:

| Option | What it means | Consequences |
|:---|:---|:---|
| **A. Stay on Daml 2.x / Canton 2.x** | Keep the current SDK; model holdings on Daml Finance-style interfaces. | Lowest short-term cost. Cannot deploy to the Canton Network Global Synchronizer (Canton 3); a second migration later. |
| **B. Move to Daml 3 / Canton 3 (recommended)** | Target the platform the Canton Network runs; align holdings and DvP with the Canton Network Token Standard (CIP-56: holdings, transfer instructions, and allocations settled by an executor). | One migration now. Contract keys must be redesigned (seven templates use them). Assets become interoperable with other CIP-56 tokens and wallets, which is where the requirements' market evidence (DTCC, Tradeweb, cross-border repo) points. |

**Recommendation: Option B.** The core design in v2.0.0 (locking to a settlement agent, then atomic delivery) maps directly onto CIP-56 allocations, so the DvP work carries over. Staying on 2.x would make the library's most valuable asset, its settlement and collateral semantics, unusable on the network its customers are adopting.

---

## 3. Workstreams

### Phase 1 — The Composable Core (the product)

**1. Holdings standard.** Replace the three separate position templates (`CashPosition`, `SecurityPosition`, `AssetHolding`) with one holding model behind interfaces: *Holding* (view: owner, instrument, amount, custodian), *Lockable* (lock to a holder), and *Transferable*. On Option B, implement the CIP-56 holding and allocation interfaces. Everything else in the library will hold and move assets through these interfaces.
*Done when:* every workflow that moves value does so through a holding interface, and DvP settles any pair of holdings (cash for security, security for security).

**2. Propose/accept for every multi-signatory workflow.** Add a proposal template (or a delegation role contract) for each agreement that today needs multi-party submission: DvP instructions, loans, repos, securities loans, margin calls, pledges, payment instructions, transfers. This is what makes the library usable across separate participants; it is the single largest blocker to real deployment.
*Done when:* the reference scenarios run with each institution's party on its own participant in `deploy/` (see Workstream 7).

**3. Compliance as composable policy.** Turn the compliance modules into an interface, e.g. `evaluate : Context -> PolicyDecision`, that business workflows call inside their own transactions. Share policy and attestation contracts with the workflows that need them via explicit contract disclosure. Then:
- `AssetTransferRequest` completion and `ExecuteDvpSettlement` evaluate KYC, sanctions, transfer restrictions, and ownership limits for both parties atomically, instead of relying on a manual approval.
- Every decision (approved or rejected, with reasons) is recorded as an audit event.
- Asset classes become the typed `AssetClass`; jurisdictions gain effective dates (§8); `minCreditRating` is evaluated; ownership percentages are computed from holdings, not supplied by the caller.
*Done when:* a transfer to a sanctioned or non-whitelisted receiver fails inside the transfer transaction, with the reason recorded.

**4. Financing contracts that hold real assets.** Rebuild the financing workflows on Workstreams 1–3:
- **Pledge and collateral** lock the pledged holding to the pledgee or tri-party agent, which closes the double-pledge gap (threat E-04). Release and enforcement act on the locked holding.
- **Loan** drawdown and repayment move cash through allocations; interest and principal are settled, not just recorded.
- **Repo** opening and closing legs are DvP settlements created by the agreement; margin transfers move collateral or cash.
- **Securities lending** delivers securities and collateral atomically at inception and return; fees and rebates are computed from rates and time.
- **Subscription and redemption** issue and burn fund units against cash.
*Done when:* no workflow references an asset or payment by free text.

**5. Lifecycle events and reporting.** Emit `AuditLog` events from every state transition, and generate `RegulatoryReportRecord` drafts (CAT, TRACE, EMIR, MiFIR fields) from settlement events rather than relying on reporting parties to create them by hand. This is the "core contracts emit reportable data" requirement (§8).

**6. Integration contract.** Make idempotency real by deriving every Ledger API command ID from the business idempotency key, and document the deduplication period. Validate ISIN, CUSIP, and LEI check digits in `ensure` clauses or smart constructors. Publish a stable event schema for the transaction stream so reconciliation and adapters do not depend on template internals.

### Phase 2 — Differentiation: Collateral, Repo, Liquidity

The requirements' own market evidence (90% of surveyed banks see rising collateral-mobility demand; 54% have repo or liquidity initiatives) says this is where customers will pay. Build it on Phase 1.

**7. Collateral engine.**
- Eligibility schedules and haircuts held as data, per counterparty agreement.
- Concentration limits per issuer and asset class.
- A price-feed contract signed by a market-data provider, with a timestamp and staleness bound, replacing custodian-entered valuations (closes the residual risk in threat T-03).
- Exposure-versus-collateral calculation that raises margin calls automatically.
- Substitution that re-runs eligibility and value checks before swapping locked holdings.

**8. Repo and settlement depth.**
- Intraday repo (hour-level maturities) and cross-currency repo, matching the cross-border intraday repo evidence in §3.
- Netted settlement (DvP Models 2 and 3, declared but not executed today) and batch settlement of many legs in one transaction.
- Asset servicing: coupon payments, maturities and redemptions, corporate actions, driven by instrument lifecycle events.
- Partial settlement and partial fills (legs must match exactly today).

### Phase 3 — Productize and Assure

**9. Test program.**
- Multi-participant tests in CI on the `deploy/` topology, with the Docker image built in CI, one institution per participant, and privacy asserted from every participant's view (§16).
- Property-based or randomized tests for the invariants in the audit dossier: value conservation, lock integrity, DvP atomicity, and no self-reduction of obligations.
- Concurrency tests for contention on the same holding, for example two settlements racing for one position.
- A coverage gate in CI: choices exercised from 67% today to at least 90%, with every template created in tests (`JurisdictionProfile` is not today).

**10. Packaging and upgrades.** ~~Split the build into a production package and a test package~~ (done in v3.0.0). Canton 3 validates every release of `aryafi-core` as an upgrade of the previous one, so run `dpm upgrade-check` against the last released DAR in CI, and design templates so later releases stay upgrade-compatible. Publish a compatibility matrix and a release assurance report per release (§19, §20).

**11. Developer experience.** Generate TypeScript and Java bindings (codegen) and publish them with each release. Ship reference adapters (payments, custody, KYC) against the stable event schema, and a reconciliation service that compares the ledger to external books of record.

**12. Live web terminal.** Connect the terminal to a sandbox through the JSON Ledger API, so scenarios run for real and each participant's view shows the contracts it actually stores. This turns the site from an explanation into a demonstration buyers and auditors can check.

**13. Independent security review.** Commission the review against the audit dossier once Phase 1 is complete, fix findings, and promote module maturity labels based on the result (`Production Candidate`, then `Production Reviewed`). Legal review of default, closeout, and pledge semantics runs in parallel (§10, §31).

---

## 4. Sequencing

| Order | Workstream | Depends on | Size (2–4 Daml engineers) |
|:---:|:---|:---|:---|
| 0 | Platform decision (§2) and move to Daml 3 / Canton 3.5 | — | Done (v3.0.0) |
| 1 | Holdings standard (1) | Decision | 3–4 weeks |
| 2 | Propose/accept (2) | 1 | 2–3 weeks |
| 3 | Composable compliance (3) | 1, 2 | 3–4 weeks |
| 4 | Multi-participant CI tests (part of 9) | 2 | 1–2 weeks, start with 2 |
| 5 | Financing on real assets (4) + events (5) + integration contract (6) | 1–3 | 6–8 weeks |
| 6 | Independent security review (13) of Phase 1 | 1–6 | 4–6 weeks elapsed |
| 7 | Collateral engine (7) | 4 | 6–8 weeks |
| 8 | Repo and settlement depth (8) | 4, 7 | 6–8 weeks |
| 9 | Packaging (10), SDKs (11), live terminal (12) | Phase 1 | in parallel, 4–6 weeks |

Sizes are planning estimates, not commitments. The critical path is platform decision → holdings → propose/accept → compliance → financing, roughly four to five months for Phase 1 with the team the requirements describe (§29).

---

## 5. How We Will Measure Progress

These use the success metrics in the requirements (§33), with today's baseline.

| Metric | Baseline (v2.0.0) | Target after Phase 1 |
|:---|:---|:---|
| Modules at `Beta` or above | 10 of 32 | All production modules |
| Workflows that move assets on-ledger | 1 (DvP) | All financing workflows |
| Choices exercised in tests | 67% | ≥ 90% |
| Scenarios passing across separate participants | 0 | All reference applications (§23) |
| Workflows built without changing core modules | 0 demonstrated | Every reference application |
| Independent security findings open | Review not started | Zero critical/high at release |

---

## 6. Risks and Open Questions

- **Platform migration cost** (Option B) is front-loaded; delaying the decision raises it, because every Phase 1 workstream would be built twice.
- **Legal semantics.** Default, closeout, pledge enforcement, and token-versus-legal-ownership need legal review before any module is labelled production (§5, §31). Engineering can model the choices; it cannot decide them.
- **Over-generalization.** The holdings and compliance interfaces must stay small; the requirements warn against both monolithic contracts and customer-specific forks (§31).
- **Standards drift.** If CIP-56 or the JSON API changes during the build, the adapter and holdings layers absorb it; keep application code behind them.
- **Decisions needed from leadership:** the platform (§2), which reference application leads Phase 2 (collateral or repo), and the budget and timing of the independent review.
