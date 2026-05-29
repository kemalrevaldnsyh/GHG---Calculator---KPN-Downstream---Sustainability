/* Refinery / Biodiesel — calculate, history, export, sheets */
var ETD_VARIANT = 'rpome';

function applyEtdBranding() {
  var title = document.getElementById('etd-header-title');
  var sub = document.getElementById('etd-header-sub');
  if (ETD_VARIANT === 'ggl') {
    if (title) title.textContent = 'ETD — GGL';
    if (sub) sub.textContent = 'Transportation & processing · GGL';
  } else {
    if (title) title.textContent = 'ETD — RPOME';
    if (sub) sub.textContent = 'Transportation & processing (lokal)';
  }
}

function openETDMode(variant) {
  ETD_VARIANT = variant === 'ggl' ? 'ggl' : 'rpome';
  applyEtdBranding();
  document.getElementById('page-landing').classList.remove('active');
  document.getElementById('calc-app-wrap').classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
  document.getElementById('etd-app-wrap').classList.add('active');
  var etdPeriod = document.getElementById('etd-period');
  if (etdPeriod && !etdPeriod.value) etdPeriod.value = String(new Date().getFullYear());
  CALC_MODE = null;
  fetchEtdLog();
  renderEtdResultsList();
  requestAnimationFrame(function() { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
  showToast(ETD_VARIANT === 'ggl' ? 'Mode: ETD GGL' : 'Mode: ETD', 'success');
}

function openETDGGLMode() {
  openETDMode('ggl');
}

function epLabelSet(calcType) {
  if (calcType === 'biodiesel') {
    return {
      dry1: 'Ep / dry-ton PME',
      dry2: 'Ep / dry-ton CG (FAD)',
      a1: 'Ep Allocated PME',
      a2: 'Ep Allocated CG',
    };
  }
  return {
    dry1: 'Ep / dry-ton RPOME',
    dry2: 'Ep / dry-ton POME FAD',
    a1: 'Ep Allocated RPOME',
    a2: 'Ep Allocated POME FAD',
  };
}

function getAllItemKeys() {
  return Object.keys(ALL_ITEMS_MAP);
}

const GROUP_BADGE = {
  fuel:     'badge-fuel',
  chemical: 'badge-chemical',
  elec:     'badge-elec',
  water:    'badge-water',
};
const GROUP_LABEL = {
  fuel:'Fuel', chemical:'Chemical', elec:'Electricity', water:'Water',
};

/* 
   STATE
 */
let addedItems = new Set();
let ITEM_INPUT_MODE = 'all'; // all | manual
let R = {};
let ghgData = [];
var gsDatacenterRows = [];
let etdData = [];
let factorRowsCache = [];
const ETD_LATEST_KEY = 'ghg_latest_etd_result_v1';
const ETD_HISTORY_KEY = 'ghg_etd_history_v1';
const GS_SAVED_RESULTS_KEY = 'ghg_savings_results_v1';
const GS_MAX_SAVED_RESULTS = 100;
const ETD_SHEET_NAME = 'ETD Log';
const GS_SHEET_NAME = 'GHG Savings Log';
let latestEtdCalc = null;

/* 
   HELPERS
 */
const g   = id => parseFloat(document.getElementById(id).value)||0;
const sv  = (id,v) => document.getElementById(id).value = v;
const st  = (id,v) => document.getElementById(id).textContent = v;
const fmt = (v,d=2) => (isNaN(v)||!isFinite(v)) ? '0.00' : v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

function saveLatestEtdSnapshot(payload) {
  try {
    var val = payload || {};
    localStorage.setItem(ETD_LATEST_KEY, JSON.stringify(val));
    var histRaw = localStorage.getItem(ETD_HISTORY_KEY);
    var hist = histRaw ? JSON.parse(histRaw) : [];
    if (!Array.isArray(hist)) hist = [];
    hist.unshift(val);
    if (hist.length > 100) hist = hist.slice(0, 100);
    localStorage.setItem(ETD_HISTORY_KEY, JSON.stringify(hist));
  } catch (e) {
    console.warn('Could not save latest ETD snapshot:', e);
  }
}

function getLatestEtdSnapshot() {
  try {
    var raw = localStorage.getItem(ETD_LATEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function getGhgSavingsSavedResults() {
  try {
    var raw = localStorage.getItem(GS_SAVED_RESULTS_KEY);
    var arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function setGhgSavingsSavedResults(list) {
  try {
    localStorage.setItem(GS_SAVED_RESULTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  } catch (e) {
    console.warn('Could not save GHG Savings records:', e);
  }
}

function ghgSavingsBuildRecordLabel(r) {
  var dt = new Date(r.savedAt || Date.now());
  var when = isNaN(dt.getTime()) ? (r.savedAt || '-') : dt.toLocaleString('en-GB');
  var country = r.country || 'N/A';
  return when + ' | ' + country + ' | Saving ' + fmt(r.saving_discharge || 0, 2) + '%';
}

function postToAppsScript(payload) {
  payload = Object.assign({}, payload, { token: APPS_TOKEN });
  return fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  }).then(function(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  });
}

function getEfHint(key) {
  var val = EF[key];
  if (val == null) return 'EF -';
  return 'EF ' + val;
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function toggleFactorPanel() {
  var panel = document.getElementById('factor-panel');
  var btn = document.getElementById('btn-toggle-factors');
  if (!panel || !btn) return;
  var open = !panel.classList.contains('open');
  if (open) {
    var pass = window.prompt('Enter passcode to manage factors:');
    if (pass !== '00000001') {
      showToast('Incorrect passcode', 'error');
      return;
    }
  }
  panel.classList.toggle('open', open);
  btn.textContent = open ? 'Hide factors' : 'Manage factors';
  if (open) renderFactorEditorRows();
}

function buildFactorRows() {
  return Object.keys(ALL_ITEMS_MAP).map(function(key) {
    return {
      key: key,
      label: ALL_ITEMS_MAP[key].label,
      ef: EF[key],
      reference: REFS[key] || '',
    };
  });
}

function renderFactorEditorRows() {
  var tb = document.getElementById('factor-tbody');
  if (!tb) return;
  factorRowsCache = buildFactorRows();
  var html = '';
  factorRowsCache.forEach(function(r) {
    html += '<tr>'
      + '<td><strong>' + escHtml(r.label) + '</strong><div style="font-size:10px;color:#9ca3af">' + escHtml(r.key) + '</div></td>'
      + '<td><input type="number" step="any" id="ef-edit-' + escHtml(r.key) + '" value="' + escHtml(r.ef) + '"></td>'
      + '<td><input type="text" id="ref-edit-' + escHtml(r.key) + '" value="' + escHtml(r.reference) + '"></td>'
      + '</tr>';
  });
  tb.innerHTML = html;
}

function refreshItemCardHints() {
  document.querySelectorAll('.ef-hint[data-ef-key]').forEach(function(el) {
    var key = el.getAttribute('data-ef-key');
    el.textContent = getEfHint(key);
  });
}

function applyEfMasterRows(rows) {
  if (!Array.isArray(rows)) return;
  var appliedCount = 0;
  rows.forEach(function(r) {
    if (!r || !r.key || !ALL_ITEMS_MAP[r.key]) return;
    var efVal = parseFloat(r.ef);
    var refVal = (typeof r.reference === 'string') ? r.reference.trim() : '';
    var updatedAt = (r.updatedAt == null) ? '' : String(r.updatedAt).trim();

    // Guard: if EF_MASTER row is still blank, many backends return ef=0.
    // Do not overwrite local defaults with those placeholder zeros.
    var looksLikeBlankRow = (efVal === 0 && !refVal && !updatedAt);
    if (looksLikeBlankRow) return;

    if (isFinite(efVal)) {
      EF[r.key] = efVal;
      appliedCount++;
    }
    if (typeof r.reference === 'string') REFS[r.key] = r.reference;
  });
  refreshItemCardHints();
  calculate();
  return appliedCount;
}

function reloadMasterFactors() {
  fetch(APPS_SCRIPT_URL + '?action=getEfMaster&token=' + APPS_TOKEN, { method: 'GET' })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(payload) {
      var rows = Array.isArray(payload) ? payload : payload.rows;
      if (!Array.isArray(rows)) throw new Error('Invalid EF master response');
      var appliedCount = applyEfMasterRows(rows) || 0;
      renderFactorEditorRows();
      if (appliedCount > 0) showToast('Factors reloaded', 'success');
      else showToast('EF_MASTER masih kosong, pakai default app', 'success');
    })
    .catch(function() {
      showToast('EF master not available, using local defaults', 'error');
    });
}

function saveMasterFactors() {
  var btn = document.getElementById('btn-save-factors');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  var rows;
  try {
    rows = Object.keys(ALL_ITEMS_MAP).map(function(key) {
      var efInput = document.getElementById('ef-edit-' + key);
      var refInput = document.getElementById('ref-edit-' + key);
      var efVal = efInput ? parseFloat(efInput.value) : NaN;
      if (!isFinite(efVal) || efVal < 0) throw new Error('Invalid EF for ' + key);
      return {
        key: key,
        label: ALL_ITEMS_MAP[key].label,
        ef: efVal,
        reference: refInput ? String(refInput.value || '').trim() : '',
        unit: ALL_ITEMS_MAP[key].unit,
      };
    });
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Save factors'; }
    showToast(err.message, 'error');
    return;
  }

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'updateEfMaster', token: APPS_TOKEN, rows: rows })
  })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(result) {
      if (result.status !== 'ok') throw new Error(result.message || 'Failed update');
      applyEfMasterRows(rows);
      renderFactorEditorRows();
      showToast('Global factors updated', 'success');
    })
    .catch(function(err) {
      showToast('Save factors failed: ' + err.message, 'error');
    })
    .finally(function() {
      if (btn) { btn.disabled = false; btn.textContent = 'Save factors'; }
    });
}

function toggleFormulas() {
  var wrap = document.getElementById('formula-wrap');
  var btn  = document.getElementById('btn-toggle-formulas');
  if (!wrap || !btn) return;
  var open = !wrap.classList.contains('open');
  wrap.classList.toggle('open', open);
  btn.textContent = open ? 'Hide formulas' : 'Show formulas';
  if (open) {
    // Show formulas for whatever is currently selected in the Results dropdown.
    if (typeof currentFilterSite !== 'undefined' && currentFilterSite !== 'all') {
      var record = null;
      for (var i = 0; i < ghgData.length; i++) {
        if (ghgData[i].site === currentFilterSite) { record = ghgData[i]; break; }
      }
      if (record) renderFormulasSaved(record);
      else renderFormulas();
    } else {
      renderFormulas();
    }
  }
}

function renderFormulas() {
  var wrap = document.getElementById('formula-wrap');
  if (!wrap || !wrap.classList.contains('open')) return;

  var mainEl = document.getElementById('formula-main');
  var itemsEl = document.getElementById('formula-items');
  var noteEl = document.getElementById('formula-note');
  if (!mainEl || !itemsEl || !noteEl) return;

  // Only for "current input" calculations (when R exists)
  if (!R || !R.total) {
    mainEl.innerHTML = '<div class="formula-hint">Belum ada kalkulasi. Isi input dulu ya.</div>';
    itemsEl.innerHTML = '';
    noteEl.textContent = '';
    return;
  }

  var rpomeDry = parseFloat(document.getElementById('af-rpome-dry').value.replace(/,/g,''))||0;
  var fadDry   = parseFloat(document.getElementById('af-fad-dry').value.replace(/,/g,''))||0;
  var rpomeAF  = parseFloat(document.getElementById('af-rpome-af').value)||0;
  var fadAF    = parseFloat(document.getElementById('af-fad-af').value)||0;

  function line(label, expr) {
    return '<div class="formula-line"><div class="formula-l">' + escHtml(label) + '</div><div class="formula-r formula-mono">' + escHtml(expr) + '</div></div>';
  }

  var mainHtml = '';
  var Lf = modeLabels();
  if (CALC_MODE === 'ggl') {
    mainHtml += line('Electricity', 'elec = value × EF = ' + fmt(R.elec,2));
    mainHtml += line('Solar', 'solar = value × EF = ' + fmt(R.solar || 0,2));
    mainHtml += line('Total Ep', 'elec + solar = ' + fmt(R.total,2));
  } else {
    mainHtml += line('Fuel total', 'coal + biosolar + lng = ' + fmt(R.coal,2) + ' + ' + fmt(R.biosolar,2) + ' + ' + fmt(R.lng,2) + ' = ' + fmt(R.fuelTotal,2));
    mainHtml += line('Chemical total', 'Σ chemicals = ' + fmt(R.chemTotal,2));
    mainHtml += line('Electricity', 'elec = value × EF = ' + fmt(R.elec,2));
    mainHtml += line('Water', 'water = value × EF = ' + fmt(R.water,2));
    mainHtml += line('Total Ep', 'fuel + chemical + elec + water = ' + fmt(R.total,2));
  }
  mainHtml += line(Lf.epDry1, 'total / dry mass stream 1 = ' + fmt(R.total,2) + ' / ' + fmt(rpomeDry,4) + ' = ' + fmt(R.epRpome,5));
  mainHtml += line(Lf.epDry2, 'total / fadDry = ' + fmt(R.total,2) + ' / ' + fmt(fadDry,4) + ' = ' + fmt(R.epFad,5));
  mainHtml += line(Lf.epAlloc1, 'ep₁ × AF₁ = ' + fmt(R.epRpome,5) + ' × ' + fmt(rpomeAF,6) + ' = ' + fmt(R.epRpomeAlloc,5));
  mainHtml += line(Lf.epAlloc2, 'ep₂ × AF₂ = ' + fmt(R.epFad,5) + ' × ' + fmt(fadAF,6) + ' = ' + fmt(R.epFadAlloc,5));
  if (CALC_MODE === 'biodiesel') {
    mainHtml += line('Ep g CO₂eq/MJ PME', '(total × AF₁ × 1000) / (dry kg PME × 37) = ' + fmt(R.epMj,5));
  }
  mainEl.innerHTML = mainHtml;

  // Per-item breakdown based on what user added.
  var itemLines = '';
  Object.keys(ITEMS).forEach(function(key) {
    if (!addedItems || !addedItems.has(key)) return;
    var item = ITEMS[key];
    var val = g(item.inputId);
    var ef  = EF[key];
    var res = val * ef;
    itemLines += line(item.label, fmt(val,3) + ' × ' + ef + ' = ' + fmt(res,2));
  });
  itemsEl.innerHTML = itemLines || '<div class="formula-hint">Belum ada item yang ditambahkan.</div>';

  noteEl.textContent = 'Rumus ini mengikuti perhitungan yang sama dengan tabel hasil dan export.';
}

function renderFormulasSaved(record) {
  var wrap = document.getElementById('formula-wrap');
  if (!wrap || !wrap.classList.contains('open')) return;
  var mainEl = document.getElementById('formula-main');
  var itemsEl = document.getElementById('formula-items');
  var noteEl = document.getElementById('formula-note');
  if (!mainEl || !itemsEl || !noteEl) return;

  if (!record) return;

  var raw = record.raw || {};
  var hasRaw = raw && (raw.total != null);

  function line(label, expr) {
    return '<div class="formula-line"><div class="formula-l">' + escHtml(label) + '</div><div class="formula-r formula-mono">' + escHtml(expr) + '</div></div>';
  }

  var total = hasRaw ? (parseFloat(raw.total) || 0) : (parseFloat(record.total) || 0);
  var epRpome = hasRaw ? (parseFloat(raw.epRpome) || 0) : (parseFloat(record.epRpome) || 0);
  var epFad = hasRaw ? (parseFloat(raw.epFad) || 0) : (parseFloat(record.epFad) || 0);
  var epRpomeAlloc = hasRaw ? (parseFloat(raw.epRpomeAlloc) || 0) : (parseFloat(record.epRpomeAlloc) || 0);
  var epFadAlloc = hasRaw ? (parseFloat(raw.epFadAlloc) || 0) : (parseFloat(record.epFadAlloc) || 0);
  var epMjSaved = hasRaw ? (parseFloat(raw.epMj) || 0) : (parseFloat(record.epMj) || 0);
  var savedCt = (raw.calcType || record.calcType || 'refinery').toString().toLowerCase();
  if (savedCt !== 'biodiesel' && savedCt !== 'ggl') savedCt = 'refinery';
  var Ls = epLabelSet(savedCt === 'ggl' ? 'refinery' : savedCt);
  Ls.epDry1 = Ls.dry1; Ls.epDry2 = Ls.dry2; Ls.epAlloc1 = Ls.a1; Ls.epAlloc2 = Ls.a2;

  var rpomeDry = parseFloat(raw.rpomeDry) || 0;
  var fadDry = parseFloat(raw.fadDry) || 0;
  var rpomeAF = parseFloat(raw.rpomeAF) || 0;
  var fadAF = parseFloat(raw.fadAF) || 0;

  var mainHtml = '';
  mainHtml += line('Total Ep', fmt(total,2));

  if (rpomeDry > 0) mainHtml += line(Ls.epDry1, fmt(total,2) + ' / ' + fmt(rpomeDry,4) + ' = ' + fmt(epRpome,5));
  else mainHtml += line(Ls.epDry1, fmt(epRpome,5) + ' (saved)');

  if (fadDry > 0) mainHtml += line(Ls.epDry2, fmt(total,2) + ' / ' + fmt(fadDry,4) + ' = ' + fmt(epFad,5));
  else mainHtml += line(Ls.epDry2, fmt(epFad,5) + ' (saved)');

  if (rpomeAF > 0) mainHtml += line(Ls.epAlloc1, fmt(epRpome,5) + ' × ' + fmt(rpomeAF,6) + ' = ' + fmt(epRpomeAlloc,5));
  else mainHtml += line(Ls.epAlloc1, fmt(epRpomeAlloc,5) + ' (saved)');

  if (fadAF > 0) mainHtml += line(Ls.epAlloc2, fmt(epFad,5) + ' × ' + fmt(fadAF,6) + ' = ' + fmt(epFadAlloc,5));
  else mainHtml += line(Ls.epAlloc2, fmt(epFadAlloc,5) + ' (saved)');

  if (savedCt === 'biodiesel') mainHtml += line('Ep g CO₂eq/MJ PME', fmt(epMjSaved,5) + ' (saved)');

  mainEl.innerHTML = mainHtml;

  // Breakdown items: only show if raw payload contains per-item numbers
  var itemKeys = ['coal','biosolar','lng','na2co3','na2so3','pac','naoh','cyclohex','nhex','ipa','hcl','be','h3po4','elec','solar','water','methanol','sodiumMethylate','citricAcid'];
  var itemHtml = '';
  var shown = 0;
  itemKeys.forEach(function(k) {
    if (!raw || raw[k] == null) return;
    var res = parseFloat(raw[k]) || 0;
    if (!res) return;
    var label = (ALL_ITEMS_MAP[k] && ALL_ITEMS_MAP[k].label) ? ALL_ITEMS_MAP[k].label : k;
    itemHtml += line(label, 'result = ' + fmt(res,2));
    shown++;
  });
  itemsEl.innerHTML = shown ? itemHtml : '<div class="formula-hint">Saved record lama belum menyimpan detail variable untuk breakdown. Save ulang sekali untuk dapat rumus lengkap.</div>';

  noteEl.textContent = 'Rumus diambil dari saved record (Google Sheets). Untuk rumus lengkap (dengan dry-ton & AF), save ulang setelah update ini.';
}

/* 
   ADD / REMOVE ITEMS
 */
function addItem() {
  const sel = document.getElementById('item-select');
  const key = sel.value;
  if (ITEM_INPUT_MODE !== 'manual') {
    showToast('Aktifkan Manual Select untuk menambah item satu-satu', 'error');
    return;
  }
  if (!key) { showToast('Please select an item first', 'error'); return; }
  if (!addItemByKey(key, { silentDuplicate: false })) return;
  sel.value = '';
}

function removeItem(key) {
  addedItems.delete(key);

  const hiddenInput = document.getElementById(ITEMS[key].inputId);
  if (hiddenInput) hiddenInput.value = '0';

  const card = document.getElementById('dyn-' + key);
  if (card) {
    card.style.animation = 'none';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-4px)';
    card.style.transition = 'all 0.15s ease';
    setTimeout(() => { card.remove(); updateEmptyState(); }, 150);
  }
  calculate();
}

function addItemByKey(key, opts) {
  opts = opts || {};
  var item = ITEMS[key];
  if (!item) return false;
  if (addedItems.has(key)) {
    if (!opts.silentDuplicate) showToast('"' + item.label + '" is already added', 'error');
    return false;
  }
  addedItems.add(key);
  renderItemCard(key);
  updateEmptyState();
  var hiddenInput = document.getElementById(item.inputId);
  if (hiddenInput && !opts.keepInputValue) hiddenInput.value = '';
  if (!opts.skipCalc) calculate();
  return true;
}

function clearAllItemCardsAndValues() {
  addedItems.clear();
  var container = document.getElementById('items-container');
  if (container) container.innerHTML = '';
  Object.keys(ITEMS).forEach(function(key) {
    var inputId = ITEMS[key] && ITEMS[key].inputId;
    var el = inputId ? document.getElementById(inputId) : null;
    if (el) el.value = '0';
  });
  updateEmptyState();
}

function addAllCurrentItems() {
  Object.keys(ITEMS).forEach(function(key) {
    addItemByKey(key, { silentDuplicate: true, skipCalc: true });
  });
  calculate();
}

function updateItemInputModeUi() {
  var isManual = ITEM_INPUT_MODE === 'manual';
  var sel = document.getElementById('item-select');
  var addBtn = document.getElementById('btn-add-item');
  var toggleBtn = document.getElementById('btn-manual-select');
  if (sel) {
    sel.disabled = !isManual;
    sel.classList.toggle('is-disabled', !isManual);
    if (!isManual) sel.value = '';
  }
  if (addBtn) {
    addBtn.disabled = !isManual;
    addBtn.classList.toggle('is-disabled', !isManual);
  }
  if (toggleBtn) {
    toggleBtn.textContent = isManual ? 'Show All Sources' : 'Manual Select';
  }
}

function setItemInputMode(mode, opts) {
  opts = opts || {};
  var force = !!opts.force;
  if (!force && mode === ITEM_INPUT_MODE) return;
  ITEM_INPUT_MODE = mode === 'manual' ? 'manual' : 'all';
  clearAllItemCardsAndValues();
  if (ITEM_INPUT_MODE === 'all') addAllCurrentItems();
  updateItemInputModeUi();
  updateEmptyState();
}

function toggleManualSelectMode() {
  var nextMode = ITEM_INPUT_MODE === 'manual' ? 'all' : 'manual';
  setItemInputMode(nextMode, { force: true });
  showToast(nextMode === 'manual' ? 'Manual Select aktif' : 'Semua emission sources ditampilkan', 'success');
}

function renderItemCard(key) {
  const item = ITEMS[key];
  const container = document.getElementById('items-container');
  const emptyEl = document.getElementById('items-empty');
  if (emptyEl) emptyEl.remove();

  const div = document.createElement('div');
  div.className = 'dynamic-item';
  div.id = 'dyn-' + key;
  div.innerHTML = `
    <div class="field" style="flex:1">
      <label>
        ${item.label}
        <span class="ef-hint" data-ef-key="${key}">${getEfHint(key)}</span>
        <span class="adder-badge ${GROUP_BADGE[item.group]}" style="margin-left:4px">${GROUP_LABEL[item.group]}</span>
      </label>
      <div class="input-wrap">
        <input type="number" placeholder="0" min="0"
               oninput="syncAndCalc('${key}', this.value)"
               style="min-width:0">
        <span class="input-unit">${item.unit}</span>
      </div>
    </div>
    <button class="remove-btn" onclick="removeItem('${key}')" title="Remove item">&times;</button>
  `;
  container.appendChild(div);
}

function syncAndCalc(key, val) {
  const hiddenInput = document.getElementById(ITEMS[key].inputId);
  if (hiddenInput) hiddenInput.value = val;
  calculate();
}

function updateEmptyState() {
  const container = document.getElementById('items-container');
  const hasItems = container.querySelector('.dynamic-item');
  let emptyEl = document.getElementById('items-empty');
  if (!hasItems && !emptyEl) {
    emptyEl = document.createElement('div');
    emptyEl.className = 'items-empty';
    emptyEl.id = 'items-empty';
    if (ITEM_INPUT_MODE === 'manual') {
      emptyEl.innerHTML = '<strong>No items added yet</strong>Select an emission source above and click <em>Add Item</em> to begin.';
    } else {
      emptyEl.innerHTML = '<strong>Semua emission source sudah dihapus</strong>Klik <em>Manual Select</em> untuk pilih satu-satu, atau klik <em>Show All Sources</em> untuk tampilkan ulang semua.';
    }
    container.appendChild(emptyEl);
  } else if (hasItems && emptyEl) {
    emptyEl.remove();
  }
}

/* 
   AF / FF CALCULATION
 */
function calculateAF() {
  const LHV = 37;
  const pomeC = g('af-pome-val'), pomeMC = g('af-pome-mc');
  const pomeDry = pomeC - (pomeC * pomeMC) / 100;
  sv('af-pome-dry', fmt(pomeDry,4));

  const rpomeC = g('af-rpome-val'), rpomeMC = g('af-rpome-mc');
  const rpomeF = rpomeC - (rpomeC * rpomeMC) / 100;
  const rpomeER = pomeC > 0 ? rpomeC / pomeC * 100 : 0;
  sv('af-rpome-dry', fmt(rpomeF,4));
  sv('af-rpome-er',  fmt(rpomeER,4));

  const fadC = g('af-fad-val'), fadMC = g('af-fad-mc');
  const fadF = fadC - (fadC * fadMC) / 100;
  const fadER = pomeC > 0 ? fadC / pomeC * 100 : 0;
  sv('af-fad-dry', fmt(fadF,4));
  sv('af-fad-er',  fmt(fadER,4));

  // Biodiesel: PME LHV=37, Crude Glycerine LHV=16 (IR 996/2022). Refinery: both LHV=37
  const rpomeLHV = LHV;
  const fadLHV   = (CALC_MODE === 'biodiesel') ? 16 : LHV;
  const totalE = (rpomeF * rpomeLHV) + (fadF * fadLHV);
  const rpomeAF = totalE > 0 ? (rpomeF * rpomeLHV) / totalE : 0;
  const fadAF   = totalE > 0 ? (fadF   * fadLHV)   / totalE : 0;
  // FF = (Feedstock_dry * LHV_feed) / (Product_dry * LHV_product) per IR 996/2022
  const rpomeFF = (rpomeF > 0) ? (pomeDry * LHV) / (rpomeF * rpomeLHV) : 0;
  const fadFF   = (fadF   > 0) ? (pomeDry * LHV) / (fadF   * fadLHV)   : 0;

  sv('af-rpome-af', fmt(rpomeAF,6));
  sv('af-rpome-ff', fmt(rpomeFF,6));
  sv('af-fad-af',   fmt(fadAF,6));
  sv('af-fad-ff',   fmt(fadFF,6));

  calculate();
}

/* 
   MAIN CALCULATION
 */
function calculate() {
  if (!CALC_MODE) return;

  var coal = 0, biosolar = 0, lng = 0, fuelTotal = 0;
  var na2co3 = 0, na2so3 = 0, pac = 0, naoh = 0, cyclohex = 0, nhex = 0, ipa = 0, hcl = 0, be = 0, h3po4 = 0;
  var methanol = 0, sodiumMethylate = 0, citricAcid = 0;
  var chemBase = 0, chemTotal = 0;
  var elec = 0, water = 0, solar = 0;
  var total = 0;

  if (CALC_MODE === 'ggl') {
    elec = g('r-elec') * EF.elec;
    solar = g('r-solar') * EF.solar;
    total = elec + solar;
  } else {
    coal = g('r-coal') * EF.coal;
    biosolar = g('r-biosolar') * EF.biosolar;
    lng = g('r-lng') * EF.lng;
    fuelTotal = coal + biosolar + lng;
    na2co3 = g('r-na2co3') * EF.na2co3;
    na2so3 = g('r-na2so3') * EF.na2so3;
    pac = g('r-pac') * EF.pac;
    naoh = g('r-naoh') * EF.naoh;
    cyclohex = g('r-cyclohex') * EF.cyclohex;
    nhex = g('r-nhex') * EF.nhex;
    ipa = g('r-ipa') * EF.ipa;
    hcl = g('r-hcl') * EF.hcl;
    be = g('r-be') * EF.be;
    h3po4 = g('r-h3po4') * EF.h3po4;
    methanol = g('r-methanol') * EF.methanol;
    sodiumMethylate = g('r-sodium_methylate') * EF.sodium_methylate;
    citricAcid = g('r-citric_acid') * EF.citric_acid;
    chemBase = na2co3 + na2so3 + pac + naoh + cyclohex + nhex + ipa + hcl + be + h3po4;
    chemTotal = chemBase + (CALC_MODE === 'biodiesel' ? (methanol + sodiumMethylate + citricAcid) : 0);
    elec = g('r-elec') * EF.elec;
    water = g('r-water') * EF.water;
    total = fuelTotal + chemTotal + elec + water;
  }

  const rpomeDry = parseFloat(document.getElementById('af-rpome-dry').value.replace(/,/g,''))||0;
  const fadDry   = parseFloat(document.getElementById('af-fad-dry').value.replace(/,/g,''))||0;
  const rpomeAF  = parseFloat(document.getElementById('af-rpome-af').value)||0;
  const fadAF    = parseFloat(document.getElementById('af-fad-af').value)||0;

  const epRpome      = rpomeDry > 0 ? total / rpomeDry : 0;
  const epFad        = fadDry   > 0 ? total / fadDry   : 0;
  const epRpomeAlloc = epRpome  * rpomeAF;
  const epFadAlloc   = epFad    * fadAF;

  const rpomeDryKg = rpomeDry * 1000;
  const mjPme = rpomeDryKg * 37;
  const epMj = (CALC_MODE === 'biodiesel' && mjPme > 0) ? ((total * rpomeAF) * 1000) / mjPme : 0;

  R = {
    coal,biosolar,lng,fuelTotal,na2co3,na2so3,pac,naoh,cyclohex,nhex,ipa,hcl,be,h3po4,
    methanol,sodiumMethylate,citricAcid,
    chemTotal,elec,water,solar,total,epRpome,epFad,epRpomeAlloc,epFadAlloc,epMj,
    epProduct1: epRpome, epProduct2: epFad, epAlloc1: epRpomeAlloc, epAlloc2: epFadAlloc,
    calcType: CALC_MODE,
  };

  const kco2 = v => fmt(v)+' kg COeq';
  if (CALC_MODE === 'ggl') {
    st('p-fuel', '—');
    st('p-chem', '—');
    st('p-elec', kco2(elec));
    st('p-solar', kco2(solar));
    st('p-water', '—');
  } else {
    st('p-fuel',  kco2(fuelTotal));
    st('p-chem',  kco2(chemTotal));
    st('p-elec',  kco2(elec));
    st('p-solar', '—');
    st('p-water', kco2(water));
  }
  st('p-total', fmt(total)+' kg COeq');
  st('p-ep-rpome',       fmt(epRpome,5)      +' kg COeq/dry-ton');
  st('p-ep-fad',         fmt(epFad,5)        +' kg COeq/dry-ton');
  st('p-ep-rpome-alloc', fmt(epRpomeAlloc,5) +' kg COeq/dry-ton');
  st('p-ep-fad-alloc',   fmt(epFadAlloc,5)   +' kg COeq/dry-ton');

  st('res-total', fmt(total,2)); st('res-rpome', fmt(epRpome,2));
  st('res-fad',   fmt(epFad,2)); st('res-alloc', fmt(epRpomeAlloc,2));
  st('res-epmj',  fmt(epMj,4));
  if (CALC_MODE === 'biodiesel') st('p-ep-mj', fmt(epMj,4) + ' g/MJ');
  else st('p-ep-mj', '—');

  const Lrow = modeLabels();
  var rows;
  if (CALC_MODE === 'ggl') {
    rows = [
      {cat:'A. Emissions Electricity'},
      {name:'Electricity', val:g('r-elec'), ef:EF.elec, res:elec, uom:'kg COeq/kWh', ref:REFS.elec},
      {cat:'B. Emissions Solar'},
      {name:'Solar', val:g('r-solar'), ef:EF.solar, res:solar, uom:'kg COeq/kWh', ref:REFS.solar},
    ];
  } else {
    rows = [
    {cat:'A. Emissions Fuel'},
    {name:'Coal',           val:g('r-coal'),     ef:EF.coal,    res:coal,     uom:'kg COeq / Kg',  ref:REFS.coal},
    {name:'Biosolar',       val:g('r-biosolar'), ef:EF.biosolar,res:biosolar, uom:'kg COeq / Kg',  ref:REFS.biosolar},
    {name:'LNG',            val:g('r-lng'),      ef:EF.lng,     res:lng,      uom:'kg COeq / m³',  ref:REFS.lng},
    {sub:'Fuel Total',      val:fuelTotal},
    {cat:'B. Emissions Chemical'},
    {name:'Sodium Carbonat',val:g('r-na2co3'),ef:EF.na2co3,res:na2co3,uom:'kg COeq/kg',ref:REFS.na2co3},
    {name:'Sodium Sulphite',val:g('r-na2so3'),ef:EF.na2so3,res:na2so3,uom:'kg COeq/kg',ref:REFS.na2so3},
    {name:'PAC',            val:g('r-pac'),   ef:EF.pac,   res:pac,   uom:'kg COeq/kg',ref:REFS.pac},
    {name:'NaOH',           val:g('r-naoh'),  ef:EF.naoh,  res:naoh,  uom:'kg COeq/kg',ref:REFS.naoh},
    {name:'Cycle-hexane',   val:g('r-cyclohex'),ef:EF.cyclohex,res:cyclohex,uom:'kg COeq/kg',ref:REFS.cyclohex},
    {name:'n-Hexane',       val:g('r-nhex'),  ef:EF.nhex,  res:nhex,  uom:'kg COeq/kg',ref:REFS.nhex},
    {name:'IPA',            val:g('r-ipa'),   ef:EF.ipa,   res:ipa,   uom:'kg COeq/kg',ref:REFS.ipa},
    {name:'HCl',            val:g('r-hcl'),   ef:EF.hcl,   res:hcl,   uom:'kg COeq/kg',ref:REFS.hcl},
    {name:'Bleaching Earth',val:g('r-be'),    ef:EF.be,    res:be,    uom:'kg COeq/kg',ref:REFS.be},
    {name:'Phosphoric Acid',val:g('r-h3po4'), ef:EF.h3po4, res:h3po4, uom:'kg COeq/kg',ref:REFS.h3po4},
    ...(CALC_MODE === 'biodiesel' ? [
    {name:'Methanol', val:g('r-methanol'), ef:EF.methanol, res:methanol, uom:'kg COeq/kg', ref:REFS.methanol},
    {name:'Sodium methylate', val:g('r-sodium_methylate'), ef:EF.sodium_methylate, res:sodiumMethylate, uom:'kg COeq/kg', ref:REFS.sodium_methylate},
    {name:'Citric acid', val:g('r-citric_acid'), ef:EF.citric_acid, res:citricAcid, uom:'kg COeq/kg', ref:REFS.citric_acid},
    ] : []),
    {sub:'Chemical Total',  val:chemTotal},
    {cat:'C. Emissions Electricity'},
    {name:'Electricity',    val:g('r-elec'),  ef:EF.elec,  res:elec,  uom:'kg COeq/kWh',ref:REFS.elec},
    {cat:'D. Emissions Water'},
    {name:'Process Water',  val:g('r-water'), ef:EF.water, res:water, uom:'kg COeq/kg', ref:REFS.water},
    ];
  }
  let html='';
  rows.forEach(r=>{
    if(r.cat) html+=`<tr class="cat-row"><td colspan="6">${r.cat}</td></tr>`;
    else if(r.sub) html+=`<tr><td colspan="3" style="text-align:right;color:#9ca3af;font-size:11px;padding:6px 12px">${r.sub}</td><td></td><td class="c-blue" style="font-weight:600">${fmt(r.val)}</td><td></td></tr>`;
    else html+=`<tr><td>${r.name}</td><td style="color:#6b7280">${r.val?fmt(r.val,3):'0'}</td><td style="color:#6b7280">${r.ef}</td><td style="color:#9ca3af;font-size:11px">${r.uom}</td><td style="font-weight:500">${fmt(r.res)}</td><td style="color:#d1d5db;font-size:11px">${r.ref}</td></tr>`;
  });
  html+=`
    <tr style="background:#f9fafb;border-top:2px solid #e5e7eb">
      <td colspan="3" style="font-weight:600">Sum of Process Emissions</td><td></td>
      <td class="c-blue" style="font-weight:700;font-size:14px">${fmt(total)}</td><td style="color:#9ca3af;font-size:11px">kg COeq</td>
    </tr>
    <tr><td colspan="3" style="color:#9ca3af;padding-top:6px">${Lrow.epDry1}</td><td></td><td class="c-green" style="font-weight:600">${fmt(epRpome,5)}</td><td style="color:#9ca3af;font-size:11px">kg COeq/dry-ton</td></tr>
    <tr><td colspan="3" style="color:#9ca3af">${Lrow.epDry2}</td><td></td><td class="c-purple" style="font-weight:600">${fmt(epFad,5)}</td><td style="color:#9ca3af;font-size:11px">kg COeq/dry-ton</td></tr>
    <tr><td colspan="3" style="color:#9ca3af">${Lrow.epAlloc1}</td><td></td><td class="c-green" style="font-weight:600">${fmt(epRpomeAlloc,5)}</td><td style="color:#9ca3af;font-size:11px">kg COeq/dry-ton</td></tr>
    <tr><td colspan="3" style="color:#9ca3af;padding-bottom:8px">${Lrow.epAlloc2}</td><td></td><td class="c-purple" style="font-weight:600">${fmt(epFadAlloc,5)}</td><td style="color:#9ca3af;font-size:11px">kg COeq/dry-ton</td></tr>`;
  if (CALC_MODE === 'biodiesel') {
    html += `<tr><td colspan="3" style="color:#9ca3af;padding-bottom:8px">Ep (allocated) — g CO₂eq/MJ PME</td><td></td><td class="c-amber" style="font-weight:600">${fmt(epMj,5)}</td><td style="color:#9ca3af;font-size:11px">g CO₂eq/MJ</td></tr>`;
  }
  html += '';
  document.getElementById('result-tbody').innerHTML = html;
  renderFormulas();
}

/* 
   GOOGLE SHEETS INTEGRATION
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxySFd-Gr18TkwKIDGp1CYbr6EXWBmhz4GpnU75hS6yjguaqI7-m1Cbo-uyhTXP4pwP/exec';
const APPS_TOKEN = 'ghg111111117-calcu-ssttn';

function buildAppsScriptUrl(params) {
  var q = ['token=' + encodeURIComponent(APPS_TOKEN)];
  if (params) {
    Object.keys(params).forEach(function(key) {
      if (params[key] != null && params[key] !== '') {
        q.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    });
  }
  return APPS_SCRIPT_URL + '?' + q.join('&');
}

function fetchGhgSavingsDatacenter() {
  ghgSavingsUpdateDatacenterStatus('Loading GHG Savings Datacenter…', false);
  fetch(buildAppsScriptUrl({ action: 'getGhgSavingsDatacenter' }), {
    method: 'GET',
    redirect: 'follow',
  })
  .then(function(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' — ' + response.statusText);
    return response.json();
  })
  .then(function(data) {
    if (data && data.status === 'error') throw new Error(data.message || 'getGhgSavingsDatacenter failed');
    var rows = Array.isArray(data) ? data : [];
    if (rows.length && !gsIsGhgSavingsDatacenterRow(rows[0])) {
      throw new Error('Backend masih return GHG Log. Deploy Apps Script terbaru (action getGhgSavingsDatacenter).');
    }
    gsDatacenterRows = rows.map(gsNormalizeGhgSavingsDatacenterRow).filter(function(r) { return r.site; });
    if (typeof ghgSavingsRenderDatacenterSiteList === 'function') ghgSavingsRenderDatacenterSiteList();
  })
  .catch(function(err) {
    console.warn('fetchGhgSavingsDatacenter error:', err);
    gsDatacenterRows = [];
    if (typeof ghgSavingsUpdateDatacenterStatus === 'function') {
      ghgSavingsUpdateDatacenterStatus(err.message || 'Gagal load Datacenter', true);
    }
    if (typeof ghgSavingsRenderDatacenterSiteList === 'function') ghgSavingsRenderDatacenterSiteList();
  });
}

function fetchHistory() {
  var tb = document.getElementById('history-tbody');

  tb.innerHTML =
    '<tr><td colspan="11" class="empty" style="color:#9ca3af">'
    + '<span style="display:inline-block;animation:pulse 1.2s ease-in-out infinite">'
    + ' Loading records from Google Sheets…'
    + '</span></td></tr>';
  fetch(buildAppsScriptUrl(), {
    method:  'GET',
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' — ' + response.statusText);
    }
    return response.json();
  })
  .then(function(data) {
    // Support multiple backend response shapes:
    // - [] (array of rows)
    // - { rows: [] }
    // - { status:'error', message:'...' }
    var rowsPayload = data;
    if (!Array.isArray(rowsPayload)) {
      if (rowsPayload && Array.isArray(rowsPayload.rows)) rowsPayload = rowsPayload.rows;
      else if (rowsPayload && (rowsPayload.status === 'error' || rowsPayload.error)) {
        throw new Error(rowsPayload.message || rowsPayload.error || 'Backend error');
      } else {
        throw new Error('Unexpected response format');
      }
    }
    data = rowsPayload;

    function buildSummaryDetail(totalVal, epRpomeVal, epFadVal, epRpomeAllocVal, epFadAllocVal, calcType, epMjVal) {
      var ct = (calcType === 'biodiesel') ? 'biodiesel' : (calcType === 'ggl' ? 'ggl' : 'refinery');
      var epL = epLabelSet(ct === 'ggl' ? 'refinery' : ct);
      if (ct === 'ggl') {
        return [
          { type:'cat',  description:'A. Emissions Electricity' },
          { type:'item', description:'Electricity',     value: 0, ef:EF.elec,  uom:'kg CO\u2082eq/kWh', result:0, ref:REFS.elec },
          { type:'cat',  description:'B. Emissions Solar' },
          { type:'item', description:'Solar',           value: 0, ef:EF.solar, uom:'kg CO\u2082eq/kWh', result:0, ref:REFS.solar },
          { type:'total', description:'Sum of Process Emissions', result: totalVal },
          { type:'ep',    description: epL.dry1,       result: epRpomeVal,      uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep',    description: epL.dry2,    result: epFadVal,        uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep',    description: epL.a1,       result: epRpomeAllocVal, uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep',    description: epL.a2,    result: epFadAllocVal,   uom:'kg CO\u2082eq/dry-ton' },
        ];
      }
      var out = [
        { type:'cat',  description:'A. Emissions Fuel' },
        { type:'item', description:'Coal',            value: 0, ef:EF.coal,     uom:'kg CO\u2082eq / Kg',  result:0, ref:REFS.coal },
        { type:'item', description:'Biosolar',        value: 0, ef:EF.biosolar, uom:'kg CO\u2082eq / Kg',  result:0, ref:REFS.biosolar },
        { type:'item', description:'LNG',             value: 0, ef:EF.lng,      uom:'kg CO\u2082eq / m\u00b3', result:0, ref:REFS.lng },
        { type:'sub',  description:'Fuel Total',      result:0 },
        { type:'cat',  description:'B. Emissions Chemical' },
        { type:'item', description:'Sodium Carbonat', value: 0, ef:EF.na2co3,   uom:'kg CO\u2082eq/kg', result:0, ref:REFS.na2co3 },
        { type:'item', description:'Sodium Sulphite', value: 0, ef:EF.na2so3,   uom:'kg CO\u2082eq/kg', result:0, ref:REFS.na2so3 },
        { type:'item', description:'PAC',             value: 0, ef:EF.pac,      uom:'kg CO\u2082eq/kg', result:0, ref:REFS.pac },
        { type:'item', description:'NaOH',            value: 0, ef:EF.naoh,     uom:'kg CO\u2082eq/kg', result:0, ref:REFS.naoh },
        { type:'item', description:'Cycle-hexane',    value: 0, ef:EF.cyclohex, uom:'kg CO\u2082eq/kg', result:0, ref:REFS.cyclohex },
        { type:'item', description:'n-Hexane',        value: 0, ef:EF.nhex,     uom:'kg CO\u2082eq/kg', result:0, ref:REFS.nhex },
        { type:'item', description:'IPA',             value: 0, ef:EF.ipa,      uom:'kg CO\u2082eq/kg', result:0, ref:REFS.ipa },
        { type:'item', description:'HCl',             value: 0, ef:EF.hcl,      uom:'kg CO\u2082eq/kg', result:0, ref:REFS.hcl },
        { type:'item', description:'Bleaching Earth', value: 0, ef:EF.be,       uom:'kg CO\u2082eq/kg', result:0, ref:REFS.be },
        { type:'item', description:'Phosphoric Acid', value: 0, ef:EF.h3po4,    uom:'kg CO\u2082eq/kg', result:0, ref:REFS.h3po4 },
        { type:'sub',  description:'Chemical Total',  result:0 },
        { type:'cat',  description:'C. Emissions Electricity' },
        { type:'item', description:'Electricity',     value: 0, ef:EF.elec,     uom:'kg CO\u2082eq/kWh', result:0, ref:REFS.elec },
        { type:'cat',  description:'D. Emissions Water' },
        { type:'item', description:'Process Water',   value: 0, ef:EF.water,    uom:'kg CO\u2082eq/kg',  result:0, ref:REFS.water },
        { type:'total', description:'Sum of Process Emissions', result: totalVal },
        { type:'ep',    description: epL.dry1,       result: epRpomeVal,      uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.dry2,    result: epFadVal,        uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.a1,       result: epRpomeAllocVal, uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.a2,    result: epFadAllocVal,   uom:'kg CO\u2082eq/dry-ton' },
      ];
      if (ct === 'biodiesel') {
        out.push({ type:'ep', description:'Ep (allocated) — g CO\u2082eq/MJ PME', result: epMjVal || 0, uom:'g CO\u2082eq/MJ' });
      }
      return out;
    }

    function pick(row, keys, fallback) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (row && row[k] != null && String(row[k]).trim() !== '') return row[k];
      }
      return fallback;
    }

    ghgData = data.map(function(row) {
      var siteName = String(pick(row, ['site','Site','SITE'], '') || '').trim();
      var periodVal = pick(row, ['period','Period','PERIOD','year','Year','YEAR'], '');
      var savedAtVal = pick(row, ['savedAt','saved_at','SavedAt','SAVEDAT','saved'], '');
      var idVal = pick(row, ['id','ID','Id'], '');
      // Support sheet header variants for raw payload
      var rawPayloadStr = pick(row, ['rawPayload','rawPayloadJSON','raw_payload','RawPayload','Raw Payload JSON','RawPayloadJSON'], '');

      var parsedPayload = {};
      if (rawPayloadStr) {
        try {
          parsedPayload = JSON.parse(rawPayloadStr);
        } catch (e) {
          console.warn('Could not parse rawPayload for record', idVal || row.id, e);
        }
      }

      var calcType = (row.calcType || parsedPayload.calcType || 'refinery').toString().toLowerCase();
      if (calcType !== 'biodiesel' && calcType !== 'ggl') calcType = 'refinery';

      var totalVal = parseFloat(row.total) || 0;
      var epRpomeVal = parseFloat(row.epProduct1 != null ? row.epProduct1 : row.epRpome) || 0;
      var epFadVal = parseFloat(row.epProduct2 != null ? row.epProduct2 : row.epFad) || 0;
      var epRpomeAllocVal = parseFloat(row.epAlloc1 != null ? row.epAlloc1 : row.epRpomeAlloc) || 0;
      var epFadAllocVal = parseFloat(row.epAlloc2 != null ? row.epAlloc2 : row.epFadAlloc) || 0;
      var epMjVal = parseFloat(row.epMj != null ? row.epMj : parsedPayload.epMj) || 0;

      var epL = epLabelSet(calcType === 'ggl' ? 'refinery' : calcType);

      var detail = parsedPayload.total != null ? (
        calcType === 'ggl' ? [
          { type:'cat',  description:'A. Emissions Electricity' },
          { type:'item', description:'Electricity', value: parsedPayload.elec || 0, ef:EF.elec, uom:'kg CO\u2082eq/kWh', result: parsedPayload.elec || 0, ref:REFS.elec },
          { type:'cat',  description:'B. Emissions Solar' },
          { type:'item', description:'Solar', value: parsedPayload.solar || 0, ef:EF.solar, uom:'kg CO\u2082eq/kWh', result: parsedPayload.solar || 0, ref:REFS.solar },
          { type:'total', description:'Sum of Process Emissions', result: parsedPayload.total || 0 },
          { type:'ep', description: epL.dry1, result: parsedPayload.epProduct1 != null ? parsedPayload.epProduct1 : (parsedPayload.epRpome || 0), uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep', description: epL.dry2, result: parsedPayload.epProduct2 != null ? parsedPayload.epProduct2 : (parsedPayload.epFad || 0), uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep', description: epL.a1, result: parsedPayload.epAlloc1 != null ? parsedPayload.epAlloc1 : (parsedPayload.epRpomeAlloc || 0), uom:'kg CO\u2082eq/dry-ton' },
          { type:'ep', description: epL.a2, result: parsedPayload.epAlloc2 != null ? parsedPayload.epAlloc2 : (parsedPayload.epFadAlloc || 0), uom:'kg CO\u2082eq/dry-ton' },
        ] : [
        { type:'cat',  description:'A. Emissions Fuel' },
        { type:'item', description:'Coal',            value: parsedPayload.coal      || 0, ef:EF.coal,     uom:'kg CO\u2082eq / Kg',      result: parsedPayload.coal      || 0, ref:REFS.coal     },
        { type:'item', description:'Biosolar',        value: parsedPayload.biosolar  || 0, ef:EF.biosolar, uom:'kg CO\u2082eq / Kg',      result: parsedPayload.biosolar  || 0, ref:REFS.biosolar },
        { type:'item', description:'LNG',             value: parsedPayload.lng       || 0, ef:EF.lng,      uom:'kg CO\u2082eq / m\u00b3', result: parsedPayload.lng       || 0, ref:REFS.lng      },
        { type:'sub',  description:'Fuel Total',      result: parsedPayload.fuelTotal || 0 },
        { type:'cat',  description:'B. Emissions Chemical' },
        { type:'item', description:'Sodium Carbonat', value: parsedPayload.na2co3    || 0, ef:EF.na2co3,   uom:'kg CO\u2082eq/kg', result: parsedPayload.na2co3    || 0, ref:REFS.na2co3   },
        { type:'item', description:'Sodium Sulphite', value: parsedPayload.na2so3    || 0, ef:EF.na2so3,   uom:'kg CO\u2082eq/kg', result: parsedPayload.na2so3    || 0, ref:REFS.na2so3   },
        { type:'item', description:'PAC',             value: parsedPayload.pac       || 0, ef:EF.pac,      uom:'kg CO\u2082eq/kg', result: parsedPayload.pac       || 0, ref:REFS.pac      },
        { type:'item', description:'NaOH',            value: parsedPayload.naoh      || 0, ef:EF.naoh,     uom:'kg CO\u2082eq/kg', result: parsedPayload.naoh      || 0, ref:REFS.naoh     },
        { type:'item', description:'Cycle-hexane',    value: parsedPayload.cyclohex  || 0, ef:EF.cyclohex, uom:'kg CO\u2082eq/kg', result: parsedPayload.cyclohex  || 0, ref:REFS.cyclohex },
        { type:'item', description:'n-Hexane',        value: parsedPayload.nhex      || 0, ef:EF.nhex,     uom:'kg CO\u2082eq/kg', result: parsedPayload.nhex      || 0, ref:REFS.nhex     },
        { type:'item', description:'IPA',             value: parsedPayload.ipa       || 0, ef:EF.ipa,      uom:'kg CO\u2082eq/kg', result: parsedPayload.ipa       || 0, ref:REFS.ipa      },
        { type:'item', description:'HCl',             value: parsedPayload.hcl       || 0, ef:EF.hcl,      uom:'kg CO\u2082eq/kg', result: parsedPayload.hcl       || 0, ref:REFS.hcl      },
        { type:'item', description:'Bleaching Earth', value: parsedPayload.be        || 0, ef:EF.be,       uom:'kg CO\u2082eq/kg', result: parsedPayload.be        || 0, ref:REFS.be       },
        { type:'item', description:'Phosphoric Acid', value: parsedPayload.h3po4     || 0, ef:EF.h3po4,    uom:'kg CO\u2082eq/kg', result: parsedPayload.h3po4     || 0, ref:REFS.h3po4    },
      ].concat(calcType === 'biodiesel' ? [
        { type:'item', description:'Methanol', value: parsedPayload.methanol || 0, ef:EF.methanol, uom:'kg CO\u2082eq/kg', result: parsedPayload.methanol || 0, ref:REFS.methanol },
        { type:'item', description:'Sodium methylate', value: parsedPayload.sodiumMethylate || 0, ef:EF.sodium_methylate, uom:'kg CO\u2082eq/kg', result: parsedPayload.sodiumMethylate || 0, ref:REFS.sodium_methylate },
        { type:'item', description:'Citric acid', value: parsedPayload.citricAcid || 0, ef:EF.citric_acid, uom:'kg CO\u2082eq/kg', result: parsedPayload.citricAcid || 0, ref:REFS.citric_acid },
      ] : []).concat([
        { type:'sub',  description:'Chemical Total',  result: parsedPayload.chemTotal || 0 },
        { type:'cat',  description:'C. Emissions Electricity' },
        { type:'item', description:'Electricity',     value: parsedPayload.elec      || 0, ef:EF.elec,     uom:'kg CO\u2082eq/kWh', result: parsedPayload.elec     || 0, ref:REFS.elec     },
        { type:'cat',  description:'D. Emissions Water' },
        { type:'item', description:'Process Water',   value: parsedPayload.water     || 0, ef:EF.water,    uom:'kg CO\u2082eq/kg',  result: parsedPayload.water    || 0, ref:REFS.water    },
        { type:'total', description:'Sum of Process Emissions', result: parsedPayload.total        || 0 },
        { type:'ep',    description: epL.dry1,       result: parsedPayload.epProduct1 != null ? parsedPayload.epProduct1 : (parsedPayload.epRpome      || 0), uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.dry2,    result: parsedPayload.epProduct2 != null ? parsedPayload.epProduct2 : (parsedPayload.epFad        || 0), uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.a1,       result: parsedPayload.epAlloc1 != null ? parsedPayload.epAlloc1 : (parsedPayload.epRpomeAlloc || 0), uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep',    description: epL.a2,    result: parsedPayload.epAlloc2 != null ? parsedPayload.epAlloc2 : (parsedPayload.epFadAlloc   || 0), uom:'kg CO\u2082eq/dry-ton' },
      ]).concat(calcType === 'biodiesel' ? [
        { type:'ep', description:'Ep (allocated) — g CO\u2082eq/MJ PME', result: epMjVal, uom:'g CO\u2082eq/MJ' },
      ] : [])
      )
      : buildSummaryDetail(totalVal, epRpomeVal, epFadVal, epRpomeAllocVal, epFadAllocVal, calcType, epMjVal);

      return {
        id:           idVal || row.id || '',
        savedAt:      savedAtVal || row.savedAt || row.saved_at || '',
        period:       periodVal || row.period || row.year || '',
        site:         siteName,
        calcType:     calcType,
        total:        totalVal,
        epRpome:      epRpomeVal,
        epFad:        epFadVal,
        epRpomeAlloc: epRpomeAllocVal,
        epFadAlloc:   epFadAllocVal,
        epMj:         epMjVal,
        detail:       detail,
        raw:          parsedPayload,
      };
    });

    renderHistory();
  })
  .catch(function(err) {
    console.error('fetchHistory error:', err);
    tb.innerHTML =
      '<tr><td colspan="11" class="empty" style="color:#dc2626">'
      + ' Could not load records: ' + err.message
      + '</td></tr>';
  });
}

function fetchEtdLog() {
  return fetch(buildAppsScriptUrl({ action: 'getEtdLog' }), {
    method: 'GET',
  })
  .then(function(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status + ' — ' + response.statusText);
    return response.json();
  })
  .then(function(data) {
    if (!Array.isArray(data)) data = [];
    etdData = data.map(function(row) {
      return {
        id: String(row.id || '').trim(),
        savedAt: String(row.savedAt || row.saved_at || '').trim(),
        period: String(row.period || row.year || '').trim(),
        site: String(row.site || row.supplier || '').trim(),
        route: String(row.route || row.destinationLabel || '').trim(),
        etdValue: parseFloat(row.etdValue) || 0,
      };
    }).filter(function(r) {
      return r.site || r.period || r.savedAt || r.etdValue;
    });
    _syncEtdResultsFromSheetRows_(data);
    renderEtdResultsList();
    return data;
  })
  .catch(function(err) {
    console.warn('fetchEtdLog error:', err);
    etdData = [];
    renderEtdResultsList();
    return [];
  });
}

function saveToSheet() {
  if (!CALC_MODE) { showToast('Buka kalkulator dari menu overview dulu', 'error'); return; }
  if (!R.total) { showToast('Run a calculation first', 'error'); return; }
  const site = document.getElementById('sel-site').value.trim();
  if (!site) { showToast('Please specify a Site first!', 'error'); document.getElementById('sel-site').focus(); return; }
  var duplicateSite = ghgData.some(function(h) {
    return String(h.site || '').trim().toLowerCase() === site.toLowerCase();
  });
  if (duplicateSite) {
    showToast('Site name already exists. Please use a different name.', 'error');
    document.getElementById('sel-site').focus();
    return;
  }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const year = String(document.getElementById('sel-year').value).trim();
  const rpomeDry = parseFloat(document.getElementById('af-rpome-dry').value.replace(/,/g,''))||0;
  const fadDry   = parseFloat(document.getElementById('af-fad-dry').value.replace(/,/g,''))||0;
  const rpomeAF  = parseFloat(document.getElementById('af-rpome-af').value)||0;
  const fadAF    = parseFloat(document.getElementById('af-fad-af').value)||0;
  const rpomeER  = parseFloat(String(document.getElementById('af-rpome-er').value).replace(/,/g,''))||0;
  const fadER    = parseFloat(String(document.getElementById('af-fad-er').value).replace(/,/g,''))||0;
  const rpomeFF  = parseFloat(String(document.getElementById('af-rpome-ff').value).replace(/,/g,''))||0;
  const fadFF    = parseFloat(String(document.getElementById('af-fad-ff').value).replace(/,/g,''))||0;
  const pomeVal  = parseFloat(String(document.getElementById('af-pome-val').value).replace(/,/g,''))||0;
  const rpomeVal = parseFloat(String(document.getElementById('af-rpome-val').value).replace(/,/g,''))||0;
  const fadVal   = parseFloat(String(document.getElementById('af-fad-val').value).replace(/,/g,''))||0;

  // Store extra variables so saved-record formulas can be shown later.
  const rawPayloadObj = Object.assign({}, R, {
    rpomeDry: rpomeDry,
    fadDry: fadDry,
    rpomeAF: rpomeAF,
    fadAF: fadAF,
    rpomeER: rpomeER,
    fadER: fadER,
    rpomeFF: rpomeFF,
    fadFF: fadFF,
    pomeVal: pomeVal,
    rpomeVal: rpomeVal,
    fadVal: fadVal,
  });

  const payload = JSON.stringify({
    year:         year,
    site:         site,
    calcType:     CALC_MODE,
    total:        R.total,
    epProduct1:   R.epProduct1,
    epProduct2:   R.epProduct2,
    epAlloc1:     R.epAlloc1,
    epAlloc2:     R.epAlloc2,
    epMj:         R.epMj,
    methanol:     R.methanol,
    sodiumMethylate: R.sodiumMethylate,
    citricAcid:   R.citricAcid,
    epRpome:      R.epRpome,
    epFad:        R.epFad,
    epRpomeAlloc: R.epRpomeAlloc,
    epFadAlloc:   R.epFadAlloc,
    coal:         R.coal,
    biosolar:     R.biosolar,
    lng:          R.lng,
    fuelTotal:    R.fuelTotal,
    na2co3:       R.na2co3,
    na2so3:       R.na2so3,
    pac:          R.pac,
    naoh:         R.naoh,
    cyclohex:     R.cyclohex,
    nhex:         R.nhex,
    ipa:          R.ipa,
    hcl:          R.hcl,
    be:           R.be,
    h3po4:        R.h3po4,
    chemTotal:    R.chemTotal,
    elec:         R.elec,
    solar:        R.solar || 0,
    water:        R.water,
    rawPayload:   JSON.stringify(rawPayloadObj),
    rawPayloadJSON: JSON.stringify(rawPayloadObj),
    raw_payload:  JSON.stringify(rawPayloadObj),
  });

  fetch(APPS_SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    (function(){ try { var p = JSON.parse(payload); p.token = APPS_TOKEN; return JSON.stringify(p); } catch(e) { return payload; } })(),
  })
  .then(function(response) {
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    return response.json();
  })
  .then(function(result) {
    if (result.status !== 'ok') {
      throw new Error(result.message || 'Server returned an error');
    }
    fetchHistory();
    showToast('Saved to Sheet! (ID: ' + result.id + ')', 'success');
    btn.disabled = false;
    btn.textContent = 'Save Calculation';
  })
  .catch(function(err) {
    console.error('saveToSheet error:', err);
    showToast('Save failed — check console', 'error');
    alert(
      'SAVE ERROR\n\n' + err.message + '\n\n' +
      'Checklist:\n' +
      '1. Apps Script deployed with "Who has access: Anyone"\n' +
      '2. Created a NEW deployment after any code edit (not Update)\n' +
      '3. Open DevTools (F12)  Network for details'
    );
    btn.disabled = false;
    btn.textContent = 'Save Calculation';
  });
}

/* 
   HISTORY / RESET / UTILITIES
 */
function renderHistory() {
  var sel     = document.getElementById('history-filter');
  var countEl = document.getElementById('history-count');

  var prevVal   = sel ? sel.value : 'all';
  var siteNames = [];
  var seen = {};
  for (var i = 0; i < ghgData.length; i++) {
    var s = ghgData[i].site;
    if (s && s !== '-' && !seen[s]) { seen[s] = true; siteNames.push(s); }
  }
  siteNames.sort();

  if (sel) {
    var opts = '<option value="all">All Sites</option>';
    for (var i = 0; i < siteNames.length; i++) {
      opts += '<option value="' + siteNames[i] + '"' + (siteNames[i] === prevVal ? ' selected' : '') + '>' + siteNames[i] + '</option>';
    }
    sel.innerHTML = opts;
    sel.value = (prevVal !== 'all' && siteNames.indexOf(prevVal) !== -1) ? prevVal : 'all';
  }

  var filterVal = sel ? sel.value : 'all';
  var filtered = filterVal === 'all' ? ghgData : ghgData.filter(function(h) { return h.site === filterVal; });
  var label = filterVal === 'all' ? 'All Sites' : filterVal;
  countEl.textContent = 'Showing ' + filtered.length + ' record' + (filtered.length !== 1 ? 's' : '') + ' for ' + label;

  var tb = document.getElementById('history-tbody');
  if (!filtered.length) {
    tb.innerHTML = '<tr><td colspan="11" class="empty">' + (ghgData.length ? 'No records for this site' : 'No saved calculations yet') + '</td></tr>';
    return;
  }

  var rows = '';
  for (var i = 0; i < filtered.length; i++) {
    var h = filtered[i];
    var displayPeriod = String(h.period).replace(/[A-Za-z]+\s*/g, '').trim() || h.period;
    var typeLabel = (h.calcType === 'biodiesel') ? 'Biodiesel' : (h.calcType === 'ggl') ? 'Processing GGL' : 'Refinery';
    var epMjDisp = (h.calcType === 'biodiesel') ? fmt(h.epMj || 0, 2) : '—';
    rows += '<tr>'
      + '<td style="font-weight:500">'               + displayPeriod          + '</td>'
      + '<td style="font-size:11px;color:#6b7280">' + typeLabel               + '</td>'
      + '<td style="color:#6b7280">'                 + h.site                 + '</td>'
      + '<td class="c-blue" style="font-weight:500">'+ fmt(h.total)           + '</td>'
      + '<td class="c-green">'                       + fmt(h.epRpome, 2)      + '</td>'
      + '<td class="c-purple">'                      + fmt(h.epFad, 2)        + '</td>'
      + '<td class="c-amber">'                       + fmt(h.epRpomeAlloc, 2) + '</td>'
      + '<td class="c-purple">'                      + fmt(h.epFadAlloc, 2)   + '</td>'
      + '<td style="font-size:11px">'                + epMjDisp               + '</td>'
      + '<td style="color:#9ca3af;font-size:11px">'  + h.savedAt              + '</td>'
      + '<td><button class="btn btn-outline btn-sm" onclick="delH(\'' + h.id + '\')"></button></td>'
      + '</tr>';
  }
  tb.innerHTML = rows;
  updateResultSiteDropdown();
}

function openExportModal() {
  if (!ghgData.length) { showToast('No records to export', 'error'); return; }

  var siteNames = [];
  var seen = {};
  for (var i = 0; i < ghgData.length; i++) {
    var s = ghgData[i].site;
    if (s && s !== '-' && !seen[s]) { seen[s] = true; siteNames.push(s); }
  }
  siteNames.sort();

  var sel = document.getElementById('modal-export-site');
  var opts = '<option value="all">All Sites</option>';
  for (var i = 0; i < siteNames.length; i++) {
    opts += '<option value="' + siteNames[i] + '">' + siteNames[i] + '</option>';
  }
  sel.innerHTML = opts;

  var histFilter = document.getElementById('history-filter');
  if (histFilter && histFilter.value !== 'all') sel.value = histFilter.value;

  document.getElementById('export-modal').classList.add('open');
}

function closeExportModal(evt) {
  if (evt && evt.target !== document.getElementById('export-modal')) return;
  document.getElementById('export-modal').classList.remove('open');
}

function triggerExcelDownload() {
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded. Check your internet connection.'); return; }

  var sel       = document.getElementById('modal-export-site');
  var filterVal = sel ? sel.value : 'all';
  var filtered  = filterVal === 'all' ? ghgData : ghgData.filter(function(h) { return h.site === filterVal; });
  if (!filtered.length) { showToast('No records to export', 'error'); return; }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  }

  function cellS(val, styleId) { return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="String">' + esc(val) + '</Data></Cell>'; }
  function cellN(val, styleId) { var n = parseFloat(val); return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="Number">' + (isNaN(n) ? 0 : n) + '</Data></Cell>'; }
  function cellEmpty(styleId) { return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="String"></Data></Cell>'; }
  function row() { var cells = Array.prototype.slice.call(arguments).join(''); return '<Row>' + cells + '</Row>\n'; }
  function tallRow(hpt) { var cells = Array.prototype.slice.call(arguments, 1).join(''); return '<Row ss:Height="' + hpt + '">' + cells + '</Row>\n'; }

  var STYLES = [
    '<Style ss:ID="hdr"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0070C0" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="cat"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#374151" ss:Size="10"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="sub"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#2563EB" ss:Size="10"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="subn"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#2563EB" ss:Size="11"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
    '<Style ss:ID="tot"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders><Font ss:Bold="1" ss:Color="#1D4ED8" ss:Size="11"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="totn"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders><Font ss:Bold="1" ss:Color="#1D4ED8" ss:Size="12"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
    '<Style ss:ID="ep"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Color="#374151" ss:Size="10"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="epn"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#059669" ss:Size="10"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00000"/></Style>',
    '<Style ss:ID="info"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#1E40AF" ss:Size="10"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="infv"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="num"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><NumberFormat ss:Format="#,##0.00"/></Style>',
    '<Style ss:ID="num5"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><NumberFormat ss:Format="#,##0.00000"/></Style>',
    '<Style ss:ID="txt"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/></Style>',
    '<Style ss:ID="ef"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10" ss:Color="#6B7280"/></Style>',
    '<Style ss:ID="ref"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="9" ss:Color="#9CA3AF"/><Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="shdr"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0070C0" ss:Pattern="Solid"/></Style>',
  ].join('\n');

  var summaryRows = '';
  summaryRows += tallRow(20,
    cellS('Year','shdr'), cellS('Type','shdr'), cellS('Site','shdr'),
    cellS('Total Ep (kg CO\u2082eq)','shdr'), cellS('Ep P1','shdr'),
    cellS('Ep P2','shdr'), cellS('Alloc P1','shdr'),
    cellS('Alloc P2','shdr'), cellS('Ep MJ','shdr'), cellS('Saved At','shdr')
  );
  for (var i = 0; i < filtered.length; i++) {
    var h  = filtered[i];
    var yr = String(h.period).replace(/[A-Za-z]+\s*/g,'').trim() || h.period;
    var typ = (h.calcType === 'biodiesel') ? 'Biodiesel' : (h.calcType === 'ggl') ? 'Processing GGL' : 'Refinery';
    var mj = (h.calcType === 'biodiesel') ? cellN(h.epMj || 0, 'num5') : cellS('—','txt');
    summaryRows += row(
      cellS(yr,'txt'), cellS(typ,'txt'), cellS(h.site||'','txt'),
      cellN(h.total,'num'),
      cellN(h.epRpome,'num5'), cellN(h.epFad,'num5'),
      cellN(h.epRpomeAlloc,'num5'), cellN(h.epFadAlloc,'num5'),
      mj,
      cellS(h.savedAt||'','txt')
    );
  }
  var summarySheet =
    '<Worksheet ss:Name="Summary">\n' +
    '<Table ss:DefaultColumnWidth="80">\n' +
    '<Column ss:Width="50"/><Column ss:Width="72"/><Column ss:Width="90"/><Column ss:Width="130"/>' +
    '<Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="110"/>' +
    '<Column ss:Width="110"/><Column ss:Width="90"/><Column ss:Width="120"/>\n' +
    summaryRows +
    '</Table>\n' +
    '<WorksheetOptions><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions>\n' +
    '</Worksheet>\n';

  var detailSheets = '';
  var usedNames = ['Summary'];

  for (var i = 0; i < filtered.length; i++) {
    var h   = filtered[i];
    var yr  = String(h.period).replace(/[A-Za-z]+\s*/g,'').trim() || h.period;
    var detail = h.detail || [];

    if (!detail.length) {
      var epl = epLabelSet(h.calcType === 'biodiesel' ? 'biodiesel' : (h.calcType === 'ggl' ? 'ggl' : 'refinery'));
      detail = [
        { type:'total', description:'Sum of Process Emissions', result:h.total },
        { type:'ep', description: epl.dry1,       result:h.epRpome,      uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep', description: epl.dry2,    result:h.epFad,        uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep', description: epl.a1,       result:h.epRpomeAlloc, uom:'kg CO\u2082eq/dry-ton' },
        { type:'ep', description: epl.a2,    result:h.epFadAlloc,   uom:'kg CO\u2082eq/dry-ton' },
      ];
      if (h.calcType === 'biodiesel') {
        detail.push({ type:'ep', description:'Ep (allocated) — g CO\u2082eq/MJ PME', result:h.epMj || 0, uom:'g CO\u2082eq/MJ' });
      }
    }

    var sheetRows = '';
    sheetRows += tallRow(18,
      cellS('Year','info'), cellS(yr,'infv'),
      cellS('Site','info'), cellS(h.site||'','infv'),
      cellS('Saved','info'), cellS(h.savedAt||'','infv')
    );
    sheetRows += tallRow(22,
      cellS('Description','hdr'), cellS('Value','hdr'),
      cellS('Emission Factor','hdr'), cellS('UoM','hdr'),
      cellS('Result (kg CO\u2082eq)','hdr'), cellS('Reference','hdr')
    );

    for (var d = 0; d < detail.length; d++) {
      var dr = detail[d];
      if (dr.type === 'cat') {
        sheetRows += tallRow(18, cellS(dr.description,'cat'), cellEmpty('cat'), cellEmpty('cat'), cellEmpty('cat'), cellEmpty('cat'), cellEmpty('cat'));
      } else if (dr.type === 'sub') {
        sheetRows += row(cellEmpty('sub'), cellEmpty('sub'), cellS(dr.description,'sub'), cellEmpty('sub'), cellN(dr.result,'subn'), cellEmpty('sub'));
      } else if (dr.type === 'total') {
        sheetRows += tallRow(20, cellS(dr.description,'tot'), cellEmpty('tot'), cellEmpty('tot'), cellEmpty('tot'), cellN(dr.result,'totn'), cellEmpty('tot'));
      } else if (dr.type === 'ep') {
        sheetRows += row(cellS(dr.description,'ep'), cellEmpty('ep'), cellEmpty('ep'), cellS(dr.uom||'','ep'), cellN(dr.result,'epn'), cellEmpty('ep'));
      } else {
        var efVal = (dr.ef != null) ? String(dr.ef) : '';
        sheetRows += row(cellS(dr.description,'txt'), cellN(dr.value,'num'), cellS(efVal,'ef'), cellS(dr.uom||'','txt'), cellN(dr.result,'num'), cellS(dr.ref||'','ref'));
      }
    }

    var base = (yr + ' ' + (h.site||'Record')).replace(/[:\\\/\?\*\[\]]/g,'').substring(0,28);
    var sn = base, sfx = 1;
    while (usedNames.indexOf(sn) !== -1) sn = base.substring(0,25) + ' ' + (++sfx);
    usedNames.push(sn);

    detailSheets +=
      '<Worksheet ss:Name="' + esc(sn) + '">\n' +
      '<Table ss:DefaultColumnWidth="80">\n' +
      '<Column ss:Width="150"/><Column ss:Width="90"/><Column ss:Width="120"/>' +
      '<Column ss:Width="110"/><Column ss:Width="130"/><Column ss:Width="220"/>\n' +
      sheetRows +
      '</Table>\n' +
      '<WorksheetOptions><FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal><TopRowBottomPane>2</TopRowBottomPane></WorksheetOptions>\n' +
      '</Worksheet>\n';
  }

  var xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n' +
    '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n' +
    '  xmlns:x="urn:schemas-microsoft-com:office:excel">\n' +
    '<Styles>\n' + STYLES + '\n</Styles>\n' +
    summarySheet +
    detailSheets +
    '</Workbook>';

  var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  var sitePart = filterVal === 'all' ? 'All_Sites' : filterVal.replace(/\s+/g,'_');
  a.href     = url;
  a.download = 'GHG_Report_' + sitePart + '_' + new Date().getFullYear() + '.xls';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);

  showToast('Exported ' + filtered.length + ' records', 'success');
  document.getElementById('export-modal').classList.remove('open');
}

function updateResultSiteDropdown() {
  var sel = document.getElementById('result-site-filter');
  if (!sel) return;
  var prev = sel.value || 'all';
  var currentInputSite = (document.getElementById('sel-site').value || '').trim();
  var seen = {}, sites = [];
  for (var i = 0; i < ghgData.length; i++) {
    var s = ghgData[i].site;
    if (s && !seen[s]) { seen[s] = true; sites.push(s); }
  }
  sites.sort();
  var currentLabel = currentInputSite ? ('Current Input: ' + escHtml(currentInputSite)) : 'All Sites (current input)';
  var html = '<option value="all">' + currentLabel + '</option>';
  for (var i = 0; i < sites.length; i++) {
    html += '<option value="' + escHtml(sites[i]) + '">' + escHtml(sites[i]) + '</option>';
  }
  sel.innerHTML = html;
  if (prev !== 'all' && sites.indexOf(prev) !== -1) sel.value = prev;
  else sel.value = 'all';
}

var currentDetailRows = [];
var currentFilterSite = 'all';
var currentFilterYear = '';

function applyResultFilter() {
  var sel  = document.getElementById('result-site-filter');
  var site = sel ? sel.value : 'all';
  currentFilterSite = site;

  var label = document.getElementById('result-site-label');
  var badge = document.getElementById('result-filter-badge');

  if (site === 'all') {
    if (label) label.textContent = '';
    if (badge) badge.style.display = 'none';
    calculate();
    renderFormulas();
    return;
  }

  // Pick the latest valid saved record for the selected site (not the first old one).
  var bySite = ghgData.filter(function(h) { return h.site === site; });
  var record = null;
  for (var i = bySite.length - 1; i >= 0; i--) {
    if ((parseFloat(bySite[i].total) || 0) > 0) { record = bySite[i]; break; }
  }
  if (!record && bySite.length) record = bySite[bySite.length - 1];
  if (!record || !record.detail) {
    showToast('No saved detail found for "' + site + '". Save a calculation first.', 'error');
    sel.value = 'all';
    return;
  }

  currentFilterYear = String(record.period).replace(/[A-Za-z]+\s*/g,'').trim() || record.period;
  if (label) label.textContent = site + ' · ' + currentFilterYear;
  if (badge) { badge.textContent = 'Showing saved record'; badge.style.display = ''; }

  renderDetailRows(record.detail, record);
  renderFormulasSaved(record);
}

function renderDetailRows(rows, record) {
  currentDetailRows = rows;
  var html = '';
  rows.forEach(function(r) {
    if (r.type === 'cat') {
      html += '<tr class="cat-row"><td colspan="6">' + r.description + '</td></tr>';
    } else if (r.type === 'sub') {
      html += '<tr><td colspan="3" style="text-align:right;color:#9ca3af;font-size:11px;padding:6px 12px">' + r.description + '</td><td></td>'
            + '<td class="c-blue" style="font-weight:600">' + fmt(r.result) + '</td><td></td></tr>';
    } else if (r.type === 'total') {
      html += '<tr style="background:#f9fafb;border-top:2px solid #e5e7eb">'
            + '<td colspan="3" style="font-weight:600">' + r.description + '</td><td></td>'
            + '<td class="c-blue" style="font-weight:700;font-size:14px">' + fmt(r.result) + '</td>'
            + '<td style="color:#9ca3af;font-size:11px">kg CO\u2082eq</td></tr>';
    } else if (r.type === 'ep') {
      var epClass = 'c-purple';
      var d = String(r.description || '');
      if (/MJ\s*PME|g\s*CO.*MJ/i.test(d)) epClass = 'c-amber';
      else if (/PME|RPOME/i.test(d) && !/FAD|CG/i.test(d)) epClass = 'c-green';
      html += '<tr><td colspan="3" style="color:#9ca3af">' + r.description + '</td><td></td>'
            + '<td class="' + epClass + '" style="font-weight:600">' + fmt(r.result, 5) + '</td>'
            + '<td style="color:#9ca3af;font-size:11px">' + (r.uom||'') + '</td></tr>';
    } else {
      var efStr = r.ef != null ? r.ef : '';
      html += '<tr><td>' + r.description + '</td>'
            + '<td style="color:#6b7280">' + (r.value ? fmt(r.value,3) : '0') + '</td>'
            + '<td style="color:#6b7280">' + efStr + '</td>'
            + '<td style="color:#9ca3af;font-size:11px">' + (r.uom||'') + '</td>'
            + '<td style="font-weight:500">' + fmt(r.result) + '</td>'
            + '<td style="color:#d1d5db;font-size:11px" contenteditable="true">' + (r.ref||'') + '</td></tr>';
    }
  });
  document.getElementById('result-tbody').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', function () {
  syncItemCatalog();
  rebuildItemSelect();
  updateResultSiteDropdown();
  renderFactorEditorRows();
  reloadMasterFactors();
  var siteInput = document.getElementById('sel-site');
  if (siteInput) siteInput.addEventListener('input', function() { updateResultSiteDropdown(); });

  var xlsBtn = document.getElementById('btn-export-ttp-xlsx');
  if (xlsBtn) {
    xlsBtn.addEventListener('click', function () {
      var rows   = getExportRows();
      var site   = currentFilterSite === 'all' ? (document.getElementById('sel-site').value.trim() || 'N/A') : currentFilterSite;
      var year   = currentFilterSite === 'all' ? (String(document.getElementById('sel-year').value).trim() || new Date().getFullYear()) : currentFilterYear;

      if (!rows.length) { showToast('No data to export. Run or select a calculation first.', 'error'); return; }

      function esc(v) { return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
      function cs(v,id){ return '<Cell ss:StyleID="'+id+'"><Data ss:Type="String">'+esc(v)+'</Data></Cell>'; }
      function cn(v,id){ var n=parseFloat(v)||0; return '<Cell ss:StyleID="'+id+'"><Data ss:Type="Number">'+n+'</Data></Cell>'; }
      function ce(id){   return '<Cell ss:StyleID="'+id+'"><Data ss:Type="String"></Data></Cell>'; }
      function tr(h,cells){ return '<Row'+(h?' ss:Height="'+h+'"':'')+'>' + cells.join('') + '</Row>\n'; }

      var STYLES = [
        '<Style ss:ID="hdr"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#0070C0" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="info"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#1E40AF" ss:Size="10"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="infv"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="cat"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#374151" ss:Size="10"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="sub"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#2563EB" ss:Size="10"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
        '<Style ss:ID="tot"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders><Font ss:Bold="1" ss:Color="#1D4ED8" ss:Size="11"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="totn"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2"/></Borders><Font ss:Bold="1" ss:Color="#1D4ED8" ss:Size="12"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
        '<Style ss:ID="ep"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Color="#374151" ss:Size="10"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>',
        '<Style ss:ID="epn"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#059669" ss:Size="10"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00000"/></Style>',
        '<Style ss:ID="num"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><NumberFormat ss:Format="#,##0.00"/></Style>',
        '<Style ss:ID="txt"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/></Style>',
        '<Style ss:ID="ef"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10" ss:Color="#6B7280"/></Style>',
        '<Style ss:ID="ref"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="9" ss:Color="#9CA3AF"/><Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/></Style>',
      ].join('\n');

      var editedRefs = {};
      document.querySelectorAll('#result-tbody tr td[contenteditable]').forEach(function(td, idx){
        editedRefs[idx] = td.textContent.trim();
      });
      var editIdx = 0;

      var sheetRows = '';
      sheetRows += tr(18, [cs('Year','info'), cs(year,'infv'), cs('Site','info'), cs(site,'infv'), ce('infv'), ce('infv')]);
      sheetRows += tr(22, [cs('Description','hdr'), cs('Value','hdr'), cs('Emission Factor','hdr'), cs('UoM','hdr'), cs('Result (kg CO\u2082eq)','hdr'), cs('Reference','hdr')]);

      rows.forEach(function(r) {
        if (r.type === 'cat') {
          sheetRows += tr(18, [cs(r.description,'cat'), ce('cat'), ce('cat'), ce('cat'), ce('cat'), ce('cat')]);
        } else if (r.type === 'sub') {
          sheetRows += tr(0, [ce('txt'), ce('txt'), cs(r.description,'txt'), ce('txt'), cn(r.result,'sub'), ce('txt')]);
        } else if (r.type === 'total') {
          sheetRows += tr(20, [cs(r.description,'tot'), ce('tot'), ce('tot'), ce('tot'), cn(r.result,'totn'), ce('tot')]);
        } else if (r.type === 'ep') {
          sheetRows += tr(0, [cs(r.description,'ep'), ce('ep'), ce('ep'), cs(r.uom||'','ep'), cn(r.result,'epn'), ce('ep')]);
        } else {
          var refVal = (editedRefs[editIdx] != null) ? editedRefs[editIdx] : (r.ref||'');
          editIdx++;
          sheetRows += tr(0, [cs(r.description,'txt'), cn(r.value,'num'), cs(String(r.ef!=null?r.ef:''),'ef'), cs(r.uom||'','txt'), cn(r.result,'num'), cs(refVal,'ref')]);
        }
      });

      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<?mso-application progid="Excel.Sheet"?>\n'
        + '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">\n'
        + '<Styles>\n' + STYLES + '\n</Styles>\n'
        + '<Worksheet ss:Name="Ep Detail">\n'
        + '<Table>\n<Column ss:Width="160"/><Column ss:Width="90"/><Column ss:Width="130"/><Column ss:Width="120"/><Column ss:Width="140"/><Column ss:Width="220"/>\n'
        + sheetRows + '</Table>\n'
        + '<WorksheetOptions><FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal><TopRowBottomPane>2</TopRowBottomPane></WorksheetOptions>\n'
        + '</Worksheet>\n</Workbook>';

      var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url;
      a.download = 'GHG_EpDetail_' + site.replace(/\s+/g,'_') + '_' + year + '.xls';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      showToast('Excel exported \u2192 ' + a.download, 'success');
    });
  }

  var pdfBtn = document.getElementById('btn-export-pdf');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', function () {
      var rows = getExportRows();
      if (!rows.length) { showToast('No data to export. Run or select a calculation first.', 'error'); return; }
      if (typeof html2pdf === 'undefined') { showToast('PDF library not loaded. Check internet connection.', 'error'); return; }

      var site = currentFilterSite === 'all' ? (document.getElementById('sel-site').value.trim() || 'N/A') : currentFilterSite;
      var year = currentFilterSite === 'all' ? (String(document.getElementById('sel-year').value).trim() || new Date().getFullYear()) : currentFilterYear;

      function getRowValue(rowsArr, label) {
        for (var i = 0; i < rowsArr.length; i++) {
          var r = rowsArr[i];
          if (r && r.type === 'ep' && r.description === label) return parseFloat(r.result) || 0;
        }
        return 0;
      }
      function getRowValueAny(rowsArr, labels) {
        for (var j = 0; j < labels.length; j++) {
          var v = getRowValue(rowsArr, labels[j]);
          if (v) return v;
        }
        return 0;
      }
      var epAllocRpome = getRowValueAny(rows, ['Ep Allocated RPOME','Ep Allocated PME']);
      var epAllocFad   = getRowValueAny(rows, ['Ep Allocated POME FAD','Ep Allocated CG']);
      var epMjPdf = 0;
      for (var ri = 0; ri < rows.length; ri++) {
        var er = rows[ri];
        if (er && er.type === 'ep' && /MJ\s*PME|g\s*CO/i.test(String(er.description || ''))) {
          epMjPdf = parseFloat(er.result) || 0;
          break;
        }
      }

      var pdfSub = modeLabels().pdfSubtitle;
      var isBiodieselPdf = (CALC_MODE === 'biodiesel');
      var isGglPdf = (CALC_MODE === 'ggl');
      if (currentFilterSite !== 'all') {
        for (var hi = 0; hi < ghgData.length; hi++) {
          if (ghgData[hi].site === currentFilterSite) {
            isBiodieselPdf = ghgData[hi].calcType === 'biodiesel';
            isGglPdf = ghgData[hi].calcType === 'ggl';
            pdfSub = isBiodieselPdf ? 'Biodiesel · PME/CG' : (isGglPdf ? 'Processing GGL' : 'Refinery POME');
            break;
          }
        }
      }

      function readNumText(id, decimals) {
        var el = document.getElementById(id);
        var raw = el ? String(el.value || '').replace(/,/g,'').trim() : '';
        var n = parseFloat(raw);
        if (!isFinite(n)) return '—';
        return fmtN(n, decimals == null ? 4 : decimals);
      }
      var selectedHist = null;
      if (currentFilterSite !== 'all') {
        for (var hs = 0; hs < ghgData.length; hs++) {
          if (ghgData[hs].site === currentFilterSite) { selectedHist = ghgData[hs]; break; }
        }
      }
      var rawHist = selectedHist && selectedHist.raw ? selectedHist.raw : {};

      // Force stream labels from the actual record's calcType (not current CALC_MODE)
      var stream1Name = isBiodieselPdf ? 'PME' : 'RPOME';
      var stream2Name = isBiodieselPdf ? 'CG (FAD)' : 'POME FAD';

      // Robust resolver: prefers exact saved value → form input → mass-balance derivation.
      // This guarantees the 6 columns (ER, AF, FF × 2) always show real numbers, even for
      // records saved before ER/FF were persisted (derivation uses rpomeDry/fadDry/LHV).
      function numFrom(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
      function fmtOrDash(n, d) { return isFinite(n) ? fmtN(n, d == null ? 4 : d) : '—'; }
      var useHist = currentFilterSite !== 'all';

      var rpomeDryH = numFrom(useHist ? rawHist.rpomeDry : document.getElementById('af-rpome-dry') && document.getElementById('af-rpome-dry').value.replace(/,/g,''));
      var fadDryH   = numFrom(useHist ? rawHist.fadDry   : document.getElementById('af-fad-dry')   && document.getElementById('af-fad-dry').value.replace(/,/g,''));
      var pomeDryH  = numFrom(useHist ? rawHist.pomeDry  : document.getElementById('af-pome-dry')  && document.getElementById('af-pome-dry').value.replace(/,/g,''));
      if (!isFinite(pomeDryH) && isFinite(rpomeDryH) && isFinite(fadDryH)) {
        // Mass-balance approximation for old records: pomeDry ≈ rpomeDry + fadDry
        pomeDryH = rpomeDryH + fadDryH;
      }
      var LHV_r = 37;
      var LHV_f = isBiodieselPdf ? 16 : 37;
      var LHV_p = 37;

      function resolveER(streamHistKey, streamDry, inputId) {
        // 1) exact saved value
        if (useHist) {
          var saved = numFrom(rawHist[streamHistKey]);
          if (isFinite(saved)) return fmtN(saved, 4);
        }
        // 2) live form input
        var fromForm = readNumText(inputId, 4);
        if (fromForm !== '—') return fromForm;
        // 3) derive from dry-mass ratio: ER ≈ streamDry / pomeDry × 100
        if (isFinite(streamDry) && isFinite(pomeDryH) && pomeDryH > 0) {
          return fmtN(streamDry / pomeDryH * 100, 4);
        }
        return '—';
      }
      function resolveAF(streamHistKey, inputId, decimals) {
        if (useHist) {
          var saved = numFrom(rawHist[streamHistKey]);
          if (isFinite(saved)) return fmtN(saved, decimals);
        }
        var fromForm = readNumText(inputId, decimals);
        if (fromForm !== '—') return fromForm;
        return '—';
      }
      function resolveFF(streamHistKey, streamDry, streamLHV, inputId) {
        if (useHist) {
          var saved = numFrom(rawHist[streamHistKey]);
          if (isFinite(saved)) return fmtN(saved, 6);
        }
        var fromForm = readNumText(inputId, 6);
        if (fromForm !== '—') return fromForm;
        // FF = (pomeDry × LHV_pome) / (streamDry × LHV_stream)
        if (isFinite(streamDry) && streamDry > 0 && isFinite(pomeDryH) && pomeDryH > 0) {
          return fmtN((pomeDryH * LHV_p) / (streamDry * streamLHV), 6);
        }
        return '—';
      }

      var rpomeER_text = resolveER('rpomeER', rpomeDryH, 'af-rpome-er');
      var fadER_text   = resolveER('fadER',   fadDryH,   'af-fad-er');
      var af1Text      = resolveAF('rpomeAF', 'af-rpome-af', 6);
      var af2Text      = resolveAF('fadAF',   'af-fad-af',   6);
      var rpomeFF_text = resolveFF('rpomeFF', rpomeDryH, LHV_r, 'af-rpome-ff');
      var fadFF_text   = resolveFF('fadFF',   fadDryH,   LHV_f, 'af-fad-ff');

      var afRowsHtml =
        '<div style="margin:8px 0 10px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;background:#fff;page-break-inside:avoid">'
        + '<div style="background:#0f172a;color:#fff;padding:6px 10px;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Allocation & Feed Factors</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:7pt;line-height:1.15">'
        + '<thead><tr>'
        + '<th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:left">Stream</th>'
        + '<th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:right">Extraction Rate (%)</th>'
        + '<th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:right">AF</th>'
        + '<th style="background:#1e293b;color:#fff;padding:4px 6px;text-align:right">FF</th>'
        + '</tr></thead><tbody>'
        + '<tr>'
        + '<td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;font-weight:600">'+stream1Name+'</td>'
        + '<td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">'+rpomeER_text+'</td>'
        + '<td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">'+af1Text+'</td>'
        + '<td style="padding:4px 6px;border-bottom:1px solid #e2e8f0;text-align:right">'+rpomeFF_text+'</td>'
        + '</tr>'
        + '<tr>'
        + '<td style="padding:4px 6px;font-weight:600">'+stream2Name+'</td>'
        + '<td style="padding:4px 6px;text-align:right">'+fadER_text+'</td>'
        + '<td style="padding:4px 6px;text-align:right">'+af2Text+'</td>'
        + '<td style="padding:4px 6px;text-align:right">'+fadFF_text+'</td>'
        + '</tr>'
        + '</tbody></table></div>';

      var tableRows = '';
      rows.forEach(function(r) {
        if (r.type === 'cat') {
          tableRows += '<tr class="pdf-cat"><td colspan="6" class="col-desc"><b>' + r.description + '</b></td></tr>';
        } else if (r.type === 'sub') {
          tableRows += '<tr class="pdf-sub"><td colspan="3" class="col-num" style="font-style:italic">' + r.description + '</td><td></td><td class="col-num"><b>' + fmtN(r.result) + '</b></td><td></td></tr>';
        } else if (r.type === 'total') {
          tableRows += '<tr class="pdf-total"><td colspan="3" class="col-desc"><b>' + r.description + '</b></td><td></td><td class="col-num"><b>' + fmtN(r.result) + '</b></td><td style="font-size:7pt;color:#94a3b8">kg CO&#x2082;eq</td></tr>';
        } else if (r.type === 'ep') {
          tableRows += '<tr class="pdf-ep"><td colspan="3" class="col-desc">' + r.description + '</td><td></td><td class="col-num" style="font-weight:600">' + fmtN(r.result,5) + '</td><td style="font-size:7pt">' + (r.uom||'') + '</td></tr>';
        } else {
          tableRows += '<tr class="pdf-item"><td class="col-desc">' + r.description + '</td><td class="col-num">' + fmtN(r.value) + '</td><td style="color:#64748b;font-size:7.5pt">' + (r.ef!=null?r.ef:'') + '</td><td style="font-size:7.5pt;color:#64748b">' + (r.uom||'') + '</td><td class="col-num" style="font-weight:500">' + fmtN(r.result) + '</td><td style="font-size:7pt;color:#94a3b8">' + (r.ref||'') + '</td></tr>';
        }
      });

      var now = new Date().toLocaleDateString('en-GB', { year:'numeric', month:'short', day:'numeric' });
      var metaItemsHtml =
        '<div class="pdf-meta-item meta-site"><span class="pdf-meta-key">Site</span><span class="pdf-meta-val val-site">' + site + '</span></div>'
        + '<div class="pdf-meta-item meta-year"><span class="pdf-meta-key">Year</span><span class="pdf-meta-val val-year">' + year + '</span></div>'
        + '<div class="pdf-meta-item meta-method"><span class="pdf-meta-key">Methodology</span><span class="pdf-meta-val">RED III</span></div>'
        + '<div class="pdf-meta-item meta-scope"><span class="pdf-meta-key">Scope</span><span class="pdf-meta-val">Processing Unit</span></div>'
        + '<div class="pdf-meta-item meta-unit"><span class="pdf-meta-key">Unit</span><span class="pdf-meta-val val-unit">kg CO&#x2082;eq/Kg</span></div>'
        + '<div class="pdf-meta-item meta-ep1"><span class="pdf-meta-key">Ep Alloc (stream 1)</span><span class="pdf-meta-val val-rpome">' + fmtN(epAllocRpome,5) + '</span></div>'
        + '<div class="pdf-meta-item meta-ep2"><span class="pdf-meta-key">Ep Alloc (stream 2)</span><span class="pdf-meta-val val-fad">' + fmtN(epAllocFad,5) + '</span></div>'
        + (epMjPdf ? '<div class="pdf-meta-item meta-mj"><span class="pdf-meta-key">Ep MJ PME</span><span class="pdf-meta-val">' + fmtN(epMjPdf,5) + ' g/MJ</span></div>' : '');

      var pdfHtml =
        '<div>'
        + '<div class="pdf-header-bar">'
        +   '<div class="pdf-header-left">'
        +     '<div class="pdf-eyebrow">KPN Downstream Sustainability Division</div>'
        +     '<div class="pdf-title">GHG Profile</div>'
        +     '<div class="pdf-subtitle">Ep Processing Detail &nbsp;·&nbsp; ISCC/INS &nbsp;·&nbsp; ' + pdfSub + '</div>'
        +   '</div>'
        +   '<div class="pdf-header-right">'
        +     '<strong>' + site + '</strong><br>'
        +     'Reporting Year: <strong>' + year + '</strong><br>'
        +     'Printed On: ' + now
        +   '</div>'
        + '</div>'
        + '<div class="pdf-meta-strip">' + metaItemsHtml + '</div>'
        + afRowsHtml
        + '<table>'
        +   '<thead><tr>'
        +     '<th style="text-align:left;width:26%">Description</th>'
        +     '<th class="col-num" style="width:11%">Value</th>'
        +     '<th style="text-align:left;width:16%">Emission Factor</th>'
        +     '<th style="text-align:left;width:12%">UoM</th>'
        +     '<th class="col-num" style="width:14%">Result (kg CO&#x2082;eq)</th>'
        +     '<th style="text-align:left;width:21%">Reference</th>'
        +   '</tr></thead>'
        +   '<tbody>' + tableRows + '</tbody>'
        + '</table>'
        + '<div class="pdf-footer">'
        +   '<span>KPN Downstream Sustainability Division &nbsp;|&nbsp; Confidential — Internal Use Only</span>'
        +   '<span>GHG Calculator · ' + pdfSub + ' · ISCC/INS</span>'
        + '</div>'
        + '</div>';

      var pdfArea = document.getElementById('pdf-print-area');
      pdfArea.innerHTML = pdfHtml;
      pdfArea.className = isBiodieselPdf ? 'pdf-print-area biodiesel-pdf' : 'pdf-print-area refinery-pdf';

      var filename = 'GHG_Report_' + site.replace(/\s+/g,'_') + '_' + year + '.pdf';
      pdfBtn.textContent = 'Generating…';
      pdfBtn.disabled = true;

      safePdfExport(pdfArea, {
        margin:      isBiodieselPdf ? [4, 4, 4, 4] : [5, 5, 5, 5],
        filename:    filename,
        image:       { type: 'jpeg', quality: 0.99 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        // Custom page size: 297mm wide (same as A4 landscape) × 400mm tall, so the
        // full GHG Profile (header + AF table + emissions table + Ep rows + footer)
        // always fits on one page without getting pushed to a page 2.
        jsPDF:       { unit: 'mm', format: [297, 400], orientation: 'portrait' },
        pagebreak:   { mode: ['avoid-all', 'css', 'legacy'] }
      }).then(function() {
        pdfBtn.textContent = ' Export PDF';
        pdfBtn.disabled = false;
        showToast('PDF exported \u2192 ' + filename, 'success');
      }).catch(function(err) {
        pdfBtn.textContent = ' Export PDF';
        pdfBtn.disabled = false;
        showToast('PDF error: ' + err.message, 'error');
      });
    });
  }
});

function getExportRows() {
  var sel  = document.getElementById('result-site-filter');
  var site = sel ? sel.value : 'all';

  if (site !== 'all') {
    for (var i = 0; i < ghgData.length; i++) {
      if (ghgData[i].site === site && ghgData[i].detail) return ghgData[i].detail;
    }
    return [];
  }

  if (!R || !R.total || !CALC_MODE) return [];
  var Lx = modeLabels();
  var out = [
    { type:'cat',  description:'A. Emissions Fuel' },
    { type:'item', description:'Coal',            value:g('r-coal'),     ef:EF.coal,     uom:'kg CO\u2082eq / Kg',  result:R.coal,     ref:REFS.coal     },
    { type:'item', description:'Biosolar',        value:g('r-biosolar'), ef:EF.biosolar, uom:'kg CO\u2082eq / Kg',  result:R.biosolar, ref:REFS.biosolar },
    { type:'item', description:'LNG',             value:g('r-lng'),      ef:EF.lng,      uom:'kg CO\u2082eq / m\u00b3', result:R.lng,  ref:REFS.lng      },
    { type:'sub',  description:'Fuel Total',      result:R.fuelTotal },
    { type:'cat',  description:'B. Emissions Chemical' },
    { type:'item', description:'Sodium Carbonat', value:g('r-na2co3'),   ef:EF.na2co3,   uom:'kg CO\u2082eq/kg', result:R.na2co3,   ref:REFS.na2co3   },
    { type:'item', description:'Sodium Sulphite', value:g('r-na2so3'),   ef:EF.na2so3,   uom:'kg CO\u2082eq/kg', result:R.na2so3,   ref:REFS.na2so3   },
    { type:'item', description:'PAC',             value:g('r-pac'),      ef:EF.pac,      uom:'kg CO\u2082eq/kg', result:R.pac,      ref:REFS.pac      },
    { type:'item', description:'NaOH',            value:g('r-naoh'),     ef:EF.naoh,     uom:'kg CO\u2082eq/kg', result:R.naoh,     ref:REFS.naoh     },
    { type:'item', description:'Cycle-hexane',    value:g('r-cyclohex'), ef:EF.cyclohex, uom:'kg CO\u2082eq/kg', result:R.cyclohex, ref:REFS.cyclohex },
    { type:'item', description:'n-Hexane',        value:g('r-nhex'),     ef:EF.nhex,     uom:'kg CO\u2082eq/kg', result:R.nhex,     ref:REFS.nhex     },
    { type:'item', description:'IPA',             value:g('r-ipa'),      ef:EF.ipa,      uom:'kg CO\u2082eq/kg', result:R.ipa,      ref:REFS.ipa      },
    { type:'item', description:'HCl',             value:g('r-hcl'),      ef:EF.hcl,      uom:'kg CO\u2082eq/kg', result:R.hcl,      ref:REFS.hcl      },
    { type:'item', description:'Bleaching Earth', value:g('r-be'),       ef:EF.be,       uom:'kg CO\u2082eq/kg', result:R.be,       ref:REFS.be       },
    { type:'item', description:'Phosphoric Acid', value:g('r-h3po4'),    ef:EF.h3po4,    uom:'kg CO\u2082eq/kg', result:R.h3po4,    ref:REFS.h3po4    },
  ];
  if (CALC_MODE === 'biodiesel') {
    out.push(
      { type:'item', description:'Methanol', value:g('r-methanol'), ef:EF.methanol, uom:'kg CO\u2082eq/kg', result:R.methanol, ref:REFS.methanol },
      { type:'item', description:'Sodium methylate', value:g('r-sodium_methylate'), ef:EF.sodium_methylate, uom:'kg CO\u2082eq/kg', result:R.sodiumMethylate, ref:REFS.sodium_methylate },
      { type:'item', description:'Citric acid', value:g('r-citric_acid'), ef:EF.citric_acid, uom:'kg CO\u2082eq/kg', result:R.citricAcid, ref:REFS.citric_acid }
    );
  }
  out.push(
    { type:'sub',  description:'Chemical Total',  result:R.chemTotal },
    { type:'cat',  description:'C. Emissions Electricity' },
    { type:'item', description:'Electricity',     value:g('r-elec'),     ef:EF.elec,     uom:'kg CO\u2082eq/kWh', result:R.elec,   ref:REFS.elec     },
    { type:'cat',  description:'D. Emissions Water' },
    { type:'item', description:'Process Water',   value:g('r-water'),    ef:EF.water,    uom:'kg CO\u2082eq/kg',  result:R.water,  ref:REFS.water    },
    { type:'total', description:'Sum of Process Emissions', result:R.total },
    { type:'ep',    description: Lx.epDry1,        result:R.epRpome,      uom:'kg CO\u2082eq/dry-ton' },
    { type:'ep',    description: Lx.epDry2,     result:R.epFad,        uom:'kg CO\u2082eq/dry-ton' },
    { type:'ep',    description: Lx.epAlloc1,        result:R.epRpomeAlloc, uom:'kg CO\u2082eq/dry-ton' },
    { type:'ep',    description: Lx.epAlloc2,     result:R.epFadAlloc,   uom:'kg CO\u2082eq/dry-ton' }
  );
  if (CALC_MODE === 'biodiesel') {
    out.push({ type:'ep', description:'Ep (allocated) — g CO\u2082eq/MJ PME', result:R.epMj, uom:'g CO\u2082eq/MJ' });
  }
  return out;
}

function fmtN(v, d) {
  d = d || 2;
  var n = parseFloat(v) || 0;
  return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d });
}

function delH(id) { showToast('Action disabled. Data is managed centrally.', 'error'); }
function clearHistory() { showToast('Action disabled. Data is managed centrally.', 'error'); }

function resetForm(){
  setItemInputMode('all', { force: true });

  document.querySelectorAll('input:not(.ro)').forEach(el => {
    const keep = ['af-pome-mc','af-rpome-mc','af-fad-mc','sel-year'];
    if (!keep.includes(el.id) && el.type !== 'button') el.value = '';
  });
  R = {};
  calculate();
  showToast('Reset','success');
}

function switchTab(tab, el) {
  document.querySelectorAll('#calc-app-wrap .page').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('page-' + tab).classList.add('active');
  el.classList.add('active');
  if (tab === 'history') fetchHistory();
}

function showToast(msg,type='success'){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast show ${type}`;
  clearTimeout(t._t);t._t=setTimeout(()=>t.className='toast',2800);
}

syncItemCatalog();
rebuildItemSelect();
fetchHistory();
