// Copyright (c) 2026 Aryaverse. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * AryaFi Core: Interactive Institutional Digital Asset Terminal & Canton Explorer
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initTopologyVisualizer();
  initScenarioSimulator();
  initInvariantCalculator();
  initIsoConverter();
  initDamlViewer();
  initTelemetryCounters();
  initCopyButtons();
});

// ============================================================================
// 1. Theme Management (Dark / Light Mode)
// ============================================================================

function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const toggleLabel = document.getElementById('theme-toggle-label');
  const toggleIcon = document.getElementById('theme-toggle-icon');

  const savedTheme = localStorage.getItem('aryafi-theme') || 'dark';
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      localStorage.setItem('aryafi-theme', newTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (toggleLabel && toggleIcon) {
      if (theme === 'dark') {
        toggleLabel.textContent = 'Light';
        toggleIcon.textContent = '☼';
      } else {
        toggleLabel.textContent = 'Dark';
        toggleIcon.textContent = '◐';
      }
    }
  }
}

// ============================================================================
// 2. Navigation, ARIA Tab Switching & URL Hash Support
// ============================================================================

function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  function switchTab(targetTabId, updateHash = true) {
    const targetBtn = document.querySelector(`.nav-tab-btn[data-tab="${targetTabId}"]`);
    const targetPane = document.getElementById(targetTabId);

    if (!targetBtn || !targetPane) return;

    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
      t.setAttribute('tabindex', '-1');
    });

    panes.forEach(p => p.classList.remove('active'));

    targetBtn.classList.add('active');
    targetBtn.setAttribute('aria-selected', 'true');
    targetBtn.setAttribute('tabindex', '0');
    targetPane.classList.add('active');

    if (updateHash) {
      const hash = targetTabId.replace('tab-', '');
      history.replaceState(null, '', `#${hash}`);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');
      switchTab(targetTabId, true);
    });

    // Keyboard accessibility (ArrowLeft, ArrowRight)
    tab.addEventListener('keydown', (e) => {
      let nextIndex = null;
      if (e.key === 'ArrowRight') {
        nextIndex = (index + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      }

      if (nextIndex !== null) {
        tabs[nextIndex].focus();
        const targetTabId = tabs[nextIndex].getAttribute('data-tab');
        switchTab(targetTabId, true);
      }
    });
  });

  // Handle Initial Hash
  if (window.location.hash) {
    const hash = window.location.hash.replace('#', '');
    const candidateTabId = `tab-${hash}`;
    if (document.getElementById(candidateTabId)) {
      switchTab(candidateTabId, false);
    }
  }
}

// ============================================================================
// 3. Canton Network Topology Explorer
// ============================================================================

const PARTICIPANT_NODES = {
  bank: {
    id: "bank_node",
    name: "Federal Reserve Bank (Cash Custodian)",
    role: "Central Cash Authority & Settlement Agent",
    port: "10012",
    hostedParties: ["FederalReserveBank", "USDCashAuthority"],
    fingerprint: "1220a4b7f8c1992e401b972e3650aa1b01c38e",
    activeContracts: 48,
    privacyBoundary: "Maintains full read visibility over tokenized USD CashPosition contracts and inter-bank clearing legs. Blind to corporate equity and fund commitments."
  },
  custodian: {
    id: "custodian_node",
    name: "Global Custodian (Safekeeping / CSD)",
    role: "Securities Intermediary & Asset Safekeeping",
    port: "10022",
    hostedParties: ["GlobalCustodian", "DTCDepository"],
    fingerprint: "12207b39a12c8491ef2300b9831a29f847d01e",
    activeContracts: 36,
    privacyBoundary: "Custody safekeeping visibility over US Treasury security positions (CUSIP/ISIN) and AssetPledge encumbrances. Blind to non-pledged fiat deposit pools."
  },
  dealerA: {
    id: "dealer_a_node",
    name: "Primary Dealer A (Goldman Sachs)",
    role: "Liquidity Provider & US Treasury Primary Dealer",
    port: "10032",
    hostedParties: ["DealerBankA", "GS_TreasuryDesk"],
    fingerprint: "122088f1c30291e0aa4719bb2345d901a83b4c",
    activeContracts: 29,
    privacyBoundary: "Observes only bilateral trades, loans, and repo positions where Dealer A is a signatory or buyer/seller. Zero visibility into Dealer B's balance sheet."
  },
  dealerB: {
    id: "dealer_b_node",
    name: "Primary Dealer B (Morgan Stanley)",
    role: "Institutional Counterparty & Borrower",
    port: "10042",
    hostedParties: ["DealerBankB", "MS_PrimeBrokerage"],
    fingerprint: "12209d81e3a24b01aa5820cc9412f810b27e99",
    activeContracts: 24,
    privacyBoundary: "Strict cryptographic isolation: Dealer B cannot observe Dealer A's funding rates, cash positions, or internal sweeps. Only bilateral DvP trades are visible."
  },
  regulator: {
    id: "regulator_node",
    name: "SEC & Supervisory Authority",
    role: "Regulatory Audit & CAT Observer",
    port: "10052",
    hostedParties: ["SECRegulator", "FINRA_Auditor"],
    fingerprint: "12203e87b21a8849aa019283fbc0192847a901",
    activeContracts: 142,
    privacyBoundary: "Receives automated certified transaction audit events (SEC CAT / TRACE) and compliance attestations. Blind to unshared proprietary trading book strategies."
  }
};

function initTopologyVisualizer() {
  const nodeElements = document.querySelectorAll('.node-group');

  nodeElements.forEach(node => {
    node.addEventListener('click', () => {
      const nodeKey = node.getAttribute('data-node');
      const details = PARTICIPANT_NODES[nodeKey];
      if (!details) return;

      nodeElements.forEach(n => n.classList.remove('selected'));
      node.classList.add('selected');

      updateNodeDetailsCard(details);
    });
  });
}

function updateNodeDetailsCard(data) {
  document.getElementById('node-detail-title').textContent = data.name;
  document.getElementById('node-detail-id').textContent = data.id;
  document.getElementById('node-detail-role').textContent = data.role;
  document.getElementById('node-detail-port').textContent = `localhost:${data.port} (gRPC / JSON)`;
  document.getElementById('node-detail-parties').textContent = data.hostedParties.join(', ');
  document.getElementById('node-detail-fp').textContent = data.fingerprint;
  document.getElementById('node-detail-contracts').textContent = `${data.activeContracts} Active Contracts`;
  document.getElementById('node-detail-privacy').textContent = data.privacyBoundary;
}

// ============================================================================
// 4. Multi-Party Scenario Simulator
// ============================================================================

const SCENARIOS = {
  dvp: {
    title: "Tokenized US Treasury + Cash DvP",
    desc: "Atomic cross-asset Delivery-versus-Payment between primary dealers with SEC CAT regulatory reporting.",
    steps: [
      {
        title: "Compliance Onboarding & Pre-Gating",
        desc: "Dealer A & Dealer B pass automated KYC Attestation and OFAC Sanctions screening. Eligibility policy gates trade.",
        log: "2026-09-24T10:00:01Z [COMPLIANCE] KYCAttestation verified for DealerBankA & DealerBankB (Status: Verified, Expiry: 2027-09-01). SanctionsCheck clean."
      },
      {
        title: "Dual Position Lockup & Escrow Staging",
        desc: "Seller locks 5M US Treasury 4.25% 2034; Buyer locks $5,000,000 USD tokenized cash with Global Custodian & Federal Reserve Bank.",
        log: "2026-09-24T10:00:03Z [LEDGER] Exercise LockSecurity on SecurityPosition(US912828ZM24, Qty: 5,000,000). Exercise LockCash on CashPosition(USD, Amt: 5,000,000.00)."
      },
      {
        title: "DvpInstruction Tri-Party Co-Signature",
        desc: "Seller, Buyer, and Settlement Agent co-sign atomic DvpInstruction with unique CorrelationId and settlement deadline.",
        log: "2026-09-24T10:00:05Z [CANTON] submitMulti [DealerBankA, DealerBankB, DTCCSettlementAgent] -> Created DvpInstruction(#001:2, Status: PendingDvp)."
      },
      {
        title: "Atomic DvP Execution & Ownership Transfer",
        desc: "Settlement Agent triggers ExecuteDvp: Security transfers to Buyer, Cash transfers to Seller atomically in a single Canton transaction commit.",
        log: "2026-09-24T10:00:07Z [SETTLEMENT] ExecuteDvp committed! SecurityPosition transferred to DealerBankB; CashPosition transferred to DealerBankA. Zero delivery risk."
      },
      {
        title: "SEC CAT Regulatory Report Emission",
        desc: "Regulatory reporting engine generates CAT trade audit report; SECRegulator node acknowledges transaction.",
        log: "2026-09-24T10:00:09Z [REGULATOR] SEC CAT Trade Report submitted to SECRegulator node. Acknowledged: CAT-ACK-2026-US912828ZM24-001. Lifecycle Closed."
      }
    ]
  },
  seclend: {
    title: "Institutional Securities Lending Lifecycle",
    desc: "Stock loan with 102% cash collateral pledge, Act360 borrow fee accrual, recall execution, and pro-rata collateral release.",
    steps: [
      {
        title: "Tri-Party Lending Agreement & Collateral Pledge",
        desc: "Pension Fund lends 5M par value Treasuries to Broker-Dealer; Borrower pledges $5.1M (102% cash collateral) via AssetPledge.",
        log: "2026-09-24T10:00:01Z [SECLEND] Created SecuritiesLendingAgreement (BorrowQty: 5M, FeeRate: 75 bps, Collateral: $5,100,000 USD). Pledge linked."
      },
      {
        title: "Periodic Borrow Fee Accrual (Act360)",
        desc: "Lender accrues lending fees for 30 elapsed days ($5,000,000 × 0.75% × 30/360 = $3,125.00).",
        log: "2026-09-24T10:00:03Z [FINANCE] Exercise AccrueLendingFee. Accrued Fee: $3,125.00 USD. Borrower executes PayLendingFee via CashPosition transfer."
      },
      {
        title: "Mark-to-Market Collateral Revaluation",
        desc: "Underlying bond price appreciates; counterparties revalue collateral to maintain 102% margin coverage.",
        log: "2026-09-24T10:00:05Z [MARGIN] Exercise RevalueCollateral. Updated Market Value: $5,050,000. Collateral adjusted to $5,151,000 USD."
      },
      {
        title: "Recall Issuance & Pro-Rata Return",
        desc: "Lender issues formal recall for 2.5M securities; Borrower returns securities and Custodian releases $2.575M cash collateral.",
        log: "2026-09-24T10:00:07Z [RECALL] Exercise RecallSecurities (Qty: 2,500,000). ReturnSecurities executed -> Collateral released pro-rata."
      },
      {
        title: "Final Return & Agreement Closeout",
        desc: "Borrower returns remaining balance; SecuritiesLendingAgreement transitions to LendingClosed; full lien discharged.",
        log: "2026-09-24T10:00:09Z [CLOSEOUT] Final securities returned. Status transitioned to LendingClosed. AssetPledge permanently archived."
      }
    ]
  },
  treasury: {
    title: "Treasury Cash Mobility & Zero-Balance Sweep",
    desc: "Multi-entity account topology, surplus cash identification, zero-balance sweep to master pool, and intercompany SWIFT clearing.",
    steps: [
      {
        title: "Multi-Entity Cash Account Setup",
        desc: "Operating accounts created at Global Bank for US Subsidiary ($25M USD) and EU Subsidiary (20M EUR). Master Pool initialized.",
        log: "2026-09-24T10:00:01Z [TREASURY] Created Account ACC-US-OPS ($25M USD), ACC-EU-OPS (20M EUR), and ACC-HQ-CONCENTRATION ($10M USD)."
      },
      {
        title: "Surplus Identification via SplitCash",
        desc: "US Subsidiary splits $15M surplus cash from operating working capital ($10M retained locally).",
        log: "2026-09-24T10:00:03Z [FINANCE] SplitCash executed: Position A ($10M retained in US ops) + Position B ($15M marked for concentration sweep). Sum invariant holds."
      },
      {
        title: "Concentration Sweep & Pool Consolidation",
        desc: "US Subsidiary transfers $15M to Treasury HQ concentration pool; HQ calls MergeCash to create $25M master liquidity pool.",
        log: "2026-09-24T10:00:05Z [SWEEP] TransferCash to TreasuryHQ completed. MergeCash consolidated pool balance to $25,000,000.00 USD."
      },
      {
        title: "Intercompany PaymentInstruction & SWIFT UETR Tracing",
        desc: "Treasury HQ issues $8M funding payment instruction; Settlement Agent attaches SWIFT UETR tracking reference.",
        log: "2026-09-24T10:00:07Z [PAYMENT] PaymentInstruction created with IdempotencyKey IDEMP-2026-09-24-01. Attached UETR: e1a49f82-3d92-4f10-bf91-b3b281f9a12c."
      },
      {
        title: "Payment Clearing & Atomic Settlement",
        desc: "Global Bank confirms clearing; funds are transferred atomically to beneficiary subsidiary with sub-transaction privacy.",
        log: "2026-09-24T10:00:09Z [SETTLED] PaymentInstruction transitioned to Settled. EU Subsidiary and third-party competitors observe zero transaction details."
      }
    ]
  }
};

let currentScenarioKey = 'dvp';
let currentStepIndex = 0;
let autoRunTimer = null;

function initScenarioSimulator() {
  const scenarioBtns = document.querySelectorAll('.scenario-select-btn');
  const runNextBtn = document.getElementById('btn-run-next-step');
  const runAutoBtn = document.getElementById('btn-run-auto');
  const resetBtn = document.getElementById('btn-reset-scenario');

  scenarioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (autoRunTimer) clearInterval(autoRunTimer);
      scenarioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentScenarioKey = btn.getAttribute('data-scenario');
      currentStepIndex = 0;
      renderScenarioView();
    });
  });

  if (runNextBtn) {
    runNextBtn.addEventListener('click', () => {
      executeNextScenarioStep();
    });
  }

  if (runAutoBtn) {
    runAutoBtn.addEventListener('click', () => {
      runAutomatedScenario();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (autoRunTimer) clearInterval(autoRunTimer);
      currentStepIndex = 0;
      renderScenarioView();
      clearTerminal();
    });
  }

  renderScenarioView();
}

function renderScenarioView() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (!scenario) return;

  document.getElementById('scenario-active-title').textContent = scenario.title;
  document.getElementById('scenario-active-desc').textContent = scenario.desc;

  const timelineContainer = document.getElementById('timeline-steps-container');
  timelineContainer.innerHTML = '';

  scenario.steps.forEach((step, idx) => {
    const isCompleted = idx < currentStepIndex;
    const isActive = idx === currentStepIndex;

    const stepEl = document.createElement('div');
    stepEl.className = `timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;
    stepEl.innerHTML = `
      <div class="timeline-step-icon">${isCompleted ? '✓' : idx + 1}</div>
      <div class="timeline-step-body">
        <div class="timeline-step-header">
          <span class="timeline-step-title">${step.title}</span>
          <span class="timeline-step-badge ${isCompleted ? 'badge-done' : (isActive ? 'badge-active' : 'badge-pending')}">
            ${isCompleted ? 'EXECUTED' : (isActive ? 'READY' : 'PENDING')}
          </span>
        </div>
        <p class="timeline-step-desc">${step.desc}</p>
      </div>
    `;
    timelineContainer.appendChild(stepEl);
  });
}

function executeNextScenarioStep() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (currentStepIndex >= scenario.steps.length) {
    appendTerminalLine("Scenario lifecycle fully executed. Click Reset to run again.", "yellow");
    return;
  }

  const step = scenario.steps[currentStepIndex];
  appendTerminalLine(`Executing Phase ${currentStepIndex + 1}: ${step.title}...`, "cyan");
  appendTerminalLine(step.log, "green");

  currentStepIndex++;
  renderScenarioView();
}

function runAutomatedScenario() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (autoRunTimer) clearInterval(autoRunTimer);

  currentStepIndex = 0;
  renderScenarioView();
  clearTerminal();

  appendTerminalLine(`Initiating automated execution: ${scenario.title}`, "yellow");

  let step = 0;
  autoRunTimer = setInterval(() => {
    if (step < scenario.steps.length) {
      executeNextScenarioStep();
      step++;
    } else {
      clearInterval(autoRunTimer);
      autoRunTimer = null;
      appendTerminalLine("All phases committed and verified with zero errors.", "green");
    }
  }, 900);
}

function appendTerminalLine(text, colorClass = "cyan") {
  const terminal = document.getElementById('scenario-terminal-output');
  if (!terminal) return;

  const line = document.createElement('div');
  line.className = `terminal-line ${colorClass}`;
  line.textContent = `> ${text}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearTerminal() {
  const terminal = document.getElementById('scenario-terminal-output');
  if (terminal) {
    terminal.innerHTML = `
      <div class="terminal-line gray">> Canton Ledger API connected to aryafi_domain...</div>
      <div class="terminal-line green">> Ready. Select a scenario and click 'Next Phase' or 'Auto-Run' to begin execution.</div>
    `;
  }
}

// ============================================================================
// 5. Mathematical Invariant Calculator (Cash Split & Merge)
// ============================================================================

function initInvariantCalculator() {
  const totalInput = document.getElementById('calc-total-amount');
  const splitInput = document.getElementById('calc-split-amount');
  const splitBtn = document.getElementById('btn-execute-split');
  const presetBtns = document.querySelectorAll('.calc-preset-btn');

  function calculateAndDisplay() {
    const total = parseFloat(totalInput.value);
    const split = parseFloat(splitInput.value);

    if (isNaN(total) || isNaN(split) || total <= 0 || split <= 0 || split >= total) {
      alert("Split amount must be strictly positive and strictly less than total position amount.");
      return;
    }

    const remainder = total - split;
    const sum = split + remainder;

    document.getElementById('calc-pos1-val').textContent = `$${split.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('calc-pos2-val').textContent = `$${remainder.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('calc-sum-val').textContent = `$${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const delta = Math.abs(sum - total);
    const statusEl = document.getElementById('calc-invariant-status');
    if (delta < 0.0001) {
      statusEl.textContent = "VERIFIED (Δ = 0.00)";
      statusEl.className = "calc-stat-val emerald";
    } else {
      statusEl.textContent = `LEAKAGE DETECTED (Δ = ${delta.toFixed(4)})`;
      statusEl.className = "calc-stat-val rose";
    }
  }

  if (splitBtn && totalInput && splitInput) {
    splitBtn.addEventListener('click', calculateAndDisplay);
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-total');
      const s = btn.getAttribute('data-split');
      if (t && s) {
        totalInput.value = t;
        splitInput.value = s;
        calculateAndDisplay();
      }
    });
  });
}

// ============================================================================
// 6. ISO 20022 Financial Messaging Converter
// ============================================================================

const ISO_TEMPLATES = {
  pacs008: {
    name: "pacs.008.001.10 (Customer Credit Transfer)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>IDEMP-2026-09-24-0042</MsgId>
      <CreDtTm>2026-09-24T10:15:30Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>CORR-REPO-2026-8831</EndToEndId>
        <UETR>e1a49f82-3d92-4f10-bf91-b3b281f9a12c</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="USD">12500000.00</IntrBkSttlmAmt>
      <Dbtr><Nm>Goldman Sachs Primary Dealer</Nm></Dbtr>
      <DbtrAcct><Id><Othr><Id>ACC-GS-USD-001</Id></Othr></Id></DbtrAcct>
      <Cdtr><Nm>BNY Mellon Global Custody</Nm></Cdtr>
      <CdtrAcct><Id><Othr><Id>ACC-BNY-CUSTODY-USD-001</Id></Othr></Id></CdtrAcct>
      <Purp><Cd>REPO</Cd></Purp>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    daml: `{
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
          "amount": "12500000.00",
          "purpose": { "RepoOpeningLeg": {} },
          "obligationRef": "REPO-REF-2026-GS-BNY-001",
          "correlationId": "CORR-REPO-2026-8831",
          "idempotencyKey": "IDEMP-2026-09-24-0042",
          "networkRef": "SWIFT-UETR-e1a49f82-3d92-4f10-bf91-b3b281f9a12c",
          "status": { "PendingSettlement": {} }
        }
      }
    }
  ]
}`
  },
  sese023: {
    name: "sese.023.001.10 (DvP Settlement Instruction)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:sese.023.001.10">
  <SctiesSttlmTxInstr>
    <TxDtls>
      <SttlmTxId>DVP-2026-TREAS-001</SttlmTxId>
      <FinInstrmId><ISIN>US912828ZM24</ISIN></FinInstrmId>
      <SttlmQty><Qty><Unit>5000000.00</Unit></Qty></SttlmQty>
      <SttlmAmt Ccy="USD">5000000.00</SttlmAmt>
      <SttlmPties>
        <DlvgPty><FinInstnId><LEI>5493006MHB84DD0ZWV18</LEI></FinInstnId></DlvgPty>
        <RcvgPty><FinInstnId><LEI>W22LROWP2IHZNBB6K528</LEI></FinInstnId></RcvgPty>
      </SttlmPties>
    </TxDtls>
  </SctiesSttlmTxInstr>
</Document>`,
    daml: `{
  "commands": [
    {
      "create": {
        "templateId": "AryaFi.Finance.Settlement:DvpInstruction",
        "arguments": {
          "dvpId": "DVP-2026-TREAS-001",
          "seller": "DealerBankA",
          "buyer": "DealerBankB",
          "settlementAgent": "DTCCSettlementAgent",
          "isin": "US912828ZM24",
          "securityQuantity": "5000000.00",
          "cashAmount": "5000000.00",
          "currency": "USD",
          "status": { "PendingDvp": {} }
        }
      }
    }
  ]
}`
  },
  camt053: {
    name: "camt.053.001.10 (Bank-to-Customer Statement)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.10">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>STMT-2026-09-24-001</MsgId><CreDtTm>2026-09-24T18:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-EOD-FED-01</Id>
      <Acct><Id><Othr><Id>ACC-US-OPS-001</Id></Othr></Id><Ccy>USD</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="USD">25000000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2026-09-24</Dt></Dt>
      </Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>`,
    daml: `{
  "query": {
    "templateId": "AryaFi.Finance.Cash:CashPosition",
    "predicate": {
      "accountId": "ACC-US-OPS-001",
      "currency": "USD",
      "expectedClosingBalance": "25000000.00"
    }
  }
}`
  },
  semt002: {
    name: "semt.002.001.10 (Custody Holding Statement)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:semt.002.001.10">
  <SctiesBalAcctgRpt>
    <StmtGnlDtls><StmtId>CUST-EOD-2026-09-24</StmtId></StmtGnlDtls>
    <FinInstrmDtls>
      <Id><ISIN>US912828ZM24</ISIN></Id>
      <AggrtBal>
        <Qty><Unit>10000000.00</Unit></Qty>
        <HldgSts><Cd>AVLB</Cd></HldgSts>
      </AggrtBal>
    </FinInstrmDtls>
  </SctiesBalAcctgRpt>
</Document>`,
    daml: `{
  "query": {
    "templateId": "AryaFi.Finance.Security:SecurityPosition",
    "predicate": {
      "isin": "US912828ZM24",
      "isLocked": false,
      "expectedSafekeepingUnits": "10000000.00"
    }
  }
}`
  }
};

function initIsoConverter() {
  const select = document.getElementById('iso-msg-select');
  const xmlDisplay = document.getElementById('iso-xml-display');
  const damlDisplay = document.getElementById('iso-daml-display');

  if (!select || !xmlDisplay || !damlDisplay) return;

  function render(key) {
    const template = ISO_TEMPLATES[key];
    if (template) {
      xmlDisplay.textContent = template.xml;
      damlDisplay.textContent = template.daml;
    }
  }

  select.addEventListener('change', () => {
    render(select.value);
  });

  render(select.value);
}

// ============================================================================
// 7. Daml Code Dossier Interactive Viewer
// ============================================================================

const DAML_MODULES = {
  cash: {
    title: "AryaFi/Finance/Cash.daml (Tokenized Cash Primitive)",
    code: `module AryaFi.Finance.Cash where

import AryaFi.Common.Identifiers (AccountId, CorrelationId)
import AryaFi.Common.Types (Amount, Currency)
import AryaFi.Common.Errors (require, requirePositive, requireNonEmpty)

template CashPosition
  with
    bank          : Party
    owner         : Party
    accountId     : AccountId
    currency      : Currency
    amount        : Amount
    isLocked      : Bool
    lockReference : Optional Text
    observers     : [Party]
  where
    signatory bank, owner
    observer observers

    ensure amount > 0.0

    key (bank, accountId, currency) : (Party, AccountId, Currency)
    maintainer key._1

    choice SplitCash : (ContractId CashPosition, ContractId CashPosition)
      with
        splitAmount : Amount
      controller owner
      do
        require (not isLocked) "Cannot split a locked cash position"
        requirePositive splitAmount "splitAmount"
        require (splitAmount < amount) ("Split amount must be strictly less than total " <> show amount)
        c1 <- create this with amount = splitAmount
        c2 <- create this with amount = amount - splitAmount
        pure (c1, c2)

    choice MergeCash : ContractId CashPosition
      with
        otherCid : ContractId CashPosition
      controller owner
      do
        require (not isLocked) "Cannot merge: this position is locked"
        other <- fetch otherCid
        require (other.bank == bank) "Bank mismatch"
        require (other.owner == owner) "Owner mismatch"
        require (other.currency == currency) "Currency mismatch"
        archive otherCid
        create this with amount = amount + other.amount`
  },
  security: {
    title: "AryaFi/Finance/Security.daml (Safekeeping & Encumbrance)",
    code: `module AryaFi.Finance.Security where

import AryaFi.Common.Identifiers (AccountId, ISIN, CUSIP)
import AryaFi.Common.Types (Amount, Rate)
import AryaFi.Common.Errors (require, requirePositive)

template SecurityPosition
  with
    custodian         : Party
    issuer            : Party
    owner             : Party
    accountId         : AccountId
    isin              : ISIN
    cusip             : Optional CUSIP
    instrumentName    : Text
    quantity          : Amount
    couponRate        : Optional Rate
    maturityTimestamp : Optional Time
    isLocked          : Bool
    lockReference     : Optional Text
    observers         : [Party]
  where
    signatory custodian, owner
    observer observers

    ensure quantity > 0.0

    key (custodian, accountId, isin) : (Party, AccountId, ISIN)
    maintainer key._1

    choice LockSecurity : ContractId SecurityPosition
      with
        lockRef       : Text
        lockingParty  : Party
      controller owner, custodian
      do
        require (not isLocked) "Security is already locked"
        create this with isLocked = True, lockReference = Some lockRef`
  },
  collateral: {
    title: "AryaFi/Finance/Collateral.daml (Haircut & Margin Revaluation)",
    code: `module AryaFi.Finance.Collateral where

import AryaFi.Common.Types (Amount, Rate, Currency, AssetClass)
import AryaFi.Common.Identifiers (AccountId, ISIN, ExternalRef)
import AryaFi.Common.Errors (require, requirePositive, requireNonNegative)

data CollateralStatus
  = Allocated | Active | Substituted | Released | Liquidated | InDispute
  deriving (Eq, Ord, Show)

template CollateralPosition
  with
    collateralProvider : Party
    collateralReceiver : Party
    custodian          : Party
    accountId          : AccountId
    assetClass         : AssetClass
    isin               : ISIN
    quantity           : Amount
    marketValue        : Amount
    haircut            : Rate
    settlementCurrency : Currency
    obligationRef      : Text
    lockReference      : Text
    status             : CollateralStatus
    externalRef        : Optional ExternalRef
    observers          : [Party]
  where
    signatory collateralProvider, collateralReceiver, custodian
    observer observers

    ensure quantity > 0.0 && marketValue > 0.0 && haircut >= 0.0 && haircut < 1.0

    nonconsuming choice GetCollateralValue : Amount
      controller custodian
      do pure (marketValue * (1.0 - haircut))

    choice RevalueCollateral : ContractId CollateralPosition
      with
        newMarketValue : Amount
        newQuantity    : Amount
      controller custodian
      do
        requirePositive newMarketValue "newMarketValue"
        create this with marketValue = newMarketValue, quantity = newQuantity`
  },
  loan: {
    title: "AryaFi/Contracts/Loan.daml (Institutional Credit Facility)",
    code: `module AryaFi.Contracts.Loan where

import AryaFi.Common.Types (Amount, Rate, Currency, DayCountConvention(..))
import AryaFi.Common.Time (calcYearFraction)
import AryaFi.Common.Errors (require, requirePositive)

data LoanStatus = LoanActive | LoanDefaulted | LoanClosed
  deriving (Eq, Show)

template InstitutionalLoan
  with
    facilityId         : Text
    lender             : Party
    borrower           : Party
    creditLimit        : Amount
    outstandingBalance : Amount
    accruedInterest    : Amount
    interestRate       : Rate
    dayCountConvention : DayCountConvention
    lastAccrualTime    : Time
    currency           : Currency
    status             : LoanStatus
    collateralPledgeId : Optional Text
    observers          : [Party]
  where
    signatory lender, borrower
    observer observers

    choice Drawdown : ContractId InstitutionalLoan
      with
        drawAmount : Amount
      controller borrower
      do
        require (status == LoanActive) "Loan is not active"
        require (outstandingBalance + drawAmount <= creditLimit) "Facility limit exceeded"
        create this with outstandingBalance = outstandingBalance + drawAmount`
  },
  repo: {
    title: "AryaFi/Contracts/Repo.daml (Repurchase Agreement)",
    code: `module AryaFi.Contracts.Repo where

import AryaFi.Common.Types (Amount, Rate, Currency)
import AryaFi.Common.Identifiers (ISIN)
import AryaFi.Common.Errors (require, requirePositive)

data RepoStatus = RepoInitiated | RepoActive | RepoSettled | RepoDefaulted
  deriving (Eq, Show)

template RepoAgreement
  with
    repoId             : Text
    seller             : Party
    buyer              : Party
    tripartyAgent      : Optional Party
    isin               : ISIN
    collateralQuantity : Amount
    currency           : Currency
    purchasePrice      : Amount
    repurchasePrice    : Amount
    repoRate           : Rate
    startDate          : Time
    endDate            : Time
    status             : RepoStatus
  where
    signatory seller, buyer

    choice CloseoutRepo : ()
      controller seller, buyer
      do pure ()`
  },
  transfer: {
    title: "AryaFi/Compliance/TransferRestrictions.daml (Reg D, Reg S, Rule 144A)",
    code: `module AryaFi.Compliance.TransferRestrictions where

import AryaFi.Common.Identifiers (ISIN)
import AryaFi.Common.Errors (require)

data RegulatoryCategory
  = RegD_506c | RegS | Rule144A | QualifiedPurchaserOnly | RetailUnrestricted
  deriving (Eq, Show)

template TransferRestrictionRule
  with
    complianceOfficer  : Party
    isin               : ISIN
    regulatoryCategory : RegulatoryCategory
    holdingPeriodDays  : Int
    whitelistRequired  : Bool
    lockupExpiry       : Optional Time
    isActive           : Bool
  where
    signatory complianceOfficer

    key (complianceOfficer, isin) : (Party, ISIN)
    maintainer key._1

    nonconsuming choice IsTransferAllowed : Bool
      controller complianceOfficer
      do
        if not isActive then pure False
        else case lockupExpiry of
          None   -> pure True
          Some t -> do
            now <- getTime
            pure (now >= t)`
  }
};

function initDamlViewer() {
  const select = document.getElementById('daml-file-select');
  const title = document.getElementById('daml-viewer-title');
  const content = document.getElementById('daml-viewer-content');

  if (!select || !title || !content) return;

  function render(key) {
    const mod = DAML_MODULES[key];
    if (mod) {
      title.textContent = mod.title;
      content.textContent = mod.code;
    }
  }

  select.addEventListener('change', () => {
    render(select.value);
  });

  render(select.value);
}

// ============================================================================
// 8. Clipboard Copy Buttons
// ============================================================================

function initCopyButtons() {
  function handleCopy(btnId, targetElId) {
    const btn = document.getElementById(btnId);
    const target = document.getElementById(targetElId);
    if (!btn || !target) return;

    btn.addEventListener('click', async () => {
      try {
        const text = target.textContent;
        await navigator.clipboard.writeText(text);
        const origText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = origText;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
      }
    });
  }

  handleCopy('btn-copy-xml', 'iso-xml-display');
  handleCopy('btn-copy-daml', 'iso-daml-display');
  handleCopy('btn-copy-source', 'daml-viewer-content');
  handleCopy('btn-copy-log', 'scenario-terminal-output');
}

// ============================================================================
// 9. Live Telemetry Tickers
// ============================================================================

function initTelemetryCounters() {
  let volume = 85000000;
  const volEl = document.getElementById('ticker-volume');

  setInterval(() => {
    volume += Math.floor(Math.random() * 25000);
    if (volEl) {
      volEl.textContent = `$${(volume / 1000000).toFixed(2)}M`;
    }
  }, 4000);
}
