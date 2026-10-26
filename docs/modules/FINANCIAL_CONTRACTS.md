# Financial Contracts Specification

AryaFi Core institutional financial contract workflows implemented in `daml/src/AryaFi/Contracts/`.

---

## Architecture & Contract Matrix

| Contract Template | Module | Primary Signatories | Observers | Lifecycle States | Key Choices |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`InstitutionalLoan`** | `Loan.daml` | Lender, Borrower | AgentBank, Regulators | Active, Defaulted, Closed | `DrawdownPrincipal`, `AccrueInterest`, `PayAccruedInterest`, `PayDownPrincipal`, `LinkCollateralPledge`, `DeclareLoanDefault`, `CureLoanDefault`, `CloseLoan` |
| **`RepoAgreement`** | `Repo.daml` | Seller, Buyer, Custodian | TripartyAgent, Regulators | RepoPendingOpening, RepoActive, RepoPendingClosing, RepoSettled, RepoDefaulted, RepoTerminated | `ExecuteOpeningLeg`, `SubstituteCollateral`, `InitiateClosingLeg`, `ExecuteClosingLeg`, `RollRepo`, `DeclareRepoDefault` |
| **`ReverseRepoPosition`**| `ReverseRepo.daml`| Buyer | Seller, Custodian | Active, Closed | `UpdateMarkToMarket`, `CalculateMarginDeficit`, `CloseReverseRepo` |
| **`MarginCall`** | `Margin.daml` | Caller, Payer | Custodian, Regulators | MarginCallIssued, MarginCallPendingConfirmation, MarginCallSatisfied, MarginCallDisputed, MarginCallDefaulted, MarginCallCancelled | `SatisfyWithCash`, `SatisfyWithPledge`, `SatisfyWithTransfer`, `AcceptMarginTransfer`, `ConfirmMarginReceipt`, `RejectMarginFulfilment`, `DisputeMarginCall`, `ResolveMarginDispute`, `DeclareMarginDefault`, `CancelMarginCall` |
| **`SecuritiesLendingAgreement`** | `SecuritiesLending.daml` | Lender, Borrower, Custodian | Regulators, Agents | LendingActive, LendingRecallIssued, LendingClosed, LendingDefaulted | `AccrueLendingFee`, `PayLendingFee`, `RecallSecurities`, `ReturnSecurities`, `RevalueCollateral`, `DeclareSecLendingDefault` |
| **`FundSubscription`** | `Subscription.daml` | FundManager, Investor | Custodian, Regulators | SubscriptionRequested, SubscriptionApproved, SubscriptionPartiallyFunded, SubscriptionFullyFunded, SubscriptionCancelled, SubscriptionRejected, SubscriptionClosed | `ApproveSubscription`, `RejectSubscription`, `IssueCapitalCall`, `ConfirmCapitalFunding`, `CancelSubscription`, `CloseSubscription` |
| **`AssetRedemption`** | `Redemption.daml` | FundManager, Investor | Custodian, Regulators | RedemptionRequested, RedemptionApproved, RedemptionGated, RedemptionSettled, RedemptionRejected, RedemptionCancelled | `ApproveRedemption`, `ApplyLiquidityGate`, `ReleaseLiquidityGate`, `ExecuteRedemptionSettlement`, `CancelRedemption`, `RejectRedemption` |
| **`AssetPledge`** | `Pledge.daml` | Pledgor, Pledgee, Custodian | TripartyAgent, Regulators | Active, Defaulted, Closed | `EncumberHolding`, `ReleasePledge`, `EnforcePledge`, `SubstitutePledge`, `UpdatePerfectionRef` |
| **`ConditionalEscrow`** | `Escrow.daml` | EscrowAgent, Depositor | Beneficiary | EscrowHeld, EscrowReleased, EscrowRefunded, EscrowExpired, EscrowDisputed | `ReleaseEscrow`, `RefundEscrow`, `ExpireEscrow`, `DisputeEscrow`, `ResolveDispute` |
| **`AssetTransferRequest`**| `Transfer.daml`| Sender, Custodian | Receiver, ComplianceOfficer| TransferPendingCompliance, TransferApproved, TransferCompleted, TransferRejected, TransferCancelled | `ApproveTransfer`, `RejectTransfer`, `CompleteTransfer`, `CompleteScreenedTransfer`, `CancelTransfer` |

---

## 1. Institutional Loan (`Loan.daml`)

### Overview
`InstitutionalLoan` models bilateral and syndicated credit facilities:
* **Committed Facility Limits:** The `ensure` clause and `DrawdownPrincipal` keep drawn principal within `facilityLimit`; drawdowns are rejected on or after maturity.
* **Computed Interest:** `AccrueInterest` computes interest from the drawn principal, rate, day-count convention (Act360, Act365Fixed, ActActISDA, Thirty360), and ledger time since `interestAccruedThrough`. Interest is crystallized before every principal change. Neither party supplies the amount.
* **Lender-Confirmed Payments:** The lender records receipt of interest (`PayAccruedInterest`) and principal (`PayDownPrincipal`), so the borrower cannot reduce its own debt. The loan auto-closes when principal and interest reach zero.
* **Collateral Linkage:** Records the `AssetPledge` reference (`collateralPledgeRef`, a text reference, not a contract ID).
* **Default & Cure Mechanics:** Transparent default declaration (`DeclareLoanDefault`) and cure acknowledgement (`CureLoanDefault`).

---

## 2. Repurchase Agreement (`Repo.daml` & `ReverseRepo.daml`)

### Overview
Models institutional fixed-income repo and reverse repo transactions across bilateral and tri-party settlement environments:
* **Two Settlement Legs (recorded):**
  1. *Opening Purchase Leg (`ExecuteOpeningLeg`):* The custodian records that the opening DvP settled, with its settlement reference.
  2. *Closing Repurchase Leg (`ExecuteClosingLeg`):* The custodian records the repurchase settlement, after the seller initiates closing or once the end date is reached.
  The legs themselves settle through `DvpInstruction` or off-ledger; the repo does not move assets.
* **Collateral Substitution (`SubstituteCollateral`):* Counterparties agree to substitute collateral during trade life without terminating the financing agreement.
* **Term Extension (`RollRepo`):* Both counterparties roll to a later end date with an updated rate and repurchase price.
* **Buyer Book Composition (`ReverseRepoPosition`):* Allows cash lenders to track mark-to-market collateral valuation and query net margin deficits (`CalculateMarginDeficit`).

---

## 3. Margin Management (`Margin.daml`)

### Overview
Provides regulatory-compliant margin call workflows for repo, securities lending, and derivatives exposures:
* **Margin Types:** Differentiates Initial Margin (`InitialMargin`) and Variation Margin (`VariationMargin`).
* **Two-Step Fulfilment:** The payer submits cash (`SatisfyWithCash`) or a pledge (`SatisfyWithPledge`); the call is satisfied only when the caller confirms receipt (`ConfirmMarginReceipt`) or returns to Issued if the caller rejects it (`RejectMarginFulfilment`).
* **Cash on the Ledger:** The payer can instead submit a pending token-standard transfer of the cash to the caller (`SatisfyWithTransfer`), which must come from the payer, go to the caller, be in the margin currency, and cover the required amount. The caller accepts it and satisfies the call in one transaction (`AcceptMarginTransfer`); if the bank refuses the transfer then, the cash returns to the payer and the call to Issued.
* **Dispute Arbitration Window:** Formal dispute tracking (`DisputeMarginCall`) and agreed dispute resolution (`ResolveMarginDispute`).
* **Enforcement:** Default can only be declared (`DeclareMarginDefault`) after the deadline has passed.

---

## 4. Securities Lending (`SecuritiesLending.daml`)

### Overview
Institutional stock borrowing and lending contracts:
* **Agreed Borrow Fees:** Each period's fee is recorded by lender and borrower together (`AccrueLendingFee`); the lender confirms payment (`PayLendingFee`).
* **Cash Rebate Rate:** Stored for reference; not yet applied to fee calculations.
* **Recall Choices:** Full or partial recall (`RecallSecurities`) with a future deadline. A partial return reduces the outstanding recall quantity; the recall stays in force until satisfied.
* **Return & Pro-Rata Release:** Borrower returns securities (`ReturnSecurities`); collateral release is capped at the pro-rata share of the securities returned. Fully returned agreements show a borrowed quantity of exactly zero and close once fees are paid.

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
2. **Atomic State Transition:** Each choice is one Daml transaction. Only `DvpInstruction` moves assets atomically across two legs; the contracts in this document record lifecycle state.
3. **Audit Readiness:** Contracts carry `correlationId` fields for cross-system tracing. Report records (`RegulatoryReportRecord`, `AuditLog`) are created by the reporting party; contracts do not emit them automatically.
