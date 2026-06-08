/* Raw Data — CPO Calculation monthly input (Data Perhitungan) */

var RD_SITES = [];
var RD_MONTHS = [];
var RD_ROWS = {};
var RD_RECORD_ID = '';
var RD_ACTIVE_CATEGORY = 'all';
var RD_LOADING = false;
var RD_SITES_CACHE_TS = 0;
var RD_SITES_CACHE_TTL = 5 * 60 * 1000;
var RD_DRAFT_TIMER = null;
var RD_STORE_KEY = 'ghg_rd_records';
var RD_SESSION_KEY = 'ghg_rd_session';

var RD_FALLBACK_SITES = [
  { siteCode: 'BONTANG', siteName: 'EUP Bontang', active: true, sortOrder: 1, defaultPeriodMonths: 12 },
  { siteCode: 'LUBUK_GAUNG', siteName: 'EUP Lubuk Gaung', active: true, sortOrder: 2, defaultPeriodMonths: 12 }
];

function openRawDataMode() {
  document.getElementById('page-landing').classList.remove('active');
  document.getElementById('calc-app-wrap').classList.remove('active');
  var etdWrap = document.getElementById('etd-app-wrap');
  if (etdWrap) etdWrap.classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
  document.getElementById('raw-data-wrap').classList.add('active');
  var back = document.getElementById('btn-back-overview');
  if (back) back.style.display = '';
  requestAnimationFrame(function() {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
  rdInitDefaults();
  rdRestoreSession_();
  RD_ACTIVE_CATEGORY = 'all';
  if (!Object.keys(RD_ROWS).length) RD_ROWS = rdBlankRowState_();
  rdFetchSites().then(function() {
    rdRenderCategoryChips();
    rdRebuildRecentList_();
    if (!RD_MONTHS.length) rdRebuildMonths();
    rdRenderTable();
    rdLoadRecord({ auto: true, silent: true });
  });
  showToast('Raw Data — CPO Calculation', 'success');
}

function rdInitDefaults() {
  var startEl = document.getElementById('rd-period-start');
  if (startEl && !startEl.value) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    if (m <= 2) y -= 1;
    startEl.value = y + '-03';
  }
}

function rdEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rdNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function rdFmtNum_(n) {
  if (!n && n !== 0) return '';
  if (Math.abs(n) < 1e-6) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(Math.round(n * 1e6) / 1e6);
}

function rdBuildMonths_(startYm, count) {
  var parts = String(startYm || '').split('-');
  if (parts.length < 2) return [];
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return [];
  var out = [];
  var i;
  for (i = 0; i < count; i++) {
    var mm = m + i;
    var yy = y;
    while (mm > 12) { mm -= 12; yy++; }
    out.push(yy + '-' + String(mm).padStart(2, '0'));
  }
  return out;
}

function rdPeriodKey_() {
  if (!RD_MONTHS.length) return '';
  return RD_MONTHS[0] + '_' + RD_MONTHS[RD_MONTHS.length - 1];
}

function rdSiteSlug_(name) {
  return String(name || '').trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'SITE';
}

function rdNorm_(s) {
  return String(s || '').trim().toLowerCase();
}

function rdResolveSite_() {
  var el = document.getElementById('rd-site');
  var raw = el ? String(el.value || '').trim() : '';
  if (!raw) return null;
  var low = rdNorm_(raw);
  var found = RD_SITES.find(function(s) {
    return rdNorm_(s.siteName) === low || rdNorm_(s.siteCode) === low;
  });
  if (found) return { siteCode: found.siteCode, siteName: found.siteName };
  return { siteCode: rdSiteSlug_(raw), siteName: raw };
}

function rdSiteKeys_(site) {
  var keys = [];
  function add(k) {
    k = String(k || '').trim();
    if (k && keys.indexOf(k) === -1) keys.push(k);
  }
  if (!site) return keys;
  add(site.siteCode);
  add(rdSiteSlug_(site.siteName));
  add(rdSiteSlug_(site.siteCode));
  return keys;
}

function rdStorageId_(site, periodKey) {
  return rdSiteSlug_(site.siteName) + '|' + periodKey;
}

function rdReadStore_() {
  try {
    var raw = localStorage.getItem(RD_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function rdWriteStore_(store) {
  try { localStorage.setItem(RD_STORE_KEY, JSON.stringify(store)); } catch (e) {}
}

function rdSaveSession_() {
  try {
    localStorage.setItem(RD_SESSION_KEY, JSON.stringify({
      site: (document.getElementById('rd-site') || {}).value || '',
      periodStart: (document.getElementById('rd-period-start') || {}).value || '',
      monthCount: (document.getElementById('rd-month-count') || {}).value || '12'
    }));
  } catch (e) {}
}

function rdRestoreSession_() {
  try {
    var raw = localStorage.getItem(RD_SESSION_KEY);
    if (!raw) return;
    var s = JSON.parse(raw);
    if (s.site && document.getElementById('rd-site')) document.getElementById('rd-site').value = s.site;
    if (s.periodStart && document.getElementById('rd-period-start')) document.getElementById('rd-period-start').value = s.periodStart;
    if (s.monthCount && document.getElementById('rd-month-count')) document.getElementById('rd-month-count').value = s.monthCount;
    rdRebuildMonths();
  } catch (e) {}
}

function rdCollectRecord_() {
  var site = rdResolveSite_();
  if (!site) return null;
  rdRebuildMonths();
  return {
    id: RD_RECORD_ID || '',
    siteCode: site.siteCode,
    siteName: site.siteName,
    periodKey: rdPeriodKey_(),
    periodStart: RD_MONTHS[0] || '',
    periodEnd: RD_MONTHS[RD_MONTHS.length - 1] || '',
    monthCount: RD_MONTHS.length,
    months: RD_MONTHS.slice(),
    payload: rdCollectPayload_(),
    updatedAt: new Date().toLocaleString('id-ID'),
    source: 'local'
  };
}

function rdSaveLocalDraft_(opts) {
  var rec = rdCollectRecord_();
  if (!rec || !rec.periodKey) return;
  var store = rdReadStore_();
  store[rdStorageId_(rec, rec.periodKey)] = rec;
  rdWriteStore_(store);
  rdSaveSession_();
  rdRebuildRecentList_();
  if (!opts || !opts.silent) rdSetUpdatedMeta(rec.updatedAt + ' (browser)');
}

function rdScheduleDraftSave_() {
  if (RD_DRAFT_TIMER) clearTimeout(RD_DRAFT_TIMER);
  RD_DRAFT_TIMER = setTimeout(function() { rdSaveLocalDraft_({ silent: true }); }, 500);
}

function rdFindLocalRecord_(site, periodKey) {
  if (!site || !periodKey) return null;
  var store = rdReadStore_();
  var ids = [rdStorageId_(site, periodKey)];
  rdSiteKeys_(site).forEach(function(code) {
    var alt = code + '|' + periodKey;
    if (ids.indexOf(alt) === -1) ids.push(alt);
  });
  var i;
  for (i = 0; i < ids.length; i++) {
    if (store[ids[i]]) return store[ids[i]];
  }
  var keys = Object.keys(store);
  var lowName = rdNorm_(site.siteName);
  for (i = 0; i < keys.length; i++) {
    var rec = store[keys[i]];
    if (rec && rec.periodKey === periodKey && rdNorm_(rec.siteName) === lowName) return rec;
  }
  return null;
}

function rdListLocalRecords_() {
  var store = rdReadStore_();
  return Object.keys(store).map(function(k) { return store[k]; })
    .filter(function(r) { return r && r.siteName && r.periodKey; })
    .sort(function(a, b) {
      return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });
}

function rdRebuildRecentList_() {
  var sel = document.getElementById('rd-recent');
  if (!sel) return;
  var prev = sel.value;
  var list = rdListLocalRecords_();
  sel.innerHTML = '<option value="">— Pilih data tersimpan —</option>';
  list.slice(0, 20).forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r.siteCode + '||' + r.periodKey;
    opt.textContent = r.siteName + ' · ' + r.periodKey.replace('_', '→') + (r.updatedAt ? ' · ' + r.updatedAt : '');
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

function rdLoadRecent(val) {
  if (!val) return;
  var parts = val.split('||');
  if (parts.length < 2) return;
  var list = rdListLocalRecords_();
  var rec = list.find(function(r) { return r.siteCode === parts[0] && r.periodKey === parts[1]; });
  if (!rec) return;
  if (document.getElementById('rd-site')) document.getElementById('rd-site').value = rec.siteName;
  if (document.getElementById('rd-period-start') && rec.periodStart) document.getElementById('rd-period-start').value = rec.periodStart;
  if (document.getElementById('rd-month-count')) document.getElementById('rd-month-count').value = String(rec.monthCount || (rec.months && rec.months.length) || 12);
  rdApplyRecord_(rec, 'local');
  rdSetStatus('Loaded dari browser: ' + rec.siteName, 'ok');
  showToast('Data sebelumnya dimuat', 'success');
}

function rdApplyRecord_(data, source) {
  if (!data) return;
  RD_ACTIVE_CATEGORY = 'all';
  RD_RECORD_ID = data.id || '';
  if (Array.isArray(data.months) && data.months.length) {
    RD_MONTHS = data.months.slice();
    var countEl = document.getElementById('rd-month-count');
    if (countEl) countEl.value = String(RD_MONTHS.length);
    var startEl = document.getElementById('rd-period-start');
    if (startEl && RD_MONTHS[0]) startEl.value = RD_MONTHS[0];
  } else {
    rdRebuildMonths();
  }
  if (data.siteName && document.getElementById('rd-site')) document.getElementById('rd-site').value = data.siteName;
  RD_ROWS = rdMergePayload_(data.payload);
  var ts = data.updatedAt || data.savedAt || '';
  if (source === 'local') rdSetUpdatedMeta(ts ? ts + ' (browser)' : '');
  else rdSetUpdatedMeta(ts ? ts + ' (Sheets)' : '');
  rdRenderCategoryChips();
  rdRenderTable();
  rdUpdateMetaBanner();
  rdSaveSession_();
}

function rdBlankRowState_() {
  var state = {};
  RAW_DATA_LINE_ITEMS.forEach(function(item) {
    state[item.key] = { months: {}, remark: 'Refer to actual data' };
  });
  return state;
}

function rdRebuildMonths() {
  var startEl = document.getElementById('rd-period-start');
  var countEl = document.getElementById('rd-month-count');
  var start = startEl ? startEl.value : '';
  var count = countEl ? parseInt(countEl.value, 10) : 12;
  if (isNaN(count) || count < 1) count = 12;
  if (count > 36) count = 36;
  if (countEl && String(countEl.value) !== String(count)) countEl.value = String(count);
  RD_MONTHS = rdBuildMonths_(start, count);
  rdUpdateMetaBanner();
  rdSaveSession_();
}

function rdOnPeriodChange() {
  rdRebuildMonths();
  rdRenderTableHead();
  rdRenderTableBody();
}

function rdOnSiteChange() {
  rdUpdateMetaBanner();
  rdSaveSession_();
}

function rdUpdateMetaBanner() {
  var site = rdResolveSite_();
  var siteEl = document.getElementById('rd-sheet-site');
  var periodEl = document.getElementById('rd-sheet-period');
  if (siteEl) siteEl.textContent = site ? site.siteName : '— isi site —';
  if (periodEl) {
    periodEl.textContent = RD_MONTHS.length
      ? RD_MONTHS[0] + '→' + RD_MONTHS[RD_MONTHS.length - 1] + ' (' + RD_MONTHS.length + 'mo)'
      : '';
  }
}

function rdSetStatus(msg, tone) {
  var el = document.getElementById('rd-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'rd-status-inline' + (tone ? ' rd-status-' + tone : '');
}

function rdSetUpdatedMeta(txt) {
  var el = document.getElementById('rd-meta-updated');
  if (el) el.textContent = txt || '';
}

function rdFetchSites() {
  var now = Date.now();
  if (RD_SITES.length && (now - RD_SITES_CACHE_TS) < RD_SITES_CACHE_TTL) {
    rdPopulateSiteDatalist();
    return Promise.resolve(RD_SITES);
  }
  if (!APPS_SCRIPT_URL) {
    RD_SITES = RD_FALLBACK_SITES.slice();
    RD_SITES_CACHE_TS = now;
    rdPopulateSiteDatalist();
    return Promise.resolve(RD_SITES);
  }
  return fetch(APPS_SCRIPT_URL + '?action=getRawDataSites&token=' + APPS_TOKEN, { method: 'GET' })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.status === 'error') throw new Error(data.message || 'Server error');
      if (Array.isArray(data) && data.length) {
        RD_SITES = data.filter(function(s) { return s.active !== false; })
          .sort(function(a, b) { return (a.sortOrder || 99) - (b.sortOrder || 99); });
      } else {
        RD_SITES = RD_FALLBACK_SITES.slice();
      }
      RD_SITES_CACHE_TS = Date.now();
      rdPopulateSiteDatalist();
      return RD_SITES;
    })
    .catch(function(err) {
      console.warn('Raw Data sites fetch failed:', err);
      RD_SITES = RD_FALLBACK_SITES.slice();
      rdPopulateSiteDatalist();
      if (!document.getElementById('rd-site').value) {
        rdSetStatus('Sheets offline — pakai auto-save browser', 'warn');
      }
      return RD_SITES;
    });
}

function rdPopulateSiteDatalist() {
  var list = document.getElementById('rd-site-list');
  if (!list) return;
  list.innerHTML = '';
  var seen = {};
  rdListLocalRecords_().forEach(function(r) {
    var name = String(r.siteName || '').trim();
    if (name && !seen[name]) {
      seen[name] = true;
      var opt = document.createElement('option');
      opt.value = name;
      list.appendChild(opt);
    }
  });
  RD_SITES.forEach(function(s) {
    var name = String(s.siteName || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    var opt = document.createElement('option');
    opt.value = name;
    list.appendChild(opt);
  });
  rdUpdateMetaBanner();
}

function rdMergePayload_(payload) {
  var base = rdBlankRowState_();
  if (!payload || !Array.isArray(payload.rows)) return base;
  payload.rows.forEach(function(r) {
    if (!r || !r.key || !base[r.key]) return;
    base[r.key].months = r.months || {};
    base[r.key].remark = r.remark || 'Refer to actual data';
  });
  return base;
}

function rdResetBlank() {
  var site = rdResolveSite_();
  if (!site) { showToast('Isi nama site dulu', 'error'); return; }
  rdRebuildMonths();
  RD_ROWS = rdBlankRowState_();
  RD_RECORD_ID = '';
  rdSetUpdatedMeta('');
  rdRenderTable();
  rdSaveLocalDraft_({ silent: true });
  rdSetStatus('Blank template — ' + site.siteName, 'ok');
  showToast('New blank form', 'success');
}

function rdLoadRecord(opts) {
  opts = opts || {};
  var site = rdResolveSite_();
  if (!site) {
    if (!Object.keys(RD_ROWS).length) RD_ROWS = rdBlankRowState_();
    RD_ACTIVE_CATEGORY = 'all';
    rdRenderCategoryChips();
    rdRenderTable();
    if (!opts.silent) showToast('Isi nama site dulu', 'error');
    return;
  }
  rdRebuildMonths();
  if (!RD_MONTHS.length) {
    if (!opts.silent) showToast('Set period start yang valid', 'error');
    return;
  }
  if (RD_LOADING) return;
  RD_LOADING = true;
  if (!opts.silent) rdSetStatus('Loading ' + site.siteName + '…', '');

  var periodKey = rdPeriodKey_();
  var localRec = rdFindLocalRecord_(site, periodKey);
  var loaded = false;

  if (localRec && rdHasData_(localRec)) {
    rdApplyRecord_(localRec, 'local');
    loaded = true;
    if (!opts.silent) {
      rdSetStatus('Loaded dari browser — ' + site.siteName, 'ok');
      showToast('Data sebelumnya dimuat (browser)', 'success');
    }
  }

  if (!APPS_SCRIPT_URL) {
    if (!loaded) {
      RD_ROWS = rdBlankRowState_();
      RD_RECORD_ID = '';
      rdRenderTable();
      if (!opts.silent) rdSetStatus('Belum ada data tersimpan — mulai isi lalu auto-save', 'warn');
    }
    RD_LOADING = false;
    return;
  }

  var codes = rdSiteKeys_(site);
  var tryIdx = 0;

  function tryNextCode() {
    if (tryIdx >= codes.length) {
      if (!loaded) {
        RD_ROWS = rdBlankRowState_();
        RD_RECORD_ID = '';
        rdRenderTable();
        if (!opts.silent) rdSetStatus('Belum ada data — isi & otomatis tersimpan di browser', 'warn');
      }
      RD_LOADING = false;
      return;
    }
    var code = codes[tryIdx++];
    var q = [
      'action=getRawData',
      'token=' + encodeURIComponent(APPS_TOKEN),
      'siteCode=' + encodeURIComponent(code),
      'siteName=' + encodeURIComponent(site.siteName),
      'periodKey=' + encodeURIComponent(periodKey)
    ];
    fetch(APPS_SCRIPT_URL + '?' + q.join('&'), { method: 'GET' })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data && data.status === 'error') throw new Error(data.message || 'Server error');
        if (data && data.found) {
          rdApplyRecord_(data, 'sheets');
          rdSaveLocalDraft_({ silent: true });
          if (!opts.silent) {
            rdSetStatus('Loaded dari Sheets — ' + site.siteName, 'ok');
            showToast('Data dimuat dari Sheets', 'success');
          }
          RD_LOADING = false;
          return;
        }
        tryNextCode();
      })
      .catch(function(err) {
        console.warn('Raw Data Sheets load failed:', err);
        if (!loaded && !opts.silent) rdSetStatus('Sheets gagal — pakai data browser jika ada', 'warn');
        tryNextCode();
      });
  }

  if (!loaded || !opts.auto) tryNextCode();
  else RD_LOADING = false;
}

function rdHasData_(rec) {
  if (!rec || !rec.payload || !Array.isArray(rec.payload.rows)) return false;
  return rec.payload.rows.some(function(r) {
    if (!r || !r.months) return false;
    return Object.keys(r.months).some(function(m) {
      var v = r.months[m];
      return v != null && String(v).trim() !== '';
    });
  });
}

function rdRowTotal_(key) {
  var row = RD_ROWS[key];
  if (!row) return 0;
  var sum = 0;
  RD_MONTHS.forEach(function(m) { sum += rdNum_(row.months[m]); });
  return sum;
}

function rdOnCellInput(key, month, el) {
  if (!RD_ROWS[key]) RD_ROWS[key] = { months: {}, remark: 'Refer to actual data' };
  RD_ROWS[key].months[month] = el.value;
  var totalEl = document.getElementById('rd-total-' + rdSafeId_(key));
  if (totalEl) totalEl.textContent = rdFmtNum_(rdRowTotal_(key));
  rdScheduleDraftSave_();
}

function rdOnRemarkInput(key, el) {
  if (!RD_ROWS[key]) RD_ROWS[key] = { months: {}, remark: 'Refer to actual data' };
  RD_ROWS[key].remark = el.value;
  rdScheduleDraftSave_();
}

function rdSafeId_(key) {
  return String(key).replace(/[^a-zA-Z0-9]/g, '_');
}

function rdCategories_() {
  var seen = {};
  var out = [];
  RAW_DATA_LINE_ITEMS.forEach(function(item) {
    var label = item.no + '. ' + item.category;
    if (!seen[label]) { seen[label] = true; out.push({ no: item.no, label: label, category: item.category }); }
  });
  return out;
}

function rdRenderCategoryChips() {
  var wrap = document.getElementById('rd-category-chips');
  if (!wrap) return;
  var cats = rdCategories_();
  wrap.innerHTML = '';
  function addChip(label, text) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rd-chip' + (RD_ACTIVE_CATEGORY === label ? ' active' : '');
    btn.textContent = text;
    btn.onclick = function() { rdFilterCategory(label); };
    wrap.appendChild(btn);
  }
  addChip('all', 'All');
  cats.forEach(function(c) { addChip(c.label, c.category); });
}

function rdFilterCategory(label) {
  RD_ACTIVE_CATEGORY = label;
  rdRenderCategoryChips();
  rdRenderTableBody();
}

function rdVisibleItems_() {
  if (RD_ACTIVE_CATEGORY === 'all') return RAW_DATA_LINE_ITEMS;
  return RAW_DATA_LINE_ITEMS.filter(function(item) {
    return (item.no + '. ' + item.category) === RD_ACTIVE_CATEGORY;
  });
}

function rdRenderTable() {
  rdRenderTableHead();
  rdRenderTableBody();
  rdUpdateMetaBanner();
}

function rdRenderTableHead() {
  var head = document.getElementById('rd-table-head');
  if (!head) return;
  var monthCells = RD_MONTHS.map(function(m) {
    return '<th class="rd-th-month">' + rdEsc_(m) + '</th>';
  }).join('');
  head.innerHTML = '<tr>'
    + '<th class="rd-th-fixed">No</th>'
    + '<th class="rd-th-fixed rd-col-cat">Item</th>'
    + '<th class="rd-th-fixed">Type</th>'
    + '<th class="rd-th-fixed">UoM</th>'
    + '<th class="rd-th-fixed">Alc</th>'
    + monthCells
    + '<th class="rd-th-total">TOTAL</th>'
    + '<th class="rd-th-remark">Remark</th>'
    + '</tr>';
}

function rdRenderTableBody() {
  var body = document.getElementById('rd-table-body');
  if (!body) return;
  var items = rdVisibleItems_();
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="20" class="rd-empty">No rows</td></tr>';
    return;
  }

  var lastNo = null;
  var lastCat = null;
  var html = '';
  items.forEach(function(item, idx) {
    var showNo = item.no !== lastNo;
    var showCat = item.category !== lastCat || showNo;
    lastNo = item.no;
    lastCat = item.category;
    var row = RD_ROWS[item.key] || { months: {}, remark: 'Refer to actual data' };
    var monthInputs = RD_MONTHS.map(function(m) {
      var val = row.months[m] != null ? row.months[m] : '';
      return '<td class="rd-td-month"><input type="text" inputmode="decimal" class="rd-inp" value="' + rdEsc_(val) + '" onchange="rdOnCellInput(\'' + rdEsc_(item.key).replace(/'/g, "\\'") + '\',\'' + m + '\',this)" oninput="rdOnCellInput(\'' + rdEsc_(item.key).replace(/'/g, "\\'") + '\',\'' + m + '\',this)"></td>';
    }).join('');
    var zebra = (idx % 2 === 0) ? '#fff' : '#f8fafc';
    html += '<tr class="rd-row">'
      + '<td class="rd-td-fixed rd-td-no" style="background:' + zebra + '">' + (showNo ? item.no : '') + '</td>'
      + '<td class="rd-td-fixed rd-col-cat' + (showCat ? ' rd-cat-label' : '') + '" style="background:' + zebra + '">' + (showCat ? rdEsc_(item.category) : '') + '</td>'
      + '<td class="rd-td-fixed rd-td-type">' + rdEsc_(item.description) + '</td>'
      + '<td class="rd-td-fixed rd-td-uom">' + rdEsc_(item.uom) + '</td>'
      + '<td class="rd-td-fixed rd-td-alloc"><span class="rd-alloc rd-alloc-' + rdEsc_(item.allocation) + '">' + rdEsc_(item.allocation) + '</span></td>'
      + monthInputs
      + '<td class="rd-td-total" id="rd-total-' + rdSafeId_(item.key) + '">' + rdFmtNum_(rdRowTotal_(item.key)) + '</td>'
      + '<td class="rd-td-remark"><input type="text" class="rd-inp rd-inp-remark" value="' + rdEsc_(row.remark || 'Refer to actual data') + '" onchange="rdOnRemarkInput(\'' + rdEsc_(item.key).replace(/'/g, "\\'") + '\',this)"></td>'
      + '</tr>';
  });
  body.innerHTML = html;
}

function rdCollectPayload_() {
  var rows = RAW_DATA_LINE_ITEMS.map(function(item) {
    var row = RD_ROWS[item.key] || { months: {}, remark: 'Refer to actual data' };
    return { key: item.key, months: row.months || {}, remark: row.remark || 'Refer to actual data' };
  });
  return { rows: rows };
}

function rdSaveToSheets() {
  var site = rdResolveSite_();
  if (!site) { showToast('Isi nama site dulu', 'error'); return; }
  rdRebuildMonths();
  if (!RD_MONTHS.length) { showToast('Set period yang valid', 'error'); return; }

  rdSaveLocalDraft_({ silent: true });

  if (!APPS_SCRIPT_URL) {
    rdSetStatus('Tersimpan di browser (Sheets offline)', 'ok');
    showToast('Tersimpan di browser', 'success');
    return;
  }

  var payload = {
    action: 'saveRawData',
    token: APPS_TOKEN,
    id: RD_RECORD_ID || '',
    siteCode: site.siteCode,
    siteName: site.siteName,
    periodKey: rdPeriodKey_(),
    periodStart: RD_MONTHS[0],
    periodEnd: RD_MONTHS[RD_MONTHS.length - 1],
    monthCount: RD_MONTHS.length,
    months: RD_MONTHS,
    payload: rdCollectPayload_()
  };

  rdSetStatus('Saving…', '');
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  })
    .then(function(res) { return res.json(); })
    .then(function(result) {
      if (result.status !== 'ok') throw new Error(result.message || 'Save failed');
      RD_RECORD_ID = result.id || RD_RECORD_ID;
      var ts = result.updatedAt || new Date().toLocaleString('id-ID');
      rdSaveLocalDraft_({ silent: true });
      rdSetUpdatedMeta(ts + ' (Sheets)');
      rdSetStatus('Saved — ' + site.siteName, 'ok');
      showToast('Raw Data saved', 'success');
    })
    .catch(function(err) {
      rdSetStatus('Sheets gagal — sudah tersimpan di browser', 'warn');
      showToast('Sheets gagal, tersimpan lokal: ' + (err.message || err), 'error');
    });
}

var RD_CAT_EXCEL = {
  1: '#E8F5E9', 2: '#E3F2FD', 3: '#FFF3E0', 4: '#F3E5F5', 5: '#E0F7FA',
  6: '#FCE4EC', 7: '#F1F8E9', 8: '#EDE7F6', 9: '#E0F2F1', 10: '#FFF8E1'
};

function rdExportExcel() {
  var site = rdResolveSite_();
  if (!site) { showToast('Isi nama site dulu', 'error'); return; }
  if (excelExportIsBusy()) { showToast('Excel export already in progress…', 'error'); return; }

  rdRebuildMonths();
  var months = RD_MONTHS.slice();
  if (!months.length) { showToast('Set a valid period', 'error'); return; }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function cellS(val, styleId) {
    return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="String">' + esc(val) + '</Data></Cell>';
  }
  function cellN(val, styleId) {
    var n = parseFloat(val);
    if (isNaN(n) || (val !== 0 && !val)) {
      return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="String"></Data></Cell>';
    }
    return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="Number">' + n + '</Data></Cell>';
  }
  function cellEmpty(styleId) {
    return '<Cell ss:StyleID="' + styleId + '"><Data ss:Type="String"></Data></Cell>';
  }
  function xrow() {
    return '<Row>' + Array.prototype.slice.call(arguments).join('') + '</Row>\n';
  }

  var styles = [
    '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="sub"><Font ss:Bold="1" ss:Size="10" ss:Color="#0369A1"/><Interior ss:Color="#F0F9FF" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="hdr"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#0369A1" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="rf"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#1D4ED8" ss:Size="9"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="fr"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#B45309" ss:Size="9"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="bd"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Color="#15803D" ss:Size="9"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="num"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><Interior ss:Color="#EEF6FC" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
    '<Style ss:ID="tot"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="10" ss:Color="#0F172A"/><Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/><NumberFormat ss:Format="#,##0.00"/></Style>',
    '<Style ss:ID="rmk"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="9" ss:Color="#64748B" ss:Italic="1"/><Interior ss:Color="#FAFAFA" ss:Pattern="Solid"/></Style>'
  ];

  var c;
  for (c = 1; c <= 10; c++) {
    var bg = RD_CAT_EXCEL[c] || '#FFFFFF';
    styles.push(
      '<Style ss:ID="c' + c + 't"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Size="10"/><Interior ss:Color="' + bg + '" ss:Pattern="Solid"/></Style>',
      '<Style ss:ID="c' + c + 'b"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders><Font ss:Bold="1" ss:Size="10" ss:Color="#334155"/><Interior ss:Color="' + bg + '" ss:Pattern="Solid"/></Style>'
    );
  }

  var sheetRows = '';
  sheetRows += xrow(cellEmpty('title'), cellS(site.siteName, 'title'));
  sheetRows += xrow(cellEmpty('sub'), cellS('RAW DATA FOR CALCULATING GHG EMISSIONS', 'sub'));
  sheetRows += xrow(cellEmpty('sub'));

  var hdrCells = [cellEmpty('hdr'), cellS('No', 'hdr'), cellS('Item description', 'hdr'), cellS('Type', 'hdr'), cellS('UoM', 'hdr'), cellS('Allocation', 'hdr')];
  months.forEach(function(m) { hdrCells.push(cellS(m, 'hdr')); });
  hdrCells.push(cellS('TOTAL', 'hdr'), cellS('REMARK', 'hdr'));
  sheetRows += xrow.apply(null, hdrCells);

  var lastNo = null;
  var lastCat = null;
  RAW_DATA_LINE_ITEMS.forEach(function(item) {
    var row = RD_ROWS[item.key] || { months: {}, remark: 'Refer to actual data' };
    var showNo = item.no !== lastNo;
    var showCat = item.category !== lastCat || showNo;
    lastNo = item.no;
    lastCat = item.category;
    var cs = 'c' + item.no + 't';
    var cb = 'c' + item.no + 'b';
    var allocStyle = item.allocation === 'FR' ? 'fr' : (item.allocation === 'BD' ? 'bd' : 'rf');
    var cells = [
      cellEmpty(cs),
      cellS(showNo ? item.no : '', cb),
      cellS(showCat ? item.category : '', cb),
      cellS(item.description, cs),
      cellS(item.uom, cs),
      cellS(item.allocation, allocStyle)
    ];
    var total = 0;
    months.forEach(function(m) {
      var v = rdNum_(row.months[m]);
      total += v;
      cells.push(cellN(v || '', 'num'));
    });
    cells.push(cellN(total || '', 'tot'));
    cells.push(cellS(row.remark || 'Refer to actual data', 'rmk'));
    sheetRows += xrow.apply(null, cells);
  });

  var colDefs = '<Column ss:Width="18"/><Column ss:Width="30"/><Column ss:Width="150"/><Column ss:Width="120"/><Column ss:Width="50"/><Column ss:Width="45"/>';
  months.forEach(function() { colDefs += '<Column ss:Width="72"/>'; });
  colDefs += '<Column ss:Width="80"/><Column ss:Width="120"/>';

  var xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<?mso-application progid="Excel.Sheet"?>\n' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:x="urn:schemas-microsoft-com:office:excel">\n' +
    '<Styles>\n' + styles.join('\n') + '\n</Styles>\n' +
    '<Worksheet ss:Name="Data Perhitungan">\n' +
    '<Table ss:DefaultColumnWidth="60">\n' + colDefs + '\n' +
    sheetRows +
    '</Table>\n' +
    '<WorksheetOptions><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane></WorksheetOptions>\n' +
    '</Worksheet>\n</Workbook>';

  var fname = 'Raw_Data_CPO_' + site.siteCode + '_' + months[0] + '_' + months[months.length - 1] + '.xls';
  runLockedExcel(function() {
    var blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Excel exported (styled)', 'success');
  }, function(msg) { showToast(msg, 'error'); });
}
