// Copyright (c) 2026 Aryaverse. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// AryaFi Core site: plain-language overview, a guided replay of the library's
// tested bond-for-cash (DvP) scenario, the library's contents, and developer
// tools (ISO 20022 mapping and the contract source viewer).

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRouter();
  initTradeWalkthrough();
  initCollateralCalculator();
  initIsoConverter();
  initDamlViewer();
  initCopyButtons();
});

// ============================================================================
// 1. Theme (follows the system until the visitor picks one)
// ============================================================================

function readStored(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function writeStored(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
}

function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  const saved = readStored('aryafi-theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  const effective = () => root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
  const updateLabel = () => {
    if (btn) btn.setAttribute('aria-label', effective() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  };

  updateLabel();
  if (btn) {
    btn.addEventListener('click', () => {
      const next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      writeStored('aryafi-theme', next);
      updateLabel();
    });
  }
  if (media.addEventListener) media.addEventListener('change', updateLabel);
}

// ============================================================================
// 2. Views (#overview, #trade, #inside, #developers)
// ============================================================================

const VIEW_TITLES = {
  overview: 'AryaFi Core',
  trade: 'See a trade settle · AryaFi Core',
  inside: "What's inside · AryaFi Core",
  developers: 'Developers · AryaFi Core'
};

// Links to the previous site's tabs still land somewhere sensible.
const LEGACY_HASHES = {
  'tab-topology': 'trade',
  'tab-simulator': 'trade',
  'tab-contracts': 'inside',
  'tab-iso': 'developers',
  'tab-security': 'overview',
  'tab-docs': 'developers'
};

function initRouter() {
  let current = null;

  function show(scroll) {
    let id = location.hash.slice(1);
    if (LEGACY_HASHES[id]) id = LEGACY_HASHES[id];
    if (id === '') id = 'overview';
    if (!(id in VIEW_TITLES)) return; // an in-page anchor such as #main

    document.querySelectorAll('.view').forEach(view => { view.hidden = view.dataset.view !== id; });
    document.querySelectorAll('.site-nav a').forEach(link => {
      if (link.dataset.view === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = VIEW_TITLES[id];
    if (scroll && current !== id) window.scrollTo(0, 0);
    current = id;
  }

  window.addEventListener('hashchange', () => show(true));
  show(false);
}

// ============================================================================
// 3. "See a trade settle": a replay of TreasuryDvpScenario
// ============================================================================
// Who holds and sees each record follows the contracts' stakeholders: a
// position is visible to its owner and the institution that keeps it, plus the
// settlement agent while the agent holds the lock; the instruction to its three
// signatories; the report to the seller and the regulator.

const ORGS = [
  { id: 'seller', name: 'Dealer Bank A', role: 'Seller' },
  { id: 'buyer', name: 'Dealer Bank B', role: 'Buyer' },
  { id: 'agent', name: 'Settlement Agent', role: 'Settlement agent' },
  { id: 'custodian', name: 'Global Custodian', role: 'Custodian' },
  { id: 'bank', name: 'Cash Settlement Bank', role: 'Cash bank' },
  { id: 'regulator', name: 'Securities Regulator', role: 'Regulator' }
];

const STEPS = [
  {
    short: 'Before',
    title: 'Before the trade',
    text: 'Dealer Bank A owns $5,000,000 (face value) of US Treasury bonds, kept by Global Custodian. Dealer Bank B has $5,000,000 in cash at Cash Settlement Bank.',
    why: 'Each position is signed by its owner and by the institution that keeps it, so neither can change it alone.',
    tech: [
      '`SecurityPosition` signed by the custodian and the owner; `CashPosition` signed by the bank and the owner.'
    ]
  },
  {
    short: 'Checks',
    title: 'Both firms are checked',
    text: 'An independent KYC provider and a sanctions screener issue checks for both dealers. The settlement agent confirms that US Treasuries are eligible for this settlement.',
    why: "The trade only goes ahead between vetted firms. Each firm sees its own checks, not its counterparty's.",
    tech: [
      '`KycAttestation` and `SanctionsAttestation`, issued by the KYC provider and the screener (not shown); `IsKycValid` and `IsSanctionsClear` confirm them at ledger time.',
      '`EligibilityPolicy` with `EvaluateEligibility`: US Treasuries approved.'
    ]
  },
  {
    short: 'Lock',
    title: 'Each side sets aside its asset',
    text: 'Dealer Bank A locks its bond. Dealer Bank B splits off exactly $4,975,000 and locks it, keeping the other $25,000. Both locks are held by the settlement agent.',
    why: 'From here on, neither dealer can pull out: only the settlement agent can release or deliver a locked asset.',
    tech: [
      '`SplitCash`: $5,000,000 becomes $4,975,000 and $25,000.',
      '`LockSecurity` and `LockCash` with `holder` = the settlement agent, which becomes an observer of both locked positions.'
    ]
  },
  {
    short: 'Sign',
    title: 'All three sign the trade',
    text: 'The seller, the buyer and the settlement agent sign one instruction: which bond, how much, the price of $4,975,000, the accounts, and the settlement date.',
    why: 'Everyone works from the same signed record, so there is nothing to reconcile afterwards. The agent can carry it out, but cannot change it.',
    tech: [
      '`DvpInstruction` with the agent, seller and buyer as signatories (DvP model 1: each trade settled on its own).',
      'The agent also shares it with the central securities depository (not shown).'
    ]
  },
  {
    short: 'Settle',
    title: 'Settlement: both move at once',
    text: 'The settlement agent checks that the locked bond and the locked cash match the instruction exactly, then delivers the bond to Dealer Bank B and the cash to Dealer Bank A in a single transaction.',
    why: 'Neither dealer is ever exposed to the other: the swap happens completely or not at all.',
    tech: [
      '`ExecuteDvpSettlement` checks the owner, account, ISIN, quantity, currency, amount, lock holder and lock reference of both legs.',
      '`SettleLockedSecurity` and `SettleLockedCash` run in the same transaction; the old positions are archived.'
    ]
  },
  {
    short: 'Report',
    title: 'The regulator gets a report',
    text: 'Dealer Bank A files a trade report with the regulator, which acknowledges it.',
    why: "The regulator gets the report it needs and never sees the firms' positions or accounts.",
    done: "Done. The bond and the cash changed hands in one transaction, neither dealer was exposed to the other, and each institution's node holds only its own records.",
    tech: [
      '`RegulatoryReportRecord` under SEC CAT, signed by the seller with the regulator as observer.',
      '`AcknowledgeReport`, exercised by the regulator.'
    ]
  }
];

// Each record exists from step `from` to step `to`. `on(step)` places it on
// institutions' cards with a label; `seenBy(step)` is who stores it.
// `gone` labels its last appearance, struck through, on the step after `to`.
const RECORDS = [
  {
    id: 'bond-a', kind: 'bond', title: 'US Treasury bond', value: '$5,000,000 face', from: 0, to: 3,
    seenBy: s => (s >= 2 ? ['seller', 'custodian', 'agent'] : ['seller', 'custodian']),
    on: s => [['seller', 'Owns'], ['custodian', 'Keeps it for Dealer Bank A']]
      .concat(s >= 2 ? [['agent', "Holds the lock on Dealer Bank A's bond"]] : []),
    status: s => (s >= 2 ? 'locked' : null),
    gone: { seller: 'Delivered to Dealer Bank B', custodian: 'Moved to Dealer Bank B', agent: 'Delivered' }
  },
  {
    id: 'cash-b', kind: 'cash', title: 'Cash', value: '$5,000,000', from: 0, to: 1,
    seenBy: () => ['buyer', 'bank'],
    on: () => [['buyer', 'Owns'], ['bank', 'Holds it for Dealer Bank B']],
    gone: { buyer: 'Split into $4,975,000 and $25,000', bank: 'Split into two positions' }
  },
  {
    id: 'cash-b-trade', kind: 'cash', title: 'Cash for the trade', value: '$4,975,000', from: 2, to: 3,
    seenBy: () => ['buyer', 'bank', 'agent'],
    on: () => [['buyer', 'Owns'], ['bank', 'Holds it for Dealer Bank B'], ['agent', "Holds the lock on Dealer Bank B's cash"]],
    status: () => 'locked',
    gone: { buyer: 'Paid to Dealer Bank A', bank: 'Moved to Dealer Bank A', agent: 'Delivered' }
  },
  {
    id: 'cash-b-rest', kind: 'cash', title: 'Cash left over', value: '$25,000', from: 2, to: 5,
    seenBy: () => ['buyer', 'bank'],
    on: () => [['buyer', 'Owns'], ['bank', 'Holds it for Dealer Bank B']]
  },
  {
    id: 'checks-a', kind: 'check', title: 'KYC and sanctions checks', value: 'Passed', from: 1, to: 5,
    seenBy: () => ['seller'],
    on: () => [['seller', 'Its own checks']]
  },
  {
    id: 'checks-b', kind: 'check', title: 'KYC and sanctions checks', value: 'Passed', from: 1, to: 5,
    seenBy: () => ['buyer'],
    on: () => [['buyer', 'Its own checks']]
  },
  {
    id: 'eligibility', kind: 'check', title: 'US Treasuries eligible', value: 'Approved', from: 1, to: 5,
    seenBy: () => ['agent'],
    on: () => [['agent', 'Its eligibility rule']]
  },
  {
    id: 'instruction', kind: 'doc', title: 'Trade instruction', value: '$5M bond for $4,975,000', from: 3, to: 5,
    seenBy: () => ['seller', 'buyer', 'agent'],
    on: () => [['seller', 'Signed'], ['buyer', 'Signed'], ['agent', 'Signed; carries it out']],
    status: s => (s >= 4 ? 'settled' : 'signed')
  },
  {
    id: 'bond-b', kind: 'bond', title: 'US Treasury bond', value: '$5,000,000 face', from: 4, to: 5,
    seenBy: () => ['buyer', 'custodian'],
    on: () => [['buyer', 'Owns'], ['custodian', 'Keeps it for Dealer Bank B']],
    status: s => (s === 4 ? 'received' : null)
  },
  {
    id: 'cash-a', kind: 'cash', title: 'Cash from the sale', value: '$4,975,000', from: 4, to: 5,
    seenBy: () => ['seller', 'bank'],
    on: () => [['seller', 'Owns'], ['bank', 'Holds it for Dealer Bank A']],
    status: s => (s === 4 ? 'received' : null)
  },
  {
    id: 'report', kind: 'doc', title: 'Trade report (SEC CAT)', value: 'Acknowledged', from: 5, to: 5,
    seenBy: () => ['seller', 'regulator'],
    on: () => [['seller', 'Filed it'], ['regulator', 'Received it']]
  }
];

const STATUS_LABELS = {
  locked: 'Locked for settlement',
  signed: 'Signed by all three',
  settled: 'Settled',
  received: 'Changed hands'
};

const EMPTY_CARD = {
  regulator: 'Nothing yet. The regulator only sees what is reported to it.',
  agent: 'Nothing yet. The agent only sees what the trade shares with it.'
};

const WHAT_IFS = [
  {
    id: 'take-back', steps: [2, 3], outcome: 'Blocked',
    label: 'The seller tries to take its bond back',
    text: 'Only the settlement agent can release a locked bond, so the seller cannot back out once it has committed. The custodian cannot release it either, and neither can send it anywhere else.',
    test: 'testLockedLegsCannotBeWithdrawn'
  },
  {
    id: 'agent-cancel', steps: [3], outcome: 'Blocked',
    label: 'The settlement agent tries to cancel the trade on its own',
    text: 'Cancelling needs the seller and the buyer as well. The agent can carry out the agreed trade, but cannot undo it alone.',
    test: 'testAgentCannotCancelAlone'
  },
  {
    id: 'short-bond', steps: [3], outcome: 'Settlement refused',
    label: 'The seller locked fewer bonds than agreed',
    text: "Settlement checks each locked asset against the signed instruction. A smaller bond position fails the check, so nothing moves: the seller keeps its bond and the buyer keeps its cash.",
    test: 'testDvpRejectsMismatchedLegs'
  },
  {
    id: 'seller-settles', steps: [3], outcome: 'Blocked',
    label: 'The seller tries to settle the trade itself',
    text: 'Only the settlement agent named in the instruction can carry it out.',
    test: 'testOnlyAgentCanExecuteDvp'
  },
  {
    id: 'settle-twice', steps: [4, 5], outcome: 'Blocked',
    label: 'Someone tries to settle the trade again',
    text: 'A settled trade cannot be settled a second time or retried.',
    test: 'testCannotReExecuteSettledDvp'
  },
  {
    id: 'outsider', steps: [3, 4, 5], outcome: 'Not visible',
    label: 'A firm outside the trade looks for it',
    text: 'A firm that is not named in the trade finds nothing: neither the instruction nor the locked bond is shared with it.',
    test: 'testDvpPrivacy'
  }
];

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Escapes the text, then renders `code` spans.
function inlineCode(text) {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function orgName(id) {
  const org = ORGS.find(o => o.id === id);
  return org ? org.name : id;
}

function initTradeWalkthrough() {
  const board = document.getElementById('board');
  const stepper = document.getElementById('stepper');
  if (!board || !stepper) return;

  const backBtn = document.getElementById('step-back');
  const nextBtn = document.getElementById('step-next');
  const viewSelect = document.getElementById('viewas-select');
  const viewHint = document.getElementById('viewas-hint');
  const whatifList = document.getElementById('whatif-list');
  const whatifResult = document.getElementById('whatif-result');

  let step = 0;
  let viewAs = '';

  ORGS.forEach(org => {
    const option = document.createElement('option');
    option.value = org.id;
    option.textContent = `${org.name} (${org.role.toLowerCase()})`;
    viewSelect.appendChild(option);
  });

  STEPS.forEach((s, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span class="stepper-num">${i + 1}</span><span class="stepper-label">${escapeHtml(s.short)}</span>`;
    btn.addEventListener('click', () => { step = i; render(); });
    li.appendChild(btn);
    stepper.appendChild(li);
  });

  WHAT_IFS.forEach(w => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'whatif-btn';
    btn.dataset.whatif = w.id;
    btn.addEventListener('click', () => showWhatIf(w));
    whatifList.appendChild(btn);
  });

  backBtn.addEventListener('click', () => { if (step > 0) { step -= 1; render(); } });
  nextBtn.addEventListener('click', () => { step = step < STEPS.length - 1 ? step + 1 : 0; render(); });
  viewSelect.addEventListener('change', () => { viewAs = viewSelect.value; renderBoard(); });

  function active(r, s) { return r.from <= s && s <= r.to; }
  function statusAt(r, s) { return r.status && active(r, s) ? r.status(s) : null; }

  function showWhatIf(w) {
    whatifResult.hidden = false;
    whatifResult.className = `whatif-result outcome-${w.outcome === 'Not visible' ? 'private' : 'blocked'}`;
    whatifResult.innerHTML =
      `<p class="whatif-outcome">${escapeHtml(w.outcome)}</p>` +
      `<p class="whatif-question">${escapeHtml(w.label)}</p>` +
      `<p>${escapeHtml(w.text)}</p>` +
      `<p class="whatif-test">Checked by the test <code>DvpSettlementTest.${escapeHtml(w.test)}</code></p>`;
  }

  function renderWhatIfs() {
    whatifList.querySelectorAll('.whatif-btn').forEach(btn => {
      const w = WHAT_IFS.find(x => x.id === btn.dataset.whatif);
      const available = w.steps.includes(step);
      btn.disabled = !available;
      btn.innerHTML = escapeHtml(w.label) +
        (available ? '' : `<span class="whatif-when">From step ${w.steps[0] + 1}</span>`);
    });
    whatifResult.hidden = true;
  }

  function renderStep() {
    const s = STEPS[step];
    document.getElementById('step-count').textContent = `Step ${step + 1} of ${STEPS.length}`;
    document.getElementById('step-title').textContent = s.title;
    document.getElementById('step-text').textContent = s.text;
    const why = document.getElementById('step-why');
    why.innerHTML = `<strong>Why it matters:</strong> ${escapeHtml(s.why)}` +
      (s.done ? `<span class="step-done">${escapeHtml(s.done)}</span>` : '');
    document.getElementById('step-tech').innerHTML =
      '<ul>' + s.tech.map(t => `<li>${inlineCode(t)}</li>`).join('') + '</ul>' +
      '<p>Replayed from <code>daml/test/AryaFi/Test/Scenarios/TreasuryDvpScenario.daml</code>.</p>';

    stepper.querySelectorAll('li').forEach((li, i) => {
      const btn = li.querySelector('button');
      li.classList.toggle('is-done', i < step);
      if (i === step) {
        btn.setAttribute('aria-current', 'step');
        // Keep the current step visible when the bar scrolls (narrow screens).
        stepper.scrollTo({ left: li.offsetLeft - (stepper.clientWidth - li.clientWidth) / 2 });
      } else {
        btn.removeAttribute('aria-current');
      }
    });
    backBtn.disabled = step === 0;
    nextBtn.textContent = step === STEPS.length - 1 ? 'Start over' : 'Next step →';
  }

  function hiddenRowHtml(count) {
    const noun = count === 1 ? 'record' : 'records';
    return `<li class="rec rec-hidden"><span class="rec-icon" aria-hidden="true"></span>` +
      `<span class="rec-body"><span class="rec-title">${count} ${noun} not shared with ${escapeHtml(orgName(viewAs))}</span>` +
      `<span class="rec-label">Not stored on its node</span></span></li>`;
  }

  function rowHtml(r, label, opts) {
    const classes = ['rec', `rec-${r.kind}`];
    if (opts.gone) classes.push('rec-gone');
    if (opts.changed) classes.push('is-changed');
    const status = opts.status
      ? `<span class="rec-status status-${opts.status}">${escapeHtml(STATUS_LABELS[opts.status])}</span>` : '';
    return `<li class="${classes.join(' ')}"><span class="rec-icon" aria-hidden="true"></span>` +
      `<span class="rec-body"><span class="rec-title">${escapeHtml(r.title)} <span class="rec-value">${escapeHtml(r.value)}</span></span>` +
      `<span class="rec-label">${escapeHtml(label)}</span>${status}</span></li>`;
  }

  function renderBoard() {
    const visible = RECORDS.filter(r => active(r, step));
    board.innerHTML = ORGS.map(org => {
      const rows = [];
      let hiddenCount = 0;
      const add = (r, label, seenBy, opts) => {
        if (viewAs && !seenBy.includes(viewAs)) hiddenCount += 1;
        else rows.push(rowHtml(r, label, opts));
      };
      visible.forEach(r => {
        const placement = r.on(step).find(([id]) => id === org.id);
        if (!placement) return;
        const status = statusAt(r, step);
        const changed = step > 0 && (r.from === step || status !== statusAt(r, step - 1));
        add(r, placement[1], r.seenBy(step), { status, changed });
      });
      RECORDS.filter(r => r.to === step - 1 && r.gone && r.gone[org.id]).forEach(r => {
        add(r, r.gone[org.id], r.seenBy(r.to), { gone: true });
      });
      if (hiddenCount) rows.push(hiddenRowHtml(hiddenCount));
      const isYou = viewAs === org.id;
      const body = rows.length
        ? `<ul class="rec-list">${rows.join('')}</ul>`
        : `<p class="org-empty">${escapeHtml(EMPTY_CARD[org.id] || 'Nothing yet.')}</p>`;
      return `<article class="org${isYou ? ' is-you' : ''}${viewAs && !isYou ? ' is-other' : ''}">` +
        `<header class="org-head"><span class="org-role">${escapeHtml(org.role)}</span>` +
        `<h3>${escapeHtml(org.name)}</h3>${isYou ? '<span class="you-tag">This node</span>' : ''}</header>${body}</article>`;
    }).join('');

    if (viewAs) {
      const stored = visible.filter(r => r.seenBy(step).includes(viewAs)).length;
      viewHint.textContent = `${orgName(viewAs)}'s node stores ${stored} of the ${visible.length} records in this trade so far. Everything else is hidden from it.`;
    } else {
      viewHint.textContent = 'Pick an institution to see only what its own node stores.';
    }
  }

  function render() {
    renderStep();
    renderBoard();
    renderWhatIfs();
  }

  render();
}

// ============================================================================
// 4. Collateral calculator
// ============================================================================

function formatUsd(value) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initCollateralCalculator() {
  const loanInput = document.getElementById('calc-loan');
  const assetSelect = document.getElementById('calc-asset');
  const marginInput = document.getElementById('calc-margin');
  const result = document.getElementById('calc-result');
  if (!loanInput || !assetSelect || !marginInput || !result) return;

  function update() {
    const loan = Math.max(0, parseFloat(loanInput.value) || 0);
    const margin = Math.max(100, parseFloat(marginInput.value) || 100) / 100;
    const haircut = parseFloat(assetSelect.value);
    let assetName = assetSelect.options[assetSelect.selectedIndex].text.replace(/ \(.*\)$/, '');
    if (/^[A-Z][a-z]/.test(assetName)) assetName = assetName[0].toLowerCase() + assetName.slice(1);
    const required = (loan * margin) / (1 - haircut);
    const counted = loan * margin;
    const buffer = Math.round((margin - 1) * 1000) / 10;
    result.innerHTML =
      `Post at least <strong>${formatUsd(required)}</strong> of ${escapeHtml(assetName)} (market value). ` +
      `After the ${(haircut * 100).toFixed(1).replace(/\.0$/, '')}% haircut it counts as ${formatUsd(counted)}: ` +
      `the loan plus a ${buffer}% margin.`;
  }

  [loanInput, assetSelect, marginInput].forEach(el => el.addEventListener('input', update));
  assetSelect.addEventListener('change', update);
  update();
}

// ============================================================================
// 5. ISO 20022 mapping and checks
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
  const validateBtn = document.getElementById('btn-validate-iso');
  const statusBadge = document.getElementById('iso-status-badge');
  const tbody = document.getElementById('iso-mapping-tbody');
  if (!select || !xmlDisplay || !damlDisplay) return;

  function resetBadge() {
    statusBadge.textContent = 'Not checked yet';
    statusBadge.className = 'badge';
  }

  function render(key) {
    const template = ISO_TEMPLATES[key];
    if (template) {
      xmlDisplay.textContent = template.xml;
      damlDisplay.textContent = template.daml;
    }
    if (tbody && ISO_MAPPINGS[key]) {
      tbody.innerHTML = ISO_MAPPINGS[key].map(row =>
        `<tr><td><code>&lt;${escapeHtml(row.xml)}&gt;</code></td><td>${escapeHtml(row.path)}</td>` +
        `<td><strong>${escapeHtml(row.json)}</strong></td><td>${escapeHtml(row.spec)}</td><td>${escapeHtml(row.rule)}</td></tr>`
      ).join('');
    }
    resetBadge();
  }

  select.addEventListener('change', () => render(select.value));

  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      const results = validateIsoPayloads(select.value, xmlDisplay.textContent, damlDisplay.textContent);
      const failed = results.filter(r => !r.ok);
      statusBadge.textContent = failed.length === 0
        ? `✓ All ${results.length} checks passed`
        : `✗ ${failed.length} of ${results.length} checks failed: ${failed.map(r => r.name).join('; ')}`;
      statusBadge.className = failed.length === 0 ? 'badge badge-ok' : 'badge badge-bad';
    });
  }

  render(select.value);
}

// ============================================================================
// 6. Contract source viewer
// ============================================================================

// The viewer loads the real module source from the repository (served as
// static files on the deployed site), so it can never drift from the code.
const DAML_SOURCE_BASE = 'daml/src/AryaFi/';
const DAML_REPO_URL = 'https://github.com/Aryaverse/aryafi-core/blob/main/';

const DAML_MODULES = {
  cash: 'Finance/Cash.daml',
  security: 'Finance/Security.daml',
  settlement: 'Finance/Settlement.daml',
  collateral: 'Finance/Collateral.daml',
  loan: 'Contracts/Loan.daml',
  repo: 'Contracts/Repo.daml',
  transfer: 'Compliance/TransferRestrictions.daml'
};

function initDamlViewer() {
  const select = document.getElementById('daml-file-select');
  const title = document.getElementById('daml-viewer-title');
  const content = document.getElementById('daml-viewer-content');
  if (!select || !title || !content) return;

  async function render(key) {
    const rel = DAML_MODULES[key];
    if (!rel) return;
    const path = DAML_SOURCE_BASE + rel;
    title.textContent = path;
    content.textContent = `Loading ${path} ...`;
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (select.value === key) content.textContent = text;
    } catch (err) {
      if (select.value === key) {
        content.textContent = `Could not load ${path} (${err.message}).\n\n` +
          'Open the page through a web server (e.g. the deployed site or "python3 -m http.server"),\n' +
          `or read the source on GitHub:\n${DAML_REPO_URL}${path}`;
      }
    }
  }

  select.addEventListener('change', () => render(select.value));
  render(select.value);
}

// ============================================================================
// 7. Copy buttons (data-copy="<id of the element to copy>")
// ============================================================================

function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      const original = btn.textContent;
      try {
        await navigator.clipboard.writeText(target.textContent);
        btn.textContent = 'Copied';
      } catch (err) {
        btn.textContent = 'Copy failed';
      }
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });
}
