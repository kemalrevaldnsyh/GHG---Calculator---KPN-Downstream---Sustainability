/* Traceability Export Shipment ISCC/INS */
/* ══════════════════════════════════════════
   TRACEABILITY MODULE
   ══════════════════════════════════════════ */

// Supplier Traceability — hanya dari Google Sheets (TES Data), di-load via trcFetchSupplierDB()
var TRC_SUPPLIERS = [];

var trcFilteredSuppliers = TRC_SUPPLIERS.slice();
var trcSelectedRows = {};
var trcFarthestTruck = null;
var trcFarthestVessel = null;

var TRC_PAGE_SIZE = 15;
var trcCurrentPage = 1;

/** Unique destination strings from TRC_SUPPLIERS (kolom destination di Sheets → field dest). */
function trcUniqueDestinations() {
  var set = {};
  TRC_SUPPLIERS.forEach(function(s) {
    var d = s && s.dest != null ? String(s.dest).trim() : '';
    if (d) set[d] = true;
  });
  return Object.keys(set).sort(function(a, b) { return a.localeCompare(b, 'id'); });
}

/** Isi dropdown Filter Destination & Shipment Destination dari data supplier (sama dengan Sheets). */
function trcRebuildDestinationDropdowns() {
  var dests = trcUniqueDestinations();
  var filterSel = document.getElementById('trc-filter-dest');
  var shipSel = document.getElementById('trc-shipment-dest');
  if (!filterSel || !shipSel) return;

  var prevFilter = filterSel.value;
  var prevShip = shipSel.value;

  filterSel.innerHTML = '<option value="">— All Destinations —</option>';
  dests.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    filterSel.appendChild(opt);
  });
  if (prevFilter && dests.indexOf(prevFilter) !== -1) filterSel.value = prevFilter;

  shipSel.innerHTML = '<option value="">— Select Destination —</option>';
  dests.forEach(function(d) {
    var opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    shipSel.appendChild(opt);
  });
  if (prevShip && dests.indexOf(prevShip) !== -1) shipSel.value = prevShip;
}

function openTraceabilityMode() {
  document.getElementById('page-landing').classList.remove('active');
  document.getElementById('calc-app-wrap').classList.remove('active');
  document.getElementById('etd-app-wrap').classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  document.getElementById('traceability-wrap').classList.add('active');
  var back = document.getElementById('btn-back-overview');
  if (back) back.style.display = '';
  requestAnimationFrame(function() {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    var trcEl = document.getElementById('traceability-wrap');
    if (trcEl && trcEl.scrollIntoView) {
      trcEl.scrollIntoView({ block: 'start', behavior: 'auto', inline: 'nearest' });
    }
  });
  trcFetchSupplierDB(); // attempt to load from Sheets (no-op if URL not set)
  trcRebuildDestinationDropdowns();
  trcCurrentPage = 1;
  trcFilterSuppliers({ keepPage: true });
  // default BL date today
  var today = new Date().toISOString().split('T')[0];
  if (!document.getElementById('trc-bl-date').value) document.getElementById('trc-bl-date').value = today;
  showToast('Traceability Export Shipment', 'success');
}

function trcFilterSuppliers(opts) {
  if (!opts || !opts.keepPage) trcCurrentPage = 1;
  var nameFilter = (document.getElementById('trc-filter-supplier').value||'').toLowerCase().trim();
  var destFilter = document.getElementById('trc-filter-dest').value;
  var modeFilter = document.getElementById('trc-filter-mode').value;
  trcFilteredSuppliers = TRC_SUPPLIERS.filter(function(s){
    var nm = !nameFilter || s.name.toLowerCase().indexOf(nameFilter) !== -1;
    var ds = !destFilter || s.dest === destFilter;
    var md = !modeFilter || s.transport === modeFilter;
    return nm && ds && md;
  });
  trcRenderSupplierTable();
}

/** Area = teks geografis dari sheet (mis. Kab/Kota, PROVINSI), bukan angka. */
function trcFormatAreaPlain_(area) {
  var t = String(area == null ? '' : area).trim();
  return t ? t : '—';
}
function trcFormatAreaCell_(area) {
  var p = trcFormatAreaPlain_(area);
  return p === '—' ? '—' : escH(p);
}
function trcExcelAreaValue_(area) {
  return String(area == null ? '' : area).trim();
}

/** Badge Certificate mengikuti teks data (Sheets): ISCC, INS, atau keduanya mis. "ISCC + INS". */
function trcCertBadgesHtml(cert) {
  var c = String(cert == null ? '' : cert);
  if (!c.trim()) return '<span style="color:#9ca3af">—</span>';
  var hasIscc = /iscc/i.test(c);
  var hasIns = /\bins\b/i.test(c);
  var parts = [];
  if (hasIscc) parts.push('<span class="trc-badge iscc">ISCC</span>');
  if (hasIns) parts.push('<span class="trc-badge ins">INS</span>');
  if (parts.length) return parts.join(' ');
  return '<span style="font-size:11px;color:#475569;font-weight:500">' + escH(c) + '</span>';
}

function trcGoToPage(p) {
  var n = trcFilteredSuppliers.length;
  var totalPages = n === 0 ? 1 : Math.max(1, Math.ceil(n / TRC_PAGE_SIZE));
  if (p < 1 || p > totalPages) return;
  trcCurrentPage = p;
  trcRenderSupplierTable();
}

function trcUpdatePaginationBar() {
  var infoEl = document.getElementById('trc-pagination-info');
  var wrap = document.getElementById('trc-pagination');
  var n = trcFilteredSuppliers.length;
  var totalPages = n === 0 ? 1 : Math.max(1, Math.ceil(n / TRC_PAGE_SIZE));
  if (trcCurrentPage > totalPages) trcCurrentPage = totalPages;
  if (trcCurrentPage < 1) trcCurrentPage = 1;

  if (infoEl) {
    if (!n) infoEl.textContent = '0 supplier';
    else {
      var start = (trcCurrentPage - 1) * TRC_PAGE_SIZE + 1;
      var end = Math.min(trcCurrentPage * TRC_PAGE_SIZE, n);
      infoEl.textContent = 'Showing ' + start + '–' + end + ' of ' + n + ' · Page ' + trcCurrentPage + '/' + totalPages;
    }
  }
  if (!wrap) return;
  wrap.innerHTML = '';
  if (n === 0) return;

  var prev = document.createElement('button');
  prev.type = 'button';
  prev.setAttribute('type', 'button');
  prev.textContent = '‹';
  prev.title = 'Previous';
  prev.disabled = trcCurrentPage <= 1;
  prev.onclick = function() { trcGoToPage(trcCurrentPage - 1); };
  wrap.appendChild(prev);

  var startP = Math.max(1, trcCurrentPage - 3);
  var endP = Math.min(totalPages, startP + 6);
  if (endP - startP < 6) startP = Math.max(1, endP - 6);
  var p;
  for (p = startP; p <= endP; p++) {
    (function(pg) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(pg);
      if (pg === trcCurrentPage) b.className = 'trc-page-active';
      b.onclick = function() { trcGoToPage(pg); };
      wrap.appendChild(b);
    })(p);
  }

  var next = document.createElement('button');
  next.type = 'button';
  next.textContent = '›';
  next.title = 'Next';
  next.disabled = trcCurrentPage >= totalPages;
  next.onclick = function() { trcGoToPage(trcCurrentPage + 1); };
  wrap.appendChild(next);
}

function trcRenderSupplierTable() {
  var tbody = document.getElementById('trc-supplier-tbody');
  var nAll = trcFilteredSuppliers.length;
  var totalPages = nAll === 0 ? 1 : Math.max(1, Math.ceil(nAll / TRC_PAGE_SIZE));
  if (trcCurrentPage > totalPages) trcCurrentPage = totalPages;
  if (trcCurrentPage < 1) trcCurrentPage = 1;

  trcUpdatePaginationBar();

  if (!nAll) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:24px;color:#9ca3af">Tidak ada supplier ditemukan</td></tr>';
    return;
  }
  var start = (trcCurrentPage - 1) * TRC_PAGE_SIZE;
  var list = trcFilteredSuppliers.slice(start, start + TRC_PAGE_SIZE);
  tbody.innerHTML = list.map(function(s, i){
    var rowKey = trcSupplierKey_(s);
    var checked = !!trcSelectedRows[rowKey];
    var modeBadge = s.transport === 'Trucking'
      ? '<span class="trc-badge truck">Trucking</span>'
      : '<span class="trc-badge vessel">T+Vessel</span>';
    var certBadge = trcCertBadgesHtml(s.cert);
    var rowId = start + i;
    return '<tr id="trc-row-'+rowId+'" class="'+(checked?'selected':'')+'">'
      + '<td><input type="checkbox" onchange="trcRowCheck(this,\''+String(rowKey).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')" '+(checked?'checked':'')+'/></td>'
      + '<td style="font-weight:500">'+escH(s.name)+'</td>'
      + '<td>'+escH(s.scope)+'</td>'
      + '<td>'+escH(s.origin)+'</td>'
      + '<td style="text-align:left;font-weight:500">'+trcFormatAreaCell_(s.area)+'</td>'
      + '<td>'+certBadge+'</td>'
      + '<td>'+modeBadge+'</td>'
      + '<td>'+escH(s.dest)+'</td>'
      + '<td style="text-align:right;font-weight:500">'+(s.distTruck||0)+'</td>'
      + '<td style="text-align:right;font-weight:500">'+(s.distVessel1||0)+'</td>'
      + '<td style="text-align:right;font-weight:500">'+(s.distVessel2||0)+'</td>'
      + '</tr>';
  }).join('');
}

function trcToggleAll(cb) {
  trcFilteredSuppliers.forEach(function(s){ trcSelectedRows[trcSupplierKey_(s)] = cb.checked; });
  trcRenderSupplierTable();
}

function trcRowCheck(cb, key) {
  trcSelectedRows[key] = cb.checked;
}

function trcGetSelected() {
  return TRC_SUPPLIERS.filter(function(s){ return !!trcSelectedRows[trcSupplierKey_(s)]; });
}

function trcMaxVessel_(s) { return Math.max(s.distVessel1 || 0, s.distVessel2 || 0); }
function trcSupplierKey_(s) {
  return [
    s.name || '',
    s.scope || '',
    s.origin || '',
    s.area || '',
    s.cert || '',
    s.transport || '',
    s.dest || '',
    s.distTruck || 0,
    s.distVessel1 || 0,
    s.distVessel2 || 0
  ].join('||');
}
function trcSameNum_(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-9;
}
function trcResolveSelectedSupplier_(supplierName) {
  var active = trcFarthestVessel || trcFarthestTruck;
  if (active && active.name === supplierName) return active;

  var finalTruck = parseFloat(document.getElementById('trc-final-truck').value);
  var finalV1 = parseFloat(document.getElementById('trc-final-vessel1').value);
  var finalV2 = parseFloat(document.getElementById('trc-final-vessel2').value);
  var finalMode = document.getElementById('trc-final-mode').value;

  var byFinalFields = TRC_SUPPLIERS.find(function(s){
    return s.name === supplierName
      && trcSameNum_(s.distTruck, isNaN(finalTruck) ? 0 : finalTruck)
      && trcSameNum_(s.distVessel1, isNaN(finalV1) ? 0 : finalV1)
      && trcSameNum_(s.distVessel2, isNaN(finalV2) ? 0 : finalV2)
      && (!finalMode || s.transport === finalMode);
  });
  if (byFinalFields) return byFinalFields;

  var checked = trcGetSelected();
  if (checked.length === 1 && checked[0].name === supplierName) return checked[0];

  return TRC_SUPPLIERS.find(function(s){ return s.name === supplierName; }) || {};
}

function trcGetPoolForSelection_() {
  var checked = trcGetSelected();
  if (checked.length) return checked;
  showToast('Select at least one supplier before finding farthest distance', 'error');
  return [];
}

function trcSelectFarthestTruck() {
  var base = trcGetPoolForSelection_();
  if (!base.length) return;
  var pool = base.filter(function(s){ return s.transport === 'Trucking' || s.transport === 'Trucking+Vessel'; });
  if (!pool.length) { showToast('No trucking suppliers in selection', 'error'); return; }
  pool.sort(function(a,b){ return b.distTruck - a.distTruck; });
  var f = pool[0];
  trcFarthestTruck = f;
  document.getElementById('trc-sel-truck-dist').textContent = f.distTruck + ' km';
  document.getElementById('trc-sel-truck-supplier').textContent = f.name;
  document.getElementById('trc-sel-truck-dist').parentElement.classList.add('highlight');
  trcUpdateFinalFields();
  showToast('Farthest trucking: ' + f.name + ' (' + f.distTruck + ' km)', 'success');
}

function trcSelectFarthestVessel() {
  var base = trcGetPoolForSelection_();
  if (!base.length) return;
  var pool = base.filter(function(s){ return s.transport === 'Trucking+Vessel' && trcMaxVessel_(s) > 0; });
  if (!pool.length) { showToast('No trucking+vessel suppliers in selection', 'error'); return; }
  pool.sort(function(a,b){ return trcMaxVessel_(b) - trcMaxVessel_(a) || b.distTruck - a.distTruck; });
  var f = pool[0];
  trcFarthestVessel = f;
  document.getElementById('trc-sel-vessel1-dist').textContent = (f.distVessel1||0) + ' km';
  document.getElementById('trc-sel-vessel1-supplier').textContent = f.name;
  document.getElementById('trc-sel-vessel1-dist').parentElement.classList.add('highlight');
  document.getElementById('trc-sel-vessel2-dist').textContent = (f.distVessel2||0) + ' km';
  document.getElementById('trc-sel-vessel2-supplier').textContent = f.distVessel2 ? f.name : '—';
  if (f.distVessel2) document.getElementById('trc-sel-vessel2-dist').parentElement.classList.add('highlight');
  trcUpdateFinalFields();
  showToast('Farthest vessel: ' + f.name + ' (V1: ' + (f.distVessel1||0) + ' km, V2: ' + (f.distVessel2||0) + ' km)', 'success');
}

function trcUpdateFinalFields() {
  var f = trcFarthestVessel || trcFarthestTruck;
  if (!f) return;
  document.getElementById('trc-selected-supplier').value = f.name;
  document.getElementById('trc-final-truck').value = f.distTruck || 0;
  document.getElementById('trc-final-vessel1').value = f.distVessel1 || 0;
  document.getElementById('trc-final-vessel2').value = f.distVessel2 || 0;
  document.getElementById('trc-final-mode').value = f.transport;
}

function trcClearSelection() {
  trcSelectedRows = {}; trcFarthestTruck = null; trcFarthestVessel = null;
  ['trc-sel-truck-dist','trc-sel-truck-supplier','trc-sel-vessel1-dist','trc-sel-vessel1-supplier','trc-sel-vessel2-dist','trc-sel-vessel2-supplier'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.textContent = id.indexOf('dist') !== -1 ? '—' : 'Not selected';
  });
  document.querySelectorAll('.dist-card').forEach(function(c){ c.classList.remove('highlight'); });
  ['trc-selected-supplier','trc-final-truck','trc-final-vessel1','trc-final-vessel2','trc-final-mode'].forEach(function(id){
    document.getElementById(id).value = '';
  });
  trcRenderSupplierTable();
  showToast('Selection cleared', 'success');
}

function trcOnRefineryChange() {
  var ref = document.getElementById('trc-refinery').value;
  if (!ref || !DEST[ref]) {
    document.getElementById('trc-af').value = '';
    document.getElementById('trc-ff').value = '';
    document.getElementById('trc-ep-refinery').value = '';
    return;
  }
  var d = DEST[ref];
  document.getElementById('trc-af').value = d.AF;
  document.getElementById('trc-ff').value = d.FF;
  document.getElementById('trc-ep-refinery').value = d.Ep.toFixed(5);
}

function formatBlDate_(val) {
  if (!val) return '—';
  var parts = val.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }
  return val;
}

function trcSaveToETD() {
  var supplierName = document.getElementById('trc-selected-supplier').value.trim();
  var refinery = document.getElementById('trc-refinery').value;
  var blDate = formatBlDate_(document.getElementById('trc-bl-date').value);
  var blNumber = document.getElementById('trc-bl-number').value;
  var vesselName = document.getElementById('trc-vessel').value;
  var certType = document.getElementById('trc-cert-type').value;
  var loadingPort = document.getElementById('trc-loading-port').value;
  var shipmentDestEl = document.getElementById('trc-shipment-dest');
  var shipmentDest = shipmentDestEl.value || '—';

  if (!supplierName) { showToast('Select a supplier first', 'error'); return; }
  if (!refinery) { showToast('Select destination refinery', 'error'); return; }

  var supplierData = trcResolveSelectedSupplier_(supplierName);
  var truckDist   = supplierData.distTruck   || 0;
  var vessel1Dist = supplierData.distVessel1 || 0;
  var vessel2Dist = supplierData.distVessel2 || 0;

  document.getElementById('supplier').value = supplierName;
  document.getElementById('destination').value = refinery;
  document.getElementById('dist_truck').value = truckDist > 0 ? truckDist : '';
  document.getElementById('dist_vessel').value = vessel1Dist > 0 ? vessel1Dist : '';
  document.getElementById('dist_vessel2').value = vessel2Dist > 0 ? vessel2Dist : '';
  updateModeHint();

  etdCalculate();

  var rp = latestEtdCalc && latestEtdCalc.rawPayload ? latestEtdCalc.rawPayload : {};
  var etdN = rp.N || 0;
  var etdR = rp.R || 0;
  var etdS = rp.S != null ? rp.S : null;
  var etdT = rp.T != null ? rp.T : null;

  var kodeSD = (document.getElementById('trc-kode-sd') && document.getElementById('trc-kode-sd').value) || '';

  var record = {
    id: 'trc_etd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    savedAt: new Date().toLocaleString('id-ID'),
    supplier: supplierName,
    origin: supplierData.origin || 'Indonesia',
    vesselName: vesselName || '—',
    blNumber: blNumber || '—',
    blDate: blDate || '—',
    certType: certType || '—',
    loadingPort: loadingPort || '—',
    sdNumber: kodeSD || '—',
    shipmentDest: shipmentDest || '—',
    refinery: refinery,
    truckDist: truckDist,
    vesselDist1: vessel1Dist,
    vesselDist2: vessel2Dist,
    etdN: etdN,
    etdR: etdR,
    etdS: etdS,
    etdT: etdT,
    etdTotal: etdR,
    rawPayload: rp
  };

  // Remove any duplicate entries (including the blank one inserted by etdCalculate)
  etdResultsLog = etdResultsLog.filter(function(x){ return x.supplier !== supplierName || x.refinery !== refinery; });
  etdResultsLog.unshift(record);
  renderEtdResultsList();
  trcPostETDResult(record);

  var etdResultsEl = document.getElementById('results');
  var cloneTarget = document.getElementById('trc-result-etd-clone');
  if (etdResultsEl && cloneTarget) {
    cloneTarget.innerHTML = etdResultsEl.innerHTML;
  }

  var metaEl = document.getElementById('trc-result-meta');
  if (metaEl) {
    metaEl.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">'
      + '<span style="background:#0369a1;color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600">'+escH(supplierName)+'</span>'
      + '<span style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:11px;color:#475569">'+escH(vesselName||'—')+'</span>'
      + '<span style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:11px;color:#475569">'+escH(certType)+'</span>'
      + '<span style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:11px;color:#475569">'+escH(loadingPort||'—')+'</span>'
      + '<span style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:11px;color:#475569">BL: '+escH(blNumber||'—')+'</span>'
      + '</div>';
  }

  document.getElementById('trc-result-section').style.display = '';
  document.getElementById('trc-save-status').textContent = '✓ Tersimpan & ETD dihitung — ' + new Date().toLocaleTimeString('id-ID');

  var gsEtdEl = document.getElementById('gs-etd');
  var etdForSavings = _toNum_(etdN != null ? etdN : (rp.N != null ? rp.N : etdR));
  if (gsEtdEl && etdForSavings) {
    gsEtdEl.value = etdForSavings;
    ghgSavingsCalc();
  }

  showToast('ETD calculated automatically — full results shown below', 'success');
}

function _trcResCard(label, val, color, highlight) {
  return '<div style="border:1px solid '+(highlight?'#fecaca':'#e5e7eb')+';border-radius:8px;padding:12px 14px;background:'+(highlight?'#fef2f2':'#f9fafb')+'">'
    + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;margin-bottom:5px">'+label+'</div>'
    + '<div style="font-size:13px;font-weight:600;color:'+(color||'#111')+'">'+val+'</div></div>';
}

function exportTrcPdf() {
  // Collect selected suppliers — fall back to all filtered if none checked
  var selected = trcGetSelected();
  if (!selected.length) selected = trcFilteredSuppliers.length ? trcFilteredSuppliers : TRC_SUPPLIERS;
  if (!selected.length) { showToast('No supplier data to export', 'error'); return; }
  if (pdfExportIsBusy()) { showToast('PDF export already in progress…', 'error'); return; }
  if (!html2pdfIsReady()) { showToast('PDF library not loaded', 'error'); return; }

  // URUTKAN dari total distance terbesar ke terkecil (yang paling jauh di atas).
  var _trcDistOf_ = function (s) {
    var t  = parseFloat(s && s.distTruck);   if (isNaN(t))  t  = 0;
    var v1 = parseFloat(s && s.distVessel1); if (isNaN(v1)) v1 = 0;
    var v2 = parseFloat(s && s.distVessel2); if (isNaN(v2)) v2 = 0;
    return t + v1 + v2;
  };
  selected = selected.slice().sort(function (a, b) { return _trcDistOf_(b) - _trcDistOf_(a); });

  var blDate     = formatBlDate_(document.getElementById('trc-bl-date').value) || '—';
  var blNumber   = document.getElementById('trc-bl-number').value || '—';
  var vessel     = document.getElementById('trc-vessel').value || '—';
  var certType   = document.getElementById('trc-cert-type').value || '—';
  var kodeSD     = document.getElementById('trc-kode-sd').value || '—';
  var loadPort   = document.getElementById('trc-loading-port').value || '—';
  var shipDest   = document.getElementById('trc-shipment-dest').value || '—';
  var refinery   = document.getElementById('trc-refinery').value || '—';
  var af         = document.getElementById('trc-af').value || '—';
  var ff         = document.getElementById('trc-ff').value || '—';
  var epRef      = document.getElementById('trc-ep-refinery').value || '—';
  var now        = new Date().toLocaleDateString('en-GB', {year:'numeric', month:'short', day:'numeric'});

  /*  TABLE-BASED LAYOUT (no CSS grid / flex offscreen) to avoid blank-PDF race conditions
      on html2canvas. All styles are inline; all columns use real <table> cells. */

  var metaCellTd = 'padding:6px 10px;color:#fff;vertical-align:top;background:#0c2340';
  var metaLabel  = '<div style="font-size:6.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">';
  var metaValue  = '<div style="font-weight:900;color:#fff;font-size:9pt">';

  function metaCell(label, value, colspan) {
    var cs = colspan ? (' colspan="'+colspan+'"') : '';
    return '<td'+cs+' style="'+metaCellTd+'">'
      + metaLabel + label + '</div>'
      + metaValue + escH(value) + '</div></td>';
  }

  var thStyle = 'background:#1e293b;color:#ffffff;padding:6px 6px;text-align:left;font-weight:600;letter-spacing:0.2px;font-size:7pt;border:1px solid #1e293b;word-wrap:break-word';
  var thStyleR = thStyle + ';text-align:right';
  var tdStyle = 'padding:5px 6px;border:1px solid #e2e8f0;font-size:7.5pt;color:#1e293b;background:#ffffff;vertical-align:top;word-wrap:break-word;overflow-wrap:break-word';
  var tdStyleR = tdStyle + ';text-align:right;font-weight:600';

  var supplierRows = selected.map(function(s, idx) {
    var mode = s.transport === 'Trucking' ? 'Direct Trucking' : 'Trucking + Vessel';
    var certTxt = String(s.cert == null ? '' : s.cert);
    var rowBg = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';
    var td = tdStyle + ';background:'+rowBg;
    var tdR = tdStyleR + ';background:'+rowBg;
    return '<tr>'
      + '<td style="'+td+';text-align:center;font-weight:700;color:#64748b">'+(idx+1)+'</td>'
      + '<td style="'+td+';font-weight:600">'+escH(s.name || '—')+'</td>'
      + '<td style="'+td+';text-align:center">'+escH(s.scope || '—')+'</td>'
      + '<td style="'+td+'">'+escH(s.origin || '—')+'</td>'
      + '<td style="'+td+'">'+escH(trcFormatAreaPlain_(s.area))+'</td>'
      + '<td style="'+td+';text-align:center">'+escH(certTxt || '—')+'</td>'
      + '<td style="'+td+';text-align:center">'+escH(mode)+'</td>'
      + '<td style="'+td+'">'+escH(s.dest || '—')+'</td>'
      + '<td style="'+tdR+'">'+(s.distTruck||0)+'</td>'
      + '<td style="'+tdR+'">'+(s.distVessel1||0)+'</td>'
      + '<td style="'+tdR+'">'+(s.distVessel2||0)+'</td>'
      + '</tr>';
  }).join('');

  var html = ''
    + '<div style="font-family:\'Plus Jakarta Sans\',Arial,Helvetica,sans-serif;padding:8px 10px;font-size:8pt;color:#1e293b;background:#ffffff;line-height:1.35;box-sizing:border-box;width:100%">'
    /* ── Header ── */
    + '<table style="width:100%;border-collapse:collapse;border-bottom:2.5px solid #0c2340;margin-bottom:10px">'
    +   '<tr>'
    +     '<td style="padding:4px 0;vertical-align:bottom;background:#ffffff">'
    +       '<div style="font-size:7pt;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#64748b;margin-bottom:2px">KPN Downstream — Sustainability</div>'
    +       '<div style="font-size:15pt;font-weight:800;color:#0c2340;letter-spacing:-0.3px">Traceability Export Shipment</div>'
    +       '<div style="font-size:7.5pt;color:#64748b;margin-top:2px">ISCC / INS Certification · Supplier GHG Distance Report</div>'
    +     '</td>'
    +     '<td style="padding:4px 0;vertical-align:bottom;text-align:right;font-size:8pt;color:#475569;line-height:1.6;background:#ffffff">'
    +       '<strong>Generated: '+now+'</strong><br>'
    +       'BL No: '+escH(blNumber)+'<br>'
    +       'Vessel: '+escH(vessel)
    +     '</td>'
    +   '</tr>'
    + '</table>'
    /* ── Shipment meta (table-based, 4 columns) ── */
    + '<table style="width:100%;border-collapse:collapse;background:#0c2340;border-radius:4px;margin-bottom:10px;table-layout:fixed">'
    +   '<tr>'
    +     metaCell('BL Date', blDate)
    +     metaCell('Certification', certType)
    +     metaCell('SD Code', kodeSD)
    +     metaCell('Loading Port', loadPort)
    +   '</tr>'
    +   '<tr>'
    +     metaCell('Shipment Destination', shipDest, 2)
    +     metaCell('Plan Refinery', refinery)
    +     metaCell('AF / FF / Ep Ref.', af+' / '+ff+' / '+epRef)
    +   '</tr>'
    + '</table>'
    /* ── Supplier section title ── */
    + '<div style="font-size:7.5pt;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.7px;margin-bottom:6px;padding-bottom:3px;border-bottom:1px solid #e2e8f0;background:#ffffff">'
    +   'Supplier Detail — '+selected.length+' Supplier(s) Selected'
    + '</div>'
    /* ── Supplier table (fixed layout, eksplisit colgroup biar ga ada kolom overflow) ── */
    + '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt;background:#ffffff">'
    +   '<colgroup>'
    +     '<col style="width:2.4%">'    /* # */
    +     '<col style="width:13%">'     /* Supplier Name */
    +     '<col style="width:5%">'      /* Scope */
    +     '<col style="width:22%">'     /* Country of Origin */
    +     '<col style="width:12%">'     /* Area */
    +     '<col style="width:7%">'      /* Certificate */
    +     '<col style="width:8%">'      /* Transport Mode */
    +     '<col style="width:10.6%">'   /* Destination */
    +     '<col style="width:6.8%">'    /* Trucking */
    +     '<col style="width:6.6%">'    /* Vessel 1 */
    +     '<col style="width:6.6%">'    /* Vessel 2 */
    +   '</colgroup>'
    +   '<thead><tr>'
    +     '<th style="'+thStyle+';text-align:center">#</th>'
    +     '<th style="'+thStyle+'">Supplier Name</th>'
    +     '<th style="'+thStyle+';text-align:center">Scope</th>'
    +     '<th style="'+thStyle+'">Country of Origin</th>'
    +     '<th style="'+thStyle+'">Area</th>'
    +     '<th style="'+thStyle+';text-align:center">Certificate</th>'
    +     '<th style="'+thStyle+';text-align:center">Transport Mode</th>'
    +     '<th style="'+thStyle+'">Destination</th>'
    +     '<th style="'+thStyleR+'">Trucking (km)</th>'
    +     '<th style="'+thStyleR+'">Vessel 1 (km)</th>'
    +     '<th style="'+thStyleR+'">Vessel 2 (km)</th>'
    +   '</tr></thead>'
    +   '<tbody>' + supplierRows + '</tbody>'
    + '</table>'
    /* ── Footer ── */
    + '<table style="width:100%;border-collapse:collapse;margin-top:10px;border-top:1px solid #e2e8f0">'
    +   '<tr>'
    +     '<td style="padding-top:5px;font-size:6.5pt;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;background:#ffffff">KPN Downstream Sustainability Calculator · ISCC/INS Traceability Report</td>'
    +     '<td style="padding-top:5px;font-size:6.5pt;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px;text-align:right;background:#ffffff">'+now+'</td>'
    +   '</tr>'
    + '</table>'
    + '</div>';

  /*  Render dari DOM ELEMENT ASLI (bukan string). Elemen dibuat visible
      di viewport dengan opacity:0 supaya browser melakukan layout + paint
      penuh — html2canvas kemudian meng-capture hasil paint yang real.
      Pendekatan ini fix blank-PDF spesifik di menu Traceability.

      Lebar host = printable area A4 landscape (297mm) − 2×margin (6mm each)
      = 285mm → ~1077px @96dpi. Ini memastikan canvas hasil html2canvas
      pas 1:1 dengan lebar area PDF, jadi tidak ada sisi kiri/kanan yang
      kepotong saat di-place ke halaman jsPDF. */
  var PRINTABLE_W_PX = 1077;
  var host = null;
  var inner = null;

  function cleanup() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    inner = null;
  }

  showToast('Generating PDF Traceability…', 'success');

  runLockedHtml2Pdf(function() {
    host = document.createElement('div');
    host.id = 'trc-pdf-host';
    host.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:' + PRINTABLE_W_PX + 'px',
      'background:#ffffff',
      'padding:0',
      'margin:0',
      'z-index:-1',
      'opacity:0.001',
      'pointer-events:none',
      'overflow:visible',
      'color:#1e293b',
      'font-family:\'Plus Jakarta Sans\',Arial,Helvetica,sans-serif'
    ].join(';') + ';';

    inner = document.createElement('div');
    inner.style.cssText = 'width:' + PRINTABLE_W_PX + 'px;background:#ffffff;color:#1e293b;box-sizing:border-box;';
    inner.innerHTML = html;
    host.appendChild(inner);
    document.body.appendChild(host);

    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        try {
          html2pdf()
            .set({
              margin:      [6, 6, 6, 6],
              filename:    'Traceability_ISCC_INS_' + new Date().toISOString().slice(0, 10) + '.pdf',
              image:       { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: PRINTABLE_W_PX,
                windowWidth: PRINTABLE_W_PX,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0
              },
              jsPDF:       { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
              pagebreak:   { mode: ['css', 'legacy'], avoid: ['tr'] }
            })
            .from(inner)
            .save()
            .then(function() {
              cleanup();
              showToast('PDF Traceability exported', 'success');
              resolve();
            })
            .catch(function(err) {
              cleanup();
              reject(err);
            });
        } catch (err) {
          cleanup();
          reject(err);
        }
      }, 120);
    });
  }, {
    warmupMs: 100,
    onBusy: function(msg) { showToast(msg, 'error'); }
  }).catch(function(err) {
    cleanup();
    showToast('PDF error: ' + (err && err.message ? err.message : err), 'error');
  });
}

function exportTrcExcel() {
  var selected = trcGetSelected();
  if (!selected.length) selected = trcFilteredSuppliers.length ? trcFilteredSuppliers : TRC_SUPPLIERS;
  if (!selected.length) { showToast('No data to export', 'error'); return; }
  if (excelExportIsBusy()) { showToast('Excel export already in progress…', 'error'); return; }

  var blDate   = formatBlDate_(document.getElementById('trc-bl-date').value) || '';
  var blNumber = document.getElementById('trc-bl-number').value || '';
  var vessel   = document.getElementById('trc-vessel').value || '';
  var certType = document.getElementById('trc-cert-type').value || '';
  var kodeSD   = document.getElementById('trc-kode-sd').value || '';
  var loadPort = document.getElementById('trc-loading-port').value || '';
  var shipDest = document.getElementById('trc-shipment-dest').value || '';
  var refinery = document.getElementById('trc-refinery').value || '';
  var af       = document.getElementById('trc-af').value || '';
  var ff       = document.getElementById('trc-ff').value || '';
  var epRef    = document.getElementById('trc-ep-refinery').value || '';

  var headerMeta = [
    ['TRACEABILITY EXPORT SHIPMENT — ISCC/INS'],
    ['BL Date', blDate, '', 'BL Number', blNumber, '', 'Vessel', vessel],
    ['Certification', certType, '', 'SD Code', kodeSD, '', 'Loading Port', loadPort],
    ['Shipment Destination', shipDest, '', 'Plan Refinery', refinery, '', 'AF / FF / Ep', af+' / '+ff+' / '+epRef],
    [],
    ['Supplier Name','Scope','Country of Origin','Area','Certificate','Transport Mode','Destination','Dist. Trucking (km)','Dist. Vessel 1 (km)','Dist. Vessel 2 (km)']
  ];
  var dataRows = selected.map(function(s){
    return [s.name, s.scope, s.origin, trcExcelAreaValue_(s.area), s.cert, s.transport, s.dest, s.distTruck||0, s.distVessel1||0, s.distVessel2||0];
  });

  var allRows = headerMeta.concat(dataRows);
  var ws = XLSX.utils.aoa_to_sheet(allRows);

  ws['!cols'] = [{wch:32},{wch:16},{wch:18},{wch:18},{wch:14},{wch:18},{wch:12},{wch:20},{wch:20},{wch:20}];

  ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:9}}];

  runLockedExcel(function() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Traceability');
    XLSX.writeFile(wb, 'Traceability_Export_ISCC_INS_'+new Date().toISOString().slice(0,10)+'.xlsx');
    showToast('Excel Traceability exported', 'success');
  }, function(msg) { showToast(msg, 'error'); });
}

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ══════════════════════════════════════════
   GOOGLE SHEETS INTEGRATION — TRACEABILITY
   TRC_APPS_SCRIPT_URL = APPS_SCRIPT_URL (satu deployment). Backend: action=getSuppliers
   membaca sheet "TES Data". Set ke '' jika tidak ingin fetch (tabel supplier tetap kosong).
   ══════════════════════════════════════════ */
const TRC_APPS_SCRIPT_URL = APPS_SCRIPT_URL;

function trcParseDistanceRow_(r) {
  var dt  = parseFloat(r.distTruck);
  var dv1 = parseFloat(r.distVessel1);
  var dv2 = parseFloat(r.distVessel2);
  return {
    distTruck:   isNaN(dt)  ? 0 : dt,
    distVessel1: isNaN(dv1) ? 0 : dv1,
    distVessel2: isNaN(dv2) ? 0 : dv2
  };
}

function trcNormalizeTransport_(t) {
  var s = String(t || '').trim();
  if (!s) return 'Trucking';
  var low = s.toLowerCase().replace(/\s+/g, '');
  if (low.indexOf('vessel') !== -1 || low.indexOf('trucking+vessel') !== -1 || low.indexOf('trucking+v') !== -1) {
    return 'Trucking+Vessel';
  }
  if (low.indexOf('+') !== -1 && (low.indexOf('truck') !== -1 || low.indexOf('vessel') !== -1)) {
    return 'Trucking+Vessel';
  }
  return 'Trucking';
}

function trcOpenInputSupplierModal() {
  var m = document.getElementById('trc-input-supplier-modal');
  if (!m) return;
  document.getElementById('trc-in-name').value = '';
  document.getElementById('trc-in-scope').value = '';
  document.getElementById('trc-in-origin').value = '';
  document.getElementById('trc-in-area').value = '';
  document.getElementById('trc-in-cert').value = '';
  document.getElementById('trc-in-transport').value = 'Trucking';
  document.getElementById('trc-in-dest').value = '';
  document.getElementById('trc-in-dist-truck').value = '';
  document.getElementById('trc-in-dist-vessel1').value = '';
  document.getElementById('trc-in-dist-vessel2').value = '';
  m.classList.add('open');
}

function trcCloseInputSupplierModal() {
  var m = document.getElementById('trc-input-supplier-modal');
  if (m) m.classList.remove('open');
}

function trcInputSupplierModalBackdrop(e) {
  if (e.target && e.target.id === 'trc-input-supplier-modal') trcCloseInputSupplierModal();
}

function trcSaveInputSupplier() {
  var name = (document.getElementById('trc-in-name').value || '').trim();
  if (!name) { showToast('Supplier name is required', 'error'); return; }
  if (TRC_SUPPLIERS.some(function(s){ return s.name === name; })) {
    showToast('Supplier name already exists in the list', 'error'); return;
  }
  var scope = (document.getElementById('trc-in-scope').value || '').trim();
  var origin = (document.getElementById('trc-in-origin').value || '').trim();
  var area = (document.getElementById('trc-in-area').value || '').trim();
  var cert = (document.getElementById('trc-in-cert').value || '').trim();
  var transport = trcNormalizeTransport_(document.getElementById('trc-in-transport').value);
  var dest = (document.getElementById('trc-in-dest').value || '').trim();
  var dTruck = parseFloat(document.getElementById('trc-in-dist-truck').value);
  var dV1    = parseFloat(document.getElementById('trc-in-dist-vessel1').value);
  var dV2    = parseFloat(document.getElementById('trc-in-dist-vessel2').value);
  TRC_SUPPLIERS.push({
    name: name,
    scope: scope,
    origin: origin,
    area: area,
    cert: cert,
    transport: transport,
    dest: dest,
    distTruck:   isNaN(dTruck) ? 0 : dTruck,
    distVessel1: isNaN(dV1) ? 0 : dV1,
    distVessel2: isNaN(dV2) ? 0 : dV2
  });
  trcCloseInputSupplierModal();
  trcRebuildDestinationDropdowns();
  var nameFilter = (document.getElementById('trc-filter-supplier').value||'').toLowerCase().trim();
  var destFilter = document.getElementById('trc-filter-dest').value;
  var modeFilter = document.getElementById('trc-filter-mode').value;
  trcFilteredSuppliers = TRC_SUPPLIERS.filter(function(s){
    var nm = !nameFilter || s.name.toLowerCase().indexOf(nameFilter) !== -1;
    var ds = !destFilter || s.dest === destFilter;
    var md = !modeFilter || s.transport === modeFilter;
    return nm && ds && md;
  });
  var idx = -1;
  var k;
  for (k = 0; k < trcFilteredSuppliers.length; k++) {
    if (trcFilteredSuppliers[k].name === name) { idx = k; break; }
  }
  trcCurrentPage = idx >= 0 ? Math.floor(idx / TRC_PAGE_SIZE) + 1 : 1;
  trcRenderSupplierTable();
  showToast('Supplier added', 'success');
}

function trcFetchSupplierDB() {
  if (!TRC_APPS_SCRIPT_URL) return;
  fetch(TRC_APPS_SCRIPT_URL + '?action=getSuppliers&token=' + APPS_TOKEN, { method: 'GET' })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if (data && data.status === 'error') throw new Error(data.message || 'Server error');
      if (Array.isArray(data) && data.length) {
        TRC_SUPPLIERS = data.map(function(r){
          var dist = trcParseDistanceRow_(r);
          var arRaw = r.area != null ? r.area : '';
          return {
            name: r.name || r.namaSupplier || '',
            scope: r.scope || '',
            origin: r.origin || '',
            area: String(arRaw).trim(),
            cert: r.certificate || r.cert || '',
            transport: trcNormalizeTransport_(r.transportation || r.transport),
            dest: r.destination || r.dest || '',
            distTruck: dist.distTruck,
            distVessel1: dist.distVessel1,
            distVessel2: dist.distVessel2
          };
        });
        trcRebuildDestinationDropdowns();
        trcCurrentPage = 1;
        trcFilterSuppliers({ keepPage: true });
        showToast('Supplier database loaded from Sheets', 'success');
      }
    })
    .catch(function(err){ console.warn('Supplier DB fetch failed:', err); });
}

function trcPostETDResult(record) {
  if (TRC_APPS_SCRIPT_URL) {
    fetch(TRC_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveETDResult', token: APPS_TOKEN, data: record })
    })
    .then(function(res){ return res.json(); })
    .then(function(result){ if (result.status === 'ok') showToast('ETD result synced to Sheets', 'success'); })
    .catch(function(err){ console.warn('ETD post to Traceability sheet failed:', err); });
  }

  // Also sync to main ETD log endpoint so ETD Results tab can always load from getEtdLog.
  if (APPS_SCRIPT_URL) {
    postToAppsScript({
      mode: 'etd',
      sheetName: ETD_SHEET_NAME,
      id: record.id || ('etd_' + Date.now()),
      savedAt: new Date().toISOString(),
      period: (document.getElementById('etd-period') && document.getElementById('etd-period').value) || '',
      site: record.supplier || '',
      route: record.refinery || '',
      etdValue: _toNum_(record.etdN || (record.rawPayload && record.rawPayload.N) || 0),
      unit: 'kg CO2eq/dry-ton',
      supplier: record.supplier || '',
      refinery: record.refinery || '',
      blDate: record.blDate || '',
      loadingPort: record.loadingPort || '',
      certType: record.certType || '',
      sdNumber: record.sdNumber || '',
      vesselName: record.vesselName || '',
      blNumber: record.blNumber || '',
      origin: record.origin || '',
      shipmentDest: record.shipmentDest || '',
      truckDist: _toNum_(record.truckDist),
      vesselDist1: _toNum_(record.vesselDist1),
      vesselDist2: _toNum_(record.vesselDist2),
      etdN: _toNum_(record.etdN),
      etdR: _toNum_(record.etdR || record.etdTotal),
      etdTotal: _toNum_(record.etdTotal || record.etdR),
      rawPayload: JSON.stringify(record.rawPayload || {})
    }).catch(function(err){
      console.warn('ETD post to main ETD log failed:', err);
    });
  }
}
