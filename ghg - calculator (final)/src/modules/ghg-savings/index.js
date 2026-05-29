/* GHG Savings Biodiesel */
/* GHG Savings — formulas unchanged */
/* ══════════════════════════════════════════
   GHG SAVINGS MODULE — formulas unchanged
   ══════════════════════════════════════════ */
const GS_EU_DATA = [
  { country:'France',      ef_mwh:0.097, g_mj:26.9,  depot:0.11 },
  { country:'Sweden',      ef_mwh:0.013, g_mj:3.6,   depot:0.02 },
  { country:'Austria',     ef_mwh:0.078, g_mj:21.7,  depot:0.09 },
  { country:'Belgium',     ef_mwh:0.154, g_mj:42.8,  depot:0.18 },
  { country:'Spain',       ef_mwh:0.198, g_mj:55,    depot:0.23 },
  { country:'Italy',       ef_mwh:0.285, g_mj:79.2,  depot:0.34 },
  { country:'Germany',     ef_mwh:0.361, g_mj:100.3, depot:0.43 },
  { country:'Netherlands', ef_mwh:0.439, g_mj:121.9, depot:0.52 },
  { country:'Poland',      ef_mwh:0.700, g_mj:194.4, depot:0.82 },
  { country:'EU-27 avg',   ef_mwh:0.288, g_mj:80,    depot:0.34 },
];
const GS_LHV    = 37;   // MJ/kg
const GS_REF_FF = 94;   // g CO₂eq/MJ fossil fuel reference

function gsGet(id) { return parseFloat(document.getElementById(id).value) || 0; }
function gsSt(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
function gsFmt(v, d) { d = d == null ? 5 : d; return isNaN(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function gsFmt2(v) { return gsFmt(v, 2); }
function gsDryToMj(kgDryTon) { return kgDryTon / GS_LHV; }
function gsMjToDry(gMj) { return gMj * GS_LHV; }
function gsGetUnit(unitSelectId) {
  var el = document.getElementById(unitSelectId);
  return el && el.value === 'mj' ? 'mj' : 'dry';
}
function gsInputToMj(inputId, unitSelectId) {
  // Input default = kg CO₂eq/dry-ton; g CO₂eq/MJ = kg ÷ 37 (LHV PME)
  var kg = gsGetUnit(unitSelectId) === 'mj'
    ? gsMjToDry(gsGet(inputId))
    : gsGet(inputId);
  return gsDryToMj(kg);
}
function gsInputToDry(inputId, unitSelectId) {
  var val = gsGet(inputId);
  return gsGetUnit(unitSelectId) === 'dry' ? val : gsMjToDry(val);
}
function gsSetUnit(unitSelectId, unit) {
  var el = document.getElementById(unitSelectId);
  if (el) el.value = unit === 'mj' ? 'mj' : 'dry';
}
function ghgSavingsOnUnitChange(inputId, unitSelectId) {
  var input = document.getElementById(inputId);
  var select = document.getElementById(unitSelectId);
  if (!input || !select) return;
  var val = parseFloat(input.value) || 0;
  // kg → g/MJ: divide by 37 | g/MJ → kg: multiply by 37
  if (select.value === 'mj') input.value = String(Math.round((val / GS_LHV) * 1e5) / 1e5);
  else input.value = String(Math.round((val * GS_LHV) * 1e5) / 1e5);
  ghgSavingsCalc();
}
function ghgSavingsRevertToKgInputs(pairs) {
  (pairs || [
    ['gs-ep-refinery', 'gs-ep-refinery-unit'],
    ['gs-etd', 'gs-etd-unit'],
    ['gs-etd-vessel', 'gs-etd-vessel-unit'],
    ['gs-ep-biodiesel', 'gs-ep-biodiesel-unit'],
    ['gs-vessel-em', 'gs-vessel-em-unit'],
  ]).forEach(function(pair) {
    var input = document.getElementById(pair[0]);
    if (!input || gsGetUnit(pair[1]) !== 'mj') {
      gsSetUnit(pair[1], 'dry');
      return;
    }
    var val = parseFloat(input.value) || 0;
    input.value = String(Math.round((val * GS_LHV) * 1e5) / 1e5);
    gsSetUnit(pair[1], 'dry');
  });
}
function gsResolveVesselMj(d) {
  if (d.vessel_mj != null) return d.vessel_mj;
  if (d.vessel_unit === 'mj') return d.vessel || 0;
  if (d.vessel_unit === 'dry') return gsDryToMj(d.vessel || 0);
  return d.vessel || 0;
}
function gsResolveComponentMj(val, unit, storedMj) {
  if (storedMj != null) return storedMj;
  return unit === 'mj' ? (val || 0) : gsDryToMj(val || 0);
}
function gsResolveComponentDry(val, unit, storedMj) {
  return gsMjToDry(gsResolveComponentMj(val, unit, storedMj));
}
function gsResolveVesselDry(d) {
  return gsMjToDry(gsResolveVesselMj(d));
}
function gsResolveInputUnit(unit, legacyDefault) {
  return unit === 'mj' ? 'g CO₂eq/MJ' : (legacyDefault || 'kg CO₂eq/dry-ton');
}
function gsEscapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function gsPdfNum(v, d) {
  d = d == null ? 2 : d;
  return (Number(v) || 0).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}
function ghgSavingsNormalizeExportData(d) {
  var ep_ref_dry = gsResolveComponentDry(d.ep_ref, d.ep_ref_unit, d.ep_ref_mj);
  var etd_dry    = gsResolveComponentDry(d.etd, d.etd_unit, d.etd_mj);
  var etd_vessel_dry = gsResolveComponentDry(d.etd_vessel, d.etd_vessel_unit, d.etd_vessel_mj);
  var ep_bd_dry  = gsResolveComponentDry(d.ep_bd, d.ep_bd_unit, d.ep_bd_mj);
  var vessel_dry = gsResolveVesselDry(d);
  var ep_ref_mj  = gsResolveComponentMj(d.ep_ref, d.ep_ref_unit, d.ep_ref_mj);
  var etd_mj     = gsResolveComponentMj(d.etd, d.etd_unit, d.etd_mj);
  var etd_vessel_mj = gsResolveComponentMj(d.etd_vessel, d.etd_vessel_unit, d.etd_vessel_mj);
  var ep_bd_mj   = gsResolveComponentMj(d.ep_bd, d.ep_bd_unit, d.ep_bd_mj);
  var vessel_mj  = gsResolveVesselMj(d);
  var depot      = d.depot || 0;
  var total_dry  = d.total_dry != null ? d.total_dry : (ep_ref_dry + etd_dry + etd_vessel_dry + ep_bd_dry);
  var fob_mj     = d.fob_mj != null ? d.fob_mj : (ep_ref_mj + etd_mj + etd_vessel_mj + ep_bd_mj);
  var discharge_mj = d.discharge_mj != null ? d.discharge_mj : (fob_mj + vessel_mj + depot);
  var saving_fob = d.saving_fob != null ? d.saving_fob : (((GS_REF_FF - fob_mj) / GS_REF_FF) * 100);
  var saving_discharge = d.saving_discharge != null ? d.saving_discharge : (((GS_REF_FF - discharge_mj) / GS_REF_FF) * 100);
  return Object.assign({}, d, {
    ep_ref_dry: ep_ref_dry, etd_dry: etd_dry, etd_vessel_dry: etd_vessel_dry, ep_bd_dry: ep_bd_dry, vessel_dry: vessel_dry,
    ep_ref_mj: ep_ref_mj, etd_mj: etd_mj, etd_vessel_mj: etd_vessel_mj, ep_bd_mj: ep_bd_mj, vessel_mj: vessel_mj,
    total_dry: total_dry, fob_mj: fob_mj, discharge_mj: discharge_mj,
    saving_fob: saving_fob, saving_discharge: saving_discharge, depot: depot,
    country: d.country || ''
  });
}

function gsNormalizeSiteKey(site) {
  return String(site || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function gsIsGhgSavingsDatacenterRow(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.calcType || (row.total != null && row.epRpome != null)) return false;
  return !!String(row.site || '').trim();
}

function gsNormalizeGhgSavingsDatacenterRow(row) {
  return {
    year: String(row.year || row.period || '').trim(),
    period: String(row.year || row.period || '').trim(),
    site: String(row.site || '').trim(),
    epRefineryKG: parseFloat(row.epRefineryKG) || 0,
    etdTrucking: parseFloat(row.etdTrucking != null ? row.etdTrucking : row.etd) || 0,
    etdVessel: parseFloat(row.etdVessel) || 0,
    epBiodieselKG: parseFloat(row.epBiodieselKG) || 0,
    vesselEmissionKG: parseFloat(row.vesselEmissionKG != null ? row.vesselEmissionKG : row.vessel) || 0,
  };
}

function ghgSavingsUpdateDatacenterStatus(message, isError) {
  var el = document.getElementById('gs-datacenter-status');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'gs-log-note' + (isError ? ' gs-datacenter-status-error' : ' gs-datacenter-status-ok');
}

function ghgSavingsGetDatacenterSiteOptions(filterText) {
  if (!Array.isArray(gsDatacenterRows)) return [];
  var filterKey = gsNormalizeSiteKey(filterText);
  var map = {};
  gsDatacenterRows.forEach(function(r) {
    var site = String(r.site || '').trim();
    if (!site) return;
    if (filterKey) {
      var siteKey = gsNormalizeSiteKey(site);
      if (siteKey.indexOf(filterKey) < 0 && filterKey.indexOf(siteKey) < 0) return;
    }
    if (!map[site]) map[site] = { site: site, years: {} };
    var y = String(r.year || r.period || '').trim();
    if (y) map[site].years[y] = true;
  });
  return Object.keys(map).sort().map(function(site) {
    var years = Object.keys(map[site].years).sort();
    return { site: site, years: years };
  });
}

function ghgSavingsRenderSitePicker() {
  var picker = document.getElementById('gs-site-picker');
  var input = document.getElementById('gs-site');
  if (!picker || !input) return;
  var options = ghgSavingsGetDatacenterSiteOptions(input.value);
  if (!options.length) {
    picker.innerHTML = '<div class="gs-site-picker-empty">' +
      (Array.isArray(gsDatacenterRows) && gsDatacenterRows.length
        ? 'Tidak ada site cocok. Coba kata kunci lain.'
        : 'Datacenter kosong / belum ter-load dari Sheets.') +
      '</div>';
    picker.classList.add('open');
    return;
  }
  picker.innerHTML = options.map(function(opt, idx) {
    var sub = opt.years.length ? opt.years.join(', ') : 'tahun kosong';
    return '<button type="button" class="gs-site-picker-item' + (idx === 0 ? ' active' : '') + '" data-site="' + gsEscapeHtml(opt.site) + '" onclick="ghgSavingsSelectDatacenterSite(this.getAttribute(\'data-site\'))">' +
      gsEscapeHtml(opt.site) + '<span style="display:block;font-size:10px;color:#6b7280;margin-top:2px">' + gsEscapeHtml(sub) + '</span></button>';
  }).join('');
  picker.classList.add('open');
}

function ghgSavingsOnSiteSearchInput() {
  ghgSavingsRenderSitePicker();
}

function ghgSavingsOnSiteSearchKeydown(e) {
  if (!e || e.key !== 'Enter') return;
  e.preventDefault();
  var picker = document.getElementById('gs-site-picker');
  var active = picker ? picker.querySelector('.gs-site-picker-item.active') : null;
  if (active) {
    ghgSavingsSelectDatacenterSite(active.getAttribute('data-site'));
    return;
  }
  ghgSavingsApplyDatacenter();
}

function ghgSavingsHideSitePickerSoon() {
  window.setTimeout(function() {
    var picker = document.getElementById('gs-site-picker');
    if (picker) picker.classList.remove('open');
  }, 180);
}

function ghgSavingsSelectDatacenterSite(site) {
  var input = document.getElementById('gs-site');
  if (input) input.value = site;
  ghgSavingsHideSitePickerSoon();
  ghgSavingsApplyDatacenter();
}

function ghgSavingsFindDatacenterRow(year, site) {
  var y = String(year || '').trim();
  var key = gsNormalizeSiteKey(site);
  if (!key || !Array.isArray(gsDatacenterRows) || !gsDatacenterRows.length) return null;

  var candidates = gsDatacenterRows.filter(function(r) {
    var siteKey = gsNormalizeSiteKey(r.site);
    if (siteKey === key) return true;
    return siteKey.indexOf(key) >= 0 || key.indexOf(siteKey) >= 0;
  });
  if (!candidates.length) return null;

  if (y) {
    for (var i = 0; i < candidates.length; i++) {
      if (String(candidates[i].year || candidates[i].period || '').trim() === y) return candidates[i];
    }
  }
  return candidates[0];
}

function ghgSavingsRenderDatacenterSiteList() {
  var count = Array.isArray(gsDatacenterRows) ? gsDatacenterRows.length : 0;
  if (!count) {
    ghgSavingsUpdateDatacenterStatus('Datacenter: 0 site. Deploy Apps Script terbaru + isi tab GHG Savings Datacenter.', true);
    return;
  }
  var sites = ghgSavingsGetDatacenterSiteOptions('');
  ghgSavingsUpdateDatacenterStatus(count + ' baris · ' + sites.length + ' site dari Sheets — ketik untuk cari, Enter atau klik untuk load.', false);
}

function ghgSavingsApplyDatacenter() {
  var periodEl = document.getElementById('gs-period');
  var siteEl = document.getElementById('gs-site');
  var period = periodEl ? String(periodEl.value || '').trim() : '';
  var site = siteEl ? String(siteEl.value || '').trim() : '';
  if (!site) {
    showToast('Ketik atau pilih site dari Datacenter', 'error');
    if (siteEl) siteEl.focus();
    return;
  }
  if (!Array.isArray(gsDatacenterRows) || !gsDatacenterRows.length) {
    showToast('Datacenter belum ter-load. Deploy Apps Script terbaru (getGhgSavingsDatacenter).', 'error');
    return;
  }
  var row = ghgSavingsFindDatacenterRow(period, site);
  if (!row) {
    var hint = ghgSavingsGetDatacenterSiteOptions('').slice(0, 3).map(function(o) { return o.site; }).join(', ');
    showToast('Site tidak ditemukan di Datacenter' + (hint ? '. Contoh: ' + hint : ''), 'error');
    return;
  }
  if (siteEl) siteEl.value = row.site;
  ghgSavingsRevertToKgInputs([
    ['gs-ep-refinery', 'gs-ep-refinery-unit'],
    ['gs-ep-biodiesel', 'gs-ep-biodiesel-unit'],
  ]);
  document.getElementById('gs-ep-refinery').value = String(row.epRefineryKG != null ? row.epRefineryKG : 0);
  document.getElementById('gs-ep-biodiesel').value = String(row.epBiodieselKG != null ? row.epBiodieselKG : 0);
  if (periodEl && row.year && (!period || period !== row.year)) periodEl.value = String(row.year);
  ghgSavingsCalc();
  showToast('Loaded EP Refinery & Biodiesel: ' + row.site + (row.year ? ' · ' + row.year : ''), 'success');
}

function ghgSavingsGetDepot() {
  var sel = document.getElementById('gs-country-select').value;
  if (sel === 'custom') return gsGet('gs-depot-custom');
  return parseFloat(sel) || 0;
}

function ghgSavingsGetCountryName() {
  var sel = document.getElementById('gs-country-select');
  var opt = sel.options[sel.selectedIndex];
  return opt ? (opt.getAttribute('data-label') || '') : '';
}

function ghgSavingsOnCountrySelect() {
  var val = document.getElementById('gs-country-select').value;
  document.getElementById('gs-custom-depot-field').style.display = val === 'custom' ? 'block' : 'none';
  ghgSavingsCalc();
  ghgSavingsRenderEuTable();
}

function ghgSavingsCalc() {
  var ep_ref_dry = gsInputToDry('gs-ep-refinery', 'gs-ep-refinery-unit');
  var etd_dry    = gsInputToDry('gs-etd', 'gs-etd-unit');
  var etd_vessel_dry = gsInputToDry('gs-etd-vessel', 'gs-etd-vessel-unit');
  var ep_bd_dry  = gsInputToDry('gs-ep-biodiesel', 'gs-ep-biodiesel-unit');
  var depot      = ghgSavingsGetDepot();

  var ep_ref_mj = gsInputToMj('gs-ep-refinery', 'gs-ep-refinery-unit');
  var etd_mj    = gsInputToMj('gs-etd', 'gs-etd-unit');
  var etd_vessel_mj = gsInputToMj('gs-etd-vessel', 'gs-etd-vessel-unit');
  var ep_bd_mj  = gsInputToMj('gs-ep-biodiesel', 'gs-ep-biodiesel-unit');
  var vessel_mj = gsInputToMj('gs-vessel-em', 'gs-vessel-em-unit');
  var total_dry = ep_ref_dry + etd_dry + etd_vessel_dry + ep_bd_dry;

  // Sum g CO₂eq/MJ per component, then GHG savings
  var fob_mj = ep_ref_mj + etd_mj + etd_vessel_mj + ep_bd_mj;

  // Step 3: GHG Saving FoB
  var saving_fob = ((GS_REF_FF - fob_mj) / GS_REF_FF) * 100;

  // Step 4: Total GHG Biodiesel — depot & vessel only added here (not in FOB / dry-ton)
  var discharge_mj = fob_mj + vessel_mj + depot;

  // Step 5: GHG Saving Discharge
  var saving_discharge = ((GS_REF_FF - discharge_mj) / GS_REF_FF) * 100;

  // Update chain rows
  gsSt('gs-chain-total-dry',       gsFmt(total_dry, 5));
  gsSt('gs-chain-fob-mj',          gsFmt(fob_mj, 5));
  gsSt('gs-chain-saving-fob',      gsFmt(saving_fob, 5));
  gsSt('gs-chain-vessel',          gsFmt(vessel_mj, 5));
  gsSt('gs-chain-depot',           gsFmt2(depot));
  gsSt('gs-chain-discharge-mj',    gsFmt(discharge_mj, 5));
  gsSt('gs-chain-saving-discharge',gsFmt(saving_discharge, 5));

  // Update summary grid
  gsSt('gs-res-total-dry',         gsFmt(total_dry, 2));
  gsSt('gs-res-fob-mj',            gsFmt(fob_mj, 5));
  gsSt('gs-res-saving-fob',        gsFmt(saving_fob, 2) + '%');
  gsSt('gs-res-saving-discharge',  gsFmt(saving_discharge, 2) + '%');
  var sumGrid = document.getElementById('gs-result-summary');
  if (sumGrid) sumGrid.style.display = '';

  // Big result cards
  var resFobBig = document.getElementById('gs-result-fob-big');
  if (resFobBig) resFobBig.innerHTML = gsFmt(saving_fob, 5) + '<span style="font-size:18px;font-weight:400">%</span>';
  gsSt('gs-result-fob-sub', gsFmt(fob_mj, 5) + ' g CO₂eq/MJ · ref ' + GS_REF_FF);

  var resDisBig = document.getElementById('gs-result-discharge-big');
  if (resDisBig) resDisBig.innerHTML = gsFmt(saving_discharge, 5) + '<span style="font-size:18px;font-weight:400">%</span>';
  gsSt('gs-result-discharge-sub', gsFmt(discharge_mj, 5) + ' g CO₂eq/MJ · ref ' + GS_REF_FF);

  // Threshold badges
  function gsBadge(val, id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (val >= 65) {
      el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:600">✓ ≥65% — ISCC EU Pass</span>';
    } else if (val >= 50) {
      el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:600">✓ ≥50% — Minimum Pass</span>';
    } else {
      el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:4px;padding:3px 9px;font-size:11px;font-weight:600">✗ Below 50% — Threshold Not Met</span>';
    }
  }
  gsBadge(saving_fob, 'gs-badge-fob');
  gsBadge(saving_discharge, 'gs-badge-discharge');

  ghgSavingsRenderEuTable();
}

function ghgSavingsRenderEuTable() {
  var tbody = document.getElementById('gs-eu-tbody');
  if (!tbody) return;
  var selVal = parseFloat(document.getElementById('gs-country-select').value);
  tbody.innerHTML = GS_EU_DATA.map(function(r, i) {
    var isActive = Math.abs(r.depot - selVal) < 0.001;
    return '<tr onclick="ghgSavingsApplyEuRow(' + i + ')" style="cursor:pointer' + (isActive ? ';background:#eff6ff' : '') + '">' +
      '<td style="' + (isActive ? 'color:#2563eb;font-weight:600' : '') + '">' + r.country + '</td>' +
      '<td style="text-align:right">' + r.ef_mwh + '</td>' +
      '<td style="text-align:right">' + r.g_mj + '</td>' +
      '<td style="text-align:right">' + r.depot + '</td>' +
    '</tr>';
  }).join('');
}

function ghgSavingsApplyEuRow(i) {
  var r = GS_EU_DATA[i];
  var sel = document.getElementById('gs-country-select');
  for (var o of sel.options) {
    if (o.value !== 'custom' && Math.abs(parseFloat(o.value) - r.depot) < 0.001) {
      sel.value = o.value;
      break;
    }
  }
  document.getElementById('gs-custom-depot-field').style.display = 'none';
  ghgSavingsCalc();
}

function ghgSavingsReset() {
  document.getElementById('gs-ep-refinery').value = '0';
  document.getElementById('gs-etd').value = '0';
  document.getElementById('gs-etd-vessel').value = '0';
  document.getElementById('gs-ep-biodiesel').value = '0';
  document.getElementById('gs-vessel-em').value = '0';
  gsSetUnit('gs-ep-refinery-unit', 'dry');
  gsSetUnit('gs-etd-unit', 'dry');
  gsSetUnit('gs-etd-vessel-unit', 'dry');
  gsSetUnit('gs-ep-biodiesel-unit', 'dry');
  gsSetUnit('gs-vessel-em-unit', 'dry');
  document.getElementById('gs-country-select').value = 'custom';
  document.getElementById('gs-depot-custom').value = '0';
  document.getElementById('gs-custom-depot-field').style.display = 'block';
  ghgSavingsCalc();
  showToast('GHG Savings reset', 'success');
}

function openGHGSavingsExportModal() {
  ghgSavingsRenderExportRecordOptions();
  document.getElementById('gs-export-modal').classList.add('open');
}

function closeGHGSavingsExportModal(e) {
  if (!e || e.target === document.getElementById('gs-export-modal')) {
    document.getElementById('gs-export-modal').classList.remove('open');
  }
}

function ghgSavingsGetCurrentData() {
  var ep_ref = gsGet('gs-ep-refinery');
  var etd    = gsGet('gs-etd');
  var etd_vessel = gsGet('gs-etd-vessel');
  var ep_bd  = gsGet('gs-ep-biodiesel');
  var vessel = gsGet('gs-vessel-em');
  var ep_ref_unit = gsGetUnit('gs-ep-refinery-unit');
  var etd_unit    = gsGetUnit('gs-etd-unit');
  var etd_vessel_unit = gsGetUnit('gs-etd-vessel-unit');
  var ep_bd_unit  = gsGetUnit('gs-ep-biodiesel-unit');
  var vessel_unit = gsGetUnit('gs-vessel-em-unit');
  var depot  = ghgSavingsGetDepot();
  var country = ghgSavingsGetCountryName();
  var ep_ref_mj = gsInputToMj('gs-ep-refinery', 'gs-ep-refinery-unit');
  var etd_mj    = gsInputToMj('gs-etd', 'gs-etd-unit');
  var etd_vessel_mj = gsInputToMj('gs-etd-vessel', 'gs-etd-vessel-unit');
  var ep_bd_mj  = gsInputToMj('gs-ep-biodiesel', 'gs-ep-biodiesel-unit');
  var vessel_mj = gsInputToMj('gs-vessel-em', 'gs-vessel-em-unit');
  var ep_ref_dry = gsInputToDry('gs-ep-refinery', 'gs-ep-refinery-unit');
  var etd_dry    = gsInputToDry('gs-etd', 'gs-etd-unit');
  var etd_vessel_dry = gsInputToDry('gs-etd-vessel', 'gs-etd-vessel-unit');
  var ep_bd_dry  = gsInputToDry('gs-ep-biodiesel', 'gs-ep-biodiesel-unit');
  var total_dry = ep_ref_dry + etd_dry + etd_vessel_dry + ep_bd_dry;
  var fob_mj = ep_ref_mj + etd_mj + etd_vessel_mj + ep_bd_mj;
  var saving_fob = ((GS_REF_FF - fob_mj) / GS_REF_FF) * 100;
  var discharge_mj = fob_mj + vessel_mj + depot;
  var saving_discharge = ((GS_REF_FF - discharge_mj) / GS_REF_FF) * 100;
  return {
    ep_ref, ep_ref_unit, etd, etd_unit, etd_vessel, etd_vessel_unit, ep_bd, ep_bd_unit,
    vessel, vessel_unit, ep_ref_mj, etd_mj, etd_vessel_mj, ep_bd_mj, vessel_mj,
    depot, country, total_dry, fob_mj, saving_fob, discharge_mj, saving_discharge
  };
}

function ghgSavingsSaveCurrentResult() {
  var d = ghgSavingsGetCurrentData();
  var period = (document.getElementById('gs-period').value || '').trim() || String(new Date().getFullYear());
  var site = (document.getElementById('gs-site').value || '').trim();
  if (!site) {
    var fallbackSite = (getLatestEtdSnapshot() && getLatestEtdSnapshot().supplier) || '';
    site = fallbackSite || '-';
  }
  var latestEtd = getLatestEtdSnapshot();
  var rec = Object.assign({}, d, {
    id: 'gs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    savedAt: new Date().toISOString(),
    period: period,
    site: site,
    etdMeta: latestEtd || null,
  });
  var all = getGhgSavingsSavedResults();
  all.unshift(rec);
  if (all.length > GS_MAX_SAVED_RESULTS) all = all.slice(0, GS_MAX_SAVED_RESULTS);
  setGhgSavingsSavedResults(all);
  ghgSavingsRenderExportRecordOptions();
  ghgSavingsSaveToSheet(rec);
}

function ghgSavingsSaveToSheet(rec) {
  var payload = {
    mode: 'ghg_savings',
    sheetName: GS_SHEET_NAME,
    id: rec.id,
    savedAt: rec.savedAt,
    period: rec.period || '',
    site: rec.site || '',
    country: rec.country || '',
    eec: 0,
    el: 0,
    epRefinery: rec.ep_ref || 0,
    etdTrucking: rec.etd || 0,
    etdVessel: rec.etd_vessel || 0,
    epBiodiesel: rec.ep_bd || 0,
    vesselEmission: rec.vessel || 0,
    etd: rec.etd || 0,
    vessel: rec.vessel || 0,
    depot: rec.depot || 0,
    savingFob: rec.saving_fob || 0,
    savingDischarge: rec.saving_discharge || 0
  };
  postToAppsScript(payload)
    .then(function(result) {
      if (result.status && result.status !== 'ok') throw new Error(result.message || 'Save GHG Savings failed');
      showToast('GHG Savings result saved to sheet', 'success');
    })
    .catch(function(err) {
      console.error('ghgSavingsSaveToSheet error:', err);
      showToast('Saved locally. Sheet sync failed.', 'error');
    });
}

function ghgSavingsRenderExportRecordOptions() {
  var sel = document.getElementById('gs-export-record');
  if (!sel) return;
  var all = getGhgSavingsSavedResults();
  var opts = '<option value="current">Current form values (live)</option>';
  for (var i = 0; i < all.length; i++) {
    var r = all[i];
    opts += '<option value="' + r.id + '">' + ghgSavingsBuildRecordLabel(r) + '</option>';
  }
  sel.innerHTML = opts;
}

function ghgSavingsGetSelectedExportData() {
  var sel = document.getElementById('gs-export-record');
  var id = sel ? sel.value : 'current';
  if (!id || id === 'current') return ghgSavingsGetCurrentData();
  var all = getGhgSavingsSavedResults();
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return all[i];
  }
  return ghgSavingsGetCurrentData();
}

function ghgSavingsExportExcel() {
  var d = ghgSavingsGetSelectedExportData();
  var company  = document.getElementById('gs-export-company').value || 'KPN Sustainability';
  var period   = document.getElementById('gs-export-period').value || new Date().getFullYear();
  var preparer = document.getElementById('gs-export-preparer').value || '-';

  var wb = XLSX.utils.book_new();
  var rows = [
    ['GHG SAVINGS BIODIESEL', '', '', ''],
    ['Company', company, 'Period', period],
    ['Prepared By', preparer, 'Generated', new Date().toLocaleDateString('en-GB')],
    ['Methodology', 'ISCC/EU Directive 2018/2001', 'Ref. Fossil', GS_REF_FF + ' g CO₂eq/MJ'],
    [],
    ['INPUTS', '', '', ''],
    ['Parameter', 'Value', 'Unit', 'Notes'],
    ['Ep Refinery', d.ep_ref, gsResolveInputUnit(d.ep_ref_unit), 'Processing POME Refinery'],
    ['Ep Refinery (g CO₂eq/MJ used)', gsResolveComponentMj(d.ep_ref, d.ep_ref_unit, d.ep_ref_mj), 'g CO₂eq/MJ', 'Used in calculation'],
    ['Etd FOB kg (Trucking) — ETD1', d.etd, gsResolveInputUnit(d.etd_unit), 'Trucking to loading port'],
    ['Etd Trucking (g CO₂eq/MJ used)', gsResolveComponentMj(d.etd, d.etd_unit, d.etd_mj), 'g CO₂eq/MJ', 'Used in calculation'],
    ['Etd FOB kg (Vessel)', d.etd_vessel, gsResolveInputUnit(d.etd_vessel_unit), 'Vessel to loading port'],
    ['Etd Vessel (g CO₂eq/MJ used)', gsResolveComponentMj(d.etd_vessel, d.etd_vessel_unit, d.etd_vessel_mj), 'g CO₂eq/MJ', 'Used in calculation'],
    ['Ep Biodiesel (PME)', d.ep_bd, gsResolveInputUnit(d.ep_bd_unit), 'Biodiesel production'],
    ['Ep Biodiesel (g CO₂eq/MJ used)', gsResolveComponentMj(d.ep_bd, d.ep_bd_unit, d.ep_bd_mj), 'g CO₂eq/MJ', 'Used in calculation'],
    ['Vessel Emissions (FOB→Import) — ETD2', d.vessel, gsResolveInputUnit(d.vessel_unit, d.vessel_mj != null ? 'kg CO₂eq/dry-ton' : 'g CO₂eq/MJ'), 'FOB to import'],
    ['Vessel (g CO₂eq/MJ used)', gsResolveVesselMj(d), 'g CO₂eq/MJ', 'Added to Total GHG only'],
    [],
    ['RESULTS', '', '', ''],
    ['Metric', 'Value', 'Unit', 'Status'],
    ['Total GHG (dry-ton)', d.total_dry, 'kg CO₂eq/dry-ton', 'Ep + Etd components only'],
    ['Total GHG FOB', d.fob_mj, 'g CO₂eq/MJ', ''],
    ['GHG Saving — FOB', d.saving_fob, '%', d.saving_fob >= 65 ? 'ISCC EU Pass ≥65%' : d.saving_fob >= 50 ? 'Min Pass ≥50%' : 'Below 50%'],
    ['+ Vessel Emissions (ETD2)', gsResolveVesselMj(d), 'g CO₂eq/MJ', 'Added to Total GHG only'],
    ['+ Depot & Filling — ' + d.country, d.depot, 'g CO₂eq/MJ', 'Added to Total GHG only'],
    ['Total GHG', d.discharge_mj, 'g CO₂eq/MJ', 'FoB + ETD2 + Depot'],
    ['GHG Saving', d.saving_discharge, '%', d.saving_discharge >= 65 ? 'ISCC EU Pass ≥65%' : d.saving_discharge >= 50 ? 'Min Pass ≥50%' : 'Below 50%'],
  ];

  var ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:40},{wch:20},{wch:22},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws, 'GHG Savings');
  XLSX.writeFile(wb, 'GHG_Savings_' + (period+'').replace(/[^a-z0-9]/gi,'_') + '.xlsx');
  closeGHGSavingsExportModal();
  showToast('Excel exported!', 'success');
}

function gsPdfThreshStatus(v) {
  if (v >= 65) return 'ISCC EU Pass >=65%';
  if (v >= 50) return 'Min Pass >=50%';
  return 'Below 50% Threshold';
}

function gsPdfInputCells(kgVal, mjVal, mjDecimals) {
  var mjD = mjDecimals == null ? 5 : mjDecimals;
  return [gsPdfNum(kgVal, 2), gsPdfNum(mjVal, mjD)];
}

function gsPdfDisplayText(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s || s === '-') return fallback || 'Not specified';
  return pdfSafeText(s);
}

function ghgSavingsExportPDF() {
  if (!acquirePdfExportLock('savings')) {
    showToast('PDF export already in progress…', 'error');
    return;
  }

  pdfWaitForLibraries()
    .then(function(JsPDF) {
      ghgSavingsGeneratePdf(JsPDF);
    })
    .catch(function(err) {
      console.error('ghgSavingsExportPDF library error:', err);
      showToast('PDF library not loaded. Refresh the page and try again.', 'error');
    })
    .finally(function() {
      releasePdfExportLock('savings');
    });
}

function ghgSavingsGeneratePdf(JsPDF) {
  try {
    var d = ghgSavingsNormalizeExportData(ghgSavingsGetSelectedExportData());
    var companyRaw  = document.getElementById('gs-export-company').value || 'KPN Sustainability';
    var periodRaw   = document.getElementById('gs-export-period').value || new Date().getFullYear();
    var preparerRaw = document.getElementById('gs-export-preparer').value || '';
    var countryRaw  = d.country || 'Custom';
    var generated = new Date().toLocaleDateString('en-GB');
    var preparerDisplay = gsPdfDisplayText(preparerRaw);
    var epTotalDry = (d.ep_ref_dry || 0) + (d.ep_bd_dry || 0);
    var epTotalMj  = (d.ep_ref_mj || 0) + (d.ep_bd_mj || 0);
    var depotLabel = 'Depot & Filling (' + pdfSafeText(countryRaw) + ')';

    var doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var y = pdfWriteBanner(doc, {
      title: 'GHG Savings Biodiesel',
      subtitle: 'ISCC/EU 2018/2001 · LHV PME 37 MJ/kg · Ref. ' + GS_REF_FF + ' g CO2eq/MJ',
      metaLines: [
        pdfSafeText(companyRaw),
        pdfSafeText(periodRaw),
        'Prepared: ' + preparerDisplay,
        generated,
      ],
    });

    y = pdfWriteSectionLabel(doc, 'EP Summary — Refinery & Biodiesel', y + 2);
    doc.autoTable(pdfTableDefaults({
      startY: y,
      head: [['Unit', 'EP1 · Ep Refinery', 'EP2 · Ep Biodiesel', 'EP TOTAL']],
      body: [
        ['kg CO2eq/dry-ton', gsPdfNum(d.ep_ref_dry, 2), gsPdfNum(d.ep_bd_dry, 2), gsPdfNum(epTotalDry, 2)],
        ['g CO2eq/MJ', gsPdfNum(d.ep_ref_mj, 5), gsPdfNum(d.ep_bd_mj, 5), gsPdfNum(epTotalMj, 5)],
      ],
      headStyles: Object.assign({}, PDF_HEAD, { fillColor: PDF_BRAND }),
      tableWidth: pdfTableWidth(doc),
      columnStyles: pdfColumnStyles(doc, [22, 26, 26, 26], {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fillColor: PDF_BRAND_LIGHT, fontStyle: 'bold' },
      }),
    }));

    y = pdfWriteSectionLabel(doc, 'GHG Components — Inputs', doc.lastAutoTable.finalY + 8);
    doc.autoTable(pdfTableDefaults({
      startY: y,
      head: [['Parameter', 'kg CO2eq/dry-ton', 'g CO2eq/MJ']],
      body: [
        ['Ep Refinery'].concat(gsPdfInputCells(d.ep_ref_dry, d.ep_ref_mj)),
        ['Ep Biodiesel (PME)'].concat(gsPdfInputCells(d.ep_bd_dry, d.ep_bd_mj)),
        ['Etd FOB kg (Trucking) — ETD1'].concat(gsPdfInputCells(d.etd_dry, d.etd_mj)),
        ['Etd FOB kg (Vessel)'].concat(gsPdfInputCells(d.etd_vessel_dry, d.etd_vessel_mj)),
        ['Vessel Emissions (FOB to Import) — ETD2'].concat(gsPdfInputCells(d.vessel_dry, d.vessel_mj)),
      ],
      headStyles: Object.assign({}, PDF_HEAD, { fillColor: PDF_BRAND }),
      tableWidth: pdfTableWidth(doc),
      columnStyles: pdfColumnStyles(doc, [52, 24, 24], {
        1: { halign: 'right' },
        2: { halign: 'right' },
      }),
    }));

    y = pdfWriteSectionLabel(doc, 'Calculation Results', doc.lastAutoTable.finalY + 8);
    doc.autoTable(pdfTableDefaults({
      startY: y,
      head: [['Parameter', 'Value', 'Unit / Status']],
      body: [
        ['Total GHG (dry-ton)', gsPdfNum(d.total_dry, 2), 'Ep + Etd components only'],
        ['Total GHG FOB', gsPdfNum(d.fob_mj, 5), 'g CO2eq/MJ'],
        ['GHG Saving — FOB', gsPdfNum(d.saving_fob, 2) + '%', gsPdfThreshStatus(d.saving_fob)],
        ['+ Vessel Emissions (ETD2)', gsPdfNum(d.vessel_mj, 5), 'g CO2eq/MJ'],
        ['+ ' + depotLabel, gsPdfNum(d.depot, 2), 'g CO2eq/MJ'],
        ['Total GHG', gsPdfNum(d.discharge_mj, 5), 'FoB + ETD2 + Depot'],
        ['GHG Saving', gsPdfNum(d.saving_discharge, 2) + '%', gsPdfThreshStatus(d.saving_discharge)],
      ],
      headStyles: Object.assign({}, PDF_HEAD, { fillColor: PDF_BRAND }),
      tableWidth: pdfTableWidth(doc),
      columnStyles: pdfColumnStyles(doc, [46, 22, 32], {
        1: { halign: 'right', fontStyle: 'bold' },
      }),
      didParseCell: function(data) {
        if (data.section !== 'body') return;
        var label = String(data.row.raw[0] || '');
        if (label === 'GHG Saving — FOB' || label === 'GHG Saving') {
          if (data.column.index === 1) {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = [5, 150, 105];
            data.cell.styles.fontSize = 9;
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (label === 'Total GHG' && data.column.index === 1) {
          data.cell.styles.fillColor = PDF_BRAND_LIGHT;
          data.cell.styles.fontStyle = 'bold';
        }
        if ((label.indexOf('+ Vessel') === 0 || label.indexOf('+ Depot') === 0) && data.column.index === 1) {
          data.cell.styles.textColor = [100, 116, 139];
        }
      },
    }));

    pdfWriteFooter(
      doc,
      'KPN SUSTAINABILITY DOWNSTREAM · GHG CALCULATION',
      'kg CO2eq/dry-ton = g CO2eq/MJ x 37 (LHV PME)'
    );

    var filename = 'GHG_Savings_' + String(companyRaw).replace(/[^a-z0-9]/gi, '_') + '_' + String(periodRaw).replace(/[^a-z0-9]/gi, '_') + '.pdf';
    doc.save(filename);
    closeGHGSavingsExportModal();
    showToast('PDF exported!', 'success');
  } catch (err) {
    console.error('ghgSavingsGeneratePdf error:', err);
    showToast('PDF export failed. Please try again.', 'error');
  }
}
