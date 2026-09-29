# AryaFi Integration Tests

`ComplianceContractIntegrationTest.daml` verifies cross-module workflows (compliance policies with transfers, DvP settlement, secured lending with obligations and pledges) on a single ledger. It runs as part of `daml test`.

## Running Scenarios Against the Local Canton Topology

The five-participant Canton 2.10 topology in `deploy/` can run the scenario scripts that do not call `setTime` (for example the DvP suites), with all of a script's parties allocated on one participant:

```bash
# 1. Build the DAR (uploaded automatically by the topology's bootstrap)
daml build

# 2. Start the topology
cd deploy/docker && docker compose up -d --build && cd ../..

# 3. Run a scenario against the bank participant's Ledger API
daml script \
  --dar .daml/dist/aryafi-core-1.0.0.dar \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:runTreasuryDvpScenario \
  --ledger-host localhost \
  --ledger-port 10012

daml script \
  --dar .daml/dist/aryafi-core-1.0.0.dar \
  --script-name AryaFi.Test.Scenarios.DvpSettlementTest:runDvpSettlementTests \
  --ledger-host localhost \
  --ledger-port 10012
```

Both scripts have been run successfully this way against Canton 2.10.

## Not Yet Covered

- **Cross-participant workflows.** A test where the seller, buyer, and settlement agent are hosted on different participants needs propose/accept templates, because parties on different participants cannot co-submit. See [KNOWN_LIMITATIONS.md](../../../../../docs/KNOWN_LIMITATIONS.md) and [IMPROVEMENT_PLAN.md](../../../../../docs/IMPROVEMENT_PLAN.md).
- **Scripts that set ledger time** (loan accrual, margin deadlines) only run on the Daml test ledger, which supports static time.
