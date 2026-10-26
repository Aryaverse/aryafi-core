# Financial Primitives Specification

AryaFi Core defines standard institutional financial building blocks in `daml/src/AryaFi/Finance/`:

- **Party (`Party.daml`)**: Institutional participant representation, LEI metadata, legal profiles, active status.
- **Account (`Account.daml`)**: Segregated, omnibus, and settlement custody accounts with explicit owner and custodian controllers.
- **Asset (`Asset.daml`)**: Generic fungible and non-fungible holding interfaces.
- **Cash (`Cash.daml`)**: Tokenized cash/deposit positions supporting split, merge, receiver-authorized transfer, and locks held by a named lock holder, who alone can release or settle them.
- **Security (`Security.daml`)**: Fixed income, equities, and tokenized Treasuries with ISIN, CUSIP, coupon, and maturity dates.
- **Collateral (`Collateral.daml`)**: Allocated/pledged positions with haircut rates and market valuation. `LockCollateralHolding` locks the provider's security position to the receiver until the collateral is released, liquidated, or substituted.
- **Token transfers (`TokenTransfer.daml`)**: The registry's `PositionTransferFactory` sends cash and securities through the token standard, and lets a client lock one of its positions to another party for an agreement, such as an escrow (`LockPosition`).
- **Obligation (`Obligation.daml`)**: Bilateral financial duties with discharge and default semantics.
- **Payment (`Payment.daml`)**: Separation of payment instruction from atomic settlement. The settlement agent executes an instruction on the ledger with `ExecutePayment`: a token-standard transfer from the payer's account to the payee's through the bank's factory, which completes at once because payer and payee signed the instruction, and which the bank's compliance requirements screen. A refused transfer fails the instruction with the reason. The transfer's metadata carries the idempotency key and correlation ID.
- **Settlement (`Settlement.daml`)**: Atomic Delivery-versus-Payment: `ExecuteDvpSettlement` validates both legs locked to the settlement agent and delivers them in one transaction.
