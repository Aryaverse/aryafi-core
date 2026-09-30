# AryaFi Core: User & Operator Guide

Welcome to the **AryaFi Core** user guide. This document explains how to use the web terminal (a scripted simulation that explains the library), how to build and test the Daml library, and how to run the local multi-participant Canton topology. For what the library does not do yet, see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 1. Accessing the Live Web Terminal

The web terminal is hosted on Vercel at:

🌐 **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**

> The terminal does **not** connect to a ledger. Its simulator replays the library's Daml test scenarios step by step; the code viewer loads the real source files from this repository.

### System Requirements
* Any modern web browser (Chrome, Chromium, Edge, Safari, Firefox) with JavaScript enabled.
* Screen resolution: Optimized for desktop (1440px+ institutional widescreen) and responsive across laptops, tablets, and mobile devices.
* Theme Toggle: Instant switching between **Crisp Light Theme** (default institutional black-on-white) and **Institutional Dark Theme** (high-contrast white-on-black) via the `[ ◐ Theme ]` button in the top navigation header. Preferences are saved automatically to `localStorage`.

---

## 2. Navigating the Institutional Terminal

The terminal is structured into six dedicated modules accessible via the top navigation bar or direct URL hashes:

```
[ Topology (#topology) ] [ Simulator (#simulator) ] [ Contracts & Math (#contracts) ]
[ ISO 20022 Hub (#iso) ] [ Security & Rules (#security) ] [ Daml Code (#docs) ]
```

### Keyboard Navigation
* You can navigate between tabs using the keyboard: press **`Tab`** to enter the navigation bar, and use the **`Left Arrow`** and **`Right Arrow`** keys to cycle between modules. Pressing **`Enter`** or **`Space`** activates the selected module.

---

## 3. Module Walkthroughs

### Module 1: Canton Multi-Participant Topology Visualizer (`#topology`)

The Topology Visualizer shows the five-participant reference topology defined in `deploy/canton/canton.conf` (Canton 3.5, protocol version 35): one synchronizer (sequencer and mediator) and one participant node per organization.

#### How to Use:
1. **Interactive SVG Node Map**:
   * Click on any participant circle on the map:
     * **Bank Node** (Cash Settlement Bank: issues tokenized deposits)
     * **Custodian Node** (Global Custodian / DvP Settlement Agent)
     * **Dealer A** (Seller)
     * **Dealer B** (Buyer)
     * **Regulator** (Supervisory Authority, observer only)
2. **Participant ACS Inspector**:
   * The right-hand inspector card dynamically updates to display:
     * **Participant ID**: Node identifier in the Canton topology configuration.
     * **Ledger API Endpoint**: Default gRPC / JSON endpoint (e.g. `localhost:10012`).
     * **Hosted Parties**: Daml parties allocated on that node.
     * **Party Namespace**: Assigned when the topology is bootstrapped.
     * **Contracts Stored**: Which contracts this node stores, i.e. those where its party is a stakeholder.
     * **Privacy Boundary**: What this participant can and cannot see.

---

### Module 2: Multi-Party Financial Lifecycle Simulator (`#simulator`)

The Simulator replays the library's scenario tests phase by phase. Each log line names the Daml choices the corresponding test exercises; nothing is submitted to a ledger.

#### Available Scenarios:
1. **Tokenized US Treasury + Cash DvP**:
   * Phase 1: Compliance Onboarding (KYC & Sanctions pre-trade gating).
   * Phase 2: Both legs locked to the settlement agent (seller's 5M face Treasury; buyer's 4,975,000 USD, split from 5M).
   * Phase 3: `DvpInstruction` co-signed by seller, buyer, and settlement agent.
   * Phase 4: `ExecuteDvpSettlement` validates both legs and delivers them in one transaction.
   * Phase 5: Seller records a `RegulatoryReportRecord` (SEC CAT regime); the regulator acknowledges it.
2. **Institutional Securities Lending**:
   * Tri-party lending agreement creation with 102% cash collateral pledge via `AssetPledge`.
   * Borrow fee agreed by both counterparties (Act/360) and payment confirmed by the lender.
   * Mark-to-market collateral revaluation.
   * Recall notice issuance and pro-rata collateral release.
   * Full return and agreement closeout.
3. **Treasury Cash Mobility & Zero-Balance Sweep**:
   * Multi-entity corporate cash accounts setup (US subsidiary, EU subsidiary, HQ pool).
   * Surplus capital identification via `SplitCash`.
   * Concentration sweep and pool consolidation via `MergeCash`.
   * Intercompany payment instruction co-signed by payer, payee, and bank; HQ locks 8M to the bank.
   * The bank delivers the locked cash (`SettleLockedCash`) and confirms the payment; the EU subsidiary sees none of it.

#### How to Operate:
1. **Select a Scenario**: Click on one of the scenario buttons in the left sidebar.
2. **Step-by-Step Execution**: Click **"Next Phase"** to advance through each step individually. The active step is highlighted with a cyan indicator, and executed phases turn emerald with a checkmark.
3. **Automated Run**: Click **"Auto-Run"** to step through the entire lifecycle automatically.
4. **Reset**: Click **"Reset"** to return the state machine to Phase 1.
5. **Copy Log / Export**: Copy the simulated log, or export it as CSV or JSON (the export is labelled as a simulation, not an audit record).

---

### Module 3: Contract Explorer & Split Calculator (`#contracts`)

#### Split Conservation Calculator
`SplitCash` turns a position of amount `A` into positions of `s` and `A − s`. Daml's `Decimal` is fixed-point with 10 decimal places, so the arithmetic is exact. The calculator mirrors that arithmetic in the browser (JavaScript floats would drift, e.g. `0.3 − 0.1`). It illustrates the rule; the on-ledger behaviour is verified by the Daml tests, not by this page.

1. Enter a **Total CashPosition Amount** (e.g. `10000000.00`).
2. Enter a **Split Amount** (e.g. `3500000.00`), or use a preset.
3. Click **"Execute Split"**. The panel shows both output positions, their sum, and `CONSERVED (exact, Δ = 0)`. Invalid inputs are rejected with the same rule `SplitCash` applies (split must be > 0 and < the position).

#### Template Cards:
Browse detailed operational parameters for:
* **`CashPosition`**: Tokenized deposit with split/merge, receiver-authorized transfer, and locks held by a named lock holder.
* **`SecurityPosition`**: CUSIP/ISIN safekeeping token.
* **`CollateralPosition`**: Haircut model ($V = M \times (1 - h)$), substitution, and disputes.
* **`DvpInstruction`**: BIS CPSS Model 1 atomic cross-asset delivery.
* **`InstitutionalLoan`**: Multi-drawdown credit facilities with auto-close logic.
* **`SecuritiesLendingAgreement`**: Stock loan fee accruals and recalls.

---

### Module 4: ISO 20022 Financial Messaging Hub (`#iso`)

Shows how ISO 20022 MX messages map to Canton 3.5 JSON Ledger API (v2) request bodies against the actual AryaFi templates.

#### Supported Messages:
* **`pacs.008.001.10`**: Financial Institutional Customer Credit Transfer $\rightarrow$ `PaymentInstruction`
* **`sese.023.001.10`**: Securities Settlement Transaction Instruction $\rightarrow$ `DvpInstruction`
* **`camt.053.001.10`**: Bank-to-Customer End-of-Day Statement $\rightarrow$ `CashPosition` Reconciliation
* **`semt.002.001.10`**: Custody Balance Accounting Statement $\rightarrow$ `SecurityPosition` Audit

#### How to Use:
1. Select a message from the dropdown menu.
2. The left pane renders the incoming ISO 20022 XML with UETR and end-to-end IDs.
3. The right pane shows the JSON Ledger API request body (`POST /v2/commands/submit-and-wait` to create an instruction, `POST /v2/state/active-contracts` for a statement) with the templates' real field names and encodings; party fields and offsets are placeholders because party IDs are assigned at allocation. Statement queries select by template; the account, currency, or ISIN filter is applied by the client.
4. Click **"Run Validation Checks"** to check the displayed payloads: XML well-formedness, required elements, ISIN and LEI check digits, UETR format, currency codes, and XML/JSON consistency. The badge reports how many checks passed or which ones failed.
5. Click **"Copy XML"** or **"Copy Daml"** to copy the payloads.

---

### Module 5: Security Assurance & Regulatory Alignment (`#security`)

Presents the threat model and regulatory mapping (not yet independently audited):
* **STRIDE Threat Mitigations**: Analysis of Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege across the contract library.
* **US Banking Capital Rules**: OCC/Fed/FDIC capital neutrality, Basel III LCR Level 1 HQLA classification, UCC Article 8/12 perfection, and custodial segregation.
* **SEC Regulatory Framework**: SEC Rule 15c3-3 customer protection, SEC CAT / FINRA TRACE report records, and Reg D / Reg S / Rule 144A transfer restrictions.

---

### Module 6: Daml Smart Contract Source Code Dossier (`#docs`)

Loads the actual Daml source files from this repository, so the viewer always matches the code. (Opened from disk without a web server, it shows a link to the file on GitHub instead.)

#### How to Use:
1. Select a contract module from the dropdown:
   * `AryaFi.Finance.Cash` (Tokenized Cash Primitive)
   * `AryaFi.Finance.Security` (Safekeeping & Encumbrance)
   * `AryaFi.Finance.Settlement` (Atomic DvP)
   * `AryaFi.Finance.Collateral` (Haircut & Margin Revaluation)
   * `AryaFi.Contracts.Loan` (Institutional Credit Facility)
   * `AryaFi.Contracts.Repo` (Repurchase Agreement)
   * `AryaFi.Compliance.TransferRestrictions` (Reg D, Reg S, Rule 144A)
2. Review the template's choices, controllers, signatories, and invariants.
3. Click **"Copy Source"** to copy the code directly to your clipboard.

---

## 4. Local Development & Canton Sandbox Deployment

To run the full stack locally:

### 1. Compile Daml Contracts
```bash
# Verify Daml toolchain (Daml SDK 3.5.12, installed with dpm)
dpm version

# Compile both packages: aryafi-core (production) and aryafi-core-test
dpm build --all

# Run the test suite (289 scripts; requires Java 17 or 21)
cd daml/test
dpm test --all --show-coverage
cd ../..
```

### 2. Start the Multi-Participant Canton Topology
The container installs Canton 3.5 (open source), creates one synchronizer (sequencer and mediator), starts five participants, allocates one party per participant, and uploads every DAR in `.daml/dist` (the production DAR).
```bash
dpm build --all       # the DAR must exist before the container starts
cd deploy/docker
docker compose up -d --build

# Verify running participant nodes (gRPC Ledger API ports 10012, 10022, 10032, 10042, 10052;
# JSON Ledger API ports 10013, 10023, 10033, 10043, 10053)
docker compose ps
```

### 3. Run a Scenario via Daml Script
```bash
dpm script \
  --dar daml/test/.daml/dist/aryafi-core-test-3.0.0.dar \
  --upload-dar=yes \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:runTreasuryDvpScenario \
  --ledger-host localhost \
  --ledger-port 10012
```
This uploads the test DAR to the bank participant, allocates the scenario's parties there, and runs the DvP. Workflows whose parties live on different participants need propose/accept templates (see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)).

---

## 5. Support & Contributing

* **GitHub Repository**: [https://github.com/Aryaverse/aryafi-core](https://github.com/Aryaverse/aryafi-core)
* **License**: Apache License, Version 2.0
* **Issue Tracker**: File bug reports, enhancement requests, and security audit questions on GitHub Issues.
