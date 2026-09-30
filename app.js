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
  initCollateralCalculator();
  initIsoConverter();
  initDamlViewer();
  initCopyButtons();
  initKeyboardShortcuts();
});

// ============================================================================
// 1. Theme Management (Dark / Light Mode)
// ============================================================================

function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle-btn');
  const toggleLabel = document.getElementById('theme-toggle-label');
  const toggleIcon = document.getElementById('theme-toggle-icon');

  const savedTheme = localStorage.getItem('aryafi-theme') || 'light';
  applyTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
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

function initKeyboardShortcuts() {
  const modal = document.getElementById('shortcuts-modal');
  const openBtn = document.getElementById('shortcuts-toggle-btn');
  const closeBtn = document.getElementById('btn-close-shortcuts');
  const themeToggle = document.getElementById('theme-toggle-btn');
  const tabIds = ['tab-topology', 'tab-simulator', 'tab-contracts', 'tab-iso', 'tab-security', 'tab-docs'];

  if (openBtn && modal) {
    openBtn.addEventListener('click', () => modal.showModal());
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.close());
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        modal.close();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    // Ignore keystrokes when typing inside inputs, textareas, selects
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return;
    }

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      if (modal) {
        if (modal.open) {
          modal.close();
        } else {
          modal.showModal();
        }
      }
    } else if (e.key >= '1' && e.key <= '6') {
      const idx = parseInt(e.key, 10) - 1;
      const targetTabId = tabIds[idx];
      const targetBtn = document.querySelector(`.nav-tab-btn[data-tab="${targetTabId}"]`);
      if (targetBtn) {
        targetBtn.click();
      }
    } else if (e.key === 't' || e.key === 'T') {
      if (themeToggle) {
        themeToggle.click();
      }
    } else if (e.key === 'r' || e.key === 'R') {
      const runBtn = document.getElementById('btn-run-scenario');
      if (runBtn && !runBtn.disabled) {
        runBtn.click();
      }
    }
  });
}

// ============================================================================
// 3. Canton Network Topology Explorer
// ============================================================================

// Mirrors deploy/canton/canton.conf and deploy/docker/bootstrap.sh: one
// organization per participant node. Party namespaces are generated when the
// topology is bootstrapped, so none are shown here.
const PARTICIPANT_NODES = {
  bank: {
    id: "bank_node",
    name: "Cash Settlement Bank",
    role: "Tokenized Deposit Issuer (CashPosition bank)",
    port: "10012",
    hostedParties: ["CashSettlementBank"],
    fingerprint: "Assigned at bootstrap",
    stores: "CashPosition contracts it issued; PaymentInstructions where it is settlement agent",
    privacyBoundary: "Stores only contracts where the bank is a stakeholder: the cash positions it issued. It does not see securities positions, loans, or repo agreements it is not party to."
  },
  custodian: {
    id: "custodian_node",
    name: "Global Custodian / Settlement Agent",
    role: "Securities Safekeeping & DvP Settlement Agent",
    port: "10022",
    hostedParties: ["GlobalCustodian"],
    fingerprint: "Assigned at bootstrap",
    stores: "SecurityPositions in custody; DvpInstructions and positions locked to it for settlement",
    privacyBoundary: "Sees security positions it safekeeps, plus cash positions only while they are locked to it as DvP lock holder. Visibility ends when the lock is released or settled."
  },
  dealerA: {
    id: "dealer_a_node",
    name: "Dealer Bank A",
    role: "Seller of US Treasuries",
    port: "10032",
    hostedParties: ["DealerBankA"],
    fingerprint: "Assigned at bootstrap",
    stores: "Its own positions and the bilateral agreements it signed",
    privacyBoundary: "Sees only contracts where Dealer A is signatory or observer. It never sees Dealer B's cash position or the Treasury after delivery to Dealer B."
  },
  dealerB: {
    id: "dealer_b_node",
    name: "Dealer Bank B",
    role: "Buyer of US Treasuries",
    port: "10042",
    hostedParties: ["DealerBankB"],
    fingerprint: "Assigned at bootstrap",
    stores: "Its own positions and the bilateral agreements it signed",
    privacyBoundary: "Sees only contracts where Dealer B is signatory or observer. It never sees Dealer A's security position or the cash after payment to Dealer A."
  },
  regulator: {
    id: "regulator_node",
    name: "Supervisory Authority",
    role: "Regulatory Observer",
    port: "10052",
    hostedParties: ["SupervisoryAuthority"],
    fingerprint: "Assigned at bootstrap",
    stores: "Only contracts it was explicitly added to as an observer, e.g. RegulatoryReportRecords",
    privacyBoundary: "Has no default visibility. Sees a contract only when the counterparties add it as observer, which on bilateral agreements requires both counterparties' consent."
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
  document.getElementById('node-detail-contracts').textContent = data.stores;
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
        desc: "The KYC authority and sanctions screener attest Dealer A and Dealer B; each attesting authority checks validity at ledger time. The eligibility policy approves the asset.",
        log: "2026-09-24T10:00:01Z [COMPLIANCE] KycAttestation IsKycValid = True for DealerBankA & DealerBankB (expiry 2027-09-01). SanctionsAttestation IsSanctionsClear = True. EligibilityPolicy -> Approved."
      },
      {
        title: "Dual Position Lockup & Escrow Staging",
        desc: "Seller locks the 5M face US Treasury; buyer splits out exactly $4,975,000 and locks it. Both locks are held by the settlement agent, so neither leg can be withdrawn.",
        log: "2026-09-24T10:00:03Z [LEDGER] LockSecurity(US912828ZM50, Qty 5,000,000, holder: SettlementAgent). SplitCash 5,000,000 -> 4,975,000 + 25,000. LockCash(USD 4,975,000.00, holder: SettlementAgent)."
      },
      {
        title: "DvpInstruction Tri-Party Co-Signature",
        desc: "Seller, buyer, and settlement agent co-sign the DvpInstruction naming the ISIN, quantity, consideration, accounts, and lock references.",
        log: "2026-09-24T10:00:05Z [LEDGER] Created DvpInstruction(TRD-US-TREAS-4P25-NOV26-001, Model 1, Status: PendingSettlement) signed by DealerBankA, DealerBankB, SettlementAgent."
      },
      {
        title: "Atomic DvP Execution & Ownership Transfer",
        desc: "ExecuteDvpSettlement validates both locked legs against the instruction, then delivers the Treasury to the buyer and the cash to the seller in one transaction. Any mismatch aborts both legs.",
        log: "2026-09-24T10:00:07Z [SETTLEMENT] ExecuteDvpSettlement: legs validated (owner, account, ISIN, qty, amount, lock holder, lock ref). SettleLockedSecurity -> DealerBankB; SettleLockedCash -> DealerBankA. Committed atomically."
      },
      {
        title: "Regulatory Report Submission",
        desc: "The seller records a RegulatoryReportRecord under the SEC CAT regime; the regulator, an observer on that record only, acknowledges it.",
        log: "2026-09-24T10:00:09Z [REGULATOR] RegulatoryReportRecord(SEC_CAT) created by DealerBankA. AcknowledgeReport by SupervisoryAuthority. isAcknowledged = True."
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
        desc: "Lender and borrower jointly agree the 30-day fee ($5,000,000 × 0.75% × 30/360 = $3,125.00); the lender confirms receipt of payment.",
        log: "2026-09-24T10:00:03Z [FINANCE] AccrueLendingFee (lender + borrower): $3,125.00 USD. PayLendingFee confirmed by lender. Accrued fee balance: $0.00."
      },
      {
        title: "Mark-to-Market Collateral Revaluation",
        desc: "Underlying bond price appreciates; counterparties revalue collateral to maintain 102% margin coverage.",
        log: "2026-09-24T10:00:05Z [MARGIN] Exercise RevalueCollateral. Updated Market Value: $5,050,000. Collateral adjusted to $5,151,000 USD."
      },
      {
        title: "Recall Issuance & Pro-Rata Return",
        desc: "Lender recalls 2.5M securities; the borrower returns them and releases at most the pro-rata share of collateral ($2.5755M of $5.151M).",
        log: "2026-09-24T10:00:07Z [RECALL] RecallSecurities (Qty 2,500,000). ReturnSecurities 2,500,000 with collateral release 2,575,500 (pro-rata cap enforced). Recall satisfied."
      },
      {
        title: "Final Return & Agreement Closeout",
        desc: "Borrower returns remaining balance; SecuritiesLendingAgreement transitions to LendingClosed; full lien discharged.",
        log: "2026-09-24T10:00:09Z [CLOSEOUT] Final securities returned (borrowed quantity 0). Status transitioned to LendingClosed. AssetPledge released (status Closed)."
      }
    ]
  },
  treasury: {
    title: "Treasury Cash Mobility & Zero-Balance Sweep",
    desc: "Multi-entity account topology, surplus cash identification, zero-balance sweep to master pool, and intercompany SWIFT clearing.",
    steps: [
      {
        title: "Multi-Entity Cash Account Setup",
        desc: "Global Bank issues cash positions to the US Subsidiary ($25M USD), the EU Subsidiary (20M EUR), and the HQ concentration account ($10M USD).",
        log: "2026-09-24T10:00:01Z [TREASURY] Created CashPosition ACC-SUB-US-01 ($25M USD), ACC-SUB-EU-01 (20M EUR), ACC-HQ-CONCENTRATION-01 ($10M USD)."
      },
      {
        title: "Surplus Identification via SplitCash",
        desc: "US Subsidiary splits $15M surplus cash from operating working capital ($10M retained locally).",
        log: "2026-09-24T10:00:03Z [FINANCE] SplitCash executed: Position A ($10M retained in US ops) + Position B ($15M marked for concentration sweep). Sum invariant holds."
      },
      {
        title: "Concentration Sweep & Pool Consolidation",
        desc: "US Subsidiary, Global Bank, and Treasury HQ jointly authorize the $15M transfer; HQ merges it into a $25M master liquidity pool.",
        log: "2026-09-24T10:00:05Z [SWEEP] TransferCash (owner + bank + receiver) to TreasuryHQ. Observers cleared. MergeCash pool balance: $25,000,000.00 USD."
      },
      {
        title: "Intercompany PaymentInstruction & SWIFT UETR Tracing",
        desc: "Treasury HQ, the US Subsidiary, and Global Bank co-sign an $8M payment instruction; HQ locks $8M to Global Bank for the payment.",
        log: "2026-09-24T10:00:07Z [PAYMENT] PaymentInstruction created with IdempotencyKey IDEMP-2026-09-24-01. Attached UETR: e1a49f82-3d92-4f10-bf91-b3b281f9a12c."
      },
      {
        title: "Payment Clearing & Atomic Settlement",
        desc: "Global Bank, as lock holder, delivers the locked $8M to the US Subsidiary and confirms the payment instruction as settled.",
        log: "2026-09-24T10:00:09Z [SETTLED] SettleLockedCash -> USSubsidiary ($8,000,000.00). ConfirmPaymentSettlement: Settled. EU Subsidiary sees none of these contracts."
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
  const exportCsvBtn = document.getElementById('btn-export-audit-csv');
  const exportJsonBtn = document.getElementById('btn-export-audit-json');

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
      const latencyEl = document.getElementById('metric-latency');
      if (latencyEl) latencyEl.textContent = '-- ms';
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportScenarioAuditCsv();
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      exportScenarioAuditJson();
    });
  }

  renderScenarioView();
}

function renderScenarioView() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (!scenario) return;

  document.getElementById('scenario-active-title').textContent = scenario.title;
  document.getElementById('scenario-active-desc').textContent = scenario.desc;

  const pct = Math.round((currentStepIndex / scenario.steps.length) * 100);
  const progressBar = document.getElementById('sim-progress-bar');
  const progressLabel = document.getElementById('sim-progress-label');
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (progressLabel) progressLabel.textContent = `${pct}% Completed (Phase ${currentStepIndex} of ${scenario.steps.length})`;

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
  const progressEl = document.getElementById('metric-latency');
  if (progressEl) progressEl.textContent = `Step ${currentStepIndex + 1} of ${scenario.steps.length}`;

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

function exportScenarioAuditCsv() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (!scenario) return;

  let csv = 'ExportedAt,Scenario,PhaseIndex,PhaseTitle,SimulatedLedgerLog,SimulationStatus\n';
  scenario.steps.forEach((step, idx) => {
    const executed = idx < currentStepIndex;
    const logClean = step.log.replace(/"/g, '""');
    csv += `"${new Date().toISOString()}","${scenario.title}","${idx + 1}","${step.title}","${logClean}","${executed ? 'SIMULATED' : 'PENDING'}"\n`;
  });

  downloadFile(`aryafi_audit_${currentScenarioKey}_${Date.now()}.csv`, 'text/csv', csv);
  appendTerminalLine(`Exported simulation log: aryafi_audit_${currentScenarioKey}.csv`, "yellow");
}

function exportScenarioAuditJson() {
  const scenario = SCENARIOS[currentScenarioKey];
  if (!scenario) return;

  const data = {
    exportDate: new Date().toISOString(),
    disclaimer: "Scripted simulation. Log lines describe the Daml choices the AryaFi library executes in its test scenarios; no ledger was contacted and nothing here is an audit record.",
    platform: "Daml SDK 3.5.12 / Canton 3.5 (protocol version 35)",
    scenarioKey: currentScenarioKey,
    scenarioTitle: scenario.title,
    currentStepIndex: currentStepIndex,
    totalSteps: scenario.steps.length,
    phases: scenario.steps.map((s, idx) => ({
      phaseNumber: idx + 1,
      title: s.title,
      description: s.desc,
      ledgerLog: s.log,
      status: idx < currentStepIndex ? "SIMULATED" : "PENDING"
    }))
  };

  downloadFile(`aryafi_audit_${currentScenarioKey}_${Date.now()}.json`, 'application/json', JSON.stringify(data, null, 2));
  appendTerminalLine(`Exported simulation log (JSON): aryafi_audit_${currentScenarioKey}.json`, "yellow");
}

function downloadFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      <div class="terminal-line gray">> Scripted simulation of the library's Daml test scenarios (no ledger connection).</div>
      <div class="terminal-line green">> Ready. Select a scenario and click 'Next Phase' or 'Auto-Run' to begin execution.</div>
    `;
  }
}

// ============================================================================
// 5. SplitCash Conservation Illustration (exact Daml Decimal arithmetic)
// ============================================================================
// Daml's Decimal is a fixed-point number with 10 decimal places, so a split is
// exact. This mirrors that with BigInt arithmetic scaled by 10^10 (JavaScript
// floats would not be exact). It illustrates the rule SplitCash enforces on
// ledger; it does not inspect any ledger state.

const DECIMAL_SCALE = 10;
const DECIMAL_FACTOR = 10n ** BigInt(DECIMAL_SCALE);

function parseDamlDecimal(text) {
  const m = /^\s*(\d+)(?:\.(\d*))?\s*$/.exec(text || '');
  if (!m) return null;
  const frac = m[2] || '';
  if (frac.length > DECIMAL_SCALE) return null;
  return BigInt(m[1]) * DECIMAL_FACTOR + BigInt((frac + '0'.repeat(DECIMAL_SCALE)).slice(0, DECIMAL_SCALE));
}

function formatDamlDecimal(units) {
  const whole = units / DECIMAL_FACTOR;
  const cents = (units % DECIMAL_FACTOR) / (DECIMAL_FACTOR / 100n);
  return `$${whole.toLocaleString('en-US')}.${cents.toString().padStart(2, '0')}`;
}

function initInvariantCalculator() {
  const totalInput = document.getElementById('calc-total-amount');
  const splitInput = document.getElementById('calc-split-amount');
  const splitBtn = document.getElementById('btn-execute-split');
  const presetBtns = document.querySelectorAll('.calc-preset-btn');

  function calculateAndDisplay() {
    const total = parseDamlDecimal(totalInput.value);
    const split = parseDamlDecimal(splitInput.value);
    const statusEl = document.getElementById('calc-invariant-status');

    if (total === null || split === null) {
      statusEl.textContent = "REJECTED: amounts must be non-negative decimals with at most 10 decimal places";
      statusEl.className = "calc-stat-val rose";
      return;
    }
    if (split <= 0n || split >= total) {
      statusEl.textContent = "REJECTED by SplitCash: split must be > 0 and < position amount";
      statusEl.className = "calc-stat-val rose";
      return;
    }

    const remainder = total - split;
    const sum = split + remainder;

    document.getElementById('calc-pos1-val').textContent = formatDamlDecimal(split);
    document.getElementById('calc-pos2-val').textContent = formatDamlDecimal(remainder);
    document.getElementById('calc-sum-val').textContent = formatDamlDecimal(sum);

    if (sum === total) {
      statusEl.textContent = "CONSERVED (exact, Δ = 0)";
      statusEl.className = "calc-stat-val emerald";
    } else {
      statusEl.textContent = "NOT CONSERVED";
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

function initCollateralCalculator() {
  const assetSelect = document.getElementById('calc-collateral-asset');
  const loanInput = document.getElementById('calc-loan-exposure');
  const marginInput = document.getElementById('calc-margin-req');
  const calcBtn = document.getElementById('btn-calculate-margin');

  function updateMarginMatrix() {
    if (!assetSelect || !loanInput || !marginInput) return;

    const loan = parseFloat(loanInput.value) || 0;
    const marginPct = (parseFloat(marginInput.value) || 102) / 100;
    const selectedOption = assetSelect.options[assetSelect.selectedIndex];
    const haircut = parseFloat(selectedOption.getAttribute('data-haircut')) || 0.02;
    const hqla = selectedOption.getAttribute('data-hqla') || 'Level 1 HQLA';

    // Required Collateral = (Loan * MarginRatio) / (1 - Haircut)
    const requiredCollateral = (loan * marginPct) / (1 - haircut);
    const haircutDeduction = requiredCollateral * haircut;
    const marginCallThreshold = loan * marginPct;

    const reqColEl = document.getElementById('calc-required-collateral');
    const effHaircutEl = document.getElementById('calc-effective-haircut');
    const thresholdEl = document.getElementById('calc-margin-call-threshold');
    const lcrStatusEl = document.getElementById('calc-lcr-status');

    if (reqColEl) reqColEl.textContent = `$${requiredCollateral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (effHaircutEl) effHaircutEl.textContent = `$${haircutDeduction.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${(haircut * 100).toFixed(1)}%)`;
    if (thresholdEl) thresholdEl.textContent = `$${marginCallThreshold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (lcrStatusEl) lcrStatusEl.textContent = hqla;
  }

  if (calcBtn) calcBtn.addEventListener('click', updateMarginMatrix);
  if (assetSelect) assetSelect.addEventListener('change', updateMarginMatrix);
  if (loanInput) loanInput.addEventListener('input', updateMarginMatrix);
  if (marginInput) marginInput.addEventListener('input', updateMarginMatrix);

  updateMarginMatrix();
}

// ============================================================================
// 6. ISO 20022 Financial Messaging Converter
// ============================================================================
// The right-hand pane is a Canton 3.5 JSON Ledger API (v2) request body against
// the actual AryaFi templates: POST /v2/commands/submit-and-wait for payment
// and settlement instructions, POST /v2/state/active-contracts for statements.
// Template IDs use the package-name form (#aryafi-core:Module:Template).
// Arguments encode newtype identifiers (AccountId, ISIN, ...) as records,
// variants as {tag, value}, and enums as plain strings. Values in <angle
// brackets> are placeholders: Canton assigns party IDs when parties are
// allocated, and offsets come from GET /v2/state/ledger-end.
// Creating an instruction needs every signatory in actAs, so all of them must
// be hosted on the submitting participant (see docs/KNOWN_LIMITATIONS.md §4).

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
      <Dbtr><Nm>Dealer Bank A</Nm><Id><OrgId><LEI>529900DEALERBANKA078</LEI></OrgId></Id></Dbtr>
      <DbtrAcct><Id><Othr><Id>ACC-DLRA-USD-001</Id></Othr></Id></DbtrAcct>
      <Cdtr><Nm>Global Custodian</Nm><Id><OrgId><LEI>529900GLOBALCUST0063</LEI></OrgId></Id></Cdtr>
      <CdtrAcct><Id><Othr><Id>ACC-CUST-USD-001</Id></Othr></Id></CdtrAcct>
      <Purp><Cd>REPO</Cd></Purp>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`,
    daml: `{
  "commands": [
    {
      "CreateCommand": {
        "templateId": "#aryafi-core:AryaFi.Finance.Payment:PaymentInstruction",
        "createArguments": {
          "payer": "<party-id:DealerBankA>",
          "payee": "<party-id:GlobalCustodian>",
          "settlementAgent": "<party-id:CashSettlementBank>",
          "payerAccountId": { "unAccountId": "ACC-DLRA-USD-001" },
          "payeeAccountId": { "unAccountId": "ACC-CUST-USD-001" },
          "currency": "USD",
          "amount": "12500000.00",
          "purpose": { "tag": "RepoOpeningLeg", "value": {} },
          "obligationRef": "REPO-REF-2026-001",
          "correlationId": { "unCorrelationId": "CORR-REPO-2026-8831" },
          "idempotencyKey": { "unIdempotencyKey": "IDEMP-2026-09-24-0042" },
          "networkRef": { "unPaymentNetworkRef": "e1a49f82-3d92-4f10-bf91-b3b281f9a12c" },
          "status": { "tag": "PendingSettlement", "value": {} },
          "observers": []
        }
      }
    }
  ],
  "commandId": "IDEMP-2026-09-24-0042",
  "userId": "<user-id>",
  "actAs": [
    "<party-id:DealerBankA>",
    "<party-id:GlobalCustodian>",
    "<party-id:CashSettlementBank>"
  ],
  "readAs": []
}`
  },
  sese023: {
    name: "sese.023.001.10 (DvP Settlement Instruction)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:sese.023.001.10">
  <SctiesSttlmTxInstr>
    <TxDtls>
      <SttlmTxId>DVP-2026-TREAS-001</SttlmTxId>
      <FinInstrmId><ISIN>US912828ZM50</ISIN></FinInstrmId>
      <SttlmQty><Qty><Unit>5000000.00</Unit></Qty></SttlmQty>
      <SttlmAmt Ccy="USD">4975000.00</SttlmAmt>
      <SttlmPties>
        <DlvgPty><FinInstnId><LEI>529900DEALERBANKA078</LEI></FinInstnId></DlvgPty>
        <RcvgPty><FinInstnId><LEI>529900DEALERBANKB048</LEI></FinInstnId></RcvgPty>
      </SttlmPties>
    </TxDtls>
  </SctiesSttlmTxInstr>
</Document>`,
    daml: `{
  "commands": [
    {
      "CreateCommand": {
        "templateId": "#aryafi-core:AryaFi.Finance.Settlement:DvpInstruction",
        "createArguments": {
          "settlementAgent": "<party-id:GlobalCustodian>",
          "seller": "<party-id:DealerBankA>",
          "buyer": "<party-id:DealerBankB>",
          "tradeId": { "unTradeId": "DVP-2026-TREAS-001" },
          "isin": { "unISIN": "US912828ZM50" },
          "securityQuantity": "5000000.00",
          "sellerSecurityAccount": { "unAccountId": "ACC-DLRA-SEC-001" },
          "buyerSecurityAccount": { "unAccountId": "ACC-DLRB-SEC-001" },
          "currency": "USD",
          "cashAmount": "4975000.00",
          "sellerCashAccount": { "unAccountId": "ACC-DLRA-USD-001" },
          "buyerCashAccount": { "unAccountId": "ACC-DLRB-USD-001" },
          "dvpModel": "DvpModel1",
          "settlementDate": "2026-09-26T00:00:00Z",
          "correlationId": { "unCorrelationId": "CORR-DVP-2026-TREAS-001" },
          "idempotencyKey": { "unIdempotencyKey": "IDEMP-DVP-2026-TREAS-001" },
          "sellerSecurityLockRef": "DVP-2026-TREAS-001",
          "buyerCashLockRef": "DVP-2026-TREAS-001",
          "status": { "tag": "PendingSettlement", "value": {} },
          "failureReason": null,
          "observers": []
        }
      }
    }
  ],
  "commandId": "IDEMP-DVP-2026-TREAS-001",
  "userId": "<user-id>",
  "actAs": [
    "<party-id:GlobalCustodian>",
    "<party-id:DealerBankA>",
    "<party-id:DealerBankB>"
  ],
  "readAs": []
}`
  },
  camt053: {
    name: "camt.053.001.10 (Bank-to-Customer Statement)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.10">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>STMT-2026-09-24-001</MsgId><CreDtTm>2026-09-24T18:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-EOD-BANK-01</Id>
      <Acct><Id><Othr><Id>ACC-SUB-US-01</Id></Othr></Id><Ccy>USD</Ccy></Acct>
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
  "eventFormat": {
    "filtersByParty": {
      "<party-id:CashSettlementBank>": {
        "cumulative": [
          {
            "identifierFilter": {
              "TemplateFilter": {
                "value": {
                  "templateId": "#aryafi-core:AryaFi.Finance.Cash:CashPosition",
                  "includeCreatedEventBlob": false
                }
              }
            }
          }
        ]
      }
    },
    "verbose": true
  },
  "activeAtOffset": "<offset from GET /v2/state/ledger-end>"
}`
  },
  semt002: {
    name: "semt.002.001.10 (Custody Holding Statement)",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:semt.002.001.10">
  <SctiesBalAcctgRpt>
    <StmtGnlDtls><StmtId>CUST-EOD-2026-09-24</StmtId></StmtGnlDtls>
    <FinInstrmDtls>
      <Id><ISIN>US912828ZM50</ISIN></Id>
      <AggrtBal>
        <Qty><Unit>10000000.00</Unit></Qty>
        <HldgSts><Cd>AVLB</Cd></HldgSts>
      </AggrtBal>
    </FinInstrmDtls>
  </SctiesBalAcctgRpt>
</Document>`,
    daml: `{
  "eventFormat": {
    "filtersByParty": {
      "<party-id:GlobalCustodian>": {
        "cumulative": [
          {
            "identifierFilter": {
              "TemplateFilter": {
                "value": {
                  "templateId": "#aryafi-core:AryaFi.Finance.Security:SecurityPosition",
                  "includeCreatedEventBlob": false
                }
              }
            }
          }
        ]
      }
    },
    "verbose": true
  },
  "activeAtOffset": "<offset from GET /v2/state/ledger-end>"
}`
  }
};

// How each ISO element maps to the Daml payload. The "rule" column states the
// reconciliation or ledger rule that applies; it is documentation, not a check.
const ISO_MAPPINGS = {
  pacs008: [
    { xml: "MsgId", path: "GrpHdr / MsgId", json: "idempotencyKey, commandId", spec: "IdempotencyKey", rule: "Also the Ledger API command ID, so a resubmitted message is deduplicated" },
    { xml: "EndToEndId", path: "PmtId / EndToEndId", json: "correlationId", spec: "CorrelationId", rule: "Links payment, obligation, and settlement records" },
    { xml: "UETR", path: "PmtId / UETR", json: "networkRef", spec: "PaymentNetworkRef", rule: "Attached by settlement agent (AttachNetworkRef)" },
    { xml: "IntrBkSttlmAmt", path: "CdtTrfTxInf / IntrBkSttlmAmt", json: "amount & currency", spec: "Decimal & ISO 4217 code", rule: "Template ensure: amount > 0" },
    { xml: "DbtrAcct", path: "CdtTrfTxInf / DbtrAcct / Id", json: "payerAccountId", spec: "AccountId", rule: "Payer is a signatory of the instruction" },
    { xml: "CdtrAcct", path: "CdtTrfTxInf / CdtrAcct / Id", json: "payeeAccountId", spec: "AccountId", rule: "Payee is a signatory of the instruction" }
  ],
  sese023: [
    { xml: "SttlmTxId", path: "TxDtls / SttlmTxId", json: "tradeId, lock refs", spec: "TradeId / Text", rule: "Both legs must be locked under this reference" },
    { xml: "ISIN", path: "FinInstrmId / ISIN", json: "isin", spec: "ISIN", rule: "Must equal the locked SecurityPosition's ISIN" },
    { xml: "SttlmQty", path: "TxDtls / SttlmQty / Unit", json: "securityQuantity", spec: "Decimal", rule: "Must equal the locked position's quantity exactly" },
    { xml: "SttlmAmt", path: "TxDtls / SttlmAmt", json: "cashAmount & currency", spec: "Decimal & ISO 4217 code", rule: "Must equal the locked CashPosition exactly" },
    { xml: "DlvgPty / RcvgPty", path: "SttlmPties / LEI", json: "seller & buyer", spec: "Party (via LEI directory)", rule: "Both sign the instruction; legs settle in one transaction" }
  ],
  camt053: [
    { xml: "Acct / Id", path: "Stmt / Acct / Id", json: "createArgument.accountId", spec: "AccountId", rule: "Keep the bank's CashPositions for the account (filtered client-side)" },
    { xml: "Acct / Ccy", path: "Stmt / Acct / Ccy", json: "createArgument.currency", spec: "ISO 4217 code", rule: "Filter by currency (client-side)" },
    { xml: "Bal / Amt", path: "Stmt / Bal / Amt", json: "sum of amount", spec: "Decimal", rule: "Closing balance must equal the sum of matching positions" }
  ],
  semt002: [
    { xml: "ISIN", path: "FinInstrmDtls / Id / ISIN", json: "createArgument.isin", spec: "ISIN", rule: "Keep custody positions in the instrument (filtered client-side)" },
    { xml: "HldgSts = AVLB", path: "AggrtBal / HldgSts", json: "createArgument.isLocked = false", spec: "Bool", rule: "Available holdings exclude locked positions" },
    { xml: "AggrtBal / Qty", path: "AggrtBal / Qty / Unit", json: "sum of quantity", spec: "Decimal", rule: "Aggregate balance must equal the sum of matching positions" }
  ]
};

// --- Real validation of the displayed payloads -------------------------------

function isValidIsin(isin) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digits = isin.slice(0, 11).split('').map(c => parseInt(c, 36).toString()).join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[11]);
}

function isValidLei(lei) {
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) return false;
  const digits = lei.split('').map(c => parseInt(c, 36).toString()).join('');
  return BigInt(digits) % 97n === 1n;
}

function validateIsoPayloads(key, xmlText, jsonText) {
  const results = [];
  const check = (name, ok) => results.push({ name, ok });

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const xmlOk = !doc.getElementsByTagName('parsererror').length;
  check('XML is well-formed', xmlOk);

  let json = null;
  try { json = JSON.parse(jsonText); } catch (e) { json = null; }
  check('JSON Ledger API body parses', json !== null);

  // Submissions carry one CreateCommand; statements are active-contract queries.
  const create = json && Array.isArray(json.commands) && json.commands.length === 1
    ? json.commands[0].CreateCommand : null;
  const args = create ? create.createArguments : null;
  if (create) {
    check('Template ID uses the package-name form', /^#aryafi-core:AryaFi\.[A-Za-z.]+:[A-Za-z]+$/.test(create.templateId));
    check('commandId is set', typeof json.commandId === 'string' && json.commandId.length > 0);
    check('actAs lists the submitting parties', Array.isArray(json.actAs) && json.actAs.length > 0);
  } else if (json && json.eventFormat) {
    const filters = Object.values(json.eventFormat.filtersByParty || {});
    const tids = filters.flatMap(f => (f.cumulative || []).map(c => c.identifierFilter?.TemplateFilter?.value?.templateId));
    check('Active-contract query filters by an AryaFi template', tids.length > 0 && tids.every(t => /^#aryafi-core:AryaFi\./.test(t || '')));
  }

  if (xmlOk) {
    const byName = name => Array.from(doc.getElementsByTagNameNS('*', name));
    (ISO_MAPPINGS[key] || []).forEach(row => {
      row.xml.split('/').map(p => p.trim().split(' ')[0]).forEach(el => {
        check(`<${el}> present`, byName(el).length > 0);
      });
    });
    byName('ISIN').forEach(e => check(`ISIN ${e.textContent} check digit (ISO 6166)`, isValidIsin(e.textContent.trim())));
    byName('LEI').forEach(e => check(`LEI ${e.textContent} checksum (ISO 17442)`, isValidLei(e.textContent.trim())));
    byName('UETR').forEach(e => check('UETR is a UUID v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(e.textContent.trim())));
    Array.from(doc.getElementsByTagName('*')).filter(e => e.hasAttribute('Ccy')).forEach(e => {
      check(`<${e.localName}> has ISO 4217 currency`, /^[A-Z]{3}$/.test(e.getAttribute('Ccy')));
      check(`<${e.localName}> amount is positive`, Number(e.textContent) > 0);
    });
  }

  if (args && key === 'sese023' && xmlOk) {
    const text = n => (doc.getElementsByTagNameNS('*', n)[0] || {}).textContent;
    check('ISIN matches between XML and JSON', args.isin.unISIN === text('ISIN'));
    check('Cash amount matches between XML and JSON', Number(args.cashAmount) === Number(text('SttlmAmt')));
    check('Quantity matches between XML and JSON', Number(args.securityQuantity) === Number(text('Unit')));
    check('actAs includes seller, buyer, and settlement agent', [args.seller, args.buyer, args.settlementAgent].every(p => json.actAs.includes(p)));
  }
  if (args && key === 'pacs008' && xmlOk) {
    const text = n => (doc.getElementsByTagNameNS('*', n)[0] || {}).textContent;
    check('Amount matches between XML and JSON', Number(args.amount) === Number(text('IntrBkSttlmAmt')));
    check('Idempotency key matches MsgId', args.idempotencyKey.unIdempotencyKey === text('MsgId'));
    check('commandId matches MsgId', json.commandId === text('MsgId'));
    check('actAs includes payer, payee, and settlement agent', [args.payer, args.payee, args.settlementAgent].every(p => json.actAs.includes(p)));
  }
  return results;
}

function initIsoConverter() {
  const select = document.getElementById('iso-msg-select');
  const xmlDisplay = document.getElementById('iso-xml-display');
  const damlDisplay = document.getElementById('iso-daml-display');
  const toggleDirBtn = document.getElementById('btn-toggle-iso-dir');
  const validateBtn = document.getElementById('btn-validate-iso');
  const dirText = document.getElementById('iso-direction-text');
  const statusBadge = document.getElementById('iso-status-badge');
  const leftTitle = document.getElementById('iso-left-title');
  const rightTitle = document.getElementById('iso-right-title');
  const tbody = document.getElementById('iso-mapping-tbody');

  let isXmlToDaml = true;

  if (!select || !xmlDisplay || !damlDisplay) return;

  function resetBadge() {
    if (statusBadge) {
      statusBadge.textContent = "Not yet validated";
      statusBadge.style.color = "var(--text-secondary)";
    }
  }

  function render(key) {
    const template = ISO_TEMPLATES[key];
    if (template) {
      xmlDisplay.textContent = template.xml;
      damlDisplay.textContent = template.daml;
    }

    if (tbody && ISO_MAPPINGS[key]) {
      tbody.innerHTML = '';
      ISO_MAPPINGS[key].forEach(row => {
        const tr = document.createElement('tr');
        [`<${row.xml}>`, row.path, row.json, row.spec, row.rule].forEach((val, i) => {
          const td = document.createElement('td');
          if (i === 0) { const code = document.createElement('code'); code.textContent = val; td.appendChild(code); }
          else if (i === 2) { const strong = document.createElement('strong'); strong.textContent = val; td.appendChild(strong); }
          else { td.textContent = val; td.style.color = 'var(--text-secondary)'; }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    resetBadge();
  }

  select.addEventListener('change', () => {
    render(select.value);
  });

  if (toggleDirBtn) {
    toggleDirBtn.addEventListener('click', () => {
      isXmlToDaml = !isXmlToDaml;
      if (dirText) {
        dirText.textContent = isXmlToDaml
          ? "SWIFT MX (XML) → JSON Ledger API request"
          : "Daml ledger data → SWIFT MX (XML)";
      }
      if (leftTitle && rightTitle) {
        leftTitle.textContent = isXmlToDaml
          ? "INCOMING ISO 20022 MX (XML PAYLOAD)"
          : "OUTGOING ISO 20022 MX (GENERATED XML)";
        rightTitle.textContent = isXmlToDaml
          ? "JSON LEDGER API v2 REQUEST BODY"
          : "SOURCE DAML LEDGER DATA (JSON LEDGER API)";
      }
      resetBadge();
    });
  }

  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      const results = validateIsoPayloads(select.value, xmlDisplay.textContent, damlDisplay.textContent);
      const failed = results.filter(r => !r.ok);
      if (statusBadge) {
        statusBadge.textContent = failed.length === 0
          ? `✓ ${results.length} checks passed`
          : `✗ ${failed.length} of ${results.length} checks failed: ${failed.map(r => r.name).join('; ')}`;
        statusBadge.style.color = failed.length === 0 ? "var(--accent-emerald)" : "var(--accent-rose)";
      }
    });
  }

  render(select.value);
}

// ============================================================================
// 7. Daml Code Dossier Interactive Viewer
// ============================================================================

// The viewer loads the real module source from the repository (served as
// static files on the deployed site), so it can never drift from the code.
const DAML_SOURCE_BASE = "daml/src/AryaFi/";
const DAML_REPO_URL = "https://github.com/Aryaverse/aryafi-core/blob/main/";

const DAML_MODULES = {
  cash: { title: "AryaFi/Finance/Cash.daml (Tokenized Cash Primitive)", path: "Finance/Cash.daml" },
  security: { title: "AryaFi/Finance/Security.daml (Securities Safekeeping)", path: "Finance/Security.daml" },
  settlement: { title: "AryaFi/Finance/Settlement.daml (Atomic DvP)", path: "Finance/Settlement.daml" },
  collateral: { title: "AryaFi/Finance/Collateral.daml (Haircut & Valuation)", path: "Finance/Collateral.daml" },
  loan: { title: "AryaFi/Contracts/Loan.daml (Credit Facility)", path: "Contracts/Loan.daml" },
  repo: { title: "AryaFi/Contracts/Repo.daml (Repurchase Agreement)", path: "Contracts/Repo.daml" },
  transfer: { title: "AryaFi/Compliance/TransferRestrictions.daml (Reg D / Reg S / 144A)", path: "Compliance/TransferRestrictions.daml" }
};

function initDamlViewer() {
  const select = document.getElementById('daml-file-select');
  const title = document.getElementById('daml-viewer-title');
  const content = document.getElementById('daml-viewer-content');

  if (!select || !title || !content) return;

  async function render(key) {
    const mod = DAML_MODULES[key];
    if (!mod) return;
    const path = DAML_SOURCE_BASE + mod.path;
    title.textContent = mod.title;
    content.textContent = `Loading ${path} ...`;
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (select.value === key) content.textContent = text;
    } catch (err) {
      if (select.value === key) {
        content.textContent = `Could not load ${path} (${err.message}).\n\n` +
          `Open the page through a web server (e.g. the deployed site or "python3 -m http.server"),\n` +
          `or read the source on GitHub:\n${DAML_REPO_URL}${path}`;
      }
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
