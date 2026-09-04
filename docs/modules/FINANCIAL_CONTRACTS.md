# Financial Contracts Specification

AryaFi Core contract workflows in `daml/src/AryaFi/Contracts/`:

- **Loan (`Loan.daml`)**: Bilateral institutional loan agreements with principal pay-down and default mechanics.
- **Repo (`Repo.daml`)**: Standard repurchase agreements with opening/closing settlement legs, repo rate, and closeout lifecycle.
- **Reverse Repo (`ReverseRepo.daml`)**: Buyer-side composition and view over active repos.
- **Securities Lending (`SecuritiesLending.daml`)**: Institutional stock loan contracts with borrow fees and recall options.
- **Margin (`Margin.daml`)**: Variation and initial margin calls with dispute resolution.
- **Escrow (`Escrow.daml`)**: Multi-party condition-based holding and release mechanisms.
- **Subscription (`Subscription.daml`)**: Institutional private credit and fund subscriptions.
- **Redemption (`Redemption.daml`)**: Liquidity redemption requests and approval flows.
- **Transfer (`Transfer.daml`)**: Multi-signatory asset transfers subject to compliance approval.
- **Pledge (`Pledge.daml`)**: Security interests and collateral pledges with perfection references.
