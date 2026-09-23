# STRIDE Threat Model: AryaFi Core Contract Infrastructure

## 1. Executive Summary & Methodology

This document establishes the formal **STRIDE Threat Model** for **AryaFi Core**, assessing the security posture, attack surfaces, threat vectors, and architectural mitigations across all smart contract modules running on **Canton Network**.

### 1.1 Methodology
The evaluation applies the Microsoft STRIDE methodology, adapted for distributed ledger technology and privacy-preserving multi-party smart contract systems:
- **S**poofing Identity: Can an adversary impersonate another institution, party, or node?
- **T**ampering with Data: Can transaction inputs, parameters, or contract state be altered maliciously?
- **R**epudiation: Can a participant deny executing a choice, originating an instruction, or signing a contract?
- **I**nformation Disclosure: Can unauthorized counterparties or outsiders view confidential terms or balances?
- **D**enial of Service: Can an actor lock funds, exhaust ledger state, or block workflow progression?
- **E**levation of Privilege: Can an unprivileged actor exercise controller choices reserved for regulators, custodians, or lenders?

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               AryaFi Trust Boundaries                                  │
│                                                                                        │
│   [Untrusted / External]      [Semi-Trusted Gateway]        [Cryptographic Core]       │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │ Third-Party Clients  │    │  Ledger API Gateway  │    │  Canton Protocol Engine  │  │
│  │ & Web Applications   │───>│  (mTLS, JWT, IdP)    │───>│  & Daml Runtime Machine  │  │
│  └──────────────────────┘    └──────────────────────┘    │  - Signatory Enforcement │  │
│                                                          │  - Sub-Tx Privacy Domain │  │
│                                                          │  - State Invariant Proofs│  │
│                                                          └──────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Threat Analysis by STRIDE Category

### 2.1 Spoofing (Identity & Authorization)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **S-01** | Adversary attempts to create a `CashPosition` or `SecurityPosition` naming a bank or custodian without their authorization. | `AryaFi.Finance.Cash`, `AryaFi.Finance.Security` | `CRITICAL` | **Dual Signatory Model**: Every position template defines `signatory bank, owner` or `signatory custodian, owner`. Under Daml semantics, a contract cannot be created without the cryptographic signature of all signatories. | Low (dependent on participant private key security). |
| **S-02** | Rogue party submits commands claiming to be an institutional party. | Canton Ledger API | `HIGH` | **JWT & Participant Node Binding**: Canton Ledger API validates cryptographic JWT claims (`actAs`). Only parties hosted on the specific participant node and backed by valid IdP credentials can author transactions. | Negligible. |
| **S-03** | Counterparty attempts to forge a compliance officer's approval on an asset transfer. | `AryaFi.Contracts.Transfer` | `CRITICAL` | **Controller Isolation**: Choice `ApproveTransfer` enforces `controller complianceOfficer`. Any command submitted by another party fails at ledger validation. | Negligible. |

---

### 2.2 Tampering (Data Integrity & Invariants)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **T-01** | Value creation / Inflation via `SplitCash` or `MergeCash`: attempting to split $100 into $60 + $50. | `AryaFi.Finance.Cash` | `CRITICAL` | **Strict Arithmetic Invariant**: `SplitCash` calculates the second position strictly as `amount - splitAmount` with explicit precondition `splitAmount < amount`. `MergeCash` archives the incoming contract and sets new amount as `amount + other.amount`. Value is strictly conserved. | None (algebraically proven). |
| **T-02** | Modification of interest rate, haircut, or margin threshold after trade agreement. | `AryaFi.Contracts.Repo`, `AryaFi.Contracts.Loan` | `HIGH` | **Contract Immutability**: Daml contracts are immutable. Amendments can only be executed through choices explicitly authorized by all contracting signatories (e.g. `RevalueCollateral`, `AccrueLoanInterest`). | None. |
| **T-03** | Manipulation of collateral valuation to artificially avoid margin calls. | `AryaFi.Contracts.Margin` | `HIGH` | **Dual-Party Margin Acceptance**: Choice `AcceptMarginValuation` requires mutual consent or trusted calculation agent co-signature. | Low. |

---

### 2.3 Repudiation (Non-Repudiation & Auditability)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **R-01** | Borrower denies agreeing to loan covenants, facility limit, or maturity date. | `AryaFi.Contracts.Loan` | `HIGH` | **Multi-Signatory Contract Origin**: `signatory lender, borrower`. A legally binding multi-party cryptographic signature is permanently recorded on the Canton domain sequencer. | None. |
| **R-02** | Counterparty denies executing a recall or default declaration. | `AryaFi.Contracts.SecuritiesLending` | `MEDIUM` | **Archival Audit Trail**: Exercising `RecallSecurities` or `DeclareDefault` archives the active contract and creates an updated contract with explicit timestamps and status history. All transaction trees are cryptographically immutable. | None. |

---

### 2.4 Information Disclosure (Privacy & Confidentiality)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **I-01** | Competitor or unauthorized third party inspects bilateral repo rates, loan spreads, or cash balances. | Entire Library | `CRITICAL` | **Canton Sub-Transaction Privacy**: Transactions are projected strictly to participants hosting signatories, controllers, or explicit observers. Unrelated nodes receive encrypted zero-knowledge / hash commitments and cannot decrypt the contract payload. | Negligible. |
| **I-02** | Subsidiary balances leaked to sister operating entities in multi-entity corporate treasury. | `AryaFi.Finance.Cash`, `AryaFi.Finance.Payment` | `HIGH` | **Scoped Observer Lists**: Operating accounts omit peer entities from the `observers` array. Only the specific subsidiary, account bank, and central treasury HQ are granted read visibility. | None. |

---

### 2.5 Denial of Service (Griefing & Resource Exhaustion)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **D-01** | Unilateral capital freeze: Bank unilaterally locks customer cash, or customer locks cash to avoid margin obligations. | `AryaFi.Finance.Cash` | `HIGH` | **Dual-Signatory Encumbrance**: `LockCash` and `UnlockCash` enforce `controller owner, bank`. Neither party can freeze or unfreeze assets unilaterally without mutual authorization. | Low (operational dispute protocols apply). |
| **D-02** | Unresponsive counterparty leaves pending payment or transfer hanging indefinitely. | `AryaFi.Finance.Payment`, `AryaFi.Contracts.Transfer` | `MEDIUM` | **Payer Cancellation Choice**: Payer / sender maintains explicit `CancelPayment` or `CancelTransfer` choice executable while the instruction is still in `Pending` status. | None. |
| **D-03** | Dust spamming: Repeatedly splitting cash into tiny fractions to bloat ledger storage. | `AryaFi.Finance.Cash` | `LOW` | **Canton Traffic Fees & Invariant Checks**: Preconditions enforce `splitAmount > 0.0` and Canton domain traffic fees charge participants per transaction byte, disincentivizing spam. | Low. |

---

### 2.6 Elevation of Privilege (Access Control & Gating)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **E-01** | Sanctioned or un-KYC'd party attempts to receive regulated tokenized securities. | `AryaFi.Compliance.Eligibility`, `AryaFi.Contracts.Transfer` | `CRITICAL` | **Pre-Settlement Compliance Gating**: `AssetTransferRequest` cannot complete without an explicit `ApproveTransfer` choice exercised by the designated `complianceOfficer`, who verifies active `KYCAttestation` and absence of `SanctionsFlag`. | None. |
| **E-02** | Non-settlement agent attempts to trigger atomic DvP exchange. | `AryaFi.Finance.Settlement` | `HIGH` | **Controller Restriction**: `ExecuteDvp` choice is strictly restricted to `controller settlementAgent`. Submissions by buyer or seller alone are rejected by Daml authorization rules. | None. |
| **E-03** | Borrower attempts to release pledged collateral without paying down loan. | `AryaFi.Contracts.Pledge` | `CRITICAL` | **Pledgee Authorization**: Choice `ReleasePledge` is restricted to `controller pledgee` (lender/custodian). The pledgor cannot release their own encumbered assets. | None. |

---

## 3. Summary Risk Assessment & Audit Recommendations

1. **Authorization Assurance**: All state transitions enforce least-privilege controllers. No single party can unilaterally move funds or seize assets without pre-agreed contractual conditions.
2. **Mathematical Correctness**: Asset quantity and cash conservation invariants are enforced at the type level with non-negative constraints and strict sum equality.
3. **Operational Pre-Requisite**: Production deployment requires participant nodes to protect signing keys inside HSMs (FIPS 140-2 Level 3) to prevent identity compromise outside the contract layer.
