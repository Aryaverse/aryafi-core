# Reference Application: Tokenized US Treasury + Cash DvP

## Overview
Demonstrates atomic Delivery-versus-Payment (DvP) of Tokenized US Treasuries against Tokenized Cash/Deposits between institutional primary dealers over Canton.

## Workflow
1. **Asset Creation**: Custodian creates `SecurityPosition` (US Treasury) and `CashPosition` (USD).
2. **DvP Initialization**: Counterparties create a multi-signatory `DvpInstruction`.
3. **Atomic Execution**: Settlement agent triggers execution, transferring the security and cash simultaneously across accounts.
