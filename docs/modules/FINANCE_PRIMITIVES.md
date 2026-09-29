# Financial Primitives Specification

AryaFi Core defines standard institutional financial building blocks in `daml/src/AryaFi/Finance/`:

- **Party (`Party.daml`)**: Institutional participant representation, LEI metadata, legal profiles, active status.
- **Account (`Account.daml`)**: Segregated, omnibus, and settlement custody accounts with explicit owner and custodian controllers.
- **Asset (`Asset.daml`)**: Generic fungible and non-fungible holding interfaces.
- **Cash (`Cash.daml`)**: Tokenized cash/deposit positions supporting split, merge, receiver-authorized transfer, and locks held by a named lock holder, who alone can release or settle them.
- **Security (`Security.daml`)**: Fixed income, equities, and tokenized Treasuries with ISIN, CUSIP, coupon, and maturity dates.
- **Collateral (`Collateral.daml`)**: Allocated/pledged positions with haircut rates and market valuation.
- **Obligation (`Obligation.daml`)**: Bilateral financial duties with discharge and default semantics.
- **Payment (`Payment.daml`)**: Separation of payment instruction from atomic settlement.
- **Settlement (`Settlement.daml`)**: Atomic Delivery-versus-Payment: `ExecuteDvpSettlement` validates both legs locked to the settlement agent and delivers them in one transaction.
