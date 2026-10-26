# AryaFi Core: Contract Authorization Matrix & Trust Boundaries

## 1. Overview & Security Model

In Daml and Canton, contract security is governed by three primitives:
1. **Signatories**: Parties whose authorization is required to create or archive a contract. Signatories are bound by the contract's terms.
2. **Controllers**: Parties who may exercise a choice. A choice body runs with the authority of the contract's signatories plus the choice's controllers.
3. **Observers**: Parties with read-only visibility of the contract and the transactions that use it.

The tables below list every template in the production modules (`daml/src/AryaFi/{Common,Finance,Contracts,Compliance}`) with its signatories, observers, choices, and controllers. They are **generated from the Daml source** by `scripts/gen_authorization_matrix.py`, so they describe what the code enforces rather than intended behaviour.

Choices of the Canton Network Token Standard interfaces (`TransferFactory_*`, `TransferInstruction_*`, `AllocationFactory_*`, `SettlementFactory_*`, `Allocation_*`, `AllocationRequest_*`) are controlled by their `actors` argument. For these, the table names the party the implementation requires among the actors.

Choices of AryaFi's compliance interface (`CompliancePolicy_*`, in the `aryafi-compliance-api` package) are controlled by their `requester` argument: any party that sees the policy contract, as an observer or because its owner disclosed it, can exercise them as itself. They only read the policy.

---

## 2. Authorization Matrix (generated from source)

### Common (Audit Events)

| Template | Signatories | Observers | Choice | Controller(s) | Effect |
|:---|:---|:---|:---|:---|:---|
| **`AuditLog`** (Events.daml) | `operator` | `parties` | — | — | No choices: append-only record |

### Finance Primitives

| Template | Signatories | Observers | Choice | Controller(s) | Effect |
|:---|:---|:---|:---|:---|:---|
| **`Account`** (Account.daml) | `custodian, owner` | `observers` | `FreezeAccount` | `custodian` | Freeze this account, preventing any asset movements in or out |
|  |  |  | `UnfreezeAccount` | `custodian` | Unfreeze a previously frozen account |
|  |  |  | `UpdateDescription` | `owner` | Update the account description |
|  |  |  | `AddObserver` | `owner` | Add a new observer to this account |
|  |  |  | `RemoveObserver` | `owner` | Remove an existing observer from this account |
|  |  |  | `IsAvailableForSettlement` *(read-only)* | `custodian` | Nonconsuming check: verify if this account is available for asset movements |
| **`AssetHolding`** (Asset.daml) | `issuer, custodian, owner` | `observers, lockHolder (while locked)` | `LockAsset` | `owner, custodian` | Lock this asset, preventing transfer or further encumbrance |
|  |  |  | `UnlockAsset` | `lockHolder` | Unlock a previously locked asset, making it freely transferable again |
|  |  |  | `TransferAsset` | `owner, custodian, newOwner` | Transfer ownership of this asset to a new owner and account |
|  |  |  | `UpdateExternalRef` | `custodian` | Update the external custody or CSD system reference |
|  |  |  | `AddObserver` | `owner` | Add an observer to this holding (e.g. collateral receiver, tri-party agent) |
|  |  |  | `IsTransferable` *(read-only)* | `custodian` | Nonconsuming check: verify if this asset can be freely transferred |
| **`CashPosition`** (Cash.daml) | `bank, owner` | `observers, lockHolder (while locked)` | `SplitCash` | `owner` | Split this position into two positions, preserving total amount |
|  |  |  | `MergeCash` | `owner` | Merge another cash position into this one, producing a single combined position |
|  |  |  | `TransferCash` | `owner, bank, newOwner` | Transfer this cash position to a new owner and account at the same bank |
|  |  |  | `LockCash` | `owner, bank` | Lock this cash position to a lock holder, preventing split, merge, or transfer |
|  |  |  | `UnlockCash` | `lockHolder` | Release the lock |
|  |  |  | `SettleLockedCash` | `lockHolder, newOwner` | Deliver a locked position to a counterparty as part of a settlement (e.g. the cash leg of a DvP) |
|  |  |  | `AddCashObserver` | `owner` | Add an observer to this cash position |
|  |  |  | `RemoveCashObserver` | `owner` | Remove an observer from this cash position |
|  |  |  | `IsAvailable` *(read-only)* | `bank` | Nonconsuming check: verify if this position is available for movement |
| **`CollateralPosition`** (Collateral.daml) | `collateralProvider, collateralReceiver, custodian` | `observers` | `GetCollateralValue` *(read-only)* | `custodian` | Compute the post-haircut collateral value |
|  |  |  | `RevalueCollateral` | `custodian` | Revalue the collateral position to reflect current market prices |
|  |  |  | `SubstituteCollateral` | `collateralProvider, collateralReceiver` | Substitute the collateral with a different eligible asset |
|  |  |  | `LockCollateralHolding` | `collateralProvider` | Provider locks the collateral asset to the receiver, which activates the collateral: `holdingCid` must be its unlocked security position of the ISIN in the collateral account at the custodian, of at least the quantity |
|  |  |  | `ActivateCollateral` | `custodian` | Activate collateral after the underlying asset has been confirmed locked |
|  |  |  | `ReleaseCollateral` | `collateralProvider, collateralReceiver` | Release this collateral position |
|  |  |  | `LiquidateCollateral` | `collateralReceiver` | Liquidate collateral following an event of default |
|  |  |  | `RaiseValuationDispute` | `collateralProvider` | Raise a valuation dispute on this collateral position |
|  |  |  | `ResolveDispute` | `collateralProvider, collateralReceiver` | Resolve a valuation dispute and return collateral to Active with agreed market value |
|  |  |  | `AddCollateralObserver` | `collateralProvider, collateralReceiver` | Add an observer (e.g. tri-party agent, regulator, trade repository) |
| **`FinancialObligation`** (Obligation.daml) | `obligor, obligee` | `agentObserver (if set)` | `DischargeObligation` | `obligee` | Record full discharge of this obligation |
|  |  |  | `PartialDischarge` | `obligee` | Record a partial payment against this obligation |
|  |  |  | `DeclareObligationDefault` | `obligee` | Declare this obligation in default |
|  |  |  | `CancelObligation` | `obligor, obligee` | Cancel this obligation by mutual agreement before any payment is made |
|  |  |  | `AmendObligation` | `obligor, obligee` | Amend the obligation amount or due date by mutual agreement |
|  |  |  | `IsOverdue` *(read-only)* | `obligee` | Nonconsuming check: is this obligation currently overdue? Returns True if current time is past due date and it is still outstanding |
|  |  |  | `IsOutstanding` *(read-only)* | `obligee` | Nonconsuming check: is this obligation still outstanding? |
| **`InstitutionalParty`** (Party.daml) | `operator, party` | `observers` | `UpdateProfile` | `party` | Update the display name and jurisdiction of this party record |
|  |  |  | `AddRole` | `operator` | Add a role to this party |
|  |  |  | `RemoveRole` | `operator` | Remove a role from this party |
|  |  |  | `SetPartyStatus` | `operator` | Activate or deactivate this party |
|  |  |  | `AddObserver` | `party` | Add an observer (e.g. a counterparty doing due diligence) |
|  |  |  | `RemoveObserver` | `party` | Remove an observer from this party record |
|  |  |  | `HasRole` *(read-only)* | `operator` | Nonconsuming check: verify if this party has a specific role |
| **`PaymentInstruction`** (Payment.daml) | `payer, payee, settlementAgent` | `observers` | `ConfirmPaymentSettlement` | `settlementAgent` | Confirm that payment has been successfully settled |
|  |  |  | `ExecutePayment` | `settlementAgent` | Execute the payment on the ledger: a token-standard transfer of the amount from the payer's account to the payee's at `bank`, through its transfer factory, funded from the payer's holdings `inputHoldingCids` |
|  |  |  | `RejectPaymentSettlement` | `settlementAgent` | Reject the payment instruction, providing a reason |
|  |  |  | `CancelPayment` | `payer` | Cancel the payment instruction before it is executed |
|  |  |  | `AttachNetworkRef` | `settlementAgent` | Attach a payment network reference after submission to a payment network |
|  |  |  | `AddPaymentObserver` | `payer` | Add an observer (e.g. compliance officer, regulator, auditor) |
|  |  |  | `IsCompleted` *(read-only)* | `settlementAgent` | Nonconsuming check: has this payment reached a final status (settled, failed, or cancelled)? |
| **`SecurityPosition`** (Security.daml) | `custodian, owner` | `observers, lockHolder (while locked)` | `SplitSecurity` | `owner` | Split this position into two positions, preserving total quantity |
|  |  |  | `TransferSecurity` | `owner, custodian, newOwner` | Transfer ownership of this security to a new owner and account |
|  |  |  | `LockSecurity` | `owner, custodian` | Lock this security, preventing split, transfer, or further encumbrance |
|  |  |  | `UnlockSecurity` | `lockHolder` | Release the lock |
|  |  |  | `SettleLockedSecurity` | `lockHolder, newOwner` | Deliver a locked position to a counterparty as part of a settlement (e.g. the securities leg of a DvP) |
|  |  |  | `UpdateCsdRef` | `custodian` | Update the CSD system reference for this holding |
|  |  |  | `AddSecurityObserver` | `owner` | Add an observer (e.g. settlement agent, tri-party repo agent, regulator) |
|  |  |  | `RemoveSecurityObserver` | `owner` | Remove an observer from this security position |
|  |  |  | `IsTransferable` *(read-only)* | `custodian` | Nonconsuming query: can this position be transferred or pledged? |
|  |  |  | `IsFixedIncome` *(read-only)* | `custodian` | Nonconsuming query: is this a fixed-income instrument? |
| **`DvpInstruction`** (Settlement.daml) | `settlementAgent, seller, buyer` | `observers` | `ExecuteDvpSettlement` | `settlementAgent` | Execute the DvP settlement atomically: deliver the locked security to the buyer and the locked cash to the seller in one transaction |
|  |  |  | `ExecuteScreenedDvpSettlement` | `settlementAgent` | Execute the DvP settlement after evaluating the instruction's compliance requirements in the same transaction |
|  |  |  | `FailDvpSettlement` | `settlementAgent` | Fail the settlement with a specific reason |
|  |  |  | `CancelDvpSettlement` | `seller, buyer` | Cancel the DvP instruction by mutual agreement |
|  |  |  | `RetrySettlement` | `settlementAgent, seller, buyer` | Retry a failed settlement instruction |
|  |  |  | `AddDvpObserver` | `settlementAgent` | Add an observer to this DvP instruction |
|  |  |  | `IsFinalized` *(read-only)* | `settlementAgent` | Nonconsuming query: has this instruction been finalized (settled, failed, or cancelled)? |
| **`PositionAllocationFactory`** (TokenAllocation.daml) | `admin` | `clients` | `AllocationFactory_Allocate` | `actors, including authorizer` | Lock a client's funding for a settlement and record its authorization (see allocate) |
|  |  |  | `AllocationFactory_PublicFetch` *(read-only)* | `actors` | Return the factory's view: its admin |
|  |  |  | `SettlementFactory_SettleBatch` | `actors: exactly settlement.executors` | Settle the allocations for a settlement's legs at this registry (see settleBatch) |
|  |  |  | `SettlementFactory_PublicFetch` *(read-only)* | `actors` | Return the factory's view: its admin |
|  |  |  | `AddAllocationFactoryClient` | `admin` | Let another account owner or settlement agent use this factory |
|  |  |  | `RemoveAllocationFactoryClient` | `admin` | Stop an account owner or settlement agent using this factory |
|  |  |  | `SetAllocationCompliance` | `admin` | Set or clear the compliance requirements allocations must meet |
| **`PositionAllocation`** (TokenAllocation.daml) | `admin, authorizer` | `settlement.executors` | `Allocation_Settle` | `nobody (refused)` | Refused: an allocation settles only with the others of its batch, through SettlementFactory_SettleBatch, which checks every leg's other side |
|  |  |  | `Allocation_Cancel` | `actors, including all of settlement.executors` | Release the funding to the authorizer, when the settlement will not happen |
|  |  |  | `Allocation_Withdraw` | `actors, including authorizer` | Take the allocation back; a committed one only after its settlement deadline |
|  |  |  | `SettleInBatch` | `admin, settlement.executors` | Settle this allocation as part of the registry's SettlementFactory_SettleBatch, which supplies the details of the instruments being settled |
| **`TokenDvpInstruction`** (TokenDvp.daml) | `settlementAgent` | `seller, buyer, observers` | `RequestTokenDvpAllocations` *(nonconsuming)* | `settlementAgent` | Ask the seller and the buyer for their allocations: each gets a token-standard AllocationRequest listing the allocations to make |
|  |  |  | `ExecuteTokenDvp` | `settlementAgent` | Settle both legs in one transaction through each registry's SettlementFactory_SettleBatch, one batch per registry, before the deadline |
|  |  |  | `CancelTokenDvp` | `settlementAgent` | Cancel the DvP before settlement: cancel the given allocations, which returns their funding, and archive the allocation requests still open |
| **`TokenDvpAllocationRequest`** (TokenDvp.daml) | `settlementAgent` | `party` | `AllocationRequest_Accept` | `actors, including party` | Tell the agent that the party has made, or will make, its allocations |
|  |  |  | `AllocationRequest_Reject` | `actors, including party` | Tell the agent that the party will not allocate |
|  |  |  | `AllocationRequest_Withdraw` | `actors, including settlementAgent` | Withdraw the request, as the settlement agent |
| **`PositionTransferFactory`** (TokenTransfer.daml) | `admin` | `clients` | `TransferFactory_Transfer` | `actors, including sender` | Instruct a transfer between two clients' accounts (see instructTransfer) |
|  |  |  | `TransferFactory_PublicFetch` *(read-only)* | `actors` | Return the factory's view: its admin |
|  |  |  | `AddTransferFactoryClient` | `admin` | Let another account owner send and receive through this factory |
|  |  |  | `RemoveTransferFactoryClient` | `admin` | Stop an account owner sending and receiving through this factory |
|  |  |  | `SetTransferCompliance` | `admin` | Set or clear the compliance requirements transfers must meet |
|  |  |  | `LockPosition` *(nonconsuming)* | `owner` | Lock `amount` of one of the owner's positions to `holder`, for the agreement `reference` names, such as an escrow |
| **`PositionTransferInstruction`** (TokenTransfer.daml) | `admin, sender` | `receiver` | `TransferInstruction_Accept` | `actors, including receiver` | Deliver the locked amount to the receiver's account, before executeBefore |
|  |  |  | `TransferInstruction_Reject` | `actors, including receiver` | Refuse the transfer: the amount is unlocked for the sender |
|  |  |  | `TransferInstruction_Withdraw` | `actors, including sender` | Take the transfer back: the amount is unlocked for the sender |

### Financial Contracts

| Template | Signatories | Observers | Choice | Controller(s) | Effect |
|:---|:---|:---|:---|:---|:---|
| **`ConditionalEscrow`** (Escrow.daml) | `escrowAgent, depositor` | `beneficiary, observers` | `DepositIntoEscrow` | `depositor` | Depositor deposits the escrowed amount: `amount` of its cash position `holdingCid`, in `accountId` at the bank whose transfer factory is `factoryCid`, is locked to the escrow agent, and the escrow holds it |
|  |  |  | `ReleaseEscrow` | `escrowAgent, beneficiary` | Release escrowed assets to beneficiary (both agent and beneficiary must agree) |
|  |  |  | `RefundEscrow` | `escrowAgent, depositor` | Refund escrowed assets to depositor (both agent and depositor must agree) |
|  |  |  | `ExpireEscrow` | `escrowAgent` | Expire the escrow after the expiry time has passed |
|  |  |  | `DisputeEscrow` | `escrowAgent` | Raise a dispute on this escrow (freezes it pending agent resolution) |
|  |  |  | `ResolveDispute` | `escrowAgent` | Escrow agent resolves an active dispute, deciding whether to release or refund, or dismissing it (EscrowHeld) |
|  |  |  | `AddEscrowObserver` | `escrowAgent` | Add an observer to this escrow (e.g. regulator, auditor) |
|  |  |  | `IsEscrowTerminal` *(read-only)* | `escrowAgent` | Nonconsuming query: has this escrow reached a terminal state? |
| **`InstitutionalLoan`** (Loan.daml) | `lender, borrower` | `observers, agentBank (if set)` | `DrawdownPrincipal` | `borrower` | Borrower executes a drawdown against the remaining facility limit |
|  |  |  | `DrawdownByTransfer` | `borrower` | Borrower accepts a drawdown the lender sent as a pending token-standard transfer, receiving the cash, and the amount is added to the principal, in one transaction |
|  |  |  | `ReceiveRepayment` | `lender` | Lender accepts a repayment the borrower sent as a pending token-standard transfer, receiving the cash, and applies it to the interest accrued up to now first, then to principal, in one transaction |
|  |  |  | `AccrueInterest` | `lender` | Accrue interest on the drawn principal from interestAccruedThrough to the current ledger time, using the contractual rate and day count |
|  |  |  | `PayAccruedInterest` | `lender` | Lender records receipt of an interest payment from the borrower |
|  |  |  | `PayDownPrincipal` | `lender` | Lender records receipt of a principal repayment from the borrower |
|  |  |  | `LinkCollateralPledge` | `borrower` | Link an active AssetPledge collateral reference to secure the loan |
|  |  |  | `UnlinkCollateralPledge` | `lender` | Unlink collateral pledge once loan obligations are discharged |
|  |  |  | `DeclareLoanDefault` | `lender` | Lender declares default upon non-payment or covenant breach |
|  |  |  | `CureLoanDefault` | `lender` | Lender acknowledges default cure following borrower rectification |
|  |  |  | `CloseLoan` | `lender` | Formally close out the facility once all principal and interest are paid |
|  |  |  | `AddLoanObserver` | `lender, borrower` | Add an authorized observer (e.g. regulator, auditor) to the loan |
|  |  |  | `IsLoanActive` *(read-only)* | `lender` | Nonconsuming query to check if the loan is active and operational |
| **`MarginCall`** (Margin.daml) | `caller, payer` | `custodian, observers` | `SatisfyWithCash` | `payer` | Payer submits a cash payment against the margin call |
|  |  |  | `SatisfyWithPledge` | `payer` | Payer submits an AssetPledge collateral perfection against the call |
|  |  |  | `SatisfyWithTransfer` | `payer` | Payer submits a pending token-standard transfer of the required cash to the caller, instructed through its bank's transfer factory |
|  |  |  | `AcceptMarginTransfer` | `caller` | Caller accepts the submitted transfer, receiving the cash, and the call is satisfied, in one transaction |
|  |  |  | `ConfirmMarginReceipt` | `caller` | Caller confirms receipt of the submitted cash or pledge |
|  |  |  | `RejectMarginFulfilment` | `caller` | Caller rejects a submitted fulfilment (e.g. payment not received); the call returns to Issued |
|  |  |  | `DisputeMarginCall` | `payer` | Payer formally disputes the margin call calculation within deadline |
|  |  |  | `ResolveMarginDispute` | `caller, payer` | Counterparties agree on resolved margin requirement following dispute |
|  |  |  | `DeclareMarginDefault` | `caller` | Caller declares default if margin is unpaid past deadline |
|  |  |  | `CancelMarginCall` | `caller` | Caller cancels the margin call prior to fulfillment |
|  |  |  | `AddMarginObserver` | `caller, payer` | Add an authorized observer (e.g. tri-party agent) |
|  |  |  | `IsMarginSatisfied` *(read-only)* | `caller` | Nonconsuming query to check if the margin call has been met |
| **`AssetPledge`** (Pledge.daml) | `pledgor, pledgee, custodian` | `observers` | `EncumberHolding` | `pledgor` | Pledgor locks the pledged asset to the pledgee: `holdingCid` must be its unlocked cash or security position of the pledged asset, in the pledge's account at the custodian, of at least the pledged quantity |
|  |  |  | `ReleasePledge` | `pledgee` | Pledgee releases the security interest voluntarily (e.g. after loan repayment) |
|  |  |  | `EnforcePledge` | `pledgee` | Pledgee enforces the security interest following an event of default |
|  |  |  | `SubstitutePledge` | `pledgor, pledgee, custodian` | Substitute the pledged asset with an equivalent eligible asset |
|  |  |  | `UpdatePerfectionRef` | `custodian` | Update the legal perfection reference (e.g. amended UCC-1 filing number) |
|  |  |  | `AddPledgeObserver` | `pledgor, pledgee` | Add an observer to this pledge (e.g. tri-party collateral agent, regulator) |
|  |  |  | `IsPledgeActive` *(read-only)* | `pledgee` | Nonconsuming query: is this pledge currently active and enforceable? |
| **`MultiPartyProposal`** (Proposal.daml) | `signed` | `signers` | `AcceptProposal` | `signer` | Sign the proposal |
|  |  |  | `RejectProposal` | `party` | Refuse the proposal, as a party yet to sign it |
|  |  |  | `WithdrawProposal` | `party` | Take the proposal back, as a party that has signed it |
| **`AssetRedemption`** (Redemption.daml) | `fundManager, investor` | `custodian, observers` | `ApproveRedemption` | `fundManager` | Fund Manager approves redemption request and strikes official NAV pricing |
|  |  |  | `ApplyLiquidityGate` | `fundManager` | Fund Manager applies liquidity gate to redemption request |
|  |  |  | `ReleaseLiquidityGate` | `fundManager` | Fund Manager releases liquidity gate, returning request to active evaluation |
|  |  |  | `RejectRedemption` | `fundManager` | Fund Manager rejects redemption request |
|  |  |  | `ExecuteRedemptionSettlement` | `custodian` | Custodian executes cash payout and finalizes redemption settlement |
|  |  |  | `SettleRedemption` | `custodian` | Custodian settles an approved redemption on the ledger: the investor accepts the fund manager's pending token-standard transfer of the net payout, and the redeemed units are burnt from the investor's unit holdings `unitHoldingCids`, with any rest returned to the investor, in one transaction |
|  |  |  | `CancelRedemption` | `investor` | Investor cancels redemption request prior to manager approval |
|  |  |  | `AddRedemptionObserver` | `fundManager` | Add authorized observer (e.g. transfer agent) |
|  |  |  | `IsRedemptionSettled` *(read-only)* | `fundManager` | Nonconsuming query to check if redemption is settled |
| **`RepoAgreement`** (Repo.daml) | `seller, buyer, custodian` | `observers, tripartyAgent (if set)` | `ExecuteOpeningLeg` | `custodian` | Custodian confirms completion of opening leg DvP settlement |
|  |  |  | `RequestOpeningLeg` *(nonconsuming)* | `custodian` | Custodian asks for the opening leg as a token-standard DvP: the collateral from the seller's collateral account to the buyer, against the purchase price from the buyer to the seller at `bank` |
|  |  |  | `SettleOpeningLeg` | `custodian` | Custodian settles the opening leg's DvP, and the repo becomes Active, in one transaction |
|  |  |  | `SubstituteCollateral` | `seller, buyer` | Collateral substitution: replace active collateral with equivalent eligible collateral |
|  |  |  | `InitiateClosingLeg` | `seller` | Seller initiates the closing (repurchase) leg, at maturity or as an early repurchase at the agreed repurchase price |
|  |  |  | `ExecuteClosingLeg` | `custodian` | Custodian confirms completion of closing leg repurchase settlement |
|  |  |  | `RequestClosingLeg` *(nonconsuming)* | `custodian` | Custodian asks for the closing leg as a token-standard DvP: the collateral from the buyer back to the seller's collateral account, against the repurchase price from the seller to the buyer at `bank` |
|  |  |  | `SettleClosingLeg` | `custodian` | Custodian settles the closing leg's DvP, and the repo is Settled, in one transaction |
|  |  |  | `RollRepo` | `seller, buyer` | Roll / extend the repo term with updated rate and maturity date |
|  |  |  | `DeclareRepoDefault` | `declaringParty` | Declare default upon failure to settle closing repurchase or post margin |
|  |  |  | `AddRepoObserver` | `seller, buyer` | Add an authorized observer (e.g. regulator, central clearing counterparty) |
|  |  |  | `IsRepoActive` *(read-only)* | `buyer` | Nonconsuming query to check if repo is currently active and encumbering collateral |
| **`ReverseRepoPosition`** (ReverseRepo.daml) | `buyer` | `seller, custodian, observers` | `UpdateMarkToMarket` | `buyer` | Buyer or valuation agent updates mark-to-market valuation |
|  |  |  | `CloseReverseRepo` | `buyer` | Close the position upon final repurchase settlement |
|  |  |  | `AddReverseRepoObserver` | `buyer` | Add observer to reverse repo position |
|  |  |  | `CalculateMarginDeficit` *(read-only)* | `buyer` | Nonconsuming query to calculate margin deficit given a minimum required haircut ratio |
| **`SecuritiesLendingAgreement`** (SecuritiesLending.daml) | `lender, borrower, custodian` | `observers` | `AccrueLendingFee` | `lender, borrower` | Record borrow fees for an elapsed period |
|  |  |  | `PayLendingFee` | `lender` | Lender confirms receipt of a lending fee payment from the borrower |
|  |  |  | `RecallSecurities` | `lender` | Lender issues a formal recall for partial or full lent securities |
|  |  |  | `ReturnSecurities` | `borrower` | Borrower returns securities, releasing collateral |
|  |  |  | `RequestDelivery` *(nonconsuming)* | `custodian` | Custodian asks for the delivery as a token-standard DvP: the borrowed securities from the lender to the borrower's borrowAccountId, against the cash collateral from the borrower to the lender at `bank` |
|  |  |  | `SettleDelivery` | `custodian` | Custodian settles the delivery's DvP, and the agreement becomes Active, in one transaction |
|  |  |  | `RequestReturn` *(nonconsuming)* | `custodian` | Custodian asks for a return as a token-standard DvP: `returnedQuantity` of the securities from the borrower to the lender, against `collateralReleaseAmount` of cash collateral from the lender back to the borrower at `bank`, within the pro-rata cap |
|  |  |  | `SettleReturn` | `custodian` | Custodian settles a return's DvP, and the agreement records the return as with ReturnSecurities, in one transaction |
|  |  |  | `AccrueFeesToDate` | `actor` | Bring fees and rebates up to date, as any of the three parties |
|  |  |  | `ReceiveLendingFee` | `lender` | Lender accepts the borrower's pending token-standard transfer of a fee payment, up to the fees accrued to date, and records it |
|  |  |  | `ReceiveRebate` | `borrower` | Borrower accepts the lender's pending token-standard transfer of a rebate payment, up to the rebate accrued to date, and records it |
|  |  |  | `RevalueCollateral` | `lender, borrower` | Mark-to-market collateral adjustment agreed between counterparties |
|  |  |  | `DeclareSecLendingDefault` | `lender` | Lender declares default upon failure to satisfy recall deadline |
|  |  |  | `AddSecLendingObserver` | `lender, borrower` | Add authorized observer |
|  |  |  | `IsLendingActive` *(read-only)* | `lender` | Nonconsuming query to check if agreement is active |
| **`FundSubscription`** (Subscription.daml) | `fundManager, investor` | `custodian, observers` | `ApproveSubscription` | `fundManager` | Fund Manager approves investor subscription |
|  |  |  | `RejectSubscription` | `fundManager` | Fund Manager rejects subscription with stated reason |
|  |  |  | `IssueCapitalCall` | `fundManager` | Fund Manager issues an incremental capital call against uncalled commitment |
|  |  |  | `ConfirmCapitalFunding` | `custodian` | Custodian confirms settlement of called capital and allocates units |
|  |  |  | `SettleCapitalCall` | `custodian` | Custodian settles a capital call payment on the ledger: it accepts the investor's pending token-standard transfer of cash to the fund manager, and issues the units the payment buys at the unit price to the investor's `unitsAccountId`, in one transaction |
|  |  |  | `CancelSubscription` | `investor` | Investor cancels request prior to manager approval |
|  |  |  | `CloseSubscription` | `fundManager` | Fund Manager formally closes subscription upon end of fund commitment period |
|  |  |  | `AddSubscriptionObserver` | `fundManager` | Add authorized observer (e.g. transfer agent) |
|  |  |  | `IsSubscriptionActive` *(read-only)* | `fundManager` | Nonconsuming query to check if commitment remains active |
| **`AssetTransferRequest`** (Transfer.daml) | `sender, custodian` | `receiver, complianceOfficer, observers` | `ApproveTransfer` | `complianceOfficer` | Compliance officer approves the transfer, allowing custodian to proceed |
|  |  |  | `RejectTransfer` | `complianceOfficer` | Compliance officer rejects the transfer with a mandatory reason |
|  |  |  | `CompleteTransfer` | `custodian` | Custodian completes an approved transfer |
|  |  |  | `CompleteScreenedTransfer` | `custodian` | Custodian screens a pending request against its compliance requirements and completes it, in one transaction, with the attestations and rules in `evidence` |
|  |  |  | `CancelTransfer` | `sender` | Sender cancels the transfer while it is still pending compliance review |
|  |  |  | `AddTransferObserver` | `custodian` | Add an observer (e.g. regulator, auditor, external custodian) |

### Compliance Policies

| Template | Signatories | Observers | Choice | Controller(s) | Effect |
|:---|:---|:---|:---|:---|:---|
| **`EligibilityPolicy`** (Eligibility.daml) | `policyManager` | `—` | `EvaluateEligibility` *(read-only)* | `policyManager` | Evaluate whether a given jurisdiction and asset class combination is eligible |
|  |  |  | `ActivatePolicy` | `policyManager` | Activate this eligibility policy |
|  |  |  | `DeactivatePolicy` | `policyManager` | Deactivate this policy (e.g. during review or update cycle) |
|  |  |  | `AddAllowedJurisdiction` | `policyManager` | Add a jurisdiction to the allowed list |
|  |  |  | `RemoveAllowedJurisdiction` | `policyManager` | Remove a jurisdiction from the allowed list |
|  |  |  | `AddAllowedAssetClass` | `policyManager` | Add an asset class to the allowed list |
|  |  |  | `RemoveAllowedAssetClass` | `policyManager` | Remove an asset class from the allowed list |
| **`JurisdictionProfile`** (Jurisdiction.daml) | `regulator, institution` | `—` | `SetJurisdictionActive` | `regulator` | Activate or deactivate this jurisdiction profile |
|  |  |  | `AddPermittedAssetClass` | `regulator` | Add a permitted asset class to this profile |
|  |  |  | `RemovePermittedAssetClass` | `regulator` | Remove a permitted asset class from this profile |
|  |  |  | `UpdateRegulatoryFramework` | `regulator` | Update the regulatory framework reference (e.g. after a regulatory change) |
|  |  |  | `IsAssetClassPermitted` *(read-only)* | `regulator` | Nonconsuming query: is the given asset class permitted in this active profile? |
| **`KycAttestation`** (KYC.daml) | `authority` | `subjectParty, observers` | `CompliancePolicy_Describe` *(read-only)* | `requester` | Describe the policy: its owner, kind, and subject or instrument |
|  |  |  | `CompliancePolicy_Evaluate` *(read-only)* | `requester` | Evaluate the policy for a request, at the current ledger time, without changing anything |
|  |  |  | `UpdateKycStatus` | `authority` | Update the KYC status and extend the validity window |
|  |  |  | `RevokeKyc` | `authority` | Revoke this KYC attestation (e.g. AML alert, watchlist match, data quality failure) |
|  |  |  | `UpdateProviderRef` | `authority` | Link an external KYC provider reference to this attestation |
|  |  |  | `AddKycObserver` | `authority` | Grant read-only visibility to an additional party (e.g. custodian, clearing member) |
|  |  |  | `IsKycValid` *(read-only)* | `authority` | Nonconsuming query: is this attestation currently valid? Returns True only when status is KycVerified and ledger time has not passed expiryTimestamp |
| **`OwnershipRestriction`** (OwnershipRestrictions.daml) | `regulator` | `—` | `CompliancePolicy_Describe` *(read-only)* | `requester` | Describe the policy: its owner, kind, and subject or instrument |
|  |  |  | `CompliancePolicy_Evaluate` *(read-only)* | `requester` | Evaluate the policy for a request, at the current ledger time, without changing anything |
|  |  |  | `UpdateCaps` | `regulator` | Update the ownership caps |
|  |  |  | `AddDisallowedJurisdiction` | `regulator` | Add a jurisdiction to the disallowed list |
|  |  |  | `RemoveDisallowedJurisdiction` | `regulator` | Remove a jurisdiction from the disallowed list |
|  |  |  | `SetRestrictionActive` | `regulator` | Activate or deactivate this restriction |
|  |  |  | `CheckOwnershipLimit` *(read-only)* | `regulator` | Nonconsuming query: does the proposed holding violate this restriction? Returns Approved if within all limits, Rejected with reason if any limit is exceeded |
| **`RegulatoryReportRecord`** (RegulatoryReporting.daml) | `reportingParty` | `regulator` | `AcknowledgeReport` | `regulator` | Regulator acknowledges receipt and validation of this report |
|  |  |  | `RejectReport` | `regulator` | Regulator rejects this report (e.g. failed validation, missing required fields) |
|  |  |  | `SubmitAmendment` | `reportingParty` | Reporting party submits an amendment (corrected report) |
| **`SanctionsAttestation`** (Sanctions.daml) | `screeningAuthority` | `subjectParty, observers` | `CompliancePolicy_Describe` *(read-only)* | `requester` | Describe the policy: its owner, kind, and subject or instrument |
|  |  |  | `CompliancePolicy_Evaluate` *(read-only)* | `requester` | Evaluate the policy for a request, at the current ledger time, without changing anything |
|  |  |  | `UpdateSanctionsStatus` | `screeningAuthority` | Update the sanctions status and extend validity |
|  |  |  | `BlockParty` | `screeningAuthority` | Block a party following a confirmed sanctions hit |
|  |  |  | `ClearParty` | `screeningAuthority` | Clear a previously flagged or blocked party following compliance resolution |
|  |  |  | `AddSanctionsObserver` | `screeningAuthority` | Add an observer (e.g. custodian, prime broker, regulator) |
|  |  |  | `IsSanctionsClear` *(read-only)* | `screeningAuthority` | Nonconsuming query: is this party currently sanctions-clear and within validity? Returns True only when status is SanctionsClear and attestation has not expired |
| **`TransferRestrictionRule`** (TransferRestrictions.daml) | `complianceOfficer` | `—` | `CompliancePolicy_Describe` *(read-only)* | `requester` | Describe the policy: its owner, kind, and subject or instrument |
|  |  |  | `CompliancePolicy_Evaluate` *(read-only)* | `requester` | Evaluate the policy for a request, at the current ledger time, without changing anything |
|  |  |  | `UpdateRestriction` | `complianceOfficer` | Update the regulatory category and lockup configuration |
|  |  |  | `ActivateRule` | `complianceOfficer` | Activate this restriction rule |
|  |  |  | `DeactivateRule` | `complianceOfficer` | Deactivate this restriction rule (e.g. after restriction period ends) |
|  |  |  | `UpdateHoldingPeriod` | `complianceOfficer` | Update the holding period requirement |
|  |  |  | `SetWhitelistRequired` | `complianceOfficer` | Update the whitelist requirement |
|  |  |  | `AddToWhitelist` | `complianceOfficer` | Add a party to the approved-transferee whitelist |
|  |  |  | `RemoveFromWhitelist` | `complianceOfficer` | Remove a party from the approved-transferee whitelist |
|  |  |  | `EvaluateTransfer` *(read-only)* | `complianceOfficer` | Nonconsuming evaluation of a proposed transfer at the current ledger time |

---

## 3. Trust Boundary Principles

These principles hold for the current code and are covered by the negative and authorization tests in `daml/test/AryaFi/Test`:

1. **A proposal needs every signature it stands for.** A `MultiPartyProposal` is carried out only when the last of its signers accepts: for a contract, they must be exactly its signatories; for a joint choice, exactly its controllers, checked against the contract when it is exercised. Each signer accepts from its own participant, and any signer can stop the proposal until then.
2. **No position is imposed on a party without its consent.** `TransferCash`, `TransferSecurity`, and `TransferAsset` require the current owner, the holding institution (bank or custodian), and the receiving owner. The receiver becomes a signatory of the new position, so its authority is required.
3. **Token-standard transfers keep the receiver's consent.** By creating a `PositionTransferFactory`, a bank or custodian agrees in advance to transfers between its clients' accounts. The sender instructs a transfer; the receiver still signs the position it receives, either by accepting the pending `PositionTransferInstruction` or by instructing the transfer together with the sender. Until then the amount stays in the sender's account, locked to the registry.
4. **Token-standard settlement needs both sides' allocations.** A registry's `SettlementFactory_SettleBatch` settles only when the allocations authorize exactly both sides of every leg, and only for the settlement's executors; a single allocation cannot be settled on its own. Each allocation is signed by its account owner, so a receiver signs the position it receives through its own allocation. Funding stays locked to the registry until settlement, cancellation by the executors, or withdrawal by the owner (for a committed allocation, only after its settlement deadline).
5. **Token-standard DvP moves only what both parties allocated.** A `TokenDvpInstruction` is signed by the settlement agent alone. The seller and buyer consent only through their own allocations, and each registry settles only if those allocations authorize exactly both sides of its legs, so the agent cannot move anything they did not allocate.
6. **Locks bind to a named lock holder.** `LockCash` / `LockSecurity` / `LockAsset` are authorized by owner and bank/custodian and name a lock holder; a client can also lock its own position through its registry's `PositionTransferFactory` (`LockPosition`), which the registry agreed to by creating it. Only the lock holder can release the lock, or deliver the position to a receiver who co-authorizes (`SettleLockedCash` / `SettleLockedSecurity`). Neither owner nor custodian can withdraw a leg from an agreed settlement.
7. **Atomic DvP.** `ExecuteDvpSettlement` validates both locked legs against the instruction (owner, account, ISIN, quantity, currency, amount, lock holder, lock reference) and delivers both in one transaction. The settlement agent cannot change economic terms; the instruction is signed by seller and buyer. An instruction with compliance requirements settles only through `ExecuteScreenedDvpSettlement`, which evaluates them first.
8. **No party reduces its own obligation.** Loan repayments and interest payments are recorded by the lender; loan interest is computed from rate, day count, and ledger time; securities-lending fees need both counterparties to accrue and the lender to confirm payment, or, with a fee accrual, are computed from the rates, day count, and ledger time, and fees and rebates are reduced only by the cash the receiver accepts; margin fulfilment needs the caller to confirm receipt; collateral release on a securities return is capped pro rata.
9. **Disclosure of bilateral agreements needs both counterparties.** Adding an observer to a loan, repo, securities loan, margin call, pledge, or collateral position requires both principals.
10. **Timestamps come from the ledger.** KYC verification, sanctions screening, pledge enforcement, redemption settlement, and report amendments record ledger time rather than a caller-supplied value.
11. **Compliance officers cannot move value.** Their choices only approve, reject, or evaluate; they hold no controller rights over positions.
12. **Compliance requirements are checked where value moves.** A bank or custodian that sets compliance requirements on its transfer or allocation factory evaluates the KYC and sanctions attestations and the transfer and ownership restrictions in the transfer, acceptance, or allocation transaction itself, through `CompliancePolicy_Evaluate`. A refused movement touches no holdings, and every decision is recorded as an `AuditLog`. The sender cannot skip the check, because the requirements are on the registry's factory; a settlement agent cannot skip it for a DvP whose instruction, signed by seller and buyer, carries requirements. A screened `AssetTransferRequest` completes only on approval; one that needs manual review stays with the compliance officer.

## 4. Known Gaps (see `docs/KNOWN_LIMITATIONS.md`)

- Across separate Canton participants, multi-signatory contracts and joint choices need a `MultiPartyProposal`; without one they need all their parties in one submission. Token-standard transfers and `TokenDvpInstruction` need neither.
- KYC attestations, sanctions attestations, transfer restriction rules, and ownership restrictions can be evaluated by business workflows through `CompliancePolicy`; eligibility policies and jurisdiction profiles cannot yet. The policies' own evaluation choices (`IsKycValid`, `IsSanctionsClear`, `EvaluateEligibility`, `EvaluateTransfer`, `CheckOwnershipLimit`) remain controlled by the policy owner.
- A workflow evaluates the evidence its caller supplies. Missing evidence is refused, but the workflow cannot tell that a party has a second, worse attestation, or that a rule by another accepted officer was left out.
- Loans, repos, margin calls satisfied by reference, and pledges and collateral that are not locked reference assets and payments by text reference rather than contract ID, so the ledger does not prevent one asset being referenced by several agreements. A locked pledge or collateral position holds its position, locked to the pledgee or receiver, and a margin call paid by transfer receives the cash.

## 5. Regenerating This Matrix

Update the choice doc comments in the Daml source, then run `python3 scripts/gen_authorization_matrix.py`. Do not edit the tables by hand.
