'use strict';

const API = '/api';
let TOKEN = localStorage.getItem('admin_token') || null;

const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

function scoreClass(v) {
  if (!v || isNaN(v)) return 'na';
  if (v >= 4.0) return 'high';
  if (v >= 3.0) return 'mid';
  return 'low';
}
function fmt(v) { return (v && v > 0) ? v.toFixed(2) : '—'; }
function barColor(dim) {
  return { trustworthiness: '#7b8cf8', purchaseIntent: '#f5a623', aesthetics: '#2dd4aa' }[dim] || '#7b8cf8';
}
function relTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {}),
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) { doLogout(); throw new Error('Unauthorized'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ───────────────────────────────────────────────
$('inp-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('btn-login').addEventListener('click', doLogin);

async function doLogin() {
  const username = $('inp-user').value.trim();
  const password = $('inp-pass').value;
  if (!username || !password) { showLoginErr('Please enter your username and password.'); return; }
  $('btn-login').disabled = true;
  $('btn-login').textContent = 'Signing in…';
  hide('login-error');
  try {
    const data = await apiFetch('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    TOKEN = data.token;
    localStorage.setItem('admin_token', TOKEN);
    enterDashboard(data.displayName, data.username);
  } catch (err) {
    showLoginErr(err.message || 'Invalid credentials.');
  } finally {
    $('btn-login').disabled = false;
    $('btn-login').textContent = 'Sign In';
  }
}

function showLoginErr(msg) { $('login-error').textContent = msg; show('login-error'); }

$('btn-logout').addEventListener('click', doLogout);
function doLogout() {
  TOKEN = null;
  localStorage.removeItem('admin_token');
  hide('screen-dashboard');
  show('screen-login');
}

async function enterDashboard(displayName, username) {
  $('admin-name').textContent = displayName || username;
  $('admin-avatar').textContent = (displayName || username).charAt(0).toUpperCase();
  hide('screen-login');
  $('screen-dashboard').classList.remove('hidden');
  loadOverview();
}

if (TOKEN) {
  apiFetch('/admin/me')
    .then(d => enterDashboard(d.displayName, d.username))
    .catch(() => { TOKEN = null; localStorage.removeItem('admin_token'); });
}

// ── Navigation ─────────────────────────────────────────
const PANELS = ['overview', 'conditions', 'comparison', 'questions', 'responses'];
const loaded = { overview: false, conditions: false, comparison: false, questions: false };

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panel = btn.dataset.panel;
    PANELS.forEach(p => { const el = $('panel-' + p); if (el) el.classList.toggle('active', p === panel); });
    if (panel === 'conditions' && !loaded.conditions) loadConditions();
    if (panel === 'comparison' && !loaded.comparison) loadComparison();
    if (panel === 'questions'  && !loaded.questions)  loadQuestions();
    if (panel === 'responses') loadResponses();
  });
});

// ── OVERVIEW ───────────────────────────────────────────
async function loadOverview() {
  show('overview-loading'); hide('overview-content');
  try {
    const [ov, cond] = await Promise.all([apiFetch('/analytics/overview'), apiFetch('/analytics/by-condition')]);

    $('stat-grid').innerHTML = `
      <div class="stat-card c-violet">
        <div class="stat-label">Total Participants</div>
        <div class="stat-value">${ov.totalParticipants}</div>
        <div class="stat-sub">${ov.inProgressParticipants} in progress</div>
      </div>
      <div class="stat-card c-teal">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${ov.completedParticipants}</div>
        <div class="stat-sub">${ov.completionRate}% completion rate</div>
      </div>
      <div class="stat-card c-gold">
        <div class="stat-label">Total Responses</div>
        <div class="stat-value">${ov.totalResponses}</div>
        <div class="stat-sub">Across all 6 conditions</div>
      </div>
      <div class="stat-card c-amber">
        <div class="stat-label">Overall Mean</div>
        <div class="stat-value">${fmt(ov.overallAvg)}</div>
        <div class="stat-sub">Scale 1–5</div>
      </div>
    `;

    const dimLabels = {
      trustworthiness: { label: 'Trustworthiness', icon: '🛡️', desc: 'Q1, Q3, Q5' },
      purchaseIntent:  { label: 'Purchase Intent',  icon: '🛒', desc: 'Q2, Q7, Q9' },
      likeability:      { label: 'Likeability',        icon: '🎨', desc: 'Q4, Q6, Q8' }
    };
    const dimTotals = { trustworthiness: [], purchaseIntent: [], likeability: [] };
    cond.forEach(c => { Object.keys(dimTotals).forEach(d => { if (c.dimensionMeans[d]?.mean) dimTotals[d].push(c.dimensionMeans[d].mean); }); });

    $('dim-overview-grid').innerHTML = Object.entries(dimLabels).map(([key, meta]) => {
      const vals = dimTotals[key];
      const mean = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '—';
      const pct  = vals.length ? ((parseFloat(mean)-1)/4*100).toFixed(1) : 0;
      const col  = barColor(key);
      return `
        <div class="stat-card" style="border-top:2px solid ${col}">
          <div class="stat-label">${meta.icon} ${meta.label}</div>
          <div class="stat-value">${mean}</div>
          <div class="stat-sub">Questions ${meta.desc}</div>
          <div style="margin-top:12px"><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${col}"></div></div></div>
        </div>`;
    }).join('');

    hide('overview-loading'); show('overview-content'); loaded.overview = true;
  } catch(err) {
    $('overview-loading').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ── CONDITIONS ─────────────────────────────────────────
async function loadConditions() {
  show('cond-loading'); hide('cond-content');
  try {
    const data = await apiFetch('/analytics/by-condition');
    $('cond-grid').innerHTML = data.map(c => {
      const isAn = c.background === 'Analogous';
      const dimHtml = Object.entries(c.dimensionMeans).map(([key, dm]) => {
        const pct = dm.mean ? ((dm.mean-1)/4*100).toFixed(1) : 0;
        return `<div class="dim-row"><div class="dim-info"><span class="dim-name">${dm.label}</span><span class="dim-val">${fmt(dm.mean)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${dm.color}"></div></div></div>`;
      }).join('');
      return `
        <div class="cond-card">
          <div class="cond-header"><span class="cond-badge ${isAn?'analogous':'complementary'}">${c.label}</span><span class="cond-n">n = ${c.n}</span></div>
          <div class="cond-meta"><strong>${c.product}</strong> · ${c.colorScheme} (${c.background})</div>
          <div class="cond-overall">${fmt(c.overallMean)}</div>
          <div class="cond-overall-label">Overall mean (1–5)</div>
          <div class="dim-bars">${dimHtml}</div>
        </div>`;
    }).join('');
    hide('cond-loading'); show('cond-content'); loaded.conditions = true;
  } catch(err) {
    $('cond-loading').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ── COMPARISON ─────────────────────────────────────────
async function loadComparison() {
  show('comp-loading'); hide('comp-content');
  try {
    const [colorData, productData] = await Promise.all([apiFetch('/analytics/by-color'), apiFetch('/analytics/by-product')]);

    const colorColors = ['#2dd4aa', '#f5a623'];
    $('color-compare').innerHTML = [colorData.analogous, colorData.complementary].map((grp, i) => {
      const bars = Object.entries(grp.questionMeans).map(([q, qd]) => {
        const pct = qd.mean ? ((qd.mean-1)/4*100).toFixed(1) : 0;
        return `<div class="hbar-item"><div class="hbar-label-row"><span class="hbar-label">${qd.label}</span><span class="hbar-val">${fmt(qd.mean)}</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${colorColors[i]}"></div></div></div>`;
      }).join('');
      return `<div class="compare-card"><div class="compare-title">${grp.label} <span style="color:var(--text3);font-size:0.72rem;font-weight:400">(n=${grp.n})</span></div><div style="margin-bottom:12px;font-family:var(--font-d);font-size:1.4rem;font-weight:800;color:var(--text)">${fmt(grp.overallMean)} <span style="font-size:0.7rem;color:var(--text3);font-family:var(--font-b)">overall mean</span></div><div class="hbar-list">${bars}</div></div>`;
    }).join('');

    const prodColors = ['#f472b6', '#60a5fa', '#a78bfa'];
    $('product-compare').innerHTML = productData.map((grp, i) => {
      const bars = Object.entries(grp.questionMeans).map(([q, qd]) => {
        const pct = qd.mean ? ((qd.mean-1)/4*100).toFixed(1) : 0;
        return `<div class="hbar-item"><div class="hbar-label-row"><span class="hbar-label">${qd.label}</span><span class="hbar-val">${fmt(qd.mean)}</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${pct}%;background:${prodColors[i]}"></div></div></div>`;
      }).join('');
      return `<div class="compare-card"><div class="compare-title">${grp.product} <span style="color:var(--text3);font-size:0.72rem;font-weight:400">(n=${grp.n})</span></div><div style="margin-bottom:12px;font-family:var(--font-d);font-size:1.4rem;font-weight:800;color:var(--text)">${fmt(grp.overallMean)} <span style="font-size:0.7rem;color:var(--text3);font-family:var(--font-b)">overall mean</span></div><div class="hbar-list">${bars}</div></div>`;
    }).join('');

    hide('comp-loading'); show('comp-content'); loaded.comparison = true;
  } catch(err) {
    $('comp-loading').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ── QUESTIONS TABLE ────────────────────────────────────
const FULL_Q_LABELS = [
  'The colours of the ad are trustworthy.',
  'I would like to buy this product for myself.',
  'I perceive this ad as honest.',
  'The overall look of the ad is appealing.',
  'I feel like i can trust the ad.',
  'The colours used in this advertisement are likeable.',
  'The colours of this advertisement make me want to buy the product.',
  'I like this ad.',
  'The chances of me buying this product is high.'
];

async function loadQuestions() {
  show('q-loading'); hide('q-content');
  try {
    const data = await apiFetch('/analytics/by-condition');
    const condOrder = ['a','b','c','d','e','f'];
    const condMap = {};
    data.forEach(c => { condMap[c.code] = c; });

    const tbody = $('q-tbody');
    tbody.innerHTML = '';

    for (let qi = 1; qi <= 9; qi++) {
      const q = `q${qi}`;
      const allVals = [];
      const cells = condOrder.map(code => {
        const c = condMap[code];
        if (!c) return '<td><span class="score-chip na">—</span></td>';
        const v = c.questionMeans[q]?.mean;
        if (v) allVals.push(v);
        return `<td><span class="score-chip ${scoreClass(v)}">${fmt(v)}</span></td>`;
      }).join('');
      const avgV = allVals.length ? allVals.reduce((a,b)=>a+b,0)/allVals.length : null;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text3);font-family:var(--font-d);font-weight:700">${qi}</td>
        <td style="font-size:0.76rem;color:var(--text)">${FULL_Q_LABELS[qi-1]}</td>
        ${cells}
        <td><span class="score-chip ${scoreClass(avgV)}">${fmt(avgV)}</span></td>`;
      tbody.appendChild(tr);
    }

    const legend = document.createElement('tr');
    legend.style.borderTop = '2px solid var(--border2)';
    legend.innerHTML = `<td colspan="2" style="padding:12px 14px;color:var(--text3);font-size:0.68rem">
      <span class="score-chip high" style="font-size:0.65rem;margin-right:5px">4.0+</span> High &nbsp;
      <span class="score-chip mid"  style="font-size:0.65rem;margin-right:5px">3.0–3.99</span> Mid &nbsp;
      <span class="score-chip low"  style="font-size:0.65rem;margin-right:5px">&lt;3.0</span> Low
    </td><td colspan="7"></td>`;
    tbody.appendChild(legend);

    hide('q-loading'); show('q-content'); loaded.questions = true;
  } catch(err) {
    $('q-loading').innerHTML = `<div class="empty-state">Failed to load: ${err.message}</div>`;
  }
}

// ── RAW RESPONSES (with Name + Email) ─────────────────
let respPage = 1;
let respTotal = 0;
const RESP_LIMIT = 20;

$('btn-load-resp').addEventListener('click', () => { respPage = 1; loadResponses(); });
$('pag-prev').addEventListener('click', () => { respPage--; loadResponses(true); });
$('pag-next').addEventListener('click', () => { respPage++; loadResponses(true); });

async function loadResponses(paginate = false) {
  show('resp-loading');
  const cond  = $('f-condition').value;
  const batch = $('f-batch').value;
  const qs = new URLSearchParams({ page: respPage, limit: RESP_LIMIT });
  if (cond)  qs.set('condition', cond);
  if (batch) qs.set('batch', batch);

  try {
    const data = await apiFetch('/analytics/raw-responses?' + qs.toString());
    respTotal = data.pagination.total;

    const tbody = $('resp-tbody');
    if (data.responses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="16" class="empty-state">No responses found.</td></tr>';
    } else {
      tbody.innerHTML = data.responses.map(r => {
        const isAn = r.conditionMeta?.background === 'Analogous';
        const vals = Object.values(r.answers).filter(v => typeof v === 'number');
        const avg  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '—';
        const qCells = [1,2,3,4,5,6,7,8,9].map(i => {
          const v = r.answers[`q${i}`];
          return `<td><span class="score-chip ${scoreClass(v)}" style="font-size:0.68rem;min-width:28px">${v||'—'}</span></td>`;
        }).join('');
        return `
          <tr>
            <td><span class="session-id">${r.sessionId}</span></td>
            <td>
              <div class="participant-name"> ${r.participantName || '—'}</div>
              <div class="participant-email">${r.participantEmail || ''}</div>
            </td>
            <td>Batch ${r.batchNumber}</td>
            <td><span class="cond-tag ${isAn?'an':'cm'}">${r.conditionLabel}</span></td>
            ${qCells}
            <td><strong style="color:var(--text)">${avg}</strong></td>
            <td style="white-space:nowrap;font-size:0.68rem;color:var(--text3)">${relTime(r.submittedAt)}</td>
          </tr>`;
      }).join('');
    }

    $('pag-info').textContent = `Showing ${Math.min((respPage-1)*RESP_LIMIT+1,respTotal)}–${Math.min(respPage*RESP_LIMIT,respTotal)} of ${respTotal}`;
    $('pag-prev').disabled = respPage <= 1;
    $('pag-next').disabled = respPage >= data.pagination.pages;
  } catch(err) {
    $('resp-tbody').innerHTML = `<tr><td colspan="16" class="empty-state">Error: ${err.message}</td></tr>`;
  } finally {
    hide('resp-loading');
  }
}