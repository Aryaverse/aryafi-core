# AryaFi Integration Tests

`ComplianceContractIntegrationTest.daml` verifies cross-module workflows (compliance policies with transfers, DvP settlement, secured lending with obligations and pledges) on a single ledger. It runs as part of `dpm test`.

## Running Scenarios Against the Local Canton Topology

The five-participant Canton 3.5 topology in `deploy/` can run the scenario scripts that do not call `setTime` (for example the DvP suites), with all of a script's parties allocated on one participant:

```bash
# 1. Build both packages (the topology's bootstrap uploads the production DAR)
dpm build --all

# 2. Start the topology
cd deploy/docker && docker compose up -d --build && cd ../..

# 3. Run a scenario against the bank participant's Ledger API; --upload-dar
#    uploads the test DAR to that participant first
dpm script \
  --dar daml/test/.daml/dist/aryafi-core-test-3.0.0.dar \
  --upload-dar=yes \
  --script-name AryaFi.Test.Scenarios.TreasuryDvpScenario:runTreasuryDvpScenario \
  --ledger-host localhost \
  --ledger-port 10012

dpm script \
  --dar daml/test/.daml/dist/aryafi-core-test-3.0.0.dar \
  --upload-dar=yes \
  --script-name AryaFi.Test.Scenarios.DvpSettlementTest:runDvpSettlementTests \
  --ledger-host localhost \
  --ledger-port 10012
```

Both scripts pass this way against Canton 3.5.19, and CI runs them on every push (`canton-topology` job). A Canton 3 ledger rejects allocating the same party name twice in one run, so each DvP test allocates parties with its own suffix.

## Not Yet Covered

- **Cross-participant workflows.** A test where the seller, buyer, and settlement agent are hosted on different participants needs propose/accept templates, because parties on different participants cannot co-submit. See [KNOWN_LIMITATIONS.md](../../../../../docs/KNOWN_LIMITATIONS.md) and [IMPROVEMENT_PLAN.md](../../../../../docs/IMPROVEMENT_PLAN.md).
- **Scripts that set ledger time** (loan accrual, margin deadlines) only run on the Daml test ledger, which supports static time.
