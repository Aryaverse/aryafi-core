# Independent Security Review Preparation Dossier & Invariant Proofs

## 1. Executive Summary & Audit Scope

This dossier serves as the formal briefing package for independent smart contract auditing and cryptography assurance firms evaluating **AryaFi Core** for production certification.

### 1.1 Target Architecture & Scope of Review
- **Language**: Daml (GHC-based Haskell derivative) targeting Canton Network protocol v30.
- **Source Code Tree**:
  - `daml/src/AryaFi/Common/`: Domain types, mathematical conventions, error codes, identifiers, events.
  - `daml/src/AryaFi/Finance/`: Primitives (`CashPosition`, `SecurityPosition`, `Account`, `PaymentInstruction`, `DvpInstruction`).
  - `daml/src/AryaFi/Contracts/`: Financing lifecycle contracts (`InstitutionalLoan`, `RepoAgreement`, `SecuritiesLendingAgreement`, `AssetPledge`, `EscrowAgreement`, `FundSubscription`, `AssetRedemption`, `Transfer`).
  - `daml/src/AryaFi/Compliance/`: Policy gating (`KYCAttestation`, `SanctionsScreening`, `Eligibility`, `RegulatoryReporting`).
- **Target Release**: `v1.0.0-rc1`

---

## 2. Mathematical Invariant Proofs & Formal Properties

The integrity of financial transactions on AryaFi depends on strict formal properties enforced at the contract layer:

### Lemma 1: Strict Value Conservation in Position Splits and Merges
*Claim*: For any operation $\mathcal{O} \in \{\text{SplitCash}, \text{MergeCash}\}$ applied to an Active Contract Set state $\mathcal{S}$, the sum of monetary units across accounts is strictly invariant:

$$\sum_{p \in \mathcal{S}_{\text{post}}} p.\text{amount} \equiv \sum_{p \in \mathcal{S}_{\text{pre}}} p.\text{amount}$$

*Proof*:
1. **Case `SplitCash`**: Let $P$ be a position with amount $A$. The choice accepts argument $s$.
   - Precondition guards enforce: $s > 0 \land s < A$.
   - The choice consumes $P$ and creates $P_1$ with amount $s$ and $P_2$ with amount $A - s$.
   - The sum of output amounts is $s + (A - s) = A$.
   - Hence $\Delta = (s + A - s) - A = 0$. Value is strictly conserved.
2. **Case `MergeCash`**: Let $P_1$ be the calling position with amount $A_1$, and $P_2$ be the target position with amount $A_2$.
   - Precondition guards enforce identical `(bank, owner, accountId, currency)` and `not isLocked`.
   - The choice consumes $P_2$ via explicit `archive otherCid` and replaces $P_1$ with $P_{\text{merged}}$ of amount $A_1 + A_2$.
   - Sum of inputs: $A_1 + A_2$. Sum of outputs: $A_1 + A_2$.
   - Value is strictly conserved. $\blacksquare$

### Lemma 2: Non-Negative Quantity Invariant
*Claim*: No contract instance of `CashPosition` or `SecurityPosition` can exist on ledger with an amount/quantity less than or equal to zero.

*Proof*:
- Both templates define compile-time Daml `ensure` clauses:
  ```daml
  ensure amount > 0.0
  ```
  ```daml
  ensure quantity > 0.0
  ```
- In Daml runtime semantics, any transaction that attempts to create a contract violating the `ensure` clause is rejected atomically by the ledger validation engine during interpretation. Therefore, negative or zero positions cannot enter the Active Contract Set. $\blacksquare$

### Lemma 3: Dual-Signatory Lock Exclusivity
*Claim*: No encumbered asset can be moved, split, merged, or double-pledged.

*Proof*:
- The choices `SplitCash`, `MergeCash`, and `TransferCash` all evaluate the precondition:
  ```daml
  require (not isLocked) "Cannot operate on a locked position"
  ```
- Because contracts are immutable and state transitions consume the contract ID, a locked contract cannot be used in a settlement leg until the dual-signatory choice `UnlockCash` is exercised jointly by both `owner` and `bank`. $\blacksquare$

---

## 4. Automated Test Coverage & Assurance Verification

AryaFi Core enforces six layers of automated testing:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AryaFi Test Architecture                        │
├────────────────────────────┬───────────────────────────────────────────┤
│ 1. Unit Tests              │ Common types, time math, financial splits │
│ 2. Lifecycle Scenarios     │ End-to-end Loan, Repo, SecLending, DvP    │
│ 3. Negative Tests          │ Boundary violations, assertion trips      │
│ 4. Authorization Tests     │ Unauthorized party submission rejections  │
│ 5. Privacy Verification    │ Canton observer boundary checks           │
│ 6. Integration Tests       │ Cross-module compliance gating pipelines  │
└────────────────────────────┴───────────────────────────────────────────┘
```

### Test Suite Execution Summary:
- **Unit Suites**: Tested across 11 test modules (`FinanceTest`, `CommonTest`, `FundLifecycleTest`, `SecuritiesLendingTest`, etc.).
- **Scenario Coverage**: 8 comprehensive multi-party institutional lifecycle scenarios.
- **Negative & Security Hardening**:
  - `ComplianceViolationTest.daml`: 8 negative compliance violation tests.
  - `UnauthorizedAccessTest.daml`: 12 unauthorized access tests verifying submitter rejections.
  - `InvalidStateTransitionTest.daml`: 15 state machine invalid transition enforcement tests.
  - `ObserverPrivacyTest.daml`: Verifies outsider and non-observer cryptographic blindness.

---

## 5. Known Assumptions & Cryptographic Dependencies

1. **Entropy & Key Security**: Private keys for Canton participant nodes must be managed via hardware security modules (HSM) conforming to FIPS 140-2 Level 3.
2. **Oracle / Market Data Feeds**: Mark-to-market prices for collateral revaluations in Repo and Securities Lending are currently provided as validated choice arguments co-signed by counterparties or trusted calculation agents. Off-ledger feeds must be vetted for Sybil and flash loan manipulation.
3. **Clock Skew Tolerance**: Canton enforces a domain record time tolerance (default: 60 seconds). Time-dependent choices (e.g. loan maturity, recall deadlines) rely on Canton consensus sequencer timestamps.

---

## 6. Auditor Verification Runbook

External audit teams can verify the codebase using the following steps:

```bash
# 1. Clean build verification
daml clean
daml build

# 2. Run full test suite across all modules
daml test

# 3. Inspect generated Daml Archive metadata
daml damlc inspect-dar .daml/dist/aryafi-core-0.1.0.dar

# 4. Verify specific security & privacy suites
daml test --test-pattern ObserverPrivacyTest
daml test --test-pattern UnauthorizedAccessTest
daml test --test-pattern InvalidStateTransitionTest
```
