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
daml damlc inspect-dar .daml/dist/aryafi-core-1.0.0.dar | grep "package-id"

# 2. Upload new DAR to all participant nodes
canton console --connect=bank_node -c 'participants.all.dars.upload(".daml/dist/aryafi-core-1.0.0.dar")'

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
