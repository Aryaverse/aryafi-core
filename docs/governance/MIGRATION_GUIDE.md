# AryaFi Core: Contract Upgrade & State Migration Guide

## 1. Overview & Upgrade Philosophy

In Daml and Canton, smart contracts are **immutable**. A compiled package (DAR) is identified by a unique cryptographic **Package ID** computed from the AST hash of its source modules. 

When upgrading contract templates from version $N$ to $N+1$:
- Active contracts on ledger instantiated under package ID $V_N$ do **not** automatically mutate.
- Upgrades must follow explicit, auditable migration procedures that preserve legal signatories, economic balances, and active encumbrances without service disruption.

This guide defines the institutional migration protocols for **AryaFi Core**.

---

## 2. Upgrade Strategies

### Strategy A: Choice-Based Direct Roll-Forward (Recommended for Core Primitives)
For high-volume primitives (`CashPosition`, `SecurityPosition`), each template includes an authorized upgrade choice:

```daml
-- Pattern: In-contract upgrade choice
choice UpgradeCashPosition : ContractId CashPositionV2
  with
    v2PackageId : Text
  controller bank, owner
  do
    require (not isLocked) "Cannot upgrade a locked position"
    create CashPositionV2 with
      bank = bank
      owner = owner
      accountId = accountId
      currency = currency
      amount = amount
      isLocked = False
      lockReference = None
      observers = observers
      newFeatureField = defaultFeatureValue
```

### Strategy B: Multi-Party Batch Migration Script
For long-running contracts (`InstitutionalLoan`, `RepoAgreement`), the custodian or calculation agent coordinates off-ledger batch execution via the Canton Ledger API:
1. Snapshot all active contracts of template $T_{V1}$ using the Active Contract Set (ACS) service.
2. Verify all signatories are available to co-sign the migration.
3. Submit atomic batches of `UpgradeContract` commands, consuming $T_{V1}$ and creating $T_{V2}$.
4. Reconcile total outstanding balances before and after migration to ensure $\sum A_{V2} \equiv \sum A_{V1}$.

---

## 3. Migration Verification Runbook

```bash
# 1. Inspect package IDs of current and new DAR packages
daml damlc inspect-dar .daml/dist/aryafi-core-0.1.0.dar | grep "package-id"
daml damlc inspect-dar .daml/dist/aryafi-core-2.0.0.dar | grep "package-id"

# 2. Upload new DAR to all participant nodes
canton console --connect=bank_node -c 'participants.all.dars.upload(".daml/dist/aryafi-core-2.0.0.dar")'

# 3. Query un-migrated contracts on active node
canton console --connect=bank_node -c '
  val oldPositions = participants.bank_node.ledger_api.acs.of_all()
    .filter(_.templateId.packageId == "old_package_id_here")
  println(s"Remaining V1 positions: ${oldPositions.size}")
'
```

---

## 4. Rollback & Contingency Procedures

1. **Transaction Atomicity**: In Daml, an upgrade choice either commits in full or rolls back completely. If any assertion fails during contract creation, the original contract remains active and untouched.
2. **Side-by-Side Execution**: Canton natively supports hosting multiple package IDs simultaneously. If an issue is detected during progressive rollout, new trades can revert to the prior package ID while active contracts remain accessible.

---

## 5. Upgrading to v2.0.0

v2.0.0 changes template fields and choice signatures, so its package ID differs from v1.0.1 and existing contracts must be migrated (Strategy B above: archive under the old package, recreate under the new one with the signatories of each contract). Because v1.0.1 did not build, most deployments have no live contracts; the notes below apply to any that do.

### 5.1 New Template Fields

| Template | New field | Value for migrated contracts |
|:---|:---|:---|
| `CashPosition`, `SecurityPosition`, `AssetHolding` | `lockHolder : Optional Party` | `None` for unlocked positions. For locked positions, agree who holds the lock (normally the settlement or collateral agent) and set `Some agent`; the `ensure` clause requires `isLocked == (lockHolder /= None)`. |
| `InstitutionalLoan` | `interestAccruedThrough : Time` | The date up to which interest is already included in `accruedInterest` (normally the last accrual date, or `startDate`). |
| `TransferRestrictionRule` | `whitelist : [Party]` | The approved transferees; `[]` if `whitelistRequired` is `False`. |

### 5.2 Changed Variants
- `LendingRecallIssued qty deadline` becomes `LendingRecallIssued with recallQuantity; recallDeadline`.
- `RedemptionSettled ref amount` becomes `RedemptionSettled with paymentReference; netPayout`.
- `MarginCallStatus` gains `MarginCallPendingConfirmation`.

### 5.3 Client Code Changes

| Before (v1.0.1) | After (v2.0.0) |
|:---|:---|
| `LockCash with lockRef` / `LockSecurity with lockRef` | add `holder = <lock holder>`; unlock and settle as the lock holder |
| `UnlockCash` / `UnlockSecurity` submitted by owner + bank/custodian | submitted by the lock holder |
| `TransferCash` / `TransferSecurity` / `TransferAsset` by owner + bank/custodian | the receiving owner must also authorize |
| `ExecuteDvpSettlement` (no arguments) | `ExecuteDvpSettlement with sellerSecurityCid; buyerCashCid`; returns `DvpSettlementResult` |
| `AccrueInterest with additionalInterest` | `AccrueInterest` (amount computed by the contract from ledger time) |
| `PayAccruedInterest` / `PayDownPrincipal` by borrower | by lender (confirming receipt) |
| `AccrueLendingFee` by lender; `PayLendingFee` by borrower | `AccrueLendingFee` by lender + borrower; `PayLendingFee` by lender |
| `SatisfyWithCash` / `SatisfyWithPledge` satisfy the call | they submit a fulfilment; the caller runs `ConfirmMarginReceipt` |
| `IsTransferAllowed` returning `Bool` | `EvaluateTransfer with receiver; acquiredAt; receiverStatus` returning `PolicyDecision` |
| `Add*Observer` on loans, repos, securities loans, margin calls, pledges, collateral by one party | both counterparties |
| Timestamp arguments on `UpdateKycStatus`, `RevokeKyc`, `UpdateSanctionsStatus`, `BlockParty`, `ClearParty`, `EnforcePledge`, `ExecuteRedemptionSettlement`, `SubmitAmendment` | removed; ledger time is recorded |
| Looking up `CashPosition` by key `(bank, accountId, currency)` | query by those fields; an account may hold several positions per currency |

### 5.4 Verification
Run the runbook in section 3, then confirm `daml test` passes and regenerate the authorization matrix (`python3 scripts/gen_authorization_matrix.py`) to review the controller changes.
