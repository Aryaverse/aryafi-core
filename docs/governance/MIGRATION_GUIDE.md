# AryaFi Core: Contract Upgrade & State Migration Guide

## 1. Overview & Upgrade Philosophy

In Daml and Canton, smart contracts are **immutable**. A compiled package (DAR) is identified by a unique cryptographic **Package ID** computed from the AST hash of its source modules. 

When upgrading contract templates from version $N$ to $N+1$:
- Active contracts on ledger instantiated under package ID $V_N$ do **not** automatically mutate.
- Upgrades must follow explicit, auditable migration procedures that preserve legal signatories, economic balances, and active encumbrances without service disruption.

This guide defines the institutional migration protocols for **AryaFi Core**.

**Canton 3 (v3.0.0 and later).** A new version of a package with the same name (`aryafi-core`) that passes Canton's upgrade checks, for example one that adds a choice or an optional field, needs no migration: once it is vetted, existing contracts are upgraded when they are next used. Canton rejects an incompatible version, so the strategies below apply to changes that cannot be expressed as an upgrade; those releases need a new package name.

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
# 1. Inspect package IDs of the current and new DARs
dpm inspect-dar aryafi-core-<current>.dar | grep "package-id"
dpm inspect-dar .daml/dist/aryafi-core-<new>.dar | grep "package-id"
```

```scala
// 2. In the Canton console: upload the new DAR to all participant nodes
participants.all.foreach(_.dars.upload(".daml/dist/aryafi-core-<new>.dar"))

// 3. Query un-migrated contracts on the active node
val oldPositions = bank_node.ledger_api.state.acs.of_all()
  .filter(_.templateId.packageId == "old_package_id_here")
println(s"Remaining old positions: ${oldPositions.size}")
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

---

## 6. Upgrading to v3.0.0

v3.0.0 moves the library from Daml SDK 2.10 / Canton 2.10 (Daml-LF 1.x) to Daml SDK 3.5.12 / Canton 3.5 (Daml-LF 2.2). Apart from the removed contract keys, template fields and choices are unchanged from v2.0.0.

### 6.1 Ledger Migration
A Canton 2 ledger cannot run the v3.0.0 DAR, and a Canton 3 ledger cannot run v2.0.0. Move live contracts with Strategy B: take an Active Contract Set snapshot on the Canton 2 participant, recreate each active contract on the Canton 3 ledger with the same arguments and signatories, and reconcile balances before and after. v2.0.0 was released on 2026-09-29, so most deployments have no live contracts.

### 6.2 Removed Contract Keys
`Account`, `InstitutionalParty`, `FinancialObligation`, `KycAttestation`, `SanctionsAttestation`, `TransferRestrictionRule`, and `OwnershipRestriction` no longer have keys. The library never looked them up, but client code that used `fetchByKey`, `lookupByKey`, or `exerciseByKey` on them must keep contract IDs or query the Active Contract Set instead. The ledger no longer rejects a duplicate (for example a second KYC attestation for the same authority and subject); check before creating.

### 6.3 Client Code Changes

| Before (v2.0.0, Canton 2.10) | After (v3.0.0, Canton 3.5) |
|:---|:---|
| HTTP JSON API v1: `POST /v1/create` | JSON Ledger API v2: `POST /v2/commands/submit-and-wait` with a `CreateCommand` |
| `POST /v1/exercise` | `ExerciseCommand`; use `/v2/commands/submit-and-wait-for-transaction` with the ledger-effects shape to read the choice result |
| `POST /v1/query` with a field filter | `POST /v2/state/active-contracts` filtered by party and template; filter fields in the client |
| Template ID `AryaFi.Finance.Cash:CashPosition` | `#aryafi-core:AryaFi.Finance.Cash:CashPosition` (package-name form) |
| `meta.commandId`, `applicationId` | `commandId`, `userId` |
| JWT with custom Daml claims (`actAs`, `readAs`, `ledgerId`) | user token (`sub` = user ID); `CanActAs` / `CanReadAs` granted as user rights on the participant |
| gRPC Ledger API v1 services | Ledger API v2 (`CommandService`, `UpdateService`, `StateService`, ...) |

[LEDGER_API_CLIENT.md](../integration/LEDGER_API_CLIENT.md) shows the v2 requests in full.

### 6.4 Build and Test Changes

| Before | After |
|:---|:---|
| `daml build` | `dpm build --all` (production and test packages) |
| `daml test` | `dpm test --all` in `daml/test` |
| `daml script --dar .daml/dist/aryafi-core-2.0.0.dar` | `dpm script --dar daml/test/.daml/dist/aryafi-core-test-3.0.0.dar --upload-dar=yes` |
| Tests in `daml/src/AryaFi/Test`, compiled into the production DAR | Tests in `daml/test/AryaFi/Test`, a separate `aryafi-core-test` package |
| `submitMulti [a, b] [] do` | `submit (actAs [a, b]) do` |
| `try ... catch` in scripts | `tryFailureStatus` |
| `allocateParty "Name"` twice in one run | a unique name per allocation (Canton 3 rejects duplicates) |

### 6.5 Verification
Run the runbook in section 3, confirm `dpm test --all` passes in `daml/test`, and run the DvP suites against the `deploy/` topology (see [daml/test/AryaFi/Test/Integration/README.md](../../daml/test/AryaFi/Test/Integration/README.md)).

## 7. Upgrading to v3.3.0

v3.3.0 is an upgrade of v3.2.0: upload the new DAR to every participant that hosts AryaFi parties, and existing contracts carry on under it. No contracts need migrating.

### 7.1 New Package
The `CompliancePolicy` interface is in a new package, `aryafi-compliance-api` 1.0.0, which the `aryafi-core` DAR includes. An authority or registry outside AryaFi that implements or calls the interface builds against the `aryafi-compliance-api` DAR from the release.

### 7.2 New Optional Fields
`PositionTransferFactory`, `PositionTransferInstruction`, `PositionAllocationFactory`, and `DvpInstruction` have a new last field, `compliance : Optional ComplianceRequirements`. Contracts created before the upgrade, and new ones without the field (the JSON Ledger API fills a missing optional field with `None`), are not screened. Daml code that constructs these templates must set `compliance = None` or the requirements.

### 7.3 Turning Compliance On
- The KYC authority and sanctions screener share their attestations with the bank or custodian (`AddKycObserver`, `AddSanctionsObserver`), or disclose them through the registry's API; the compliance officer discloses its transfer restriction rules.
- The bank or custodian exercises `SetTransferCompliance` and `SetAllocationCompliance` on its factories with its `ComplianceRequirements`. From then on, wallets and settlement apps pass the evidence in the choice context (see [LEDGER_API_CLIENT.md §6.4](../integration/LEDGER_API_CLIENT.md#64-compliance-evidence)); a transfer without it ends `Failed` with the reason. Transfers already pending are screened again on acceptance only if they were instructed under requirements.
- A DvP is screened only if its instruction is created with requirements; settle it with `ExecuteScreenedDvpSettlement`.
