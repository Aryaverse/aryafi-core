# Compliance and Policy Specification

AryaFi Core compliance engine contracts in `daml/src/AryaFi/Compliance/`:

- **KYC (`KYC.daml`)**: Institutional KYC attestations issued by approved verification authorities.
- **Jurisdiction (`Jurisdiction.daml`)**: Country and cross-border regulatory framework profiles.
- **Eligibility (`Eligibility.daml`)**: Dynamic evaluation engine for counterparty and collateral eligibility.
- **Sanctions (`Sanctions.daml`)**: Real-time sanctions attestation records.
- **Transfer Restrictions (`TransferRestrictions.daml`)**: `EvaluateTransfer` checks the lockup, holding period, whitelist, and the receiver's investor status against the regulatory category (Reg D 506(c), Reg S, Rule 144A, accredited / qualified purchaser), and reports every failed rule. This is a configurable policy module, not legal advice.
- **Ownership Restrictions (`OwnershipRestrictions.daml`)**: Cap tables, concentration limits, and jurisdictional barriers.
- **Regulatory Reporting (`RegulatoryReporting.daml`)**: Audit records structured for CAT, EMIR, MiFIR, and trade repository submissions.

## Compliance inside the workflows

KYC attestations, sanctions attestations, and transfer restriction rules implement the `CompliancePolicy` interface, defined in its own package, `aryafi-compliance-api` (`daml/compliance-api`), so that authorities and registries outside AryaFi can implement it or call it, and so that `aryafi-core` stays upgradeable. Its two choices only read the policy, and any party that sees the policy contract can exercise them as itself:

- `CompliancePolicy_Describe` returns the policy's owner (the authority), kind (`KycPolicy`, `SanctionsPolicy`, `TransferRulePolicy`), and subject party or instrument.
- `CompliancePolicy_Evaluate` returns a `ComplianceDecision` (`Compliant`, `NonCompliant reason`, or `NeedsReview reason`) for one party's part in a movement, at the current ledger time:

| Policy | Decision |
|:---|:---|
| `KycAttestation` | Compliant only for the attested party, verified, and before expiry; otherwise `KYC_EXPIRED`, `KYC_PENDING`, or `KYC_REJECTED: <reason>` |
| `SanctionsAttestation` | Compliant only for the screened party, clear, and before expiry; `SANCTIONED: <list>` if blocked (even after expiry), `SANCTIONS_SCREENING_EXPIRED`, or review if flagged |
| `TransferRestrictionRule` | Applies to the receiver of its ISIN while active: `LOCKUP_NOT_EXPIRED`, `RECEIVER_NOT_WHITELISTED`; a whitelisted receiver is eligible for the rule's category, otherwise a restricted category and any holding period need review |

Anyone can implement the interface, so both choices first check that the policy's owner signed the contract, and refuse it otherwise: a policy cannot be forged in an authority's name. An authority shares a policy by adding the bank or custodian as an observer, or by disclosing the contract to whoever submits the transaction (explicit disclosure), as a registry's off-ledger API would.

**The gate (`Gate.daml`).** A bank or custodian states its `ComplianceRequirements`: the KYC authorities it accepts (one valid attestation from any of them), the sanctions authorities (a clear screening from every one), the transfer-rule officers, and the instruments that need a rule. It sets them on its `PositionTransferFactory` (`SetTransferCompliance`) or `PositionAllocationFactory` (`SetAllocationCompliance`); a `DvpInstruction` can carry them too. The caller then lists the policy contracts in the choice context under `aryafi.io/compliance-evidence` (for the DvP, the `evidence` argument of `ExecuteScreenedDvpSettlement`), and the registry or agent evaluates them for sender and receiver in the same transaction:

- **Transfers** are screened when instructed and again when the receiver accepts. A refused transfer is `TransferInstructionResult_Failed` with the reason under `aryafi.io/compliance-refusal` in the result's metadata: on instruction it spends no holdings; on acceptance the amount is unlocked for the sender.
- **Allocations** are screened, leg by leg, when they are made; a refused allocation is `AllocationInstructionResult_Failed` and locks nothing.
- **DvP**: `ExecuteScreenedDvpSettlement` settles the instruction, or fails it with the reasons and leaves both legs locked to the agent. An instruction with requirements cannot be settled with `ExecuteDvpSettlement`.

Missing evidence is refused (`NO_KYC_ATTESTATION`, `NO_SANCTIONS_SCREENING`, `NO_TRANSFER_RULE`), and a decision that needs manual review refuses the movement. Evidence whose owner did not sign it fails the whole transaction. Every decision is recorded as an `AuditLog` (`ComplianceCheckPassed` or `ComplianceCheckFailed` with the reasons), kept by the registry or agent and shown to the parties that asked for the movement. See [KNOWN_LIMITATIONS.md §4](../KNOWN_LIMITATIONS.md#4-multi-party-workflows-and-compliance) for what the gate does not check.
