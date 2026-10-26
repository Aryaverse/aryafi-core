# Security Review Preparation Dossier & Invariant Arguments

## 1. Executive Summary & Review Scope

This dossier is the briefing package for an independent security review of **AryaFi Core**. **No independent review has taken place yet.** Until one does, no module carries the `Production Candidate` or `Production Reviewed` label (see [KNOWN_LIMITATIONS.md](../KNOWN_LIMITATIONS.md)).

### 1.1 Target Platform & Scope of Review
- **Language / platform**: Daml SDK 3.5.12 (Daml-LF 2.2), deployed on Canton 3.5 (protocol version 35).
- **Source tree in scope**:
  - `daml/src/AryaFi/Common/`: Domain types, day-count conventions, error helpers, identifiers, audit events, policy decisions.
  - `daml/src/AryaFi/Finance/`: `CashPosition`, `SecurityPosition`, `AssetHolding`, `Account`, `InstitutionalParty`, `CollateralPosition`, `FinancialObligation`, `PaymentInstruction`, `DvpInstruction`, and the Canton Network Token Standard implementation: the `Holding` views (`TokenStandard`), `PositionTransferFactory` and `PositionTransferInstruction` (`TokenTransfer`), `PositionAllocationFactory` and `PositionAllocation` (`TokenAllocation`), `TokenDvpInstruction` and `TokenDvpAllocationRequest` (`TokenDvp`), and their shared helpers (`TokenRegistry`).
  - `daml/src/AryaFi/Contracts/Proposal.daml`: `MultiPartyProposal`, which collects the signatures for a contract or a joint choice one party at a time.
  - `daml/src/AryaFi/Contracts/FinancingLegs.daml` and `daml/src/AryaFi/Finance/Encumbrance.daml`: the shared helpers that settle financing legs as token-standard DvPs and lock positions for pledges and collateral.
  - The token-standard interface packages in `daml/deps/splice` are vendored from Splice 0.8.3 and are out of scope, as is Splice's reference token (`splice-test-token-v2`), which only the tests use.
  - `daml/src/AryaFi/Contracts/`: `InstitutionalLoan`, `RepoAgreement`, `ReverseRepoPosition`, `SecuritiesLendingAgreement`, `MarginCall`, `AssetPledge`, `ConditionalEscrow`, `AssetTransferRequest`, `FundSubscription`, `AssetRedemption`.
  - `daml/src/AryaFi/Compliance/`: `KycAttestation`, `SanctionsAttestation`, `JurisdictionProfile`, `EligibilityPolicy`, `TransferRestrictionRule`, `OwnershipRestriction`, `RegulatoryReportRecord`, and the compliance gate (`Gate`), which the token-standard factories and `DvpInstruction` use to evaluate them.
  - `daml/compliance-api/`: the `CompliancePolicy` interface (package `aryafi-compliance-api`), which the KYC, sanctions, and transfer-rule templates implement.
- **Out of scope**: the test package under `daml/test/AryaFi/Test/`, the website, and the deployment configuration.
- **Authorization reference**: [AUTHORIZATION_MATRIX.md](AUTHORIZATION_MATRIX.md), generated from the source.
- **Target release**: `v3.3.0`

---

## 2. Invariants and the Tests That Check Them

Each invariant below is argued from the code and exercised by a named test. They are arguments for reviewers to verify, not formal proofs.

### Invariant 1: Value Conservation in Splits, Merges, and Transfers
*Claim*: `SplitCash` and `MergeCash` (and `SplitSecurity`), and token-standard transfers, neither create nor destroy value.

*Argument*:
- `SplitCash` requires `0 < s < A`, consumes the position of amount `A`, and creates positions of `s` and `A - s`.
- `MergeCash` requires the same bank, owner, account, and currency, and both positions unlocked; it archives the other position (`A2`) and recreates this one (`A1`) with `A1 + A2`.
- A token-standard transfer (`TransferFactory_Transfer`) archives every input holding and creates the change, `total - amount`, and the transferred `amount`; it fails if the inputs total less than the amount. Accepting, rejecting, or withdrawing moves the locked amount whole.
- Token-standard settlement (`SettlementFactory_SettleBatch`) proceeds only if the allocations authorize exactly both sides of every leg. Each allocation locks, per instrument, what it sends net of what it receives, and on settlement archives that and creates what it receives net of what it sends. Summed over the allocations of a batch, each leg is counted once as sent and once as received, so what is archived equals what is created, instrument by instrument. `Allocation_Settle` on a single allocation, which would skip that check, is refused.
- Daml `Decimal` is fixed-point with 10 decimal places, so `s + (A - s) = A` holds exactly; there is no floating-point rounding.

*Tests*: `Unit/AssetCashTest.daml` (split, merge, boundary cases), `Scenarios/TreasuryCashScenario.daml` (split, sweep, merge), `Unit/TokenTransferTest.daml` (change, exact amounts, short inputs), `Unit/TokenAllocationTest.daml` (`testDvpThroughAllocations`, `testNettedAllocation`, `testUnusedInputsReturned`, `testSettleAlone`).

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
- A pending token-standard transfer locks the amount to the registry (the bank or custodian). It is delivered to the receiver on acceptance, before `executeBefore`, or unlocked for the sender on rejection or withdrawal.
- A token-standard allocation locks its funding to the registry, shown to the settlement's executors. It is consumed on settlement, before the settlement deadline, or unlocked for the owner when the executors cancel the allocation or the owner withdraws it (a committed allocation only after its deadline).

- An encumbered `AssetPledge` locks the pledged position to the pledgee, and a locked `CollateralPosition` locks its position to the receiver, through the same checks (`AryaFi.Finance.Encumbrance`). Releasing unlocks the position for its owner, enforcing or liquidating delivers it to the pledgee or receiver, and a substitution locks the new asset's position before unlocking the old one. The custodian cannot change the quantity of locked collateral by revaluing it.
- A funded `ConditionalEscrow` locks the depositor's cash position to the escrow agent, through the bank's `PositionTransferFactory` (`LockPosition`), which the registry agreed to by creating it. Releasing the escrow, with the agent and the beneficiary, delivers the position to the beneficiary; refunding it unlocks it for the depositor. The depositor and the beneficiary cannot release, refund, or move it alone.

*Scope limit*: this invariant covers positions. It prevents double-pledging only for locked pledges and collateral: a pledge or collateral position that is not locked, and a `MarginCall` satisfied by reference, name assets by text, so the ledger does not link them to a locked position.

*Tests*: `Scenarios/DvpSettlementTest.daml` (`testLockedLegsCannotBeWithdrawn`), `Authorization/MultiSignatoryTest.daml`, `Negative/UnauthorizedAccessTest.daml`, `Unit/TokenTransferTest.daml` (`testTransferChecks`, `testExpiredTransfer`), `Unit/TokenAllocationTest.daml` (`testCancelAndWithdraw`, `testCommittedAllocation`), `Unit/PledgedHoldingTest.daml` (`testDoublePledgeRefused`, `testEncumberAndRelease`, `testEnforcementDeliversToPledgee`), `Unit/CollateralAndMarginTest.daml` (`testCollateralCannotBeReused`, `testCollateralLockAndRelease`, `testCollateralLiquidation`), `Unit/FinancingCashTest.daml` (`testEscrowReleasesDeposit`, `testEscrowDisputeAndRefund`, `testEscrowDepositChecks`).

### Invariant 4: DvP Atomicity
*Claim*: Either both legs of a DvP settle or neither does.

*Argument*: `ExecuteDvpSettlement` fetches both locked legs, checks owner, account, ISIN, quantity, currency, amount, lock holder, and lock reference against the instruction, then exercises `SettleLockedSecurity` and `SettleLockedCash` and records `Settled`, all within one Daml transaction. Any failed check aborts the whole transaction.

A repo's opening and closing legs and a securities loan's delivery and returns settle as token-standard DvPs through the agreement (`SettleOpeningLeg`, `SettleClosingLeg`, `SettleDelivery`, `SettleReturn`, via `AryaFi.Contracts.FinancingLegs`), so the agreement's new status is part of the same transaction as both legs: if the DvP fails, the agreement does not change. Each checks first that the DvP is the agreement's (agent, parties, trade ID, securities, cash).

A capital call and a redemption exchange fund units for cash in one transaction in the same way: `SettleCapitalCall` accepts the investor's cash transfer to the fund and issues the units it buys, and `SettleRedemption` accepts the fund manager's payout and burns the redeemed units. If the cash registry refuses the transfer, no units are issued or burnt.

Token-standard settlement is atomic in the same way when the settlement agent settles every registry's batch in one transaction, as `ExecuteTokenDvp` does: if any registry rejects its batch, the transaction fails and no registry settles. `ExecuteTokenDvp` first checks that it has exactly one batch for each registry of the trade's legs.

*Tests*: `Unit/FinancingOnLedgerTest.daml` (`testRepoLegsMoveAssets`, `testRepoLegChecks`, `testSecuritiesLoanMovesAssets`), `Unit/FinancingCashTest.daml` (`testCapitalCallIssuesUnits`, `testRedemptionBurnsUnits`), `Scenarios/DvpSettlementTest.daml` (`testDvpFullLifecycle`, `testDvpRejectsMismatchedLegs`, `testCannotReExecuteSettledDvp`), `Scenarios/TreasuryDvpScenario.daml`, `Unit/TokenAllocationTest.daml` (`testDvpThroughAllocations`, `testSettlementChecks`), `Scenarios/TokenDvpTest.daml` (`testTokenDvpWithAryaFiCash`, `testTokenDvpWithAnotherToken`, `testTokenDvpNeedsBothSides`).

### Invariant 5: No Party Reduces Its Own Obligation
*Claim*: An obligor cannot record its own payment, and a creditor cannot unilaterally increase what is owed.

*Argument*: `PayDownPrincipal`, `PayAccruedInterest`, and `ReceiveRepayment` are controlled by the lender, and `ReceiveRepayment` reduces the debt only by the cash it accepts; `DrawdownByTransfer` adds to the principal exactly the cash the borrower accepts; `AccrueInterest` computes interest from the contract's rate, day count, and ledger time and takes no amount; `AccrueLendingFee` needs lender and borrower; `PayLendingFee` is controlled by the lender; `AccrueFeesToDate` computes a securities loan's fees and rebates from its rates, its day count, and ledger time and takes no amount, and returns, revaluations, and a default accrue them first, so a party cannot skip a period; `ReceiveLendingFee` (the lender) and `ReceiveRebate` (the borrower) reduce what is owed only by the cash the receiver accepts, and at most to zero; `SettleCapitalCall` issues units only for cash the fund manager receives, at the agreed unit price, and `SettleRedemption` pays exactly the net payout struck at approval; margin fulfilment is only satisfied when the caller runs `ConfirmMarginReceipt`; `ReturnSecurities` caps collateral release pro rata; `DischargeObligation` is controlled by the obligee.

*Tests*: `Unit/LoanTest.daml` (`testBorrowerCannotRecordOwnRepayment`), `Unit/SecuritiesLendingTest.daml` (`testBorrowerCannotReduceOwnObligations`), `Unit/FinancingCashTest.daml` (`testLendingFeesAccrue`, `testLendingFeePayments`, `testCapitalCallIssuesUnits`, `testRedemptionBurnsUnits`), `Unit/RepoMarginTest.daml` (`testMarginCallPledgeFulfillment`, `testMarginDeadlineAndRejection`).

### Invariant 6: Consent for Ownership and Disclosure
*Claim*: No position is created for a party without its authority, and bilateral agreements are only disclosed with both counterparties' consent.

*Argument*: transfers are controlled by owner, bank/custodian, and the receiving owner; a token-standard transfer reaches the receiver only when the receiver accepts it or instructs it with the sender, and only between clients the registry listed on its factory; token-standard settlement creates a position only for an account whose owner allocated to receive it, so a `TokenDvpInstruction`, signed by the agent alone, moves nothing the seller and buyer did not allocate; a `MultiPartyProposal` creates a contract only once all its signatories have signed it, and exercises a joint choice only once exactly its controllers have; `Add*Observer` choices on loans, repos, securities loans, margin calls, pledges, and collateral positions are controlled by both principals; observers are cleared on transfer.

*Tests*: `Authorization/MultiSignatoryTest.daml`, `Privacy/ObserverPrivacyTest.daml`, `Scenarios/EscrowScenario.daml` (`testPledgeAddObserver`), `Unit/TokenTransferTest.daml` (`testInstructionActors`, `testFactoryClients`, `testTransferRejected`), `Unit/TokenAllocationTest.daml` (`testSettlementChecks`, `testAllocateChecks`, `testAllocationVisibility`), `Unit/ProposalTest.daml` (`testProposalChecks`, `testJointActionNeedsItsControllers`), `Unit/FinancingProposalTest.daml` (`testFinancingControllersChecked`, `testAssetTransferJointly`).

### Invariant 7: Compliance Is Checked Where Value Moves
*Claim*: When a bank or custodian has set compliance requirements, nothing moves through its token-standard factories, no screened DvP settles, and no screened asset transfer request completes, unless the KYC, sanctions, and transfer-rule policies approve both parties in the same transaction; a refused movement changes no holdings, and its reasons are recorded.

*Argument*: `ComplianceRequirements` are a field of the registry-signed `PositionTransferFactory` and `PositionAllocationFactory`, copied onto each `PositionTransferInstruction`, and of the `DvpInstruction` that seller, buyer, and agent sign; the caller cannot change them. `instructTransfer` and `allocate` evaluate the requirements after their input checks and before archiving or locking any holding, and return `Failed` without touching the inputs when refused; `TransferInstruction_Accept` evaluates them before delivering, and on refusal releases the lock to the sender. `ExecuteDvpSettlement` refuses an instruction with requirements, so the agent must use `ExecuteScreenedDvpSettlement`, which settles only on approval; `CompleteScreenedTransfer` completes an `AssetTransferRequest` only on approval and otherwise rejects it or leaves it for the compliance officer. Missing evidence is a rejection, evidence is evaluated through the read-only `CompliancePolicy_Evaluate` (an archived attestation cannot be evaluated), and every decision creates an `AuditLog`. The gate accepts a policy as an authority's only if that authority signed it: the interface's own choices, which implementations cannot override, abort when the view's owner is not a signatory, so a template written by anyone cannot pose as an authority's attestation. The financing contracts that pay by transfer (loans, margin calls, capital calls, redemptions, lending fees and rebates) and `ExecutePayment` move cash only through the registry's transfer factory and instructions, so they are screened in the same way; a payment instruction refused by the bank fails with the reason.

*Scope limit*: delivering or unlocking a locked position does not go through the factories, so a pledge's enforcement and an escrow's release are not screened.

*Tests*: `Unit/CompliancePolicyTest.daml` (`testForgedPolicyRefused`), `Unit/ComplianceGateTest.daml` (`testTransferToSanctionedReceiverFails`, `testTransferToNonWhitelistedReceiverFails`, `testEvidenceIsRequired`, `testReceiverScreenedAgainOnAcceptance`, `testOwnershipRestrictionInTransfer`, `testScreenedAssetTransferRequest`, `testScreenedAllocation`, `testScreenedDvpSettles`, `testScreenedDvpFailsForSanctionedBuyer`), `Unit/FinancingCashTest.daml` (`testPaymentInstructionMovesCash`), and `Network/ComplianceAcrossNodes.daml` (`runComplianceAcrossNodes`).

---

## 3. Automated Test Coverage

`dpm test --all --show-coverage` (in `daml/test`) on 3.4.0 (in development):

| Measure | Result |
|:---|:---|
| Test scripts | 394, all passing |
| Templates created | 34 of 34 in `aryafi-core` (100%) |
| Choices exercised | 183 of 250 in `aryafi-core` (73.2%), counting each template's implicit `Archive`; the report does not count interface choices (the token standard's and `CompliancePolicy`'s), which the tests exercise |

| Suite | Files | Focus |
|:---|:---|:---|
| `Unit/` | 22 | Types, day counts, primitives, contracts, pledged holdings, collateral, margin, loans, repos, securities loans, escrows, funds, and payment instructions on real assets, securities lending fees, compliance policies and the compliance gate, token-standard holdings, transfers, and settlement, multi-party proposals for contracts and joint choices |
| `Scenarios/` | 10 | End-to-end DvP (including through the token standard), repo, loan, securities lending, treasury, escrow, private credit, transfer |
| `Negative/` | 3 | Unauthorized submitters, compliance violations, invalid state transitions |
| `Authorization/` | 1 | Multi-signatory consent |
| `Privacy/` | 1 | Observer visibility from each party's viewpoint |
| `Integration/` | 1 | Cross-module workflows on a single ledger |
| `Network/` | 7 | Smoke test for shared networks such as TestNet (five run-scoped parties, one DvP); both DvPs, a repo and an escrow agreed and changed, a repo's legs and a funded escrow settled, and screened transfers, with each institution on its own participant |

Not yet covered: property-based tests, concurrency/contention tests, and multi-participant tests beyond the `Network/` scripts (both DvPs, repos, escrows, and screened transfers, each run with every institution on its own participant, locally and in CI).

---

## 4. Known Assumptions & Dependencies

1. **Key security**: Participant node keys are managed outside the contract layer (HSM/KMS); see [OPERATIONS_GUIDE.md](../deployment/OPERATIONS_GUIDE.md).
2. **Market data**: Collateral and repo revaluations take prices as choice arguments from the custodian or both counterparties. There is no on-ledger price oracle; off-ledger price sources must be controlled by the operator.
3. **Time**: Time-dependent choices (loan accrual and maturity, recall and margin deadlines, KYC and sanctions expiry) use Daml ledger time, which Canton bounds by the synchronizer's ledger-time/record-time tolerance.
4. **Multi-party submission**: Most tests create multi-signatory contracts by submitting as several parties at once (`submit (actAs [...])`). On separate participants, `MultiPartyProposal` collects the signatures one party at a time instead, for contracts and for joint choices; the `Network/` scripts agree and settle the reference DvP, agree and change a repo and an escrow, and agree a repo whose legs and an escrow whose deposit then settle, that way.

---

## 5. Reviewer Verification Runbook

```bash
# 1. Clean build of both packages with warnings as errors (see daml.yaml build-options)
dpm clean --all
dpm build --all

# 2. Run the full test suite with coverage of the production templates
cd daml/test
dpm test --all --show-coverage

# 3. Inspect the production DAR
dpm inspect-dar ../../.daml/dist/aryafi-core-3.4.0.dar

# 4. Run specific security and privacy suites (--files selects a test module;
#    --test-pattern would match script names, not file names)
dpm test --files AryaFi/Test/Privacy/ObserverPrivacyTest.daml
dpm test --files AryaFi/Test/Negative/UnauthorizedAccessTest.daml
dpm test --files AryaFi/Test/Scenarios/DvpSettlementTest.daml
dpm test --files AryaFi/Test/Unit/ComplianceGateTest.daml
cd ../..

# 5. Confirm the authorization matrix matches the source
python3 scripts/gen_authorization_matrix.py
git diff --exit-code docs/security/AUTHORIZATION_MATRIX.md
```
