# Financial Contracts Specification

AryaFi Core institutional financial contract workflows implemented in `daml/src/AryaFi/Contracts/`.

---

## Architecture & Contract Matrix

| Contract Template | Module | Primary Signatories | Observers | Lifecycle States | Key Choices |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`InstitutionalLoan`** | `Loan.daml` | Lender, Borrower | AgentBank, Regulators | Active, Defaulted, Closed | `DrawdownPrincipal`, `DrawdownByTransfer`, `AccrueInterest`, `PayAccruedInterest`, `PayDownPrincipal`, `ReceiveRepayment`, `LinkCollateralPledge`, `DeclareLoanDefault`, `CureLoanDefault`, `CloseLoan` |
| **`RepoAgreement`** | `Repo.daml` | Seller, Buyer, Custodian | TripartyAgent, Regulators | RepoPendingOpening, RepoActive, RepoPendingClosing, RepoSettled, RepoDefaulted, RepoTerminated | `RequestOpeningLeg`, `SettleOpeningLeg`, `ExecuteOpeningLeg`, `SubstituteCollateral`, `InitiateClosingLeg`, `RequestClosingLeg`, `SettleClosingLeg`, `ExecuteClosingLeg`, `RollRepo`, `DeclareRepoDefault` |
| **`ReverseRepoPosition`**| `ReverseRepo.daml`| Buyer | Seller, Custodian | Active, Closed | `UpdateMarkToMarket`, `CalculateMarginDeficit`, `CloseReverseRepo` |
| **`MarginCall`** | `Margin.daml` | Caller, Payer | Custodian, Regulators | MarginCallIssued, MarginCallPendingConfirmation, MarginCallSatisfied, MarginCallDisputed, MarginCallDefaulted, MarginCallCancelled | `SatisfyWithCash`, `SatisfyWithPledge`, `SatisfyWithTransfer`, `AcceptMarginTransfer`, `ConfirmMarginReceipt`, `RejectMarginFulfilment`, `DisputeMarginCall`, `ResolveMarginDispute`, `DeclareMarginDefault`, `CancelMarginCall` |
| **`SecuritiesLendingAgreement`** | `SecuritiesLending.daml` | Lender, Borrower, Custodian | Regulators, Agents | LendingPendingDelivery, LendingActive, LendingRecallIssued, LendingClosed, LendingDefaulted | `RequestDelivery`, `SettleDelivery`, `AccrueLendingFee`, `AccrueFeesToDate`, `PayLendingFee`, `ReceiveLendingFee`, `ReceiveRebate`, `RecallSecurities`, `ReturnSecurities`, `RequestReturn`, `SettleReturn`, `RevalueCollateral`, `DeclareSecLendingDefault` |
| **`FundSubscription`** | `Subscription.daml` | FundManager, Investor | Custodian, Regulators | SubscriptionRequested, SubscriptionApproved, SubscriptionPartiallyFunded, SubscriptionFullyFunded, SubscriptionCancelled, SubscriptionRejected, SubscriptionClosed | `ApproveSubscription`, `RejectSubscription`, `IssueCapitalCall`, `SettleCapitalCall`, `ConfirmCapitalFunding`, `CancelSubscription`, `CloseSubscription` |
| **`AssetRedemption`** | `Redemption.daml` | FundManager, Investor | Custodian, Regulators | RedemptionRequested, RedemptionApproved, RedemptionGated, RedemptionSettled, RedemptionRejected, RedemptionCancelled | `ApproveRedemption`, `ApplyLiquidityGate`, `ReleaseLiquidityGate`, `SettleRedemption`, `ExecuteRedemptionSettlement`, `CancelRedemption`, `RejectRedemption` |
| **`AssetPledge`** | `Pledge.daml` | Pledgor, Pledgee, Custodian | TripartyAgent, Regulators | Active, Defaulted, Closed | `EncumberHolding`, `ReleasePledge`, `EnforcePledge`, `SubstitutePledge`, `UpdatePerfectionRef` |
| **`ConditionalEscrow`** | `Escrow.daml` | EscrowAgent, Depositor | Beneficiary | EscrowAwaitingDeposit, EscrowHeld, EscrowReleased, EscrowRefunded, EscrowExpired, EscrowDisputed | `DepositIntoEscrow`, `ReleaseEscrow`, `RefundEscrow`, `ExpireEscrow`, `DisputeEscrow`, `ResolveDispute` |
| **`AssetTransferRequest`**| `Transfer.daml`| Sender, Custodian | Receiver, ComplianceOfficer| TransferPendingCompliance, TransferApproved, TransferCompleted, TransferRejected, TransferCancelled | `ApproveTransfer`, `RejectTransfer`, `CompleteTransfer`, `CompleteScreenedTransfer`, `CancelTransfer` |

---

## 1. Institutional Loan (`Loan.daml`)

### Overview
`InstitutionalLoan` models bilateral and syndicated credit facilities:
* **Committed Facility Limits:** The `ensure` clause and `DrawdownPrincipal` keep drawn principal within `facilityLimit`; drawdowns are rejected on or after maturity.
* **Computed Interest:** `AccrueInterest` computes interest from the drawn principal, rate, day-count convention (Act360, Act365Fixed, ActActISDA, Thirty360), and ledger time since `interestAccruedThrough`. Interest is crystallized before every principal change. Neither party supplies the amount.
* **Lender-Confirmed Payments:** The lender records receipt of interest (`PayAccruedInterest`) and principal (`PayDownPrincipal`), so the borrower cannot reduce its own debt. The loan auto-closes when principal and interest reach zero.
* **Cash on the Ledger:** The lender sends a drawdown as a token-standard transfer, which the borrower accepts as it adds exactly the amount received to the principal (`DrawdownByTransfer`); the borrower sends a repayment, which the lender accepts as it applies it to accrued interest, then principal (`ReceiveRepayment`).
* **Collateral Linkage:** Records the `AssetPledge` reference (`collateralPledgeRef`, a text reference, not a contract ID).
* **Default & Cure Mechanics:** Transparent default declaration (`DeclareLoanDefault`) and cure acknowledgement (`CureLoanDefault`).

---

## 2. Repurchase Agreement (`Repo.daml` & `ReverseRepo.daml`)

### Overview
Models institutional fixed-income repo and reverse repo transactions across bilateral and tri-party settlement environments:
* **Two Settlement Legs on the Ledger:** The custodian, as settlement agent, asks for each leg as a token-standard DvP (`RequestOpeningLeg`, `RequestClosingLeg`): the collateral from the seller's collateral account against the purchase price, then back against the repurchase price. Seller and buyer allocate from their own nodes, and the custodian settles the DvP through the repo (`SettleOpeningLeg`, `SettleClosingLeg`), which checks that it is the repo's and updates the repo in the same transaction. Closing needs the seller's initiation or the end date.
* **Legs Settled Elsewhere:** `ExecuteOpeningLeg` and `ExecuteClosingLeg` record legs settled through `DvpInstruction` or off-ledger, with their settlement references.
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
* **Delivery and Returns on the Ledger:** An agreement created as `LendingPendingDelivery` is delivered as a token-standard DvP of the securities to the borrower against its cash collateral (`RequestDelivery`, `SettleDelivery`). Each return is a DvP of securities back against the release of collateral, within the pro-rata cap (`RequestReturn`, `SettleReturn`).
* **Fees and Rebates Computed on the Ledger:** With a fee accrual (`feeAccrual`), the borrow fee accrues on the value on loan (quantity × the agreed `loanPrice`) at the fee rate, and the rebate on cash collateral at the rebate rate, by the agreement's day count, each accrual rounded to the cent. Any party brings them up to date (`AccrueFeesToDate`); returns, revaluations (which can change the loan price), and a default accrue them first. The borrower pays fees and the lender pays rebates with token-standard transfers that the receiver accepts as the agreement records them (`ReceiveLendingFee`, `ReceiveRebate`), each up to what is owed.
* **Agreed Borrow Fees:** Without a fee accrual, each period's fee is recorded by lender and borrower together (`AccrueLendingFee`); the lender confirms payment (`PayLendingFee`), and the rebate rate is stored for reference.
* **Recall Choices:** Full or partial recall (`RecallSecurities`) with a future deadline. A partial return reduces the outstanding recall quantity; the recall stays in force until satisfied.
* **Return & Pro-Rata Release:** Borrower returns securities (`ReturnSecurities`); collateral release is capped at the pro-rata share of the securities returned. Fully returned agreements show a borrowed quantity of exactly zero and close once fees are paid.

---

## 5. Fund Subscription & Capital Calls (`Subscription.daml`)

### Overview
Private credit, tokenized fund, and private equity capital commitment lifecycle:
* **Commitment Tracking:** Tracks committed, called, and funded amounts with LP unit accounting.
* **Incremental Capital Calls:** General Partner issues capital calls (`IssueCapitalCall`) bounded by uncalled commitments.
* **Units Against Cash on the Ledger:** With the ISIN of the fund's units (`unitIsin`), the investor pays a capital call with a token-standard transfer to the fund manager, and the custodian settles it (`SettleCapitalCall`): the fund manager receives the cash and the investor receives the units it buys at the unit price, security positions of type `FundUnit` kept by the custodian, in one transaction.
* **Custodian Funding Settlement:** For a payment made elsewhere, the custodian verifies the bank transfer and records the units allocated (`ConfirmCapitalFunding`).
* **Automated State Machine:** Auto-transitions between `SubscriptionApproved`, `SubscriptionPartiallyFunded`, and `SubscriptionFullyFunded`.

---

## 6. Asset & Fund Redemption (`Redemption.daml`)

### Overview
Liquidity management for open-ended funds, private debt, and tokenized investment vehicles:
* **NAV Pricing:** Fund manager strikes official valuation (`ApproveRedemption`) and computes net payout after exit fees.
* **Liquidity Gates:** Manager can apply gating rules (`ApplyLiquidityGate`) when aggregate redemption requests exceed fund capacity thresholds.
* **Units Burnt Against Cash on the Ledger:** With the ISIN of the fund's units (`unitIsin`), the fund manager pays the net payout with a token-standard transfer to the investor, and the custodian settles it (`SettleRedemption`): it checks the payout is the net payout, the investor receives the cash, and the redeemed units are burnt from the investor's unit holdings, with any rest returned, in one transaction.
* **Custodian Cash Settlement:** For a payout made elsewhere, the paying agent records it (`ExecuteRedemptionSettlement`), linking ledger records with banking rails (Fedwire / SEPA).

---

## 7. Conditional Escrow (`Escrow.daml`)

### Overview
An escrow agent holds an amount for a beneficiary until a release condition is met:
* **The Deposit on the Ledger:** An escrow created as `EscrowAwaitingDeposit` is funded by the depositor (`DepositIntoEscrow`): its cash position is locked to the escrow agent through the bank's transfer factory (`LockPosition`), and the escrow holds the locked position. Neither the depositor nor the beneficiary can move it while it is held.
* **Release and Refund:** The agent and the beneficiary release the escrow together (`ReleaseEscrow`), which delivers the deposit to the beneficiary's account (`beneficiaryAccountId`); the agent and the depositor refund it (`RefundEscrow`), which unlocks it for the depositor. An escrow expires after its expiry time (`ExpireEscrow`) and can then be refunded.
* **Disputes:** The agent freezes an escrow (`DisputeEscrow`) and resolves the dispute (`ResolveDispute`): a release, a refund, or a dismissal back to Held. A deposit is refunded by the agent alone, but released only with the beneficiary, so the agent dismisses the dispute and releases it with `ReleaseEscrow`.

---

## 8. Security & Privacy Guarantees on Canton

1. **Sub-Transaction Privacy:** Only bilateral/tri-party counterparties, custodians, and designated regulators observe position balances, margin calls, or default events. Unrelated dealers have zero ledger visibility.
2. **Atomic State Transition:** Each choice is one Daml transaction. A choice that moves assets, such as a repo leg, a capital call's settlement, or an escrow's release, moves them in the same transaction as it updates the contract; choices that record movements settled elsewhere record lifecycle state only.
3. **Audit Readiness:** Contracts carry `correlationId` fields for cross-system tracing. Report records (`RegulatoryReportRecord`, `AuditLog`) are created by the reporting party; contracts do not emit them automatically.
