# End-of-Day Ledger & Custody Reconciliation Interfaces

## 1. Executive Summary & Purpose

In institutional digital asset infrastructure, **Canton Network** acts as the definitive golden source for synchronized state, bilateral agreements, and atomic settlement. However, regulated banks, asset managers, and broker-dealers must operate alongside traditional off-ledger systems:
- **Core Banking General Ledgers (GL)**: Internal fiat deposit systems (e.g. SAP Banking, FIS, Temenos).
- **Custody Books of Record (BoR)**: Internal securities accounting databases.
- **External Financial Infrastructure**: Central Securities Depositories (DTCC, Euroclear), Central Bank Reserve Accounts (Fedwire, Target2), and Correspondent Nostro Accounts.

To satisfy supervisory requirements under **BCBS 239** (Risk Data Aggregation), **SEC Rule 17a-13** (Quarterly Security Counts), and **FINRA Rule 4330** (Customer Protection / Segregation), institutions must execute continuous and end-of-day (EOD) automated reconciliation.

This specification details the mathematical invariants, three-way reconciliation topology, break taxonomy, file schemas, and automated discrepancy resolution procedures for AryaFi Core.

---

## 2. Three-Way Reconciliation Topology

```
                   ┌────────────────────────────────────────┐
                   │        Canton On-Ledger State          │
                   │   Active Contract Set (ACS) Snapshot   │
                   │  - CashPosition (Amount, isLocked)     │
                   │  - SecurityPosition (Quantity, ISIN)   │
                   └───────────────────┬────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│     Internal Bank Ledger (BoR)       ││    External CSD / Central Bank       │
│  - Core Banking General Ledger       ││  - Fedwire Central Bank Reserves    │
│  - Internal Custody Safekeeping DB   ││  - DTCC / Euroclear Omnibus Account  │
│  - Nostro / Vostro Cash Ledger       ││  - Custodian Sub-Account Holdings    │
└──────────────────────────────────────┘└──────────────────────────────────────┘
                    ▲                                     ▲
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │  AryaFi Automated EOD       │
                        │  Reconciliation Engine      │
                        └─────────────────────────────┘
```

---

## 3. Mathematical Invariants & Balance Proofs

### 3.1 Cash Balance Conservation Invariant
For every institutional currency $c \in \text{Currencies}$ and account $a \in \text{Accounts}$ serviced by bank $B$:

$$\text{OnLedgerCash}(a, c) = \text{InternalGLBalance}(a, c) \pm \Delta_{\text{InFlight}}(a, c)$$

Where:
- $\text{OnLedgerCash}(a, c) = \sum \text{CashPosition.amount}$ where $\text{accountId} = a \land \text{currency} = c$.
- $\text{InternalGLBalance}(a, c)$ is the cleared balance recorded in the core banking ledger.
- $\Delta_{\text{InFlight}}(a, c)$ represents pending, un-cleared `PaymentInstruction` contracts initiated prior to the ledger cutoff timestamp $T_{\text{cutoff}}$.

### 3.2 Securities Custody Invariant
For every security identifier $s \in \text{ISINs}$ and safekeeping account $a \in \text{Accounts}$:

$$\text{OnLedgerQuantity}(a, s) \equiv \text{InternalBoRQuantity}(a, s)$$

$$\sum_{a \in \text{OmnibusAccounts}} \text{OnLedgerQuantity}(a, s) = \text{ExternalCSDQuantity}(s)$$

### 3.3 Encumbrance / Collateral Invariant
For any position encumbered as collateral or staged for settlement:

$$\text{OnLedgerLockedCash}(a, c) \equiv \text{OffLedgerLienHold}(a, c)$$

$$\text{OnLedgerLockedSecurity}(a, s) \equiv \text{OffLedgerPledgedQuantity}(a, s)$$

---

## 4. Break Taxonomy & Classification

When the reconciliation engine detects a divergence between Canton on-ledger state and off-ledger records, it classifies the incident into one of four severity tiers:

| Break Category | Severity | Description | Root Cause | Automated Resolution Strategy |
|:---|:---|:---|:---|:---|
| **Timing / In-Flight Break** | `LOW` | Contract executed on Canton near EOD cutoff, but corresponding SWIFT message or batch GL update has not yet posted. | Network latency or differing batch clearing windows. | Engine checks timestamp against cutoff window; auto-resolves if cleared within $T + 30\text{ min}$. |
| **Rounding / Decimal Break** | `MEDIUM` | Sub-cent fractional difference (e.g. $\$0.0001$) between Canton high-precision decimals (up to 10 decimal places) and 2-decimal core banking systems. | Truncation differences in legacy accounting systems. | Automatically posted to an institutional "Penny Break / Tolerance Reserve" ledger if within configured tolerance threshold ($< \$0.05$). |
| **Encumbrance Mismatch** | `HIGH` | Contract is marked `isLocked = True` on Canton, but external core banking system shows funds as available for withdrawal (or vice versa). | Missed webhook notification from Canton `LockCash` event. | Trigger real-time lock synchronization; prevent withdrawal on core banking platform until aligned. |
| **Quantity / Value Break** | `CRITICAL` | Discrepancy between on-ledger total units and external CSD or bank general ledger balances. | Unregistered external movement, failed atomic leg rollback, or duplicate entry. | Immediate hard halt on automated processing for the affected account; alerts sent to Treasury Compliance & Custody Operations. |

---

## 5. Automated EOD Reconciliation Workflow

```
Time: 17:00:00 EST (Official Market Cutoff)
                     │
                     ▼
  [Step 1: Point-in-Time Snapshot Acquisition]
  - Canton ACS snapshot captured at exact ledger offset token
  - Core Banking general ledger snapshot frozen
  - CSD MT535 / semt.002 statement ingested
                     │
                     ▼
  [Step 2: Normalization & Primary Key Hashing]
  - Key: Hash(Entity, AccountId, AssetType, Currency/ISIN)
  - Values normalized to standard 4-decimal institutional precision
                     │
                     ▼
  [Step 3: Algorithmic Matching Engine]
  - Compare Total Quantity, Available Quantity, and Encumbered Quantity
  - Tag matches with Status: RECONCILED
                     │
                     ▼
  [Step 4: Break Isolation & Automated Triage]
  - If delta == 0.0 -> Auto-certify statement
  - If delta > tolerance -> Generate Incident Report & Audit Event
                     │
                     ▼
  [Step 5: Output Generation]
  - Publish certified Reconciliation Statement (JSON/CSV)
  - Store cryptographic proof of ACS snapshot in audit archive
```

---

## 6. Discrepancy Reporting Schema

### 6.1 Machine-Readable JSON Schema (`reconciliation_report.json`)
```json
{
  "reportId": "RECON-EOD-2026-09-18-001",
  "asOfTimestamp": "2026-09-18T17:00:00Z",
  "ledgerOffset": "000000000000004a8b34",
  "reportingInstitution": "DeutscheBankGTB_Participant",
  "summary": {
    "totalAccountsReconciled": 142,
    "matchedAccounts": 140,
    "unmatchedBreaks": 2,
    "totalNetDiscrepancyUsd": 12.50
  },
  "discrepancies": [
    {
      "breakId": "BRK-20260918-01",
      "accountId": "ACC-US-OPS-001",
      "assetIdentifier": "USD",
      "assetClass": "CashDeposit",
      "onLedgerBalance": "10000000.0000",
      "offLedgerBalance": "10000012.5000",
      "delta": "-12.5000",
      "category": "Timing / In-Flight Break",
      "severity": "LOW",
      "inFlightReferences": [
        "IDEMP-2026-09-18-0042"
      ],
      "status": "Investigating"
    }
  ]
}
```

### 6.2 Flat CSV Schema for Core Banking Ingestion (`eod_reconciliation.csv`)
```csv
ReportId,AsOfDate,AccountId,AssetId,OnLedgerAmount,OffLedgerAmount,Delta,EncumberedOnLedger,EncumberedOffLedger,Status
RECON-20260918,2026-09-18,ACC-HQ-CONCENTRATION-01,USD,25000000.0000,25000000.0000,0.0000,0.0000,0.0000,MATCHED
RECON-20260918,2026-09-18,ACC-SUB-US-01,USD,10000000.0000,10000000.0000,0.0000,0.0000,0.0000,MATCHED
RECON-20260918,2026-09-18,ACC-SUB-EU-01,EUR,20000000.0000,20000000.0000,0.0000,0.0000,0.0000,MATCHED
RECON-20260918,2026-09-18,ACC-CUSTODY-DTC-01,US912828ZM50,5000000.0000,5000000.0000,0.0000,5000000.0000,5000000.0000,MATCHED
```

---

## 7. Audit Certification & Regulatory Ingestion

At the close of each reconciliation cycle, the reconciliation engine computes a SHA-256 digest of the combined on-ledger ACS state and off-ledger ledger dump:

$$\text{AuditDigest} = \text{SHA256}(\text{ACS\_Snapshot} \parallel \text{GL\_Snapshot} \parallel T_{\text{cutoff}})$$

This digest is committed to the regulatory reporting stream via `RegulatoryReporting` contracts, giving supervisors (e.g. Federal Reserve, OCC, BaFin) a digest they can recompute from the retained snapshots to confirm the reconciliation inputs were not altered afterwards. The digest proves the inputs are unchanged, not that the balances are correct; that still depends on the reconciliation itself.
