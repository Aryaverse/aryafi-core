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
| **T-02** | Modification of interest rate, haircut, or margin threshold after trade agreement. | `AryaFi.Contracts.Repo`, `AryaFi.Contracts.Loan` | `HIGH` | **Contract Immutability & Computed Interest**: Contracts are immutable; economic terms change only through choices controlled by both counterparties (e.g. `SubstituteCollateral`, `RollRepo`). Loan interest is computed by `AccrueInterest` from the agreed rate, day count, and ledger time; the lender cannot choose the amount. | None. |
| **T-03** | Manipulation of collateral valuation to avoid or inflate margin calls. | `AryaFi.Finance.Collateral`, `AryaFi.Contracts.Margin` | `HIGH` | **Dispute Path & Receipt Confirmation**: The custodian revalues collateral; the provider can `RaiseValuationDispute`, which is resolved only by both parties. A margin call is satisfied only when the caller confirms receipt (`ConfirmMarginReceipt`). | Medium: there is no on-ledger price oracle; the custodian's valuation is trusted until disputed. |
| **T-04** | Seller or custodian withdraws the security leg after agreeing a DvP, leaving the buyer's cash committed. | `AryaFi.Finance.Security`, `AryaFi.Finance.Cash`, `AryaFi.Finance.Settlement` | `CRITICAL` | **Lock Holder**: Legs are locked to the settlement agent (`LockSecurity` / `LockCash` with `holder`). Only the lock holder can unlock or settle them; `ExecuteDvpSettlement` checks both legs and moves them in one transaction. Tested by `testLockedLegsCannotBeWithdrawn`. | None. |
| **T-05** | Obligor records its own repayment, fee payment, or margin fulfilment without paying. | `AryaFi.Contracts.Loan`, `AryaFi.Contracts.SecuritiesLending`, `AryaFi.Contracts.Margin` | `CRITICAL` | **Creditor Confirmation**: `PayDownPrincipal`, `PayAccruedInterest`, and `PayLendingFee` are controlled by the creditor; margin fulfilment needs `ConfirmMarginReceipt` by the caller; collateral release on a securities return is capped pro rata. | None. |

---

### 2.3 Repudiation (Non-Repudiation & Auditability)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **R-01** | Borrower denies agreeing to loan covenants, facility limit, or maturity date. | `AryaFi.Contracts.Loan` | `HIGH` | **Multi-Signatory Contract Origin**: `signatory lender, borrower`. The loan cannot be created without both parties' authorization, and the creating transaction is stored by both parties' participant nodes. | None. |
| **R-02** | Counterparty denies executing a recall or default declaration. | `AryaFi.Contracts.SecuritiesLending` | `MEDIUM` | **Transaction History**: `RecallSecurities` and `DeclareSecLendingDefault` archive the agreement and create an updated one; the recall records its quantity and deadline. Each transaction is stored by every stakeholder's participant node. | None. |

---

### 2.4 Information Disclosure (Privacy & Confidentiality)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **I-01** | Competitor or unauthorized third party inspects bilateral repo rates, loan spreads, or cash balances. | Entire Library | `CRITICAL` | **Canton Sub-Transaction Privacy**: Transaction views are delivered only to participants hosting stakeholders (signatories and observers) of the contracts involved. Other participants receive nothing; the sequencer and mediator handle encrypted views and hashes only. Adding an observer to a bilateral agreement requires both counterparties. | None. |
| **I-02** | Subsidiary balances leaked to sister operating entities in multi-entity corporate treasury. | `AryaFi.Finance.Cash`, `AryaFi.Finance.Payment` | `HIGH` | **Scoped Observer Lists**: Operating accounts omit peer entities from the `observers` array. Only the specific subsidiary, account bank, and central treasury HQ are granted read visibility. | None. |

---

### 2.5 Denial of Service (Griefing & Resource Exhaustion)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **D-01** | Unilateral capital freeze: Bank locks customer cash, or customer locks cash to avoid obligations. | `AryaFi.Finance.Cash` | `HIGH` | **Joint Locking, Holder Release**: `LockCash` requires `owner, bank` and names a lock holder; only the lock holder can release (`UnlockCash`) or settle it. Neither owner nor bank can lock alone. | Low: an unresponsive lock holder can leave funds locked; operational dispute procedures apply. |
| **D-02** | Unresponsive counterparty leaves pending payment or transfer hanging indefinitely. | `AryaFi.Finance.Payment`, `AryaFi.Contracts.Transfer` | `MEDIUM` | **Payer Cancellation Choice**: Payer / sender maintains explicit `CancelPayment` or `CancelTransfer` choice executable while the instruction is still in `Pending` status. | None. |
| **D-03** | Dust spamming: Repeatedly splitting cash into tiny fractions to bloat ledger storage. | `AryaFi.Finance.Cash` | `LOW` | **Canton Traffic Fees & Invariant Checks**: Preconditions enforce `splitAmount > 0.0` and Canton domain traffic fees charge participants per transaction byte, disincentivizing spam. | Low. |

---

### 2.6 Elevation of Privilege (Access Control & Gating)

| Threat ID | Threat Vector | Targeted Component | Severity | Implemented Daml & Canton Mitigation | Residual Risk |
|:---|:---|:---|:---:|:---|:---|
| **E-01** | Sanctioned or un-KYC'd party attempts to receive regulated tokenized securities. | `AryaFi.Compliance.*`, `AryaFi.Finance.TokenTransfer`, `AryaFi.Finance.TokenAllocation`, `AryaFi.Finance.Settlement`, `AryaFi.Contracts.Transfer` | `CRITICAL` | **Compliance Inside the Transaction**: a bank or custodian with `ComplianceRequirements` on its transfer and allocation factories evaluates both parties' KYC and sanctions attestations and the instrument's transfer rule in the transfer, acceptance, or allocation itself (`AryaFi.Compliance.Gate`); a refused movement touches no holdings and the reason is recorded. A `DvpInstruction` with requirements settles only through `ExecuteScreenedDvpSettlement`. An `AssetTransferRequest` with requirements completes through the custodian's `CompleteScreenedTransfer` on approval, and otherwise is rejected or left to the compliance officer; one without completes only after the officer's `ApproveTransfer`. A direct `TransferSecurity` requires the receiver's authority. | Low for screened factories, DvPs, and requests; medium for registries that set no requirements, where approval is a manual decision (see KNOWN_LIMITATIONS §4). |
| **E-06** | A party passes a compliance attestation it made itself, naming a trusted authority as its owner. | `aryafi-compliance-api`, `AryaFi.Compliance.Gate` | `CRITICAL` | **Owner Must Sign**: anyone can implement `CompliancePolicy`, but its choices, which implementations cannot override, refuse a policy whose owner is not one of its signatories, so the transaction fails. The gate counts only policies whose owner is among the registry's accepted authorities. | None. |
| **E-07** | The sender leaves out evidence that would refuse the transfer, such as a newer, blocking screening or a stricter rule by another officer. | `AryaFi.Compliance.Gate` | `HIGH` | **Missing Evidence Refuses; Archived Evidence Fails**: a movement without a KYC attestation, a screening by every sanctions authority, or a rule for a restricted instrument is refused. An authority changes an attestation by archiving it, so an outdated one cannot be evaluated. | Medium: the gate cannot tell that a party has a second attestation, or that another accepted officer has a rule, that the caller left out; registries should accept one rule officer per instrument and one KYC authority per client. |
| **E-02** | Non-settlement agent attempts to trigger the DvP exchange, or settles it against the wrong positions. | `AryaFi.Finance.Settlement` | `HIGH` | **Controller Restriction & Leg Validation**: `ExecuteDvpSettlement` is controlled by `settlementAgent` only and rejects legs whose owner, account, ISIN, quantity, currency, amount, lock holder, or lock reference differ from the instruction. | None. |
| **E-03** | Borrower attempts to release pledged collateral without paying down loan. | `AryaFi.Contracts.Pledge` | `CRITICAL` | **Pledgee Authorization**: Choice `ReleasePledge` is restricted to `controller pledgee` (lender/custodian). The pledgor cannot release their own encumbered assets. | None. |
| **E-04** | The same asset is pledged or posted as collateral to several agreements. | `AryaFi.Contracts.Pledge`, `AryaFi.Finance.Collateral`, `AryaFi.Contracts.Margin` | `HIGH` | **Locked Pledged Positions**: once the pledgor encumbers a pledge (`EncumberHolding`), the pledged cash or security position is locked to the pledgee, so it cannot be locked for another pledge, a settlement, or a transfer; release unlocks it and enforcement delivers it to the pledgee. Likewise, `LockCollateralHolding` locks a collateral position's security position to the receiver; release unlocks it and liquidation delivers it. **Not mitigated** for pledges and collateral that are not locked, and for margin calls satisfied by reference, which name assets by text. | Low for locked pledges and collateral; high for unlocked ones and margin satisfied by reference (see IMPROVEMENT_PLAN). |
| **E-05** | A party is made the owner of a position it did not accept. | `AryaFi.Finance.Cash`, `AryaFi.Finance.Security`, `AryaFi.Finance.Asset` | `MEDIUM` | **Receiver Authority**: Transfers are controlled by owner, bank/custodian, and the receiving owner, who becomes a signatory. | None. |

---

## 3. Summary Risk Assessment & Audit Recommendations

1. **Authorization Assurance**: All state transitions enforce least-privilege controllers. No single party can unilaterally move funds or seize assets without pre-agreed contractual conditions.
2. **Mathematical Correctness**: Asset quantity and cash conservation invariants are enforced at the type level with non-negative constraints and strict sum equality.
3. **Operational Pre-Requisite**: Production deployment requires participant nodes to protect signing keys inside HSMs (FIPS 140-2 Level 3) to prevent identity compromise outside the contract layer.
