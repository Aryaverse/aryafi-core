# Compliance and Policy Specification

AryaFi Core compliance engine contracts in `daml/src/AryaFi/Compliance/`:

- **KYC (`KYC.daml`)**: Institutional KYC attestations issued by approved verification authorities.
- **Jurisdiction (`Jurisdiction.daml`)**: Country and cross-border regulatory framework profiles.
- **Eligibility (`Eligibility.daml`)**: Dynamic evaluation engine for counterparty and collateral eligibility.
- **Sanctions (`Sanctions.daml`)**: Real-time sanctions attestation records.
- **Transfer Restrictions (`TransferRestrictions.daml`)**: Regulatory exemptions (Reg D, Reg S, Rule 144A, lockup periods).
- **Ownership Restrictions (`OwnershipRestrictions.daml`)**: Cap tables, concentration limits, and jurisdictional barriers.
- **Regulatory Reporting (`RegulatoryReporting.daml`)**: Audit records structured for CAT, EMIR, MiFIR, and trade repository submissions.
