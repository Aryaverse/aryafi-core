# AryaFi Core: Contract Authorization Matrix & Trust Boundaries

## 1. Overview & Security Model

In Daml and Canton, contract security is governed by three primary primitives:
1. **Signatories**: Parties whose explicit cryptographic authorization is required to create or modify a contract. Signatories bear legal and economic liability for the contract state.
2. **Controllers**: Parties empowered to exercise specific contract choices, initiating state transitions, balance movements, or archival.
3. **Observers**: Parties granted read-only visibility into the contract state, transaction tree, and events.

This document provides the exhaustive, auditable **Authorization Matrix** across all core modules in the AryaFi contract library.

---

## 2. Finance Primitives Authorization Matrix

| Template | Signatories | Choice Name | Controller(s) | Observers | Preconditions & Security Invariants | Resulting State Transition |
|:---|:---|:---|:---|:---|:---|:---|
| **`Account`** | `custodian`, `owner` | `FreezeAccount` | `custodian` | `observers` | `not isFrozen` | Updates `isFrozen = True` |
| | | `UnfreezeAccount` | `custodian` | `observers` | `isFrozen` | Updates `isFrozen = False` |
| | | `AddAccountObserver` | `owner` | `observers` | `newObserver notElem observers` | Adds party to observer list |
| **`CashPosition`** | `bank`, `owner` | `SplitCash` | `owner` | `observers` | `not isLocked`, `splitAmount > 0.0`, `splitAmount < amount` | Archives self; creates 2 new positions ($A_1 + A_2 = A_{\text{total}}$) |
| | | `MergeCash` | `owner` | `observers` | `not isLocked`, matching `bank, owner, accountId, currency` | Archives other CID; updates `amount = amount + other.amount` |
| | | `TransferCash` | `owner`, `bank` | `observers` | `not isLocked`, `newOwner /= owner` | Re-assigns ownership & account at same bank |
| | | `LockCash` | `owner`, `bank` | `observers` | `not isLocked`, `lockRef /= ""` | Encumbers position (`isLocked = True`) |
| | | `UnlockCash` | `owner`, `bank` | `observers` | `isLocked` | Releases encumbrance (`isLocked = False`) |
| **`SecurityPosition`** | `custodian`, `owner` | `SplitSecurity` | `owner` | `observers` | `not isLocked`, `splitQty > 0.0`, `splitQty < quantity` | Conserves total units ($Q_1 + Q_2 = Q_{\text{total}}$) |
| | | `MergeSecurity` | `owner` | `observers` | `not isLocked`, matching `custodian, owner, accountId, isin` | Consolidates security units |
| | | `TransferSecurity`| `owner`, `custodian` | `observers` | `not isLocked`, `newOwner /= owner` | Updates legal ownership at custodian |
| | | `LockSecurity` | `owner`, `custodian` | `observers` | `not isLocked`, non-empty `lockRef` | Blocks position from transfer or settlement |
| | | `UnlockSecurity` | `owner`, `custodian` | `observers` | `isLocked` | Restores position to available status |
| **`PaymentInstruction`**| `payer`, `payee`, `settlementAgent` | `ConfirmPaymentSettlement` | `settlementAgent` | `observers` | `status == PendingSettlement` | Transitions `status = Settled` |
| | | `RejectPaymentSettlement` | `settlementAgent` | `observers` | `status == PendingSettlement`, non-empty `reason` | Transitions `status = Failed reason` |
| | | `CancelPayment` | `payer` | `observers` | `status == PendingSettlement`, non-empty `reason` | Transitions `status = Cancelled reason` |
| | | `AttachNetworkRef` | `settlementAgent` | `observers` | `status == PendingSettlement` | Attaches SWIFT UETR / Fedwire IMAD |
| **`DvpInstruction`** | `seller`, `buyer`, `settlementAgent` | `ExecuteDvp` | `settlementAgent` | `observers` | `status == PendingDvp`, both cash & security locked | Atomically swaps cash & security; marks `DvpSettled` |
| | | `CancelDvp` | `seller`, `buyer` | `observers` | `status == PendingDvp` | Cancels trade; triggers unlock of underlying assets |

---

## 3. Financial Contracts Authorization Matrix

| Template | Signatories | Choice Name | Controller(s) | Observers | Preconditions & Invariants | Resulting State Transition |
|:---|:---|:---|:---|:---|:---|:---|
| **`InstitutionalLoan`**| `lender`, `borrower` | `DrawdownLoan` | `borrower` | `custodian`, `observers` | `status == LoanActive`, drawdown amount $\le$ available facility limit | Accrues principal; emits drawdown funding instruction |
| | | `AccrueInterest` | `lender` | `observers` | `status == LoanActive`, valid elapsed time & day count | Updates `accruedInterest` based on Act360 / Act365 |
| | | `RepayLoan` | `borrower` | `observers` | `repaymentAmount > 0.0` | Reduces outstanding principal; auto-closes if zero |
| | | `DeclareDefault` | `lender` | `observers` | Delinquent payment breach or covenant violation | Transitions `status = LoanDefaulted`; triggers pledge enforcement |
| **`RepoAgreement`** | `seller`, `buyer`, `custodian` | `RevalueRepoCollateral`| `seller`, `buyer` | `observers` | Active repo status, updated market price feed | Updates mark-to-market valuation & margin surplus/deficit |
| | | `ExecuteClosingLeg` | `seller`, `buyer`, `custodian` | `observers` | Maturity date reached, repurchase price funded | Repurchases collateral; marks repo `RepoClosed` |
| | | `DefaultRepo` | `buyer` (or `seller`) | `observers` | Failure to repurchase or satisfy margin call | Liquidates collateral to satisfy cash obligation |
| **`SecuritiesLendingAgreement`**| `lender`, `borrower`, `custodian` | `AccrueLendingFee` | `lender` | `observers` | `status == LendingActive` | Accrues borrow fee ($Qty \times Rate \times Days/360$) |
| | | `RecallSecurities` | `lender` | `observers` | `recallQuantity <= borrowedQuantity` | Transitions `status = LendingRecalled` with deadline |
| | | `ReturnSecurities` | `borrower` | `observers` | `returnQuantity <= borrowedQuantity` | Releases pro-rata collateral; auto-closes if zero |
| | | `DeclareDefault` | `lender` | `observers` | Recall deadline expired without return | Transitions `status = LendingDefaulted`; seizes collateral |
| **`AssetPledge`** | `pledgor`, `pledgee`, `custodian` | `ReleasePledge` | `pledgee` | `observers` | Underlying obligation certified as discharged | Releases lien; returns unencumbered asset to pledgor |
| | | `EnforcePledge` | `pledgee` | `observers` | Verified default on secured loan or repo | Transfers pledged collateral ownership to pledgee |
| **`EscrowAgreement`** | `depositor`, `beneficiary`, `escrowAgent` | `ReleaseEscrow` | `escrowAgent` | `observers` | Release conditions satisfied (time, milestone, or joint consent) | Disburses escrowed assets to beneficiary |
| | | `RefundEscrow` | `escrowAgent` | `observers` | Expiration of escrow period without milestone | Returns escrowed assets to depositor |
| **`FundSubscription`**| `investor`, `fundManager` | `IssueCapitalCall` | `fundManager` | `observers` | Called amount $\le$ uncalled commitment | Creates capital call payment obligation |
| | | `FundCapitalCall` | `investor` | `observers` | Capital call payment verified | Converts commitment to funded fund share units |
| **`AssetRedemption`** | `investor`, `fundManager` | `ApproveRedemption` | `fundManager` | `observers` | NAV calculated, liquidity gate verified | Tranches cash payout to investor |

---

## 4. Compliance & Policy Engine Authorization Matrix

| Template | Signatories | Choice Name | Controller(s) | Observers | Preconditions & Invariants | Resulting State Transition |
|:---|:---|:---|:---|:---|:---|:---|
| **`KYCAttestation`** | `authority` | `RenewKYC` | `authority` | `party`, `complianceOfficers` | Verified institutional identity documentation | Extends expiration timestamp |
| | | `RevokeKYC` | `authority` | `party`, `complianceOfficers` | Non-empty revocation reason | Immediately invalidates attestation |
| **`SanctionsScreening`**| `screeningProvider` | `UpdateSanctionsStatus`| `screeningProvider` | `regulators`, `auditors` | Timestamped OFAC/EU/UN screening run | Flags party if matched against sanctions list |
| **`AssetTransferRequest`**| `sender`, `custodian` | `ApproveTransfer` | `complianceOfficer` | `receiver`, `observers` | Active KYC verified; no active sanctions hit | Transitions `status = TransferApproved` |
| | | `RejectTransfer` | `complianceOfficer` | `receiver`, `observers` | Compliance or eligibility policy failure | Transitions `status = TransferRejected reason` |
| | | `CompleteTransfer` | `custodian` | `receiver`, `observers` | `status == TransferApproved` | Executes physical custody transfer; marks `TransferCompleted` |
| | | `CancelTransfer` | `sender` | `receiver`, `observers` | `status == TransferPendingCompliance` | Transitions `status = TransferCancelled reason` |

---

## 5. Trust Boundary Principles

1. **No Unilateral Asset Movement**: Asset positions (`CashPosition`, `SecurityPosition`) always require the joint signature of the legal owner and the holding institution. No custodian can unilaterally seize assets, and no owner can move assets without custodian verification.
2. **Separation of Economic Claim and Compliance Review**: The `complianceOfficer` cannot alter loan balances or seize cash; their authority is strictly bounded to approving or rejecting transfer workflows (`TransferStatus`).
3. **Settlement Independence**: The `settlementAgent` orchestrates atomic exchange (`ExecuteDvp`, `ConfirmPaymentSettlement`) but cannot alter economic terms (prices, quantities, interest rates) agreed upon by counterparties.
