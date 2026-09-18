# ISO 20022 Financial Messaging Mapping Specifications

## 1. Executive Summary & Context

As institutional financial markets modernize their core infrastructure, **ISO 20022** has emerged as the universal data standard for wholesale payments, cross-border banking, securities clearing, and trade reporting. Global settlement systems—including **SWIFT CBPR+**, the Federal Reserve's **Fedwire Funds Service**, the European Central Bank's **T2 / TARGET2**, and clearing utilities (**DTCC**, **Euroclear**) have mandated or completed migration to ISO 20022 XML syntax.

The **AryaFi Core** Daml library models multi-party atomic rights, encumbrances, and settlement lifecycles over **Canton Network**. However, external institutional ledger nodes (custodian banks, broker-dealers, central securities depositories) must exchange instructions with legacy core banking and messaging gateways. 

This specification establishes the canonical bidirectional field mapping between ISO 20022 message definitions and AryaFi Daml primitives:
1. **Payments & Cash Movement**: `PaymentInstruction` $\longleftrightarrow$ `pacs.008` / `pacs.009`
2. **Account Balance Reporting**: `CashPosition` $\longleftrightarrow$ `camt.053` / `camt.054`
3. **Custody Holdings Reporting**: `SecurityPosition` $\longleftrightarrow$ `semt.002`
4. **Delivery-versus-Payment (DvP)**: `DvpInstruction` $\longleftrightarrow$ `sese.023` / `sese.025`

---

## 2. Integration Architecture

```
  Legacy Financial Rail                       AryaFi Gateway                         Canton Network
┌────────────────────────┐              ┌────────────────────────┐              ┌──────────────────────┐
│  SWIFT Alliance /      │              │  ISO 20022 Integration │              │  Canton Ledger API   │
│  Fedwire / TARGET2     │<──XML MT/MX─>│  Adapter Engine        │<──gRPC/JSON─>│  (Daml Contracts)    │
│  Messaging Gateway     │              │  (Validation & Mapping)│              │                      │
└────────────────────────┘              └────────────────────────┘              └──────────────────────┘
            │                                       │                                       │
            │  1. Inbound pacs.008                  │                                       │
            │──────────────────────────────────────>│  2. submitMulti create               │
            │                                       │     PaymentInstruction                │
            │                                       │──────────────────────────────────────>│
            │                                       │                                       │
            │                                       │  3. Event Stream: Settled             │
            │                                       │<──────────────────────────────────────│
            │  4. Outbound pacs.002 / camt.054      │                                       │
            │<──────────────────────────────────────│                                       │
```

---

## 3. Mapping: `PaymentInstruction` $\longleftrightarrow$ `pacs.008` / `pacs.009`

The `pacs.008.001.10` (*FI to FI Customer Credit Transfer*) and `pacs.009.001.10` (*Financial Institution Credit Transfer*) carry institutional payment obligations. `PaymentInstruction` isolates the multi-party intent from the operational settlement.

### 3.1 Field-by-Field Mapping Table

| AryaFi Field (`PaymentInstruction`) | ISO 20022 Element Path (`pacs.008` / `pacs.009`) | Type / Format | Transformation & Validation Rules |
|:---|:---|:---|:---|
| `idempotencyKey` | `GrpHdr/MsgId` (or `CdtTrfTxInf/PmtId/EndToEndId`) | `Max35Text` | Invariant: must be unique per transaction. Used to deduplicate ledger command submissions. |
| `networkRef` (`PaymentNetworkRef`) | `CdtTrfTxInf/PmtId/UETR` | `UUIDv4` (36 chars) | SWIFT Unique End-to-End Transaction Reference (UETR). Attached via `AttachNetworkRef`. |
| `correlationId` | `CdtTrfTxInf/PmtId/InstrId` | `Max35Text` | Multi-leg transaction correlation ID across composite workflows (e.g. DvP, Repo). |
| `payer` | `CdtTrfTxInf/DbtrAgt/FinInstnId/BICFI` (or `LEI`) | `Party` | Canton participant Party ID mapped from BIC / LEI identifier registry. |
| `payerAccountId` | `CdtTrfTxInf/DbtrAcct/Id/Othr/Id` (or `IBAN`) | `AccountId` | Debtor account identifier held at custodian/bank. |
| `payee` | `CdtTrfTxInf/CdtrAgt/FinInstnId/BICFI` (or `LEI`) | `Party` | Canton participant Party ID of the beneficiary financial institution. |
| `payeeAccountId` | `CdtTrfTxInf/CdtrAcct/Id/Othr/Id` (or `IBAN`) | `AccountId` | Beneficiary account identifier held at receiving institution. |
| `settlementAgent` | `GrpHdr/SttlmInf/SttlmMtd` / `InstgRmbrsmntAgt` | `Party` | Canton settlement authority (e.g., correspondent bank, central clearing agent). |
| `amount` | `CdtTrfTxInf/IntrBkSttlmAmt` | `Decimal` (18, 4) | High-precision transfer amount. Must be strictly positive ($> 0.0$). |
| `currency` | `CdtTrfTxInf/IntrBkSttlmAmt/@Ccy` | ISO 4217 (3 chars) | E.g., `USD`, `EUR`, `GBP`, `SGD`. Must match account denomination. |
| `purpose` | `CdtTrfTxInf/Purp/Cd` | `PaymentPurpose` | See Purpose Mapping Table below. |
| `obligationRef` | `CdtTrfTxInf/RmtInf/Ustrd` | `Optional Text` | Up to 140 chars unstructured remittance / underlying contract reference. |
| `status` | Derived from Choice / Lifecycle | `SettlementStatus` | `PendingSettlement` $\to$ `pacs.002` (Pending), `Settled` $\to$ `pacs.002` (ACCP). |

### 3.2 Payment Purpose Code Mappings

| ISO 20022 External Purpose Code | AryaFi `PaymentPurpose` Variant | Workflow Context |
|:---|:---|:---|
| `LOAN` / `COLL` | `LoanDisbursement` / `LoanRepayment` | Credit facility drawdown or term loan principal repayment |
| `INTR` | `InterestPayment` | Periodic loan, repo, or debt instrument coupon servicing |
| `REPO` | `RepoOpeningLeg` / `RepoClosingLeg` | Repurchase agreement opening funding or closing repurchase leg |
| `MARG` | `MarginPayment` | Variation margin or initial margin transfer |
| `SECU` / `DVPP` | `DvpCashLeg` | Delivery-versus-Payment cash leg paired with security transfer |
| `FEES` / `COMM` | `FeePayment` | Custody, agent lending, or administration fees |
| `DIVI` | `DividendPayment` | Cash dividend distribution to security holder |
| `OTHR` | `GeneralPayment Text` | General corporate treasury or vendor disbursement |

---

## 4. Mapping: `CashPosition` $\longleftrightarrow$ `camt.053` / `camt.054`

The `camt.053.001.10` (*Bank to Customer Statement*) provides electronic reporting of end-of-day balances and locked reserves. The `camt.054.001.10` (*Debit / Credit Notification*) provides real-time event updates.

### 4.1 Field-by-Field Mapping Table

| AryaFi Field (`CashPosition`) | ISO 20022 Element Path (`camt.053`) | Transformation / Description |
|:---|:---|:---|
| `bank` | `Stmt/Acct/Svcr/FinInstnId/BICFI` | Account servicer (issuing bank or central bank). |
| `owner` | `Stmt/Acct/Ownr/Id/OrgId/AnyBIC` | Account owner / beneficial holder on ledger. |
| `accountId` | `Stmt/Acct/Id/Othr/Id` | Unique account reference at the servicer bank. |
| `currency` | `Stmt/Bal/Amt/@Ccy` | Currency denomination (e.g. `USD`). |
| `amount` | `Stmt/Bal/Amt` | Cleared available or booked balance. |
| `isLocked` | `Stmt/Bal/Tp/CdOrPrtry/Cd` | If `False` $\to$ `CLAV` (Closing Available). If `True` $\to$ `INFO` / `BLCK` (Blocked / Encumbered). |
| `lockReference` | `Stmt/Bal/Desc` | Contract ID or legal escrow reference encumbering funds. |

---

## 5. Mapping: `SecurityPosition` $\longleftrightarrow$ `semt.002`

The `semt.002.001.07` (*Custody Statement of Holdings*) reports institutional positions held at central securities depositories (CSDs) and custodian banks.

### 5.1 Field-by-Field Mapping Table

| AryaFi Field (`SecurityPosition`) | ISO 20022 Element Path (`semt.002`) | Transformation / Description |
|:---|:---|:---|
| `custodian` | `StmtGnlDtls/SfkpgPlc/LEI` | Custodian institution holding legal custody of the asset. |
| `owner` | `StmtGnlDtls/AcctOwnr/Id/OrgId/LEI` | Institutional beneficial owner or dealer entity. |
| `accountId` | `StmtGnlDtls/SfkpgAcct/Id` | Safekeeping account identifier. |
| `isin` | `FinInstrmDtls/FinInstrmId/ISIN` | ISO 6166 International Securities Identification Number. |
| `cusip` | `FinInstrmDtls/FinInstrmId/OthrId/Id` | CUSIP security identifier (for US domestic markets). |
| `quantity` | `FinInstrmDtls/HldgDtls/AggtQty/Qty/Unit` | Number of units / par value held on ledger. |
| `isLocked` | `FinInstrmDtls/HldgDtls/AggtQty/Qty/Unit` + Tag | Flagged under Blocked Holdings if encumbered for DvP/repo. |
| `lockReference` | `FinInstrmDtls/HldgDtls/BlckdDtls/Rsn` | Instruction ID causing the custody hold. |

---

## 6. Mapping: `DvpInstruction` $\longleftrightarrow$ `sese.023` / `sese.025`

The `sese.023.001.10` (*Securities Settlement Transaction Instruction*) triggers Delivery-versus-Payment settlement. Upon atomic execution on Canton, a `sese.025.001.10` (*Settlement Transaction Confirmation*) is emitted to both counterparties.

### 6.1 Field-by-Field Mapping Table

| AryaFi Field (`DvpInstruction`) | ISO 20022 Element Path (`sese.023` / `sese.025`) | Transformation / Description |
|:---|:---|:---|
| `dvpId` | `TxDtls/SttlmTxId` | Unique DvP transaction reference identifier. |
| `seller` | `TxDtls/SttlmPties/DlvgPty/FinInstnId/LEI` | Delivering party (transferring security, receiving cash). |
| `buyer` | `TxDtls/SttlmPties/RcvgPty/FinInstnId/LEI` | Receiving party (receiving security, delivering cash). |
| `settlementAgent` | `TxDtls/SttlmPties/SttlmPty/FinInstnId/BICFI` | Central settlement agency orchestrating atomic exchange. |
| `isin` | `TxDtls/FinInstrmId/ISIN` | Traded security identifier (ISO 6166). |
| `securityQuantity` | `TxDtls/SttlmQty/Qty/Unit` | Total units of security transferred upon execution. |
| `cashAmount` | `TxDtls/SttlmAmt/Amt` | Cash consideration transferred upon delivery. |
| `currency` | `TxDtls/SttlmAmt/Amt/@Ccy` | Currency of payment consideration. |
| `status` | `TxDtls/Sts/Sttld` | Status transition: `PendingDvp` $\to$ `DvpSettled`. |

---

## 7. Sample Payloads

### 7.1 Inbound ISO 20022 `pacs.008` XML Snippet
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>IDEMP-2026-09-18-0042</MsgId>
      <CreDtTm>2026-09-18T10:15:30Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>CORR-REPO-2026-8831</EndToEndId>
        <UETR>e1a49f82-3d92-4f10-bf91-b3b281f9a12c</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">12500000.00</IntrBkSttlmAmt>
      <Dbtr>
        <Nm>Goldman Sachs Primary Dealer</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <Othr>
            <Id>ACC-GS-USD-001</Id>
          </Othr>
        </Id>
      </DbtrAcct>
      <Cdtr>
        <Nm>BNY Mellon Global Custody</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>ACC-BNY-CUSTODY-USD-001</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <Purp>
        <Cd>REPO</Cd>
      </Purp>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>
```

### 7.2 Resulting Daml Command (JSON Ledger API Format)
```json
{
  "commands": [
    {
      "create": {
        "templateId": "AryaFi.Finance.Payment:PaymentInstruction",
        "arguments": {
          "payer": "GoldmanSachs_Participant",
          "payee": "BnyMellon_Participant",
          "settlementAgent": "DTCC_Participant",
          "payerAccountId": "ACC-GS-USD-001",
          "payeeAccountId": "ACC-BNY-CUSTODY-USD-001",
          "currency": "USD",
          "amount": "12500000.0",
          "purpose": { "RepoOpeningLeg": {} },
          "obligationRef": "REPO-REF-2026-GS-BNY-001",
          "correlationId": "CORR-REPO-2026-8831",
          "idempotencyKey": "IDEMP-2026-09-18-0042",
          "networkRef": "SWIFT-UETR-e1a49f82-3d92-4f10-bf91-b3b281f9a12c",
          "status": { "PendingSettlement": {} },
          "observers": ["FederalReserve_Participant"]
        }
      }
    }
  ]
}
```
