# AryaFi Core: Platform & Smart Contract Architecture Specification

## 1. Executive Summary

**AryaFi Core** is an enterprise-grade, privacy-aware smart contract library engineered in [Daml](https://www.digitalasset.com/daml) for wholesale financial institutions, global custodian banks, primary broker-dealers, and institutional asset managers.

Deployed atop the **Canton Network Protocol v30**, AryaFi Core provides composable, mathematically rigorous primitives for tokenized deposits, sovereign securities safekeeping, atomic Delivery-versus-Payment (DvP) settlement, repurchase agreements (repo), securities lending, revolving credit facilities, and private credit fund subscription/redemption lifecycles.

---

## 2. Platform Architecture Overview

```
                      +---------------------------------------+
                      |   AryaFi Web Terminal (Vercel Cloud)  |
                      |   Canton Ledger API Client Gateway    |
                      +-------------------+-------------------+
                                          |
                +-------------------------+-------------------------+
                |                                                   |
    +-----------v-----------+                           +-----------v-----------+
    |  ISO 20022 Adapter    |                           |  Reconciliation Hub   |
    |  (pacs, sese, camt)   |                           |  (EOD Bank & CSD)     |
    +-----------+-----------+                           +-----------+-----------+
                |                                                   |
+---------------v---------------------------------------------------v---------------+
|                              Canton Network Sequencer Domain                       |
|                          (Byzantine Fault Tolerant Consensus)                     |
+---+-------------------+-------------------+-------------------+-------------------+
    |                   |                   |                   |                   |
+---v-----------+   +---v-----------+   +---v-----------+   +---v-----------+   +---v-----------+
| Federal Bank  |   | Custodian     |   | Primary       |   | Primary       |   | SEC & CAT     |
| Node (Port    |   | Node (Port    |   | Dealer A Node |   | Dealer B Node |   | Observer Node |
| 10012)        |   | 10022)        |   | (Port 10032)  |   | (Port 10042)  |   | (Port 10052)  |
+---------------+   +---------------+   +---------------+   +---------------+   +---------------+
```

---

## 3. Mathematical Foundations & Financial Formulas

All financial calculations in AryaFi Core enforce high-precision arithmetic to guarantee algebraic conservation of value and prevent rounding leakage.

### 3.1. Day-Count Convention Algorithms (`AryaFi.Common.Time`)

Year fraction calculation $\alpha(t_1, t_2)$ is implemented across three institutional standards:

#### 1. Actual/360 (`Act360`):
Used in wholesale money markets, repo, and securities lending:
$$\alpha_{\text{Act360}}(t_1, t_2) = \frac{\text{Days}(t_1, t_2)}{360.0}$$

#### 2. Actual/365 (`Act365`):
Used in sterling markets and commonwealth sovereign bonds:
$$\alpha_{\text{Act365}}(t_1, t_2) = \frac{\text{Days}(t_1, t_2)}{365.0}$$

#### 3. 30/360 Bond Basis (`Thirty360`):
Standard US corporate and municipal bond day-count convention:
$$\alpha_{\text{30/360}}(t_1, t_2) = \frac{360 \times (Y_2 - Y_1) + 30 \times (M_2 - M_1) + (D_2 - D_1)}{360.0}$$
Where $D_1 = \min(D_1, 30)$ and if $D_1 = 30$, $D_2 = \min(D_2, 30)$.

---

### 3.2. Collateral Haircut Valuation (`AryaFi.Finance.Collateral`)

For any asset allocated as collateral against a financing obligation:
$$V_{\text{collateral}} = M_{\text{market}} \times (1.0 - h)$$
Where:
* $M_{\text{market}}$ is the gross mark-to-market valuation in settlement currency.
* $h \in [0.0, 1.0)$ is the agreed collateral haircut rate (e.g., $0.02$ for $2\%$).
* **Invariant Guard**: Contract creation and revaluation strictly require $V_{\text{collateral}} \ge \text{ObligationAmount}$.

---

### 3.3. Securities Lending Fee & Rebate Accruals (`AryaFi.Contracts.SecuritiesLending`)

Borrow fee accrued over elapsed period $[t_{\text{last}}, t_{\text{now}}]$:
$$F_{\text{borrow}} = Q_{\text{borrowed}} \times R_{\text{borrow}} \times \alpha_{\text{Act360}}(t_{\text{last}}, t_{\text{now}})$$

For cash-collateralized stock loans with an agreed cash rebate rate $R_{\text{rebate}}$:
$$F_{\text{rebate}} = C_{\text{collateral}} \times R_{\text{rebate}} \times \alpha_{\text{Act360}}(t_{\text{last}}, t_{\text{now}})$$
$$\text{Net Payment} = F_{\text{borrow}} - F_{\text{rebate}}$$

---

### 3.4. Repurchase Agreement Pricing (`AryaFi.Contracts.Repo`)

Repurchase price calculated at maturity:
$$P_{\text{repurchase}} = P_{\text{purchase}} \times \left(1.0 + R_{\text{repo}} \times \alpha_{\text{Act360}}(t_{\text{start}}, t_{\text{end}})\right)$$

---

### 3.5. Cash Position Conservation Law (Lemma 1)

For any tokenized deposit pool subject to splitting or merging:
$$\sum_{i=1}^{n} \text{Amount}(\text{Output}_i) \equiv \text{Amount}(\text{Input})$$
* **Proof Guarantee**: In `Cash.daml`, `SplitCash` creates:
  $$\text{pos}_1 = \text{splitAmount}, \quad \text{pos}_2 = \text{amount} - \text{splitAmount}$$
  $$\text{pos}_1 + \text{pos}_2 = \text{splitAmount} + (\text{amount} - \text{splitAmount}) \equiv \text{amount}$$
* Every split or merge emits a deterministic state change with zero precision leakage ($\Delta = 0.00$).

---

## 4. Contract Module Hierarchy & Matrix

| Module | Primary Template | Signatories | Key Controllers | Primary Responsibilities |
|:---|:---|:---|:---|:---|
| `AryaFi.Finance.Cash` | `CashPosition` | `bank, owner` | `owner` | Multi-currency tokenized deposits, split, merge, lock, transfer |
| `AryaFi.Finance.Security` | `SecurityPosition` | `custodian, owner` | `owner, custodian` | CUSIP/ISIN safekeeping, encumbrance locks, transfers |
| `AryaFi.Finance.Account` | `Account` | `custodian, owner` | `custodian, owner` | Segregated & omnibus custody accounts, freeze controls |
| `AryaFi.Finance.Payment` | `PaymentInstruction` | `payer, settlementAgent` | `settlementAgent` | Tri-party payment separation, UETR & IMAD network references |
| `AryaFi.Finance.Settlement` | `DvpInstruction` | `settlementAgent, seller, buyer` | `settlementAgent` | BIS CPSS Model 1 atomic Delivery-versus-Payment |
| `AryaFi.Finance.Collateral` | `CollateralPosition` | `collateralProvider, collateralReceiver, custodian` | `custodian, receiver, provider` | Mark-to-market valuation, haircut adjustments, substitution |
| `AryaFi.Contracts.Loan` | `InstitutionalLoan` | `lender, borrower` | `borrower, lender` | Revolving credit & term facilities, drawdowns, repayment |
| `AryaFi.Contracts.Repo` | `RepoAgreement` | `seller, buyer` | `seller, buyer` | Bilateral/tri-party repo, margin calls, closeout |
| `AryaFi.Contracts.SecuritiesLending`| `SecuritiesLendingAgreement` | `lender, borrower, custodian` | `lender, borrower` | Stock loans, 102% collateral pledge, recalls, rebates |
| `AryaFi.Contracts.Subscription` | `FundSubscription` | `fundManager, investor` | `fundManager` | Private credit fund capital commitments & capital calls |
| `AryaFi.Contracts.Redemption` | `AssetRedemption` | `fundManager, investor` | `fundManager` | NAV-priced share redemption with liquidity gates |
| `AryaFi.Compliance.KYC` | `KYCAttestation` | `complianceOfficer` | `complianceOfficer` | Institutional identity verification & renewal |
| `AryaFi.Compliance.Sanctions` | `SanctionsScreening` | `complianceOfficer` | `complianceOfficer` | Continuous OFAC/UN sanctions compliance |
| `AryaFi.Compliance.TransferRestrictions`| `TransferRestrictionRule` | `complianceOfficer` | `complianceOfficer` | Reg D 506(c), Reg S, Rule 144A transfer gating |

---

## 5. Canton Sub-Transaction Privacy Architecture

In the Canton Network, privacy is achieved cryptographically at the sub-transaction level:

1. **Need-to-Know Projection**:
   * A participant node only processes and stores sub-transaction trees where the parties it hosts are **signatories**, **observers**, or **controllers** of choices executed in that sub-tree.
2. **Third-Party Blindness**:
   * When Dealer A and Dealer B execute a bilateral trade, Custodian and Cash Authority only observe the transfer choices affecting their respective security/cash positions. Unrelated market participants (e.g. Dealer C) receive zero ledger events or metadata.
3. **Auditability Without Compromise**:
   * Observers (such as `SECRegulator`) can be conditionally attached to `RegulatoryReporting` contracts or DvP settlement choices to receive cryptographically certified trade receipts without granting read access to proprietary inventory positions.

---

## 6. Testing & Quality Assurance Architecture

AryaFi Core enforces a multi-tiered testing strategy comprising 36+ test suites and scenarios:

```
daml/src/AryaFi/Test/
├── Unit/                   # High-precision unit tests for every primitive & contract
├── Scenarios/              # Multi-party institutional lifecycle scenarios (Dvp, Repo, Loan, Seclend)
├── Negative/               # Unauthorized access, compliance violation & invalid transition tests
├── Privacy/                # Canton sub-transaction privacy & observer visibility verification
├── Authorization/          # Multi-signatory, bilateral & tri-party authorization edge cases
└── Integration/            # Multi-participant node integration tests
```

---

## 7. Operational Deployment & Canton Runbook

### 1. Artifact Compilation
```bash
daml build
# Generates .daml/dist/aryafi-core-1.0.0.dar
```

### 2. Multi-Node Deployment
Upload the DAR across all participant nodes in the topology:
```bash
for port in 10012 10022 10032 10042 10052; do
  daml ledger upload-dar \
    --host localhost \
    --port $port \
    .daml/dist/aryafi-core-1.0.0.dar
done
```

### 3. Scenario Verification
Execute default init-script against Canton Domain:
```bash
daml script \
  --dar .daml/dist/aryafi-core-1.0.0.dar \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:testTreasuryDvp \
  --ledger-host localhost \
  --ledger-port 10012
```
