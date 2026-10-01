# AryaFi Core: Platform & Smart Contract Architecture Specification

## 1. Executive Summary

**AryaFi Core** is an enterprise-grade, privacy-aware smart contract library engineered in [Daml](https://www.digitalasset.com/daml) for wholesale financial institutions, global custodian banks, primary broker-dealers, and institutional asset managers.

Built with Daml SDK 3.5 for **Canton 3.5** (protocol version 35), AryaFi Core provides primitives for tokenized deposits, securities safekeeping, atomic Delivery-versus-Payment (DvP) settlement, repurchase agreements (repo), securities lending, credit facilities, and private credit fund subscription/redemption lifecycles. Module maturity and gaps are listed in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

---

## 2. Platform Architecture Overview

```
                      +---------------------------------------+
                      |   AryaFi Website (Vercel)             |
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
|                     Canton Synchronizer (Sequencer + Mediator)                     |
|                       (BFT ordering, mediator confirmation)                        |
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

Amounts use Daml `Decimal`, a fixed-point number with 10 decimal places, so additions and subtractions are exact. Formulas marked *computed on-ledger* are evaluated by the contracts; formulas marked *reference* describe how counterparties derive a value that the contract records as agreed.

### 3.1. Day-Count Convention Algorithms (`AryaFi.Common.Time`)

Year fraction calculation $\alpha(t_1, t_2)$ is implemented for four conventions (*computed on-ledger* by `calcYearFraction`; ISDA 2006 §4.16):

#### 1. Actual/360 (`Act360`):
Used in wholesale money markets, repo, and securities lending:
$$\alpha_{\text{Act360}}(t_1, t_2) = \frac{\text{Days}(t_1, t_2)}{360.0}$$

#### 2. Actual/365 (`Act365`):
Used in sterling markets and commonwealth sovereign bonds:
$$\alpha_{\text{Act365}}(t_1, t_2) = \frac{\text{Days}(t_1, t_2)}{365.0}$$

#### 3. Actual/Actual ISDA (`ActActISDA`):
Used for government bonds and swaps. Days falling in each calendar year are divided by that year's length:
$$\alpha_{\text{Act/Act}}(t_1, t_2) = \frac{\text{Days in non-leap years}}{365} + \frac{\text{Days in leap years}}{366}$$
A full calendar year is exactly 1.0.

#### 4. 30/360 US Bond Basis (`Thirty360`):
Standard US corporate and municipal bond day-count convention:
$$\alpha_{\text{30/360}}(t_1, t_2) = \frac{360 \times (Y_2 - Y_1) + 30 \times (M_2 - M_1) + (D_2 - D_1)}{360.0}$$
Where $D_1 = \min(D_1, 30)$ and, if $D_1 = 30$, $D_2 = \min(D_2, 30)$.

Act/360 and Act/365F count elapsed 24-hour periods between timestamps; Act/Act ISDA and 30/360 use UTC calendar dates. No business-day adjustment is applied.

#### Loan interest (*computed on-ledger*, `AryaFi.Contracts.Loan`):
$$I = P_{\text{drawn}} \times R \times \alpha(t_{\text{accrued-through}}, t_{\text{now}})$$
Interest is crystallized before every change in drawn principal, so each period uses the principal outstanding in it.

---

### 3.2. Collateral Haircut Valuation (`AryaFi.Finance.Collateral`)

For any asset allocated as collateral against a financing obligation:
$$V_{\text{collateral}} = M_{\text{market}} \times (1.0 - h)$$
Where:
* $M_{\text{market}}$ is the gross mark-to-market valuation in settlement currency.
* $h \in [0.0, 1.0)$ is the agreed collateral haircut rate (e.g., $0.02$ for $2\%$).
* The contract computes $V_{\text{collateral}}$ (`GetCollateralValue`) and enforces $M > 0$ and $0 \le h < 1$. It does **not** compare the value against the secured obligation; `CollateralPosition` records the obligation by reference only.

---

### 3.3. Securities Lending Fee & Rebate Accruals (`AryaFi.Contracts.SecuritiesLending`, *reference*)

The contract records each period's fee as agreed by lender and borrower (`AccrueLendingFee`); the rebate rate is stored but not applied. The reference formulas are:

Borrow fee accrued over elapsed period $[t_{\text{last}}, t_{\text{now}}]$:
$$F_{\text{borrow}} = Q_{\text{borrowed}} \times R_{\text{borrow}} \times \alpha_{\text{Act360}}(t_{\text{last}}, t_{\text{now}})$$

For cash-collateralized stock loans with an agreed cash rebate rate $R_{\text{rebate}}$:
$$F_{\text{rebate}} = C_{\text{collateral}} \times R_{\text{rebate}} \times \alpha_{\text{Act360}}(t_{\text{last}}, t_{\text{now}})$$
$$\text{Net Payment} = F_{\text{borrow}} - F_{\text{rebate}}$$

---

### 3.4. Repurchase Agreement Pricing (`AryaFi.Contracts.Repo`, *reference*)

The repurchase price is agreed at trade inception; `calcRepurchasePrice` implements the formula, but the contract does not check the agreed price against it:
$$P_{\text{repurchase}} = P_{\text{purchase}} \times \left(1.0 + R_{\text{repo}} \times \alpha_{\text{Act360}}(t_{\text{start}}, t_{\text{end}})\right)$$

---

### 3.5. Cash Position Conservation

For any tokenized deposit pool subject to splitting or merging:
$$\sum_{i=1}^{n} \text{Amount}(\text{Output}_i) \equiv \text{Amount}(\text{Input})$$
* **Argument**: In `Cash.daml`, `SplitCash` creates:
  $$\text{pos}_1 = \text{splitAmount}, \quad \text{pos}_2 = \text{amount} - \text{splitAmount}$$
  $$\text{pos}_1 + \text{pos}_2 = \text{splitAmount} + (\text{amount} - \text{splitAmount}) \equiv \text{amount}$$
* Because `Decimal` arithmetic is exact, the sum is preserved exactly. The unit tests in `AssetCashTest.daml` exercise split, merge, and their boundary cases.

---

## 4. Contract Module Hierarchy & Matrix

The authoritative, generated list of every choice and controller is [AUTHORIZATION_MATRIX.md](security/AUTHORIZATION_MATRIX.md).

| Module | Primary Template | Signatories | Key Controllers | Primary Responsibilities |
|:---|:---|:---|:---|:---|
| `AryaFi.Finance.Cash` | `CashPosition` | `bank, owner` | `owner`; `owner, bank, newOwner` (transfer); lock holder | Tokenized deposits: split, merge, receiver-authorized transfer, lock-holder locks |
| `AryaFi.Finance.Security` | `SecurityPosition` | `custodian, owner` | `owner, custodian`; lock holder | ISIN/CUSIP safekeeping, lock-holder locks, receiver-authorized transfers |
| `AryaFi.Finance.Account` | `Account` | `custodian, owner` | `custodian, owner` | Segregated & omnibus custody accounts, freeze controls |
| `AryaFi.Finance.Payment` | `PaymentInstruction` | `payer, payee, settlementAgent` | `settlementAgent` | Payment instruction separate from settlement, UETR & IMAD references |
| `AryaFi.Finance.Settlement` | `DvpInstruction` | `settlementAgent, seller, buyer` | `settlementAgent` | Atomic DvP: validates and delivers both locked legs in one transaction |
| `AryaFi.Finance.Collateral` | `CollateralPosition` | `collateralProvider, collateralReceiver, custodian` | `custodian, receiver, provider` | Mark-to-market valuation, haircut adjustments, substitution |
| `AryaFi.Contracts.Loan` | `InstitutionalLoan` | `lender, borrower` | `borrower` (drawdown); `lender` (accrual, payment receipts) | Credit facilities with computed interest; repayments confirmed by the lender |
| `AryaFi.Contracts.Repo` | `RepoAgreement` | `seller, buyer, custodian` | `seller, buyer`; `custodian` (legs) | Bilateral/tri-party repo lifecycle, substitution, roll, closeout |
| `AryaFi.Contracts.SecuritiesLending`| `SecuritiesLendingAgreement` | `lender, borrower, custodian` | `lender, borrower` | Stock loans, jointly agreed fees, recalls, pro-rata collateral release |
| `AryaFi.Contracts.Subscription` | `FundSubscription` | `fundManager, investor` | `fundManager` | Private credit fund capital commitments & capital calls |
| `AryaFi.Contracts.Redemption` | `AssetRedemption` | `fundManager, investor` | `fundManager` | NAV-priced share redemption with liquidity gates |
| `AryaFi.Compliance.KYC` | `KycAttestation` | `authority` | `authority` | Institutional identity attestation with expiry |
| `AryaFi.Compliance.Sanctions` | `SanctionsAttestation` | `screeningAuthority` | `screeningAuthority` | Vendor-neutral sanctions screening status with expiry |
| `AryaFi.Compliance.TransferRestrictions`| `TransferRestrictionRule` | `complianceOfficer` | `complianceOfficer` | Lockup, holding period, whitelist, and Reg D / Reg S / Rule 144A evaluation |

---

## 5. Canton Sub-Transaction Privacy Architecture

In the Canton Network, privacy is achieved cryptographically at the sub-transaction level:

1. **Need-to-Know Projection**:
   * A participant node only processes and stores sub-transaction trees where the parties it hosts are **signatories**, **observers**, or **controllers** of choices executed in that sub-tree.
2. **Third-Party Blindness**:
   * When Dealer A and Dealer B execute a bilateral trade, Custodian and Cash Authority only observe the transfer choices affecting their respective security/cash positions. Unrelated market participants (e.g. Dealer C) receive zero ledger events or metadata.
3. **Auditability Without Compromise**:
   * Observers (such as a `SupervisoryAuthority` party) can be conditionally attached to `RegulatoryReporting` contracts or DvP settlement choices to see the reports and instructions they are added to, without read access to the counterparties' positions. On bilateral agreements, adding an observer requires both counterparties.

---

## 6. Testing & Quality Assurance Architecture

AryaFi Core enforces a multi-tiered testing strategy comprising 36+ test suites and scenarios:

```
daml/test/AryaFi/Test/      # separate test package (aryafi-core-test)
├── Unit/                   # High-precision unit tests for every primitive & contract
├── Scenarios/              # Multi-party institutional lifecycle scenarios (Dvp, Repo, Loan, Seclend)
├── Negative/               # Unauthorized access, compliance violation & invalid transition tests
├── Privacy/                # Canton sub-transaction privacy & observer visibility verification
├── Authorization/          # Multi-signatory, bilateral & tri-party authorization edge cases
├── Network/                # Smoke test for shared networks such as TestNet (deploy/testnet)
└── Integration/            # Cross-module workflow tests (single ledger)
```

---

## 7. Operational Deployment & Canton Runbook

### 1. Artifact Compilation
```bash
dpm build --all
# Generates .daml/dist/aryafi-core-3.2.0.dar (production)
# and daml/test/.daml/dist/aryafi-core-test-3.2.0.dar (tests)
```

### 2. Multi-Node Deployment
Upload the production DAR to every participant through its JSON Ledger API (the `deploy/` bootstrap does this automatically):
```bash
for port in 10013 10023 10033 10043 10053; do
  curl -sf -X POST "http://localhost:$port/v2/dars?vetAllPackages=true" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @.daml/dist/aryafi-core-3.2.0.dar
done
```

### 3. Scenario Verification
Run the treasury DvP scenario against the bank participant:
```bash
dpm script \
  --dar daml/test/.daml/dist/aryafi-core-test-3.2.0.dar \
  --upload-dar=yes \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:runTreasuryDvpScenario \
  --ledger-host localhost \
  --ledger-port 10012
```
