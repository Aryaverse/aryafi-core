# Privacy and Disclosure Model

## 1. Canton Sub-Transaction Privacy
In AryaFi Core, privacy is treated as a security requirement, not an operational detail. Daml's sub-transaction privacy ensures that only parties with explicit legal and operational roles receive transaction trees.

## 2. Observer Taxonomy
| Party Role | Visibility Level | Contracts Observed |
| :--- | :--- | :--- |
| **Custodian** | Account-level | Own account holdings, locked assets, custody movements |
| **Asset Issuer** | Issuance-level | Security holdings, corporate actions, cap tables |
| **Trade Counterparty** | Contract-level | Bilateral contract state (Repo, Loan, DvP) |
| **Settlement Agent** | Transaction-level | Active DvP / payment instructions during settlement |
| **Regulator / Auditor** | Read-Only Audit | Regulatory reporting records, audit event streams |
| **Third Parties** | Zero Visibility | Blind to all contracts and state transitions |
