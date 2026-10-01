# AryaFi Core: User & Operator Guide

Welcome to the **AryaFi Core** user guide. It explains how to use the website, how to build and test the Daml library, and how to run the local multi-participant Canton topology. For what the library does not do yet, see [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 1. The Website

🌐 **[https://aryafi-core.vercel.app](https://aryafi-core.vercel.app)**

The website explains what AryaFi Core does for the institutions that would use it, and lets you watch a trade settle. It does **not** connect to a ledger: the trade walkthrough replays the library's tested scenario, and the code viewer loads the real source files from this repository.

It works in any modern browser, on desktop and phone. It follows your system's light or dark setting; the moon/sun button in the header switches theme, and the choice is remembered in the browser.

The header has four views, each with its own address:

| View | Address | What it answers |
|:---|:---|:---|
| Overview | `#overview` | What is this, why does it matter, who takes part, and how mature is it? |
| See a trade settle | `#trade` | What actually happens in a bond-for-cash trade, and what stops it going wrong? |
| What's inside | `#inside` | What does the library cover, and which parts are ready? |
| Developers | `#developers` | How do I build it, run it, connect my systems, and read the code? |
| Docs | `#docs` | The key documents, rendered from the repository. `#docs/<document>/<section>` links to a section. |

Links to the previous site's tabs (`#tab-simulator`, `#tab-iso`, ...) open the matching view.

---

## 2. See a Trade Settle

Dealer Bank A sells $5,000,000 (face value) of US Treasury bonds to Dealer Bank B for $4,975,000. The walkthrough replays `TreasuryDvpScenario` in six steps:

1. **Before the trade.** Who owns what, and which institution keeps it.
2. **Both firms are checked.** KYC and sanctions checks; the settlement agent approves the bond as eligible.
3. **Each side sets aside its asset.** The bond and exactly $4,975,000 are locked to the settlement agent.
4. **All three sign the trade.** One instruction signed by seller, buyer and settlement agent.
5. **Settlement: both move at once.** Bond and cash change hands in one transaction.
6. **The regulator gets a report.** The regulator receives the trade report and nothing else.

Use **Next step** and **Back**, or click a step in the bar.

* **The board** shows six institutions: seller, buyer, settlement agent, custodian, cash bank and regulator. Each card lists what that institution holds or stores at this step. Locked assets are marked *Locked for settlement*, new records are highlighted, and assets that just left are shown struck through.
* **Whose view?** Pick an institution to see only what its own node stores. Records it does not store are collapsed into "*N* records not shared with ...". This is Canton's privacy model: a contract is shared only with the parties named in it.
* **What if…?** Buttons try something the contracts are built to stop, such as the seller taking back its locked bond, a short delivery, the agent cancelling alone, or settling twice. Each becomes available at the step where it makes sense, and each result names the test in `DvpSettlementTest` that checks it.
* **Under the hood** lists the Daml templates and choices behind each step.

---

## 3. What's Inside and Developers

**What's inside** describes each area of the library in plain words, with its maturity:
* **Settlement** (Beta): cash, securities and delivery versus payment. Moves real assets on the ledger.
* **Financing** (Experimental): loans, repos, securities lending, margin calls, pledges and collateral, funds and escrow. Tracks each agreement; assets do not move on the ledger yet. Includes a calculator for the collateral a loan needs: `loan × margin ÷ (1 − haircut)`, with illustrative haircuts.
* **Compliance** (Experimental): KYC and sanctions, transfer rules, eligibility and limits, regulatory reports. Evaluated correctly, but not yet enforced inside transfers.
* **Coming next**: agreeing trades across nodes, settling other tokens such as Canton Coin through the token standard, financing on real assets, and an independent audit.

**Developers** has:
* **Get started**: install the Daml SDK with `dpm`, build, and run the tests.
* **Run it on a network**: the local five-institution Canton network (`deploy/docker`) and the TestNet runbook (`deploy/testnet`).
* **Connect your systems: ISO 20022**: pick `pacs.008`, `sese.023`, `camt.053` or `semt.002` to see the message next to the JSON Ledger API v2 request it becomes. **Check this message** runs real checks: XML well-formedness, required elements, ISIN (ISO 6166) and LEI (ISO 17442) check digits, UETR format, currency codes, and consistency between the XML and the request. **Field-by-field mapping** lists each element and the rule that applies.
* **Read the contracts**: the Daml source of seven core modules, loaded from this repository.
* **Documentation**: links to the key documents on the Docs view.

**Docs** renders the key documents from this repository's Markdown: known limitations, improvement plan, changelog, this guide, the Ledger API client guide, ISO 20022 mappings, migration guide, TestNet runbook, versioning policy, authorization matrix and threat model. Links between them stay on the site; a link to a file that is not published is shown as plain text.

---

## 4. Local Development & Canton Sandbox Deployment

To run the full stack locally:

### 1. Compile Daml Contracts
```bash
# Verify Daml toolchain (Daml SDK 3.5.12, installed with dpm)
dpm version

# Compile both packages: aryafi-core (production) and aryafi-core-test
dpm build --all

# Run the test suite (319 scripts; requires Java 17 or 21)
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
  --dar daml/test/.daml/dist/aryafi-core-test-3.2.0.dar \
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
