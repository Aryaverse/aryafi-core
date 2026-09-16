# Financial Contracts Specification

AryaFi Core institutional financial contract workflows implemented in `daml/src/AryaFi/Contracts/`.

---

## Architecture & Contract Matrix

| Contract Template | Module | Primary Signatories | Observers | Lifecycle States | Key Choices |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`InstitutionalLoan`** | `Loan.daml` | Lender, Borrower | AgentBank, Regulators | Active, Defaulted, Closed | `DrawdownPrincipal`, `AccrueInterest`, `PayAccruedInterest`, `PayDownPrincipal`, `LinkCollateralPledge`, `DeclareLoanDefault`, `CureLoanDefault`, `CloseLoan` |
| **`RepoAgreement`** | `Repo.daml` | Seller, Buyer, Custodian | TripartyAgent, Regulators | RepoPendingOpening, RepoActive, RepoPendingClosing, RepoSettled, RepoDefaulted, RepoTerminated | `ExecuteOpeningLeg`, `SubstituteCollateral`, `InitiateClosingLeg`, `ExecuteClosingLeg`, `RollRepo`, `DeclareRepoDefault` |
| **`ReverseRepoPosition`**| `ReverseRepo.daml`| Buyer | Seller, Custodian | Active, Closed | `UpdateMarkToMarket`, `CalculateMarginDeficit`, `CloseReverseRepo` |
| **`MarginCall`** | `Margin.daml` | Caller, Payer | Custodian, Regulators | MarginCallIssued, MarginCallSatisfied, MarginCallDisputed, MarginCallDefaulted, MarginCallCancelled | `SatisfyWithCash`, `SatisfyWithPledge`, `DisputeMarginCall`, `ResolveMarginDispute`, `DeclareMarginDefault`, `CancelMarginCall` |
| **`SecuritiesLendingAgreement`** | `SecuritiesLending.daml` | Lender, Borrower, Custodian | Regulators, Agents | LendingActive, LendingRecallIssued, LendingClosed, LendingDefaulted | `AccrueLendingFee`, `PayLendingFee`, `RecallSecurities`, `ReturnSecurities`, `RevalueCollateral`, `DeclareSecLendingDefault` |
| **`FundSubscription`** | `Subscription.daml` | FundManager, Investor | Custodian, Regulators | SubscriptionRequested, SubscriptionApproved, SubscriptionPartiallyFunded, SubscriptionFullyFunded, SubscriptionCancelled, SubscriptionRejected, SubscriptionClosed | `ApproveSubscription`, `RejectSubscription`, `IssueCapitalCall`, `ConfirmCapitalFunding`, `CancelSubscription`, `CloseSubscription` |
| **`AssetRedemption`** | `Redemption.daml` | FundManager, Investor | Custodian, Regulators | RedemptionRequested, RedemptionApproved, RedemptionGated, RedemptionSettled, RedemptionRejected, RedemptionCancelled | `ApproveRedemption`, `ApplyLiquidityGate`, `ReleaseLiquidityGate`, `ExecuteRedemptionSettlement`, `CancelRedemption`, `RejectRedemption` |
| **`AssetPledge`** | `Pledge.daml` | Pledgor, Pledgee, Custodian | TripartyAgent, Regulators | Active, Defaulted, Closed | `ReleasePledge`, `EnforcePledge`, `SubstitutePledge`, `UpdatePerfectionRef` |
| **`ConditionalEscrow`** | `Escrow.daml` | Depositor, Custodian | Beneficiary | EscrowPending, EscrowFulfilled, EscrowReleased, EscrowRefunded, EscrowDisputed, EscrowExpired | `FulfillCondition`, `ReleaseEscrow`, `RefundEscrow`, `DisputeEscrow`, `ResolveDispute` |
| **`AssetTransferRequest`**| `Transfer.daml`| Sender, Custodian | Receiver, ComplianceOfficer| TransferPendingCompliance, TransferApproved, TransferCompleted, TransferRejected, TransferCancelled | `ApproveTransfer`, `RejectTransfer`, `CompleteTransfer`, `CancelTransfer` |

---

## 1. Institutional Loan (`Loan.daml`)

### Overview
`InstitutionalLoan` models bilateral and syndicated credit facilities:
* **Committed Facility Limits:** Invariant checks guarantee that cumulative drawn principal cannot exceed `facilityLimit`.
* **Day-Count Interest Accrual:** Integrates with `AryaFi.Common.Types.DayCountConvention` (Act360, Act365Fixed, Thirty360).
* **Payment Waterfall:** Discrete servicing of accrued interest (`PayAccruedInterest`) and principal paydown (`PayDownPrincipal`), with automatic transition to `Closed` upon full discharge.
* **Collateral Perfection Linkage:** Explicitly binds an active `AssetPledge` contract identifier (`collateralPledgeRef`).
* **Default & Cure Mechanics:** Transparent default declaration (`DeclareLoanDefault`) and cure acknowledgement (`CureLoanDefault`).

---

## 2. Repurchase Agreement (`Repo.daml` & `ReverseRepo.daml`)

### Overview
Models institutional fixed-income repo and reverse repo transactions across bilateral and tri-party settlement environments:
* **Two-Leg DvP Settlement:**
  1. *Opening Purchase Leg (`ExecuteOpeningLeg`):* Custodian verifies initial cash funding against collateral encumbrance.
  2. *Closing Repurchase Leg (`ExecuteClosingLeg`):* Custodian executes final repurchase payment and releases collateral.
* **Collateral Substitution (`SubstituteCollateral`):* Counterparties agree to substitute collateral during trade life without terminating the financing agreement.
* **Term Extension (`RollRepo`):* Rollover mechanics with updated repo rates and repurchase prices.
* **Buyer Book Composition (`ReverseRepoPosition`):* Allows cash lenders to track mark-to-market collateral valuation and query net margin deficits (`CalculateMarginDeficit`).

---

## 3. Margin Management (`Margin.daml`)

### Overview
Provides regulatory-compliant margin call workflows for repo, securities lending, and derivatives exposures:
* **Margin Types:** Differentiates Initial Margin (`InitialMargin`) and Variation Margin (`VariationMargin`).
* **Dual Settlement Rails:** Supports satisfaction via cash transfer (`SatisfyWithCash`) or collateral hypothecation (`SatisfyWithPledge`).
* **Dispute Arbitration Window:** Formal dispute tracking (`DisputeMarginCall`) and agreed dispute resolution (`ResolveMarginDispute`).
* **Enforcement:** Explicit default declaration (`DeclareMarginDefault`) upon breach of margin deadline.

---

## 4. Securities Lending (`SecuritiesLending.daml`)

### Overview
Institutional stock borrowing and lending contracts:
* **Continuous Borrow Fee Accrual:** Lender accrues borrow fees (`AccrueLendingFee`) based on contractual borrow fee rate.
* **Cash Rebate Rate:** Tracks contractual rebate rate owed back to borrower on cash collateral.
* **Recall Choices:** Full or partial recall options (`RecallSecurities`) with notice period deadlines.
* **Return & Pro-Rata Release:** Borrower returns securities (`ReturnSecurities`), proportionally unlocking posted collateral.

---

## 5. Fund Subscription & Capital Calls (`Subscription.daml`)

### Overview
Private credit, tokenized fund, and private equity capital commitment lifecycle:
* **Commitment Tracking:** Tracks committed, called, and funded amounts with LP unit accounting.
* **Incremental Capital Calls:** General Partner issues capital calls (`IssueCapitalCall`) bounded by uncalled commitments.
* **Custodian Funding Settlement:** Custodian verifies bank transfer and issues LP shares (`ConfirmCapitalFunding`).
* **Automated State Machine:** Auto-transitions between `SubscriptionApproved`, `SubscriptionPartiallyFunded`, and `SubscriptionFullyFunded`.

---

## 6. Asset & Fund Redemption (`Redemption.daml`)

### Overview
Liquidity management for open-ended funds, private debt, and tokenized investment vehicles:
* **NAV Pricing:** Fund manager strikes official valuation (`ApproveRedemption`) and computes net payout after exit fees.
* **Liquidity Gates:** Manager can apply gating rules (`ApplyLiquidityGate`) when aggregate redemption requests exceed fund capacity thresholds.
* **Custodian Cash Settlement:** Paying agent executes cash payout (`ExecuteRedemptionSettlement`) linking ledger records with banking rails (Fedwire / SEPA).

---

## 7. Security & Privacy Guarantees on Canton

1. **Sub-Transaction Privacy:** Only bilateral/tri-party counterparties, custodians, and designated regulators observe position balances, margin calls, or default events. Unrelated dealers have zero ledger visibility.
2. **Atomic State Transition:** Settlement legs and collateral substitutions transition atomically with no leg-risk or unhedged exposure.
3. **Audit Readiness:** All contracts maintain `correlationId` fields and emit audit events for CAT, EMIR, and MiFIR reporting.
