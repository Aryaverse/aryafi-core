# AryaFi Integration Testing Framework

This directory contains integration test suites and harnesses designed to run against live or local multi-participant Canton test networks.

## Overview
Integration testing validates the end-to-end behavior of the AryaFi contract ecosystem across distributed Canton participant nodes, verifying:
- Multi-party sub-transaction privacy.
- Canton sequencer and domain synchronization.
- JSON Ledger API and gRPC endpoint interactions.
- Off-chain orchestrators, adapters, and compliance hooks.

## Running Canton Integration Tests
1. Start local Canton sandbox environment:
   ```bash
   canton -c canton-local.conf
   ```
2. Deploy `aryafi-core.dar` across the participant nodes.
3. Run integration runners:
   ```bash
   daml script --dar .daml/dist/aryafi-core-0.1.0.dar --script-name AryaFi.Test.Scenarios.DvpTreasuryScenario:dvpTreasuryScenario --ledger-host localhost --ledger-port 6865
   ```
