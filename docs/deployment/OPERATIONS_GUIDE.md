# Canton Participant Node Operations & Key Management Guide

## 1. Executive Summary & Production Architecture

This operations manual governs the deployment, maintenance, security hardening, and disaster recovery of **Canton Participant Nodes** running the **AryaFi Core** institutional smart contract library.

In a production Canton deployment, each regulated legal entity (e.g. Central Bank, Custodian, Broker-Dealer, Asset Manager) operates its own participant node infrastructure. A participant node stores the private Active Contract Set (ACS) for its hosted parties, executes local transaction validation, generates zero-knowledge / cryptographic commitment proofs, and connects to one or more shared Canton synchronization domains.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       Participant Node Production Architecture                         │
│                                                                                        │
│   ┌──────────────────────────┐                    ┌────────────────────────────────┐   │
│   │   Application Gateway    │                    │     Hardware Security Module   │   │
│   │   (mTLS / OAuth2 IdP)    │                    │     (HSM / AWS KMS / Vault)    │   │
│   └────────────┬─────────────┘                    └────────────────▲───────────────┘   │
│                │                                                   │                   │
│                ▼                                                   │ Signing Keys      │
│   ┌────────────────────────────────────────────────────────────────┴───────────────┐   │
│   │                      Canton Participant Node Daemon                            │   │
│   │   - Ledger API Server (gRPC / JSON)        - Transaction Engine                │   │
│   │   - Sub-transaction Privacy Validator     - ACS Active State Store            │   │
│   └────────────────────────────┬───────────────────────────────────────────────────┘   │
│                                │                                                       │
│                ┌───────────────┴───────────────┐                                       │
│                ▼                               ▼                                       │
│   ┌─────────────────────────┐     ┌────────────────────────┐                           │
│   │ PostgreSQL Primary DB   │     │ Canton Synchronization │                           │
│   │ (State & Audit Records) │     │ Domain (Sequencer/Med) │                           │
│   └─────────────────────────┘     └────────────────────────┘                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware Security Module (HSM) & Key Management Service (KMS)

In institutional banking environments, raw private keys must never exist in plaintext on disk or in system memory. Canton supports Hardware Security Modules (via PKCS#11) and cloud KMS providers for cryptographic operations.

### 2.1 Key Classification & Cryptographic Standards

| Key Type | Usage | Recommended Algorithm | Rotation Policy | Storage Tier |
|:---|:---|:---|:---|:---|
| **Namespace Key** | Establishes the participant's unique cryptographic identity (`Fingerprint`). | `Ed25519` or `ECDSA P-256` | Static (Lifetime of Node) | FIPS 140-2 Level 3 / Cold HSM |
| **Signing Key** | Signs transaction proposals, confirmations, and administrative operations. | `Ed25519` | Annual / On Compromise | AWS CloudHSM / Azure Dedicated HSM |
| **Encryption Key** | Decrypts incoming multi-party transaction payloads routed via the sequencer. | `ECIES P-256` or `RSA-OAEP 2048+` | Biannual | Cloud KMS / PKCS#11 HSM |
| **Ledger API TLS Key** | Secures mTLS transport between enterprise clients and the Ledger API. | `RSA 4096` or `ECDSA P-384` | 90 Days | Vault / Automated ACME |

### 2.2 Sample AWS KMS Configuration (`canton-kms.conf`)
```hocon
canton.participants.bank_node.crypto {
  provider = kms
  kms {
    type = aws
    region = "us-east-1"
    key-id-namespace = "arn:aws:kms:us-east-1:123456789012:key/b63c8a91-..."
    key-id-signing = "arn:aws:kms:us-east-1:123456789012:key/c84d9b02-..."
    key-id-encryption = "arn:aws:kms:us-east-1:123456789012:key/d95e0c13-..."
  }
}
```

---

## 3. High Availability (HA) & Disaster Recovery (DR)

### 3.1 Active-Passive Participant Redundancy
For Tier-1 financial institutions requiring 99.999% availability:
1. **Primary Active Node**: Processes client transactions, executes command submissions, and validates domain sequencing.
2. **Standby Passive Node**: Continuously replicates PostgreSQL state via synchronous streaming replication.
3. **Automated Failover**: In the event of primary node failure, a virtual IP / load balancer directs traffic to the standby node, which acquires the Canton database lock and resumes Ledger API serving within $< 15$ seconds.

### 3.2 Backup & Point-in-Time Recovery (PITR)
- **Continuous Archiving**: PostgreSQL Write-Ahead Logs (WAL) are streamed continuously to encrypted multi-region object storage (S3 / Azure Blob Storage).
- **Daily Snapshots**: Automated daily physical database snapshots executed at EOD cutoff.
- **Recovery Time Objective (RTO)**: $< 30$ minutes.
- **Recovery Point Objective (RPO)**: 0 (synchronous database durability).

---

## 4. Active Contract Set (ACS) Pruning & State Maintenance

As financial operations execute millions of contract transitions (e.g. daily split, merge, and loan drawdown events), archived contracts accumulate in the database.

### 4.1 Automated Pruning Protocol
Canton provides an automated pruning service that safely removes archived contracts older than a specified retention window without breaking auditability:

```scala
// Execute ACS pruning via Canton Console
val retentionWindow = java.time.Duration.ofDays(90)
val pruneUpTo = java.time.Instant.now().minus(retentionWindow)

// Verify no open transactions or un-reconciled offsets
participants.bank_node.pruning.prune_internally(pruneUpTo)
```

- **Audit Preservation**: Prior to pruning, ensure all archived transaction events have been successfully streamed and indexed into the enterprise cold data warehouse or compliance audit store.

---

## 5. Telemetry, Monitoring & Alerting

Canton exposes Prometheus metrics and OpenTelemetry tracing endpoints on port `9090`.

### 5.1 Critical Monitoring Alerts

| Metric Name | Threshold | Description & Action |
|:---|:---|:---|
| `daml_ledger_api_command_duration_seconds` | $> 5.0\text{s}$ (p99) | High command submission latency. Check domain sequencer connection and DB load. |
| `canton_node_active_contracts` | Steady unexpected spike | Indicates possible unarchived contract leak or delayed settlement workflows. |
| `canton_db_storage_free_bytes` | $< 20\%$ | Low storage warning. Expand PostgreSQL disk volume immediately. |
| `canton_domain_mediator_response_timeouts` | $> 0$ in $5\text{m}$ | Mediator communication failure. Risk of transaction aborts across the domain. |

---

## 6. Runbook: Deploying a New Daml Archive (DAR) Upgrade

When releasing upgraded contract templates or bug fixes:
1. Compile and inspect the new DAR:
   ```bash
   daml build
   daml damlc inspect-dar .daml/dist/aryafi-core-1.0.0.dar
   ```
2. Upload to the standby/passive node first, followed by the active node:
   ```scala
   participants.all.dars.upload(".daml/dist/aryafi-core-1.0.0.dar")
   ```
3. Verify successful validation in the Canton console:
   ```scala
   participants.bank_node.dars.list()
   ```
4. Update client API gateway to reference the new package ID for subsequent contract creation commands. Existing active contracts continue executing under their original package IDs until transitioned via contract upgrade choices.
