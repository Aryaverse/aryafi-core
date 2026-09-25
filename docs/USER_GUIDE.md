# AryaFi Core: User & Operator Guide

Welcome to the **AryaFi Core** user guide. This document provides comprehensive, step-by-step instructions for interacting with the institutional digital asset terminal, running multi-party financial scenarios, validating algebraic contract invariants, testing ISO 20022 translations, and deploying the platform to Canton testnets.

---

## 1. Accessing the Live Web Terminal

The live institutional terminal is hosted in production on Vercel at:

🌐 **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**

### System Requirements
* Any modern web browser (Chrome, Chromium, Edge, Safari, Firefox) with JavaScript enabled.
* Screen resolution: Optimized for desktop (1440px+ institutional widescreen) and responsive across laptops, tablets, and mobile devices.
* Theme Toggle: Instant switching between **Institutional Dark Theme** (default Wall Street / Bloomberg-style cyber-finance aesthetic) and **Crisp Light Theme** via the `[ ◐ Theme ]` button in the top navigation header. Preferences are saved automatically to `localStorage`.

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

The Topology Visualizer models a live Canton Network protocol v30 domain with 5 segregated participant nodes and a central sequencer domain hub.

#### How to Use:
1. **Interactive SVG Node Map**:
   * Click on any participant circle on the map:
     * **Bank Node** (Federal Reserve Bank / Central Cash Authority)
     * **Custodian Node** (Global Custodian / Safekeeping CSD)
     * **Dealer A** (Goldman Sachs Primary Dealer)
     * **Dealer B** (Morgan Stanley Primary Dealer)
     * **SEC / CAT** (Supervisory & Audit Authority)
2. **Participant ACS Inspector**:
   * The right-hand inspector card dynamically updates to display:
     * **Participant ID**: Node identifier in the Canton topology configuration.
     * **Ledger API Endpoint**: Default gRPC / JSON endpoint (e.g. `localhost:10012`).
     * **Hosted Parties**: Daml parties allocated on that node.
     * **KMS Fingerprint**: Cryptographic public key fingerprint managing the node's namespace.
     * **Active Contract Set (ACS)**: Live count of unarchived contracts observed by the node.
     * **Sub-Transaction Privacy Boundary**: Strict cryptographic rule defining which contract types and payload data this participant can observe vs. which are obscured.

---

### Module 2: Multi-Party Financial Lifecycle Simulator (`#simulator`)

The Simulator executes complex, multi-party smart contract lifecycles phase-by-phase, demonstrating state machine progression and non-repudiable audit logs.

#### Available Scenarios:
1. **Tokenized US Treasury + Cash DvP**:
   * Phase 1: Compliance Onboarding (KYC & Sanctions pre-trade gating).
   * Phase 2: Dual Position Lockup (Seller locks $5M US Treasuries, Buyer locks $5M cash).
   * Phase 3: `DvpInstruction` Tri-Party Co-signature.
   * Phase 4: Atomic Settlement Execution (Simultaneous cross-asset transfer in 1 transaction commit).
   * Phase 5: SEC CAT regulatory audit report emission.
2. **Institutional Securities Lending**:
   * Tri-party lending agreement creation with 102% cash collateral pledge via `AssetPledge`.
   * Act/360 borrow fee accrual and payment servicing.
   * Mark-to-market collateral revaluation.
   * Recall notice issuance and pro-rata collateral release.
   * Full return and agreement closeout.
3. **Treasury Cash Mobility & Zero-Balance Sweep**:
   * Multi-entity corporate cash accounts setup (US subsidiary, EU subsidiary, HQ pool).
   * Surplus capital identification via `SplitCash`.
   * Concentration sweep and pool consolidation via `MergeCash`.
   * Intercompany funding instruction with SWIFT UETR tracking reference.
   * Settlement agent clearing with complete competitor blindness.

#### How to Operate:
1. **Select a Scenario**: Click on one of the scenario buttons in the left sidebar.
2. **Step-by-Step Execution**: Click **"Next Phase"** to advance through each step individually. The active step is highlighted with a cyan indicator, and executed phases turn emerald with a checkmark.
3. **Automated Run**: Click **"Auto-Run"** to execute the entire lifecycle with real-time streaming intervals.
4. **Reset**: Click **"Reset"** to return the state machine to Phase 1.
5. **Copy Log**: Click **"Copy Log"** to copy the complete ledger API execution log to your clipboard.

---

### Module 3: Contract Explorer & Invariant Proof Calculator (`#contracts`)

This section allows quantitative analysts, auditors, and engineers to verify the algebraic properties and conservation invariants of AryaFi contracts.

#### Lemma 1: Conservation of Value ($\Delta = 0.00$):
In AryaFi, every `SplitCash` and `MergeCash` operation satisfies the strict algebraic conservation equation:
$$\sum \text{Outputs} \equiv \sum \text{Inputs}$$
No rounding leakage or token inflation is mathematically possible.

#### Testing the Proof:
1. Enter a **Total CashPosition Amount** (e.g. `$10,000,000.00`).
2. Enter a **Split Amount** (e.g. `$3,500,000.00`).
3. Click **"Execute Split & Verify Proof"** (or use the one-click quick presets: **$1M**, **$25M**, or **$100M**).
4. Inspect the output box:
   * Output Position A: `$3,500,000.00`
   * Output Position B: `$6,500,000.00`
   * Reconstituted Total Sum: `$10,000,000.00`
   * Guarantee Status: **VERIFIED ($\Delta = 0.00$)**

#### Template Cards:
Browse detailed operational parameters for:
* **`CashPosition`**: Fiat deposit primitive with maintainer keys and encumbrance locks.
* **`SecurityPosition`**: CUSIP/ISIN safekeeping token.
* **`CollateralPosition`**: Haircut model ($V = M \times (1 - h)$), substitution, and disputes.
* **`DvpInstruction`**: BIS CPSS Model 1 atomic cross-asset delivery.
* **`InstitutionalLoan`**: Multi-drawdown credit facilities with auto-close logic.
* **`SecuritiesLendingAgreement`**: Stock loan fee accruals and recalls.

---

### Module 4: ISO 20022 Financial Messaging Hub (`#iso`)

Enables enterprise integration teams to inspect bidirectional translation between SWIFT ISO 20022 MX XML messages and Daml Ledger API JSON-RPC command payloads.

#### Supported Messages:
* **`pacs.008.001.10`**: Financial Institutional Customer Credit Transfer $\rightarrow$ `PaymentInstruction`
* **`sese.023.001.10`**: Securities Settlement Transaction Instruction $\rightarrow$ `DvpInstruction`
* **`camt.053.001.10`**: Bank-to-Customer End-of-Day Statement $\rightarrow$ `CashPosition` Reconciliation
* **`semt.002.001.10`**: Custody Balance Accounting Statement $\rightarrow$ `SecurityPosition` Audit

#### How to Use:
1. Select a message from the dropdown menu.
2. The left pane renders the incoming ISO 20022 XML with UETR and end-to-end IDs.
3. The right pane renders the exact compiled Daml Ledger API JSON command with parameters.
4. Click **"Copy XML"** or **"Copy Daml"** to copy payloads for testing against your own API gateways.

---

### Module 5: Security Assurance & Regulatory Alignment (`#security`)

Presents the audited regulatory and threat modeling matrix:
* **STRIDE Threat Mitigations**: Analysis of Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege across the contract library.
* **US Banking Capital Rules**: OCC/Fed/FDIC capital neutrality, Basel III LCR Level 1 HQLA classification, UCC Article 8/12 perfection, and custodial segregation.
* **SEC Regulatory Framework**: SEC Rule 15c3-3 customer protection, automated SEC CAT reporting, FINRA TRACE compliance, and Reg D / Reg S / Rule 144A transfer restrictions.

---

### Module 6: Daml Smart Contract Source Code Dossier (`#docs`)

Allows developers and auditors to review actual production Daml smart contract code directly in the terminal without opening an IDE.

#### How to Use:
1. Select a contract module from the dropdown:
   * `AryaFi.Finance.Cash` (Tokenized Cash Primitive)
   * `AryaFi.Finance.Security` (Safekeeping & Encumbrance)
   * `AryaFi.Finance.Collateral` (Haircut & Margin Revaluation)
   * `AryaFi.Contracts.Loan` (Institutional Credit Facility)
   * `AryaFi.Contracts.Repo` (Repurchase Agreement)
   * `AryaFi.Compliance.TransferRestrictions` (Reg D, Reg S, Rule 144A)
2. Review syntax-highlighted Daml template choices, controllers, signatories, and invariants.
3. Click **"Copy Source"** to copy the code directly to your clipboard.

---

## 4. Local Development & Canton Sandbox Deployment

To run the full stack locally:

### 1. Compile Daml Contracts
```bash
# Verify Daml toolchain
daml version

# Compile Daml Archive (DAR)
daml build

# Run comprehensive test suite across all modules
daml test
```

### 2. Start Multi-Participant Canton Docker Sandbox
```bash
cd deploy/docker
docker compose up -d

# Verify running participant nodes (Ports 10012, 10022, 10032, 10042, 10052)
docker compose ps
```

### 3. Run Scenario via Daml Script
```bash
daml script \
  --dar .daml/dist/aryafi-core-1.0.0.dar \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:testTreasuryDvp \
  --ledger-host localhost \
  --ledger-port 10012
```

---

## 5. Support & Contributing

* **GitHub Repository**: [https://github.com/Aryaverse/aryafi-core](https://github.com/Aryaverse/aryafi-core)
* **License**: Apache License, Version 2.0
* **Issue Tracker**: File bug reports, enhancement requests, and security audit questions on GitHub Issues.
