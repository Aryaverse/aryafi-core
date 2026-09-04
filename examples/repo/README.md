# Reference Application: Institutional Repo

## Overview
Demonstrates bilateral and tri-party repurchase agreement (Repo) lifecycle management with collateral margin allocation and closeout settlement.

## Workflow
1. **Agreement Execution**: Seller and Buyer initiate `RepoAgreement` specifying haircut, repo rate, and maturity.
2. **Margin Management**: Real-time margin calls via `MarginCall` template.
3. **Maturity & Closeout**: Repurchase of collateral and discharge of obligations.
