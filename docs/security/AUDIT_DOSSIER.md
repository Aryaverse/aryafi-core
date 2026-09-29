# Security Review Preparation Dossier & Invariant Arguments

## 1. Executive Summary & Review Scope

This dossier is the briefing package for an independent security review of **AryaFi Core**. **No independent review has taken place yet.** Until one does, no module carries the `Production Candidate` or `Production Reviewed` label (see [KNOWN_LIMITATIONS.md](../KNOWN_LIMITATIONS.md)).

### 1.1 Target Platform & Scope of Review
- **Language / platform**: Daml SDK 2.10.0 (Daml-LF 1.x), deployed on Canton 2.10 (protocol version 5).
- **Source tree in scope**:
  - `daml/src/AryaFi/Common/`: Domain types, day-count conventions, error helpers, identifiers, audit events, policy decisions.
  - `daml/src/AryaFi/Finance/`: `CashPosition`, `SecurityPosition`, `AssetHolding`, `Account`, `InstitutionalParty`, `CollateralPosition`, `FinancialObligation`, `PaymentInstruction`, `DvpInstruction`.
  - `daml/src/AryaFi/Contracts/`: `InstitutionalLoan`, `RepoAgreement`, `ReverseRepoPosition`, `SecuritiesLendingAgreement`, `MarginCall`, `AssetPledge`, `ConditionalEscrow`, `AssetTransferRequest`, `FundSubscription`, `AssetRedemption`.
  - `daml/src/AryaFi/Compliance/`: `KycAttestation`, `SanctionsAttestation`, `JurisdictionProfile`, `EligibilityPolicy`, `TransferRestrictionRule`, `OwnershipRestriction`, `RegulatoryReportRecord`.
- **Out of scope**: the test scripts under `daml/src/AryaFi/Test/`, the web terminal, and the deployment configuration.
- **Authorization reference**: [AUTHORIZATION_MATRIX.md](AUTHORIZATION_MATRIX.md), generated from the source.
- **Target release**: `v1.0.2`

---

## 2. Invariants and the Tests That Check Them

Each invariant below is argued from the code and exercised by a named test. They are arguments for reviewers to verify, not formal proofs.

### Invariant 1: Value Conservation in Splits and Merges
*Claim*: `SplitCash` and `MergeCash` (and `SplitSecurity`) neither create nor destroy value.

*Argument*:
- `SplitCash` requires `0 < s < A`, consumes the position of amount `A`, and creates positions of `s` and `A - s`.
- `MergeCash` requires the same bank, owner, account, and currency, and both positions unlocked; it archives the other position (`A2`) and recreates this one (`A1`) with `A1 + A2`.
- Daml `Decimal` is fixed-point with 10 decimal places, so `s + (A - s) = A` holds exactly; there is no floating-point rounding.

*Tests*: `Unit/AssetCashTest.daml` (split, merge, boundary cases), `Scenarios/TreasuryCashScenario.daml` (split, sweep, merge).

### Invariant 2: Positive Position Quantities
*Claim*: No `CashPosition`, `SecurityPosition`, or `AssetHolding` exists with a zero or negative amount or quantity.

*Argument*: each template's `ensure` clause requires `amount > 0.0` / `quantity > 0.0`; a transaction that would create a violating contract is rejected.

*Tests*: `Unit/AssetCashTest.daml`, `Negative/InvalidStateTransitionTest.daml`.

### Invariant 3: Lock Integrity
*Claim*: A locked position cannot be split, merged, transferred, or unlocked except through its lock holder.

*Argument*:
- `ensure ... isLocked == (lockHolder /= None)` ties the lock flag to a named lock holder.
- `SplitCash`, `MergeCash`, `TransferCash` (and the security/asset equivalents) require `not isLocked`.
- `UnlockCash` / `UnlockSecurity` / `UnlockAsset` are controlled by the lock holder alone; `SettleLockedCash` / `SettleLockedSecurity` are controlled by the lock holder and the receiver.
- Owner and bank/custodian consent once, when creating the lock; afterwards they cannot withdraw the position from the settlement it was locked for.

*Scope limit*: this invariant covers positions. It does **not** prevent double-pledging: `AssetPledge`, `CollateralPosition`, and `MarginCall` reference assets by text, so the ledger does not link them to a locked position. (An earlier version of this dossier claimed otherwise; that claim was incorrect.)

*Tests*: `Scenarios/DvpSettlementTest.daml` (`testLockedLegsCannotBeWithdrawn`), `Authorization/MultiSignatoryTest.daml`, `Negative/UnauthorizedAccessTest.daml`.

### Invariant 4: DvP Atomicity
*Claim*: Either both legs of a DvP settle or neither does.

*Argument*: `ExecuteDvpSettlement` fetches both locked legs, checks owner, account, ISIN, quantity, currency, amount, lock holder, and lock reference against the instruction, then exercises `SettleLockedSecurity` and `SettleLockedCash` and records `Settled`, all within one Daml transaction. Any failed check aborts the whole transaction.

*Tests*: `Scenarios/DvpSettlementTest.daml` (`testDvpFullLifecycle`, `testDvpRejectsMismatchedLegs`, `testCannotReExecuteSettledDvp`), `Scenarios/TreasuryDvpScenario.daml`.

### Invariant 5: No Party Reduces Its Own Obligation
*Claim*: An obligor cannot record its own payment, and a creditor cannot unilaterally increase what is owed.

*Argument*: `PayDownPrincipal` and `PayAccruedInterest` are controlled by the lender; `AccrueInterest` computes interest from the contract's rate, day count, and ledger time and takes no amount; `AccrueLendingFee` needs lender and borrower; `PayLendingFee` is controlled by the lender; margin fulfilment is only satisfied when the caller runs `ConfirmMarginReceipt`; `ReturnSecurities` caps collateral release pro rata; `DischargeObligation` is controlled by the obligee.

*Tests*: `Unit/LoanTest.daml` (`testBorrowerCannotRecordOwnRepayment`), `Unit/SecuritiesLendingTest.daml` (`testBorrowerCannotReduceOwnObligations`), `Unit/RepoMarginTest.daml` (`testMarginCallPledgeFulfillment`, `testMarginDeadlineAndRejection`).

### Invariant 6: Consent for Ownership and Disclosure
*Claim*: No position is created for a party without its authority, and bilateral agreements are only disclosed with both counterparties' consent.

*Argument*: transfers are controlled by owner, bank/custodian, and the receiving owner; `Add*Observer` choices on loans, repos, securities loans, margin calls, pledges, and collateral positions are controlled by both principals; observers are cleared on transfer.

*Tests*: `Authorization/MultiSignatoryTest.daml`, `Privacy/ObserverPrivacyTest.daml`, `Scenarios/EscrowScenario.daml` (`testPledgeAddObserver`).

---

## 3. Automated Test Coverage

`daml test --show-coverage` on v1.0.2:

| Measure | Result |
|:---|:---|
| Test scripts | 289, all passing |
| Templates created | 26 of 27 (96.3%); `JurisdictionProfile` is never created |
| Choices exercised | 138 of 206 (67.0%), counting each template's implicit `Archive` |

| Suite | Files | Focus |
|:---|:---|:---|
| `Unit/` | 11 | Types, day counts, primitives, contracts, compliance policies |
| `Scenarios/` | 9 | End-to-end DvP, repo, loan, securities lending, treasury, escrow, private credit, transfer |
| `Negative/` | 3 | Unauthorized submitters, compliance violations, invalid state transitions |
| `Authorization/` | 1 | Multi-signatory consent |
| `Privacy/` | 1 | Observer visibility from each party's viewpoint |
| `Integration/` | 1 | Cross-module workflows on a single ledger |

Not yet covered: property-based tests, multi-participant tests on a real Canton topology, and concurrency/contention tests.

---

## 4. Known Assumptions & Dependencies

1. **Key security**: Participant node keys are managed outside the contract layer (HSM/KMS); see [OPERATIONS_GUIDE.md](../deployment/OPERATIONS_GUIDE.md).
2. **Market data**: Collateral and repo revaluations take prices as choice arguments from the custodian or both counterparties. There is no on-ledger price oracle; off-ledger price sources must be controlled by the operator.
3. **Time**: Time-dependent choices (loan accrual and maturity, recall and margin deadlines, KYC and sanctions expiry) use Daml ledger time, which Canton bounds by the domain's ledger-time/record-time tolerance.
4. **Multi-party submission**: The tests create multi-signatory contracts with `submitMulti`. On separate participants this needs propose/accept workflows (not yet provided).

---

## 5. Reviewer Verification Runbook

```bash
# 1. Clean build with warnings as errors (see daml.yaml build-options)
daml clean
daml build

# 2. Run the full test suite with coverage
daml test --show-coverage

# 3. Inspect the DAR
daml damlc inspect-dar .daml/dist/aryafi-core-1.0.0.dar

# 4. Run specific security and privacy suites (--files selects a test module;
#    --test-pattern would match script names, not file names)
daml test --files daml/src/AryaFi/Test/Privacy/ObserverPrivacyTest.daml
daml test --files daml/src/AryaFi/Test/Negative/UnauthorizedAccessTest.daml
daml test --files daml/src/AryaFi/Test/Scenarios/DvpSettlementTest.daml

# 5. Confirm the authorization matrix matches the source
python3 scripts/gen_authorization_matrix.py
git diff --exit-code docs/security/AUTHORIZATION_MATRIX.md
```
