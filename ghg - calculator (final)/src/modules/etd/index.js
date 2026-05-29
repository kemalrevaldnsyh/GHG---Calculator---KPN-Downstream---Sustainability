/* ETD — RPOME calculator + results */
/* ETD — RPOME (ETD BENER.html logic; etdCalculate renamed to avoid clash with main calculate) */

// === CONSTANTS (from Excel DATA sheet) ===
const h_truck = 0.87;
const h_vessel = 0.12;
const EF_Diesel = 0.0951;
const EF_B40 = EF_Diesel * 0.6; // 0.05706
const EF_B10 = EF_Diesel * 0.9; // 0.08559
const EF_HFO = 0.0942;
const MmPOME = 1.015228426395939;
const MmRPOME = 1.000300090027008;

// GLM-specific constants (from Excel GLM!L21 and L22)
const GLM_L21 = 0.7312246559398706;
const GLM_L22 = 0.7206886344194471;

// Destination data
const DEST = {
  LBG: {
    label: 'PMC Lubuk Gaung',
    Ep: 15.510655996919498,
    FF: 1.333733453369344,
    AF: 0.7653061224489796
  },
  TJP: {
    label: 'EUP Tanjung Pura',
    Ep: 29.96436,
    FF: 1.18124,
    AF: 0.84663
  },
  BTG: {
    label: 'EUP Bontang',
    Ep: 36.10316,
    FF: 1.05074,
    AF: 0.94161
  },
  TPG: {
    label: 'TPG Tanjung Langsat',
    Ep: 57.61433,
    FF: 1.68187,
    AF: 0.64361
  },
  GLM: {
    label: 'GLM Port Klang',
    Ep: 61.53894,
    FF: 1.24827,
    AF: 0.80717
  }
};

// Vessel emission constants (pre-calculated from Excel)
const C23 = 6.508861802539543;  // LBG→TJP vessel (POME to RPOME)
const C24 = 17.07044676779194;  // LBG→BTG vessel (POME to RPOME)
const C25 = 2.7265418021415013; // LBG→TPG vessel (RPOME)
const C26 = 1.6289339484588965; // LBG→GLM vessel (RPOME)
const C33 = 2.67669296381747;   // TJP→TPG vessel (RPOME)
const C34 = 6.685362136196683;  // TJP→GLM vessel (RPOME)
const C41 = 14.4950738854865;   // BTG→TPG vessel (RPOME)
const C42 = 17.090498522298713; // BTG→GLM vessel (RPOME)
const C61 = 6.045338308837516;  // LBG vessel base
const C62 = 4.595259491464591;  // LBG→TJP additional
const C63 = 14.367511401255989; // LBG→BTG additional

let currentDest = 'LBG';

function etdDom(id) {
  var map = {
    supplier: 'ggl-supplier',
    destination: 'ggl-destination',
    dist_truck: 'ggl-dist-truck',
    dist_vessel: 'ggl-dist-vessel',
    dist_vessel2: 'ggl-dist-vessel2',
    'etd-period': 'ggl-etd-period',
    results: 'ggl-etd-results',
    'r-supplier': 'ggl-r-supplier',
    'r-meta': 'ggl-r-meta',
    'r-summary': 'ggl-r-summary',
    'r-tbody': 'ggl-r-tbody',
    'r-fob': 'ggl-r-fob',
    'r-factors': 'ggl-r-factors',
    'mode-hint': 'ggl-mode-hint',
  };
  if (typeof CALC_MODE !== 'undefined' && CALC_MODE === 'ggl' && map[id]) {
    var gglEl = document.getElementById(map[id]);
    if (gglEl) return gglEl;
  }
  return document.getElementById(id);
}

function etdStatCardHtml(label, value, highlight) {
  return '<div class="stat-card' + (highlight ? ' highlight' : '') + '">'
    + '<div class="stat-label">' + label + '</div>'
    + '<div class="stat-value">' + value.toFixed(2) + '</div>'
    + '<div class="stat-unit">kgCO₂e/dry-t</div>'
    + '</div>';
}

function etdBreakdownRowHtml(row) {
  return '<tr>'
    + '<td><div class="td-name">' + row.name + '</div><div class="td-formula">' + row.formula + '</div></td>'
    + '<td></td>'
    + '<td class="' + (row.val === null ? 'td-val na' : 'td-val') + '">'
    + (row.val === null ? 'N/A' : row.val.toFixed(2))
    + '</td></tr>';
}

function etdFobCardHtml(label, val, ep, primary) {
  return '<div class="fob-card ' + (primary ? 'primary' : '') + '">'
    + '<div class="fob-label">' + label + '</div>'
    + '<div class="fob-value">' + val.toFixed(2) + '</div>'
    + '<div class="fob-breakdown">Ep ' + ep.toFixed(2) + ' + Etd ' + (val - ep).toFixed(2) + '</div>'
    + '</div>';
}

function paintEtdResultsView(getEl, data) {
  getEl('r-supplier').textContent = data.supplier;
  getEl('r-meta').textContent = data.meta;
  getEl('r-summary').innerHTML = data.summaryHtml;
  getEl('r-tbody').innerHTML = data.rows.map(etdBreakdownRowHtml).join('');
  getEl('r-fob').innerHTML = data.fobHtml;
  getEl('r-factors').innerHTML = data.factorsHtml;
  var resultsEl = getEl('results');
  resultsEl.style.display = 'block';
  resultsEl.scrollIntoView({ behavior: 'smooth' });
}

function updateModeHint() {
  var truckEl = etdDom('dist_truck');
  var vesselEl = etdDom('dist_vessel');
  var vessel2El = etdDom('dist_vessel2');
  var hint = etdDom('mode-hint');
  if (!truckEl || !vesselEl || !vessel2El || !hint) return;
  const dt  = parseFloat(truckEl.value);
  const dv1 = parseFloat(vesselEl.value);
  const dv2 = parseFloat(vessel2El.value);
  const hasTruck   = !isNaN(dt)  && dt  > 0;
  const hasVessel1 = !isNaN(dv1) && dv1 > 0;
  const hasVessel2 = !isNaN(dv2) && dv2 > 0;
  if (!hasTruck && !hasVessel1 && !hasVessel2) { hint.style.display = 'none'; return; }
  hint.style.display = 'flex';
  if (hasTruck && hasVessel1 && hasVessel2) {
    hint.className = 'mode-hint trucking_vessel';
    hint.innerHTML = 'Mode: <strong>Bulking</strong> — Trucking ' + dt + ' km → Vessel 1 ' + dv1 + ' km → Vessel 2 ' + dv2 + ' km';
  } else if (!hasTruck && hasVessel1 && hasVessel2) {
    hint.className = 'mode-hint trucking_vessel';
    hint.innerHTML = 'Mode: <strong>Bulking (2 Vessel)</strong> — Vessel 1 ' + dv1 + ' km → Vessel 2 ' + dv2 + ' km';
  } else if (hasTruck && hasVessel1) {
    hint.className = 'mode-hint trucking_vessel';
    hint.innerHTML = 'Mode: <strong>Bulking</strong> — Trucking ' + dt + ' km → Vessel ' + dv1 + ' km';
  } else if (hasTruck) {
    hint.className = 'mode-hint trucking';
    hint.innerHTML = 'Mode: <strong>Direct Trucking</strong> — ' + dt + ' km';
  } else {
    hint.className = 'mode-hint vessel';
    hint.innerHTML = 'Mode: <strong>Direct Vessel</strong> — ' + dv1 + ' km';
  }
}

function openFactorModal(dest) {
  currentDest = dest;
  const d = DEST[dest];
  document.getElementById('modal-dest-label').textContent = d.label;
  document.getElementById('modal-dest-label2').textContent = d.label;
  document.getElementById('modal-af-input').value = d.AF;
  document.getElementById('modal-ff-input').value = d.FF;
  document.getElementById('factorModal').classList.add('active');
}

function closeFactorModal() {
  document.getElementById('factorModal').classList.remove('active');
}

function saveFactors() {
  const newAF = parseFloat(document.getElementById('modal-af-input').value);
  const newFF = parseFloat(document.getElementById('modal-ff-input').value);
  
  if (!isNaN(newAF) && newAF >= 0 && newAF <= 1) {
    DEST[currentDest].AF = newAF;
  }
  if (!isNaN(newFF) && newFF >= 0) {
    DEST[currentDest].FF = newFF;
  }
  
  closeFactorModal();
  // Recalculate if results are shown
  if (document.getElementById('results').style.display === 'block') {
    etdCalculate();
  }
}

function etdCalculateGgl() {
  const G = (typeof GGL_ETD !== 'undefined') ? GGL_ETD : {
    h_truck: 0.87, h_vessel: 0.07, EF_B40: 0.095 * 0.6, Mm_Md: 1.25,
    destinations: {
      PLM: { label: 'EUP Palembang', Ep: 0.58389374058265631 },
      BTG: { label: 'EUP Bontang', Ep: 3.0817003485179981 },
      KUM: { label: 'EUP Kumai', Ep: 0.24414969836428579 },
      LBG: { label: 'EUP Lubuk Gaung', Ep: 0.91571517172963479 },
    }
  };

  const supplier = etdDom('supplier').value.trim() || '—';
  const dest = etdDom('destination').value;
  const d = G.destinations[dest];
  if (!d) {
    alert('Please select a valid GGL EUP destination (Palembang, Bontang, Kumai, or Lubuk Gaung).');
    return;
  }

  const dtRaw  = parseFloat(etdDom('dist_truck').value);
  const dv1Raw = parseFloat(etdDom('dist_vessel').value);
  const dv2Raw = parseFloat(etdDom('dist_vessel2').value);

  const hasTruck   = !isNaN(dtRaw)  && dtRaw  > 0;
  const hasVessel1 = !isNaN(dv1Raw) && dv1Raw > 0;
  const hasVessel2 = !isNaN(dv2Raw) && dv2Raw > 0;

  if (!hasTruck && !hasVessel1 && !hasVessel2) {
    alert('Enter at least one distance (Trucking or Vessel)!');
    return;
  }

  const dist_truck   = hasTruck   ? dtRaw  : 0;
  const dist_vessel1 = hasVessel1 ? dv1Raw : 0;
  const dist_vessel2 = hasVessel2 ? dv2Raw : 0;

  let Ep = d.Ep;
  let epSource = 'referensi EUP';
  if (typeof R !== 'undefined' && R && R.epRpome > 0 && typeof CALC_MODE !== 'undefined' && CALC_MODE === 'ggl') {
    Ep = R.epRpome;
    epSource = 'Processing tab';
  }

  const efB40 = G.EF_B40;
  const mm = G.Mm_Md;

  const etd_truck_raw   = hasTruck   ? dist_truck   * G.h_truck  * efB40 * mm : 0;
  const etd_vessel1_raw = hasVessel1 ? dist_vessel1 * G.h_vessel * efB40 * mm : 0;
  const etd_vessel2_raw = hasVessel2 ? dist_vessel2 * G.h_vessel * efB40 * mm : 0;
  const total_etd_raw = etd_truck_raw + etd_vessel1_raw + etd_vessel2_raw;
  const N = total_etd_raw;
  const totalFob = Ep + N;

  const periodVal = (etdDom('etd-period').value || '').trim() || String(new Date().getFullYear());
  saveLatestEtdSnapshot({
    savedAt: new Date().toISOString(),
    period: periodVal,
    supplier: supplier,
    destination: dest,
    destinationLabel: d.label,
    etdForSavings: N,
    totalFob: totalFob,
    unit: 'kg CO2eq/dry-ton'
  });
  latestEtdCalc = {
    id: 'etd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    savedAt: new Date().toISOString(),
    period: periodVal,
    site: supplier,
    route: d.label,
    etdValue: N,
    unit: 'kg CO2eq/dry-ton',
    supplier: supplier,
    refinery: dest,
    truckDist: dist_truck,
    vesselDist1: dist_vessel1,
    vesselDist2: dist_vessel2,
    etdN: N,
    etdR: totalFob,
    etdS: null,
    etdT: null,
    etdTotal: totalFob,
    rawPayload: {
      variant: 'ggl',
      destination: dest,
      destinationLabel: d.label,
      dist_truck, dist_vessel1, dist_vessel2,
      total_etd_raw, N, Ep, R: totalFob, epSource: epSource
    }
  };

  (function() {
    var rec = {
      id: latestEtdCalc.id,
      savedAt: latestEtdCalc.savedAt,
      period: periodVal,
      supplier: supplier,
      refinery: dest,
      origin: 'Indonesia',
      vesselName: '',
      blNumber: '',
      blDate: '',
      certType: '',
      loadingPort: '',
      shipmentDest: d.label,
      truckDist: dist_truck,
      vesselDist1: dist_vessel1,
      vesselDist2: dist_vessel2,
      etdN: N,
      etdR: totalFob,
      etdS: null,
      etdT: null,
      etdTotal: totalFob,
      rawPayload: latestEtdCalc.rawPayload
    };
    etdResultsLog = etdResultsLog.filter(function(x){ return x.supplier !== supplier || x.refinery !== dest; });
    etdResultsLog.unshift(rec);
  }());

  let modeLabel, distLabel;
  if (hasTruck && hasVessel1 && hasVessel2) {
    modeLabel = 'Bulking (Truck + 2 Vessel)';
    distLabel = 'Truck ' + dist_truck + ' km + Vessel1 ' + dist_vessel1 + ' km + Vessel2 ' + dist_vessel2 + ' km';
  } else if (!hasTruck && hasVessel1 && hasVessel2) {
    modeLabel = 'Bulking (2 Vessel)';
    distLabel = 'Vessel1 ' + dist_vessel1 + ' km + Vessel2 ' + dist_vessel2 + ' km';
  } else if (hasTruck && hasVessel1) {
    modeLabel = 'Bulking (Truck + Vessel)';
    distLabel = 'Truck ' + dist_truck + ' km + Vessel ' + dist_vessel1 + ' km';
  } else if (hasTruck) {
    modeLabel = 'Direct Trucking';
    distLabel = dist_truck + ' km (truck)';
  } else {
    modeLabel = 'Direct Vessel';
    distLabel = dist_vessel1 + ' km (vessel)';
  }

  var summaryHtml = ''
    + (hasTruck ? etdStatCardHtml('Etd Cangkang Trucking', etd_truck_raw, false) : '')
    + (hasVessel1 ? etdStatCardHtml('Etd Cangkang Vessel' + (hasVessel2 ? ' 1' : ''), etd_vessel1_raw, false) : '')
    + (hasVessel2 ? etdStatCardHtml('Etd Cangkang Vessel 2', etd_vessel2_raw, false) : '')
    + etdStatCardHtml('Ep Processing', Ep, false)
    + etdStatCardHtml('Etd FOB ' + dest, N, false)
    + etdStatCardHtml('Total FOB ' + dest, totalFob, true);

  var rows = [];
  if (hasTruck) rows.push({
    name: 'Etd Cangkang — Trucking',
    formula: dist_truck + ' km × η_truck(' + G.h_truck + ') × EF_B40(' + efB40.toFixed(5) + ') × Mm(' + mm + ')',
    val: etd_truck_raw
  });
  if (hasVessel1) rows.push({
    name: 'Etd Cangkang — Vessel' + (hasVessel2 ? ' 1' : ''),
    formula: dist_vessel1 + ' km × η_vessel(' + G.h_vessel + ') × EF_B40(' + efB40.toFixed(5) + ') × Mm(' + mm + ')',
    val: etd_vessel1_raw
  });
  if (hasVessel2) rows.push({
    name: 'Etd Cangkang — Vessel 2 (Bulking)',
    formula: dist_vessel2 + ' km × η_vessel(' + G.h_vessel + ') × EF_B40(' + efB40.toFixed(5) + ') × Mm(' + mm + ')',
    val: etd_vessel2_raw
  });
  rows.push({
    name: 'Ep Processing',
    formula: epSource === 'Processing tab' ? 'From Processing tab — ' + d.label : 'EUP reference — ' + d.label,
    val: Ep
  });
  rows.push({
    name: 'Etd FOB ' + dest + ' (N)',
    formula: '(' + total_etd_raw.toFixed(4) + ') truck + vessel(s)',
    val: N
  });
  rows.push({
    name: 'Etd FOB Tj. Langsat (O)',
    formula: '-',
    val: null
  });
  rows.push({
    name: 'Etd FOB Port Klang (P)',
    formula: '-',
    val: null
  });

  var fobHtml = etdFobCardHtml('FOB ' + d.label, totalFob, Ep, true);

  var factorsHtml = ''
    + (hasTruck ? '<div class="factor-item"><span class="factor-key">η truck</span><span class="factor-val">' + G.h_truck + '</span></div>' : '')
    + ((hasVessel1 || hasVessel2) ? '<div class="factor-item"><span class="factor-key">η vessel</span><span class="factor-val">' + G.h_vessel + '</span></div>' : '')
    + '<div class="factor-item"><span class="factor-key">EF_B40</span><span class="factor-val">' + efB40.toFixed(5) + '</span></div>'
    + '<div class="factor-item"><span class="factor-key">Mm</span><span class="factor-val">' + mm + '</span></div>'
    + '<div class="factor-item"><span class="factor-key">Ep (' + dest + ')</span><span class="factor-val">' + Ep.toFixed(5) + '</span></div>'
    + '<div class="factor-item"><span class="factor-key">Product</span><span class="factor-val">Cangkang</span></div>';

  paintEtdResultsView(etdDom, {
    supplier: supplier,
    meta: distLabel + ' · ' + d.label + ' · ' + modeLabel,
    summaryHtml: summaryHtml,
    rows: rows,
    fobHtml: fobHtml,
    factorsHtml: factorsHtml
  });
  updateModeHint();
}

function etdCalculate() {
  if ((typeof ETD_VARIANT !== 'undefined' && ETD_VARIANT === 'ggl') ||
      (typeof CALC_MODE !== 'undefined' && CALC_MODE === 'ggl')) {
    return etdCalculateGgl();
  }
  const supplier = document.getElementById('supplier').value.trim() || '—';
  const dest    = document.getElementById('destination').value;
  const dtRaw   = parseFloat(document.getElementById('dist_truck').value);
  const dv1Raw  = parseFloat(document.getElementById('dist_vessel').value);
  const dv2Raw  = parseFloat(document.getElementById('dist_vessel2').value);

  const hasTruck   = !isNaN(dtRaw)  && dtRaw  > 0;
  const hasVessel1 = !isNaN(dv1Raw) && dv1Raw > 0;
  const hasVessel2 = !isNaN(dv2Raw) && dv2Raw > 0;

  if (!hasTruck && !hasVessel1 && !hasVessel2) {
    alert('Enter at least one distance (Trucking or Vessel)!');
    return;
  }

  const dist_truck   = hasTruck   ? dtRaw  : 0;
  const dist_vessel1 = hasVessel1 ? dv1Raw : 0;
  const dist_vessel2 = hasVessel2 ? dv2Raw : 0;

  const d = DEST[dest];
  const {Ep, FF, AF} = d;

  // =====================================================
  // PERBAIKAN RUMUS TPG DAN GLM
  // TPG menggunakan EF_B10 (bukan EF_B40)
  // GLM menambahkan GLM_L21 + GLM_L22
  // =====================================================
  
  let etd_truck_raw, etd_vessel1_raw, etd_vessel2_raw;
  
  if (dest === 'TPG') {
    // TPG uses EF_B10 instead of EF_B40
    etd_truck_raw   = hasTruck   ? dist_truck   * h_truck  * EF_B10 * MmPOME : 0;
    etd_vessel1_raw = hasVessel1 ? dist_vessel1 * h_vessel * EF_HFO * MmPOME : 0;
    etd_vessel2_raw = hasVessel2 ? dist_vessel2 * h_vessel * EF_HFO * MmPOME : 0;
  } else if (dest === 'GLM') {
    // GLM uses EF_B10 for truck and EF_HFO for vessel
    etd_truck_raw   = hasTruck   ? dist_truck   * h_truck  * EF_B10 * MmPOME : 0;
    etd_vessel1_raw = hasVessel1 ? dist_vessel1 * h_vessel * EF_HFO * MmPOME : 0;
    etd_vessel2_raw = hasVessel2 ? dist_vessel2 * h_vessel * EF_HFO * MmPOME : 0;
  } else {
    // LBG, TJP, BTG use EF_B40
    etd_truck_raw   = hasTruck   ? dist_truck   * h_truck  * EF_B40 * MmPOME : 0;
    etd_vessel1_raw = hasVessel1 ? dist_vessel1 * h_vessel * EF_B40 * MmPOME : 0;
    etd_vessel2_raw = hasVessel2 ? dist_vessel2 * h_vessel * EF_B40 * MmPOME : 0;
  }

  const total_etd_raw = etd_truck_raw + etd_vessel1_raw + etd_vessel2_raw;

  // =====================================================
  // FORMULA N calculation
  // =====================================================
  let N;
  if (dest === 'BTG' && hasTruck && hasVessel1 && hasVessel2) {
    const {FF: FF_LBG, AF: AF_LBG} = DEST['LBG'];
    const truck_part   = etd_truck_raw   * FF * AF * MmRPOME;
    const vessel1_part = etd_vessel1_raw * FF_LBG * AF_LBG;
    const vessel2_part = etd_vessel2_raw * FF * AF;
    N = truck_part + vessel1_part + vessel2_part;
  } else if (dest === 'GLM') {
    // GLM adds L21 + L22
    N = total_etd_raw * FF * AF * MmRPOME + GLM_L21 + GLM_L22;
  } else {
    N = total_etd_raw * FF * AF * MmRPOME;
  }

  // O: Etd FOB Tj. Langsat (TPG)
  let O = null;
  if (dest === 'LBG')      O = N + C25;
  else if (dest === 'TJP') O = N + C33;
  else if (dest === 'BTG') O = N + C41;
  else if (dest === 'TPG') O = N;

  // P: Etd FOB Port Klang (GLM)
  let P = null;
  if (dest === 'LBG')      P = N + C26;
  else if (dest === 'TJP') P = N + C34;
  else if (dest === 'BTG') P = N + C42;
  else if (dest === 'GLM') P = N;

  const R = Ep + N;
  const S = O !== null ? Ep + O : null;
  const T = P !== null ? Ep + P : null;
  const periodVal = (document.getElementById('etd-period').value || '').trim() || String(new Date().getFullYear());
  saveLatestEtdSnapshot({
    savedAt: new Date().toISOString(),
    period: periodVal,
    supplier: supplier,
    destination: dest,
    destinationLabel: d.label,
    etdForSavings: N,
    totalFob: R,
    unit: 'kg CO2eq/dry-ton'
  });
  latestEtdCalc = {
    id: 'etd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    savedAt: new Date().toISOString(),
    period: periodVal,
    site: supplier,
    route: d.label,
    etdValue: N,
    unit: 'kg CO2eq/dry-ton',
    supplier: supplier,
    refinery: dest,
    truckDist:   dist_truck,
    vesselDist1: dist_vessel1,
    vesselDist2: dist_vessel2,
    etdN: N,
    etdR: R,
    etdS: S,
    etdT: T,
    etdTotal: R,
    rawPayload: {
      destination: dest,
      destinationLabel: d.label,
      dist_truck: dist_truck,
      dist_vessel1: dist_vessel1,
      dist_vessel2: dist_vessel2,
      total_etd_raw: total_etd_raw,
      N: N,
      Ep: Ep,
      R: R,
      S: S,
      T: T
    }
  };

  // Push to etdResultsLog immediately so PDF export works without sheet round-trip
  (function() {
    var rec = {
      id: latestEtdCalc.id,
      savedAt: latestEtdCalc.savedAt,
      period: periodVal,
      supplier: supplier,
      refinery: dest,
      origin: 'Indonesia',
      vesselName: '',
      blNumber: '',
      blDate: '',
      certType: '',
      loadingPort: '',
      shipmentDest: d.label,
      truckDist:   dist_truck,
      vesselDist1: dist_vessel1,
      vesselDist2: dist_vessel2,
      etdN: N,
      etdR: R,
      etdS: S,
      etdT: T,
      etdTotal: R,
      rawPayload: latestEtdCalc.rawPayload
    };
    etdResultsLog = etdResultsLog.filter(function(x){ return x.supplier !== supplier || x.refinery !== dest; });
    etdResultsLog.unshift(rec);
  }());

  // Mode label
  let modeLabel, distLabel;
  if (hasTruck && hasVessel1 && hasVessel2) {
    modeLabel = 'Bulking (Truck + 2 Vessel)';
    distLabel = `Truck ${dist_truck} km + Vessel1 ${dist_vessel1} km + Vessel2 ${dist_vessel2} km`;
  } else if (!hasTruck && hasVessel1 && hasVessel2) {
    modeLabel = 'Bulking (2 Vessel)';
    distLabel = `Vessel1 ${dist_vessel1} km + Vessel2 ${dist_vessel2} km`;
  } else if (hasTruck && hasVessel1) {
    modeLabel = 'Bulking (Truck + Vessel)';
    distLabel = `Truck ${dist_truck} km + Vessel ${dist_vessel1} km`;
  } else if (hasTruck) {
    modeLabel = 'Direct Trucking';
    distLabel = `${dist_truck} km (truck)`;
  } else {
    modeLabel = 'Direct Vessel';
    distLabel = `${dist_vessel1} km (vessel)`;
  }

  document.getElementById('r-supplier').textContent = supplier;
  document.getElementById('r-meta').textContent = `${distLabel} · ${d.label} · ${modeLabel}`;

  const summaryHtml = ''
    + (hasTruck ? etdStatCardHtml('Etd POME Trucking', etd_truck_raw, false) : '')
    + (hasVessel1 ? etdStatCardHtml('Etd POME Vessel' + (hasVessel2 ? ' 1' : ''), etd_vessel1_raw, false) : '')
    + (hasVessel2 ? etdStatCardHtml('Etd POME Vessel 2', etd_vessel2_raw, false) : '')
    + etdStatCardHtml('Ep Refinery', Ep, false)
    + etdStatCardHtml('Etd FOB ' + dest, N, false)
    + etdStatCardHtml('Total FOB ' + dest, R, true);

  const EF_used = (dest === 'TPG' || dest === 'GLM') ? EF_B10 : EF_B40;
  const EF_vessel_used = (dest === 'TPG' || dest === 'GLM') ? EF_HFO : EF_B40;
  const EF_label = (dest === 'TPG' || dest === 'GLM') ? 'EF_B10' : 'EF_B40';
  const EF_vessel_label = (dest === 'TPG' || dest === 'GLM') ? 'EF_HFO' : 'EF_B40';

  const rows = [];
  if (hasTruck) rows.push({
    name: 'Etd POME — Trucking',
    formula: `${dist_truck} km × η_truck(${h_truck}) × ${EF_label}(${EF_used.toFixed(5)}) × Mm_POME(${MmPOME.toFixed(6)})`,
    val: etd_truck_raw
  });
  if (hasVessel1) rows.push({
    name: `Etd POME — Vessel${hasVessel2 ? ' 1' : ''}`,
    formula: `${dist_vessel1} km × η_vessel(${h_vessel}) × ${EF_vessel_label}(${EF_vessel_used.toFixed(5)}) × Mm_POME(${MmPOME.toFixed(6)})`,
    val: etd_vessel1_raw
  });
  if (hasVessel2) rows.push({
    name: 'Etd POME — Vessel 2 (Bulking)',
    formula: `${dist_vessel2} km × η_vessel(${h_vessel}) × ${EF_vessel_label}(${EF_vessel_used.toFixed(5)}) × Mm_POME(${MmPOME.toFixed(6)})`,
    val: etd_vessel2_raw
  });
  rows.push({ name: 'Ep Refinery', formula: `Data CB — ${d.label}`, val: Ep });
  
  let nFormula;
  if (dest === 'BTG' && hasTruck && hasVessel1 && hasVessel2) {
    const {FF: FF_LBG, AF: AF_LBG} = DEST['LBG'];
    nFormula = `truck×FF_BTG×AF_BTG×MmRPOME + vessel1×FF_LBG(${FF_LBG.toFixed(5)})×AF_LBG(${AF_LBG.toFixed(5)}) + vessel2×FF_BTG×AF_BTG`;
  } else if (dest === 'GLM') {
    nFormula = `(${total_etd_raw.toFixed(4)}) × FF(${FF}) × AF(${AF}) × MmRPOME + L21(${GLM_L21.toFixed(4)}) + L22(${GLM_L22.toFixed(4)})`;
  } else {
    nFormula = `(${total_etd_raw.toFixed(4)}) × FF(${FF}) × AF(${AF}) × MmRPOME`;
  }
  
  rows.push({
    name: `Etd FOB ${dest} (N)`,
    formula: nFormula,
    val: N
  });
  rows.push({
    name: 'Etd FOB Tj. Langsat (O)',
    formula: O !== null ? (dest === 'TPG' ? 'Direct at TPG' : 'N + vessel to TPG') : '-',
    val: O
  });
  rows.push({
    name: 'Etd FOB Port Klang (P)',
    formula: P !== null ? (dest === 'GLM' ? 'Direct at GLM' : 'N + vessel to GLM') : '-',
    val: P
  });

  const fobs = [
    {label: `FOB ${d.label}`, val: R, primary: true},
    ...(S !== null && dest !== 'TPG' ? [{label: 'FOB Tj. Langsat', val: S, primary: false}] : []),
    ...(T !== null && dest !== 'GLM' ? [{label: 'FOB Port Klang', val: T, primary: false}] : [])
  ];
  const fobHtml = fobs.map(f => etdFobCardHtml(f.label, f.val, Ep, f.primary)).join('');

  const factorsHtml = `
    ${hasTruck ? `<div class="factor-item"><span class="factor-key">η truck</span><span class="factor-val">${h_truck}</span></div>` : ''}
    ${(hasVessel1||hasVessel2) ? `<div class="factor-item"><span class="factor-key">η vessel</span><span class="factor-val">${h_vessel}</span></div>` : ''}
    <div class="factor-item"><span class="factor-key">${EF_label}</span><span class="factor-val">${EF_used.toFixed(5)}</span></div>
    ${(hasVessel1||hasVessel2) ? `<div class="factor-item"><span class="factor-key">${EF_vessel_label}</span><span class="factor-val">${EF_vessel_used.toFixed(5)}</span></div>` : ''}
    <div class="factor-item"><span class="factor-key">Mm POME</span><span class="factor-val">${MmPOME.toFixed(8)}</span></div>
    <div class="factor-item"><span class="factor-key">Mm RPOME</span><span class="factor-val">${MmRPOME.toFixed(10)}</span></div>
    <div class="factor-item">
      <span class="factor-key">FF (${dest})</span>
      <span class="factor-val editable" onclick="openFactorModal('${dest}')" title="Triple-click to edit">${FF}</span>
    </div>
    <div class="factor-item">
      <span class="factor-key">AF (${dest})</span>
      <span class="factor-val editable" onclick="openFactorModal('${dest}')" title="Triple-click to edit">${AF}</span>
    </div>`;

  paintEtdResultsView(function(id) { return document.getElementById(id); }, {
    supplier: supplier,
    meta: `${distLabel} · ${d.label} · ${modeLabel}`,
    summaryHtml: summaryHtml,
    rows: rows,
    fobHtml: fobHtml,
    factorsHtml: factorsHtml
  });
}

function saveETDToSheet() {
  if (!latestEtdCalc) {
    showToast('Calculate emissions before saving ETD', 'error');
    return;
  }
  var _rp_ = latestEtdCalc.rawPayload || {};
  var payload = {
    mode: 'etd',
    sheetName: ETD_SHEET_NAME,
    id: latestEtdCalc.id,
    savedAt: latestEtdCalc.savedAt,
    period: latestEtdCalc.period || '',
    site: latestEtdCalc.site || '',
    route: latestEtdCalc.route || '',
    etdValue: latestEtdCalc.etdValue || 0,
    unit: latestEtdCalc.unit || 'kg CO2eq/dry-ton',
    truckDist:   _toNum_(_rp_.dist_truck),
    vesselDist1: _toNum_(_rp_.dist_vessel1),
    vesselDist2: _toNum_(_rp_.dist_vessel2),
    etdN:    _toNum_(_rp_.N),
    etdR:    _toNum_(_rp_.R),
    supplier: latestEtdCalc.site || '',
    refinery: _rp_.destination || '',
    rawPayload: JSON.stringify(_rp_)
  };
  postToAppsScript(payload)
    .then(function(result) {
      if (result.status && result.status !== 'ok') throw new Error(result.message || 'Save ETD failed');
      fetchEtdLog();
      showToast('ETD saved to sheet', 'success');
    })
    .catch(function(err) {
      console.error('saveETDToSheet error:', err);
      showToast('ETD save failed', 'error');
    });
}

// Keyboard shortcut: Ctrl+Shift+E to open factor editor for current destination (ETD only)
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    var destEl = document.getElementById('destination');
    if (!destEl) return;
    e.preventDefault();
    openFactorModal(destEl.value);
  }
});

// Close modal when clicking outside
document.getElementById('factorModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeFactorModal();
  }
});

/* ══════════════════════════════════════════
   ETD SUB-TABS
   ══════════════════════════════════════════ */
function switchEtdSubTab(tab, el) {
  document.querySelectorAll('#etd-inner .etd-subpage').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('#etd-app-wrap .etd-subtab').forEach(function(t){ t.classList.remove('active'); });
  document.getElementById('etd-sub-' + tab).classList.add('active');
  el.classList.add('active');
  if (tab === 'results') {
    fetchEtdLog();
    renderEtdResultsList();
  }
}

/* ══════════════════════════════════════════
   ETD RESULTS — from Traceability
   ══════════════════════════════════════════ */
var etdResultsLog = [];

function _safeParseJson_(val) {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return {};
  }
}

function _toNum_(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

function _resolveEtdForSavings_(r) {
  if (!r) return 0;
  var rp = r.rawPayload || {};
  var n = _toNum_(r.etdN != null ? r.etdN : rp.N);
  if (n > 0) return n;

  var ep = _toNum_(rp.Ep);
  var total = _toNum_(r.etdTotal != null ? r.etdTotal : (r.etdR != null ? r.etdR : rp.R));
  if (total > 0 && ep > 0 && total > ep) return total - ep;

  return _toNum_(r.etdValue);
}

function _resolveEtdTotalFob_(r) {
  if (!r) return 0;
  var rp = r.rawPayload || {};
  var v = _toNum_(r.etdR != null ? r.etdR : (r.etdTotal != null ? r.etdTotal : rp.R));
  if (v > 0) return v;
  var n = _resolveEtdForSavings_(r);
  var ep = _toNum_(rp.Ep);
  if (n > 0 && ep > 0) return n + ep;
  return 0;
}

function _resolveEtdDistances_(r) {
  var rp = {};
  if (r && r.rawPayload) {
    rp = (typeof r.rawPayload === 'string') ? _safeParseJson_(r.rawPayload) : r.rawPayload;
  }
  var truckDist   = (r && r.truckDist   != null) ? _toNum_(r.truckDist)   : (rp.dist_truck   != null ? _toNum_(rp.dist_truck)   : 0);
  var vesselDist1 = (r && r.vesselDist1 != null) ? _toNum_(r.vesselDist1) : (rp.dist_vessel1 != null ? _toNum_(rp.dist_vessel1) : 0);
  var vesselDist2 = (r && r.vesselDist2 != null) ? _toNum_(r.vesselDist2) : (rp.dist_vessel2 != null ? _toNum_(rp.dist_vessel2) : 0);
  return { truckDist: truckDist, vesselDist1: vesselDist1, vesselDist2: vesselDist2 };
}

function _isMeaningfulEtdRecord_(r) {
  if (!r) return false;
  var hasName = !!((r.supplier && r.supplier !== '-') || (r.refinery && r.refinery !== '-'));
  var hasNum = _resolveEtdForSavings_(r) > 0 || _resolveEtdTotalFob_(r) > 0 || _toNum_(r.etdValue) > 0;
  return hasName && hasNum;
}

function _etdExportLabel_(r, idx) {
  var supplier = (r.supplier || '-').trim();
  var refinery = (r.refinery || '-').trim();
  var etd = _resolveEtdForSavings_(r);
  return '#' + (idx + 1) + ' · ' + supplier + ' · ' + refinery + ' · ETD ' + fmt(etd || 0, 2);
}

function refreshEtdExportSelector() {
  var sel = document.getElementById('etd-export-select');
  if (!sel) return;
  var html = '<option value="all">All ETD Results (valid only)</option>';
  for (var i = 0; i < etdResultsLog.length; i++) {
    var r = etdResultsLog[i];
    if (!_isMeaningfulEtdRecord_(r)) continue;
    var idVal = String(r.id || ('idx_' + i)).replace(/"/g, '&quot;');
    html += '<option value="' + idVal + '">' + escH(_etdExportLabel_(r, i)) + '</option>';
  }
  sel.innerHTML = html;
}

function _mapSheetRowToEtdResult_(row) {
  var rp = _safeParseJson_(row.rawPayload || row.raw_payload || row.payload || '');
  var supplier = String(row.supplier || row.site || '').trim();
  var refinery = String(row.refinery || rp.destination || '').trim();
  var ep = _toNum_(rp.Ep);
  var etdN = _toNum_(row.etdN != null ? row.etdN : (rp.N != null ? rp.N : row.etdValue));
  var etdR = _toNum_(row.etdR != null ? row.etdR : (rp.R != null ? rp.R : row.etdTotal));
  var etdTotal = _toNum_(row.etdTotal != null ? row.etdTotal : (etdR || row.etdValue));
  if (!etdN && ep > 0 && etdR > ep) etdN = etdR - ep;
  if (!etdN && ep > 0 && etdTotal > ep) etdN = etdTotal - ep;
  return {
    id: String(row.id || '').trim() || ('sheet_' + (row.savedAt || Date.now()) + '_' + supplier + '_' + refinery),
    savedAt: String(row.savedAt || row.saved_at || '').trim(),
    supplier: supplier || '-',
    origin: String(row.origin || 'Indonesia').trim(),
    vesselName: String(row.vesselName || row.vessel || '').trim(),
    blNumber: String(row.blNumber || '').trim(),
    blDate: String(row.blDate || '').trim(),
    certType: String(row.certType || row.certificate || '').trim(),
    loadingPort: String(row.loadingPort || '').trim(),
    sdNumber: String(row.sdNumber || row.kodeSD || row.sd_number || '').trim(),
    shipmentDest: String(row.shipmentDest || row.route || row.destinationLabel || '').trim(),
    refinery: refinery || '-',
    truckDist: _toNum_(row.truckDist != null ? row.truckDist : (rp.dist_truck != null ? rp.dist_truck : row.distanceTrucking)),
    vesselDist1: _toNum_(row.vesselDist1 != null ? row.vesselDist1 : (rp.dist_vessel1 != null ? rp.dist_vessel1 : row.distanceVessel1)),
    vesselDist2: _toNum_(row.vesselDist2 != null ? row.vesselDist2 : (rp.dist_vessel2 != null ? rp.dist_vessel2 : row.distanceVessel2)),
    etdN: etdN,
    etdR: etdR,
    etdValue: _toNum_(row.etdValue),
    etdS: rp.S != null ? _toNum_(rp.S) : null,
    etdT: rp.T != null ? _toNum_(rp.T) : null,
    etdTotal: etdTotal || etdR || etdN,
    rawPayload: rp
  };
}

function _syncEtdResultsFromSheetRows_(rows) {
  var incoming = (rows || []).map(_mapSheetRowToEtdResult_).filter(function(r) {
    return (r.supplier && r.supplier !== '-') || (r.refinery && r.refinery !== '-') || r.etdN || r.etdR || r.etdTotal || r.etdValue;
  });
  if (!incoming.length && etdResultsLog.length) return;

  function keyOf(r) {
    return String(r.id || '') || [r.savedAt || '', r.supplier || '', r.refinery || '', r.etdTotal || ''].join('|');
  }
  function score(r) {
    var s = 0;
    if (r.supplier && r.supplier !== '-') s += 2;
    if (r.refinery && r.refinery !== '-') s += 2;
    if (r.truckDist || r.vesselDist1 || r.vesselDist2) s += 2;
    if (r.etdN) s += 3;
    if (r.etdR || r.etdTotal) s += 2;
    if (r.rawPayload && Object.keys(r.rawPayload).length) s += 3;
    return s;
  }
  function mergeRec(a, b) {
    var first = score(a) >= score(b) ? a : b;
    var second = first === a ? b : a;
    var mergedRaw = Object.assign({}, second.rawPayload || {}, first.rawPayload || {});
    return Object.assign({}, second, first, { rawPayload: mergedRaw });
  }

  var map = {};
  (etdResultsLog || []).forEach(function(r) {
    map[keyOf(r)] = r;
  });
  incoming.forEach(function(r) {
    var k = keyOf(r);
    map[k] = map[k] ? mergeRec(map[k], r) : r;
  });

  var merged = Object.keys(map).map(function(k){ return map[k]; });
  merged.sort(function(a, b) {
    var ta = Date.parse(a.savedAt || '') || 0;
    var tb = Date.parse(b.savedAt || '') || 0;
    return tb - ta;
  });
  etdResultsLog = merged;
}

function _etdStatCard(label, val, unit, hl) {
  var bg = hl ? '#fef2f2' : '#f9fafb';
  var br = hl ? '#fecaca' : '#e5e7eb';
  var clr = hl ? '#dc2626' : '#111';
  return '<div style="border:1px solid '+br+';border-radius:8px;padding:10px 12px;background:'+bg+';min-width:120px">'
    + '<div style="font-size:10px;color:#6b7280;margin-bottom:4px">'+label+'</div>'
    + '<div style="font-size:18px;font-weight:700;color:'+clr+'">'+val+'</div>'
    + (unit ? '<div style="font-size:9px;color:#9ca3af">'+unit+'</div>' : '')
    + '</div>';
}

function _etdFobCard(label, val, primary) {
  var bg = primary ? '#fef2f2' : '#f9fafb';
  var br = primary ? '#fecaca' : '#e5e7eb';
  var clr = primary ? '#dc2626' : '#111';
  return '<div style="border:1px solid '+br+';border-radius:8px;padding:14px;background:'+bg+';text-align:center">'
    + '<div style="font-size:10px;color:#6b7280;margin-bottom:6px">'+label+'</div>'
    + '<div style="font-size:22px;font-weight:700;color:'+clr+'">'+val+'</div>'
    + '<div style="font-size:9px;color:#9ca3af;margin-top:4px">kgCO₂e/dry-t</div></div>';
}

function _buildEtdResultBlock(r) {
  var rp = r.rawPayload || {};
  var dest = r.refinery || '';
  var d = DEST[dest] || {};
  var Ep = rp.Ep || (d.Ep || 0);
  var N = rp.N || r.etdN || 0;
  var R = rp.R || r.etdR || r.etdTotal || 0;
  var S = rp.S != null ? rp.S : (r.etdS != null ? r.etdS : null);
  var T = rp.T != null ? rp.T : (r.etdT != null ? r.etdT : null);
  var dTruck = rp.dist_truck || r.truckDist || 0;
  var dV1 = rp.dist_vessel1 || r.vesselDist1 || 0;
  var dV2 = rp.dist_vessel2 || r.vesselDist2 || 0;
  var hasTruck = dTruck > 0;
  var hasV1 = dV1 > 0;
  var hasV2 = dV2 > 0;
  var total_etd_raw = rp.total_etd_raw || 0;
  var destLabel = rp.destinationLabel || d.label || dest;

  var modeLabel;
  if (hasTruck && hasV1 && hasV2) modeLabel = 'Bulking (Truck + 2 Vessel)';
  else if (!hasTruck && hasV1 && hasV2) modeLabel = 'Bulking (2 Vessel)';
  else if (hasTruck && hasV1) modeLabel = 'Bulking (Truck + Vessel)';
  else if (hasTruck) modeLabel = 'Direct Trucking';
  else modeLabel = 'Direct Vessel';

  var distLabel = '';
  if (hasTruck) distLabel += dTruck + ' km (truck)';
  if (hasV1) distLabel += (distLabel ? ' + ' : '') + dV1 + ' km (V1)';
  if (hasV2) distLabel += (distLabel ? ' + ' : '') + dV2 + ' km (V2)';

  var EF_used = (dest === 'TPG' || dest === 'GLM') ? EF_B10 : EF_B40;
  var EF_vessel_used = (dest === 'TPG' || dest === 'GLM') ? EF_HFO : EF_B40;
  var EF_label = (dest === 'TPG' || dest === 'GLM') ? 'EF_B10' : 'EF_B40';
  var EF_vessel_label = (dest === 'TPG' || dest === 'GLM') ? 'EF_HFO' : 'EF_B40';

  var etd_truck_raw = hasTruck ? dTruck * h_truck * EF_used * MmPOME : 0;
  var etd_v1_raw = hasV1 ? dV1 * h_vessel * EF_vessel_used * MmPOME : 0;
  var etd_v2_raw = hasV2 ? dV2 * h_vessel * EF_vessel_used * MmPOME : 0;

  var out = '';
  out += '<div style="font-weight:700;font-size:16px;margin-bottom:2px">'+escH(r.supplier||'—')+'</div>';
  out += '<div style="font-size:12px;color:#64748b;margin-bottom:14px">'+distLabel+' · '+escH(destLabel)+' · '+modeLabel+'</div>';

  out += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">';
  if (hasTruck) out += _etdStatCard('Etd POME Trucking', etd_truck_raw.toFixed(2), 'kgCO₂e/dry-t');
  if (hasV1) out += _etdStatCard('Etd POME Vessel'+(hasV2?' 1':''), etd_v1_raw.toFixed(2), 'kgCO₂e/dry-t');
  if (hasV2) out += _etdStatCard('Etd POME Vessel 2', etd_v2_raw.toFixed(2), 'kgCO₂e/dry-t');
  out += _etdStatCard('Ep Refinery', Ep.toFixed(2), 'kgCO₂e/dry-t');
  out += _etdStatCard('Etd FOB '+dest, N.toFixed(2), 'kgCO₂e/dry-t', true);
  out += _etdStatCard('Total FOB '+dest, R.toFixed(2), 'kgCO₂e/dry-t');
  out += '</div>';

  var th = 'style="background:#1e293b;color:#fff;padding:6px 12px;text-align:left;font-size:10px;font-weight:600;letter-spacing:0.3px"';
  var td = 'style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px"';
  var tdv = 'style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;text-align:right;font-weight:600;color:#dc2626"';
  var tdf = 'style="padding:4px 12px 8px;font-size:10px;color:#9ca3af;border-bottom:1px solid #f1f5f9"';

  out += '<div style="overflow-x:auto;margin-bottom:16px"><table style="width:100%;border-collapse:collapse">';
  out += '<thead><tr><th '+th+'>Komponen</th><th '+th+' style="text-align:right">Nilai</th></tr></thead><tbody>';

  if (hasTruck) {
    out += '<tr><td '+td+'>Etd POME — Trucking</td><td '+tdv+'>'+etd_truck_raw.toFixed(2)+'</td></tr>';
    out += '<tr><td colspan="2" '+tdf+'>'+dTruck+' km × η_truck('+h_truck+') × '+EF_label+'('+EF_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  if (hasV1) {
    out += '<tr><td '+td+'>Etd POME — Vessel'+(hasV2?' 1':'')+'</td><td '+tdv+'>'+etd_v1_raw.toFixed(2)+'</td></tr>';
    out += '<tr><td colspan="2" '+tdf+'>'+dV1+' km × η_vessel('+h_vessel+') × '+EF_vessel_label+'('+EF_vessel_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  if (hasV2) {
    out += '<tr><td '+td+'>Etd POME — Vessel 2</td><td '+tdv+'>'+etd_v2_raw.toFixed(2)+'</td></tr>';
    out += '<tr><td colspan="2" '+tdf+'>'+dV2+' km × η_vessel('+h_vessel+') × '+EF_vessel_label+'('+EF_vessel_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  out += '<tr><td '+td+'>Ep Refinery</td><td '+tdv+'>'+Ep.toFixed(2)+'</td></tr>';
  out += '<tr><td colspan="2" '+tdf+'>Data CB — '+escH(destLabel)+'</td></tr>';
  out += '<tr><td '+td+'>Etd FOB '+dest+' (N)</td><td '+tdv+'>'+N.toFixed(2)+'</td></tr>';
  if (S !== null) {
    out += '<tr><td '+td+'>Etd FOB Tj. Langsat (O)</td><td '+tdv+'>'+(dest==='TPG' ? N.toFixed(2) : S !== null ? (S - Ep).toFixed(2) : 'N/A')+'</td></tr>';
  }
  if (T !== null) {
    out += '<tr><td '+td+'>Etd FOB Port Klang (P)</td><td '+tdv+'>'+(dest==='GLM' ? N.toFixed(2) : T !== null ? (T - Ep).toFixed(2) : 'N/A')+'</td></tr>';
  }
  out += '</tbody></table></div>';

  out += '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px">';
  out += _etdFobCard('FOB '+destLabel, R.toFixed(2), true);
  if (S !== null && dest !== 'TPG') out += _etdFobCard('FOB Tj. Langsat', S.toFixed(2), false);
  if (T !== null && dest !== 'GLM') out += _etdFobCard('FOB Port Klang', T.toFixed(2), false);
  out += '</div>';

  var FF = d.FF || 0;
  var AF = d.AF || 0;
  out += '<div style="display:flex;flex-wrap:wrap;gap:10px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:11px">';
  if (hasTruck) out += '<div><span style="color:#6b7280">η truck</span> <b>'+h_truck+'</b></div>';
  if (hasV1||hasV2) out += '<div><span style="color:#6b7280">η vessel</span> <b>'+h_vessel+'</b></div>';
  out += '<div><span style="color:#6b7280">'+EF_label+'</span> <b>'+EF_used.toFixed(5)+'</b></div>';
  if (hasV1||hasV2) out += '<div><span style="color:#6b7280">'+EF_vessel_label+'</span> <b>'+EF_vessel_used.toFixed(5)+'</b></div>';
  out += '<div><span style="color:#6b7280">Mm POME</span> <b>'+MmPOME.toFixed(8)+'</b></div>';
  out += '<div><span style="color:#6b7280">Mm RPOME</span> <b>'+MmRPOME.toFixed(10)+'</b></div>';
  out += '<div><span style="color:#6b7280">FF ('+dest+')</span> <b>'+FF+'</b></div>';
  out += '<div><span style="color:#6b7280">AF ('+dest+')</span> <b>'+AF+'</b></div>';
  out += '</div>';

  return out;
}

function renderEtdResultsList() {
  var el = document.getElementById('etd-results-list');
  if (!etdResultsLog.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 0;color:#d1d5db;font-size:13px">No data yet — use Traceability Export Shipment to send results here.</div>';
    return;
  }
  var html = '';
  etdResultsLog.forEach(function(r, idx) {
    html += '<div style="background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;margin-bottom:16px">'
      + '<div style="background:#1e293b;padding:10px 16px;display:flex;justify-content:space-between;align-items:center">'
      + '<div style="color:#fff;font-weight:600;font-size:12px">#'+(idx+1)+' '+escH(r.supplier||'—')+' &nbsp;<span style="font-weight:400;color:#94a3b8;font-size:11px">'+escH(r.vesselName||'')+'  '+escH(r.blNumber||'')+'</span></div>'
      + '<div style="display:flex;gap:8px;align-items:center">'
      + '<span style="font-size:10px;color:#94a3b8">'+escH(r.savedAt||'')+'</span>'
      + '<button type="button" class="btn btn-outline btn-sm" onclick="useEtdResultForSavings('+idx+')" style="border-color:#60a5fa;color:#ffffff;background:#1d4ed8">Use for GHG Savings</button>'
      + '</div>'
      + '</div>'
      + '<div style="background:#f1f5f9;padding:8px 16px;display:flex;gap:20px;flex-wrap:wrap;border-bottom:1px solid #e2e8f0;font-size:11px;color:#475569">'
      + '<span><b>BL Date:</b> '+escH(r.blDate||'—')+'</span>'
      + '<span><b>Loading Port:</b> '+escH(r.loadingPort||'—')+'</span>'
      + '<span><b>Origin:</b> '+escH(r.origin||'—')+'</span>'
      + '<span><b>Cert:</b> '+escH(r.certType||'—')+'</span>'
      + '<span><b>SD Number:</b> '+escH(r.sdNumber||'—')+'</span>'
      + '<span><b>Refinery:</b> '+escH(r.refinery||'—')+'</span>'
      + '<span><b>Shipment Dest:</b> '+escH(r.shipmentDest||'—')+'</span>'
      + '</div>'
      + '<div style="padding:16px">'
      + _buildEtdResultBlock(r)
      + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
  refreshEtdExportSelector();
}

function useEtdResultForSavings(idx) {
  var r = etdResultsLog[idx];
  if (!r) return;
  var etdVal = _resolveEtdForSavings_(r);
  if (!etdVal) {
    showToast('ETD value is empty for this record', 'error');
    return;
  }

  saveLatestEtdSnapshot({
    savedAt: new Date().toISOString(),
    period: r.period || '',
    supplier: r.supplier || '',
    destination: r.refinery || '',
    destinationLabel: r.refinery || '',
    etdForSavings: etdVal,
    totalFob: _toNum_(r.etdR || r.etdTotal),
    unit: 'kg CO2eq/dry-ton'
  });

  var gsEtdEl = document.getElementById('gs-etd');
  if (gsEtdEl) gsEtdEl.value = etdVal;
  var gsSiteEl = document.getElementById('gs-site');
  if (gsSiteEl && !gsSiteEl.value) gsSiteEl.value = r.supplier || '';
  if (typeof ghgSavingsCalc === 'function') ghgSavingsCalc();
  showToast('ETD FOB selected for GHG Savings: ' + fmt(etdVal, 2), 'success');
}

function _etdResCard(label, val, color, highlight) {
  return '<div style="border:1px solid '+(highlight?'#fecaca':'#e5e7eb')+';border-radius:7px;padding:10px 12px;background:'+(highlight?'#fef2f2':'#f9fafb')+'">'
    + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;margin-bottom:4px">'+label+'</div>'
    + '<div style="font-size:13px;font-weight:600;color:'+(color||'#111')+'">'+val+'</div></div>';
}

/* Build a PDF-safe (table-only) version of the ETD result block.
   Avoids flex / grid / page-break-inside:avoid, which cause html2pdf to render huge blank gaps. */
function _buildEtdResultBlockPdf(r, idx) {
  var rp = r.rawPayload || {};
  var dest = r.refinery || '';
  var d = (typeof DEST !== 'undefined' && DEST[dest]) ? DEST[dest] : {};
  var Ep = _toNum_(rp.Ep != null ? rp.Ep : (d.Ep || 0));
  var N  = _toNum_(rp.N  != null ? rp.N  : r.etdN);
  var R  = _toNum_(rp.R  != null ? rp.R  : (r.etdR != null ? r.etdR : r.etdTotal));
  var S  = rp.S != null ? _toNum_(rp.S) : (r.etdS != null ? _toNum_(r.etdS) : null);
  var T  = rp.T != null ? _toNum_(rp.T) : (r.etdT != null ? _toNum_(r.etdT) : null);

  var dists = (typeof _resolveEtdDistances_ === 'function') ? _resolveEtdDistances_(r) : {
    truckDist:   _toNum_(rp.dist_truck   != null ? rp.dist_truck   : r.truckDist),
    vesselDist1: _toNum_(rp.dist_vessel1 != null ? rp.dist_vessel1 : r.vesselDist1),
    vesselDist2: _toNum_(rp.dist_vessel2 != null ? rp.dist_vessel2 : r.vesselDist2)
  };
  var dTruck = dists.truckDist, dV1 = dists.vesselDist1, dV2 = dists.vesselDist2;
  var hasTruck = dTruck > 0, hasV1 = dV1 > 0, hasV2 = dV2 > 0;
  var destLabel = rp.destinationLabel || d.label || dest || '—';

  var modeLabel;
  if (hasTruck && hasV1 && hasV2)      modeLabel = 'Bulking (Truck + 2 Vessel)';
  else if (!hasTruck && hasV1 && hasV2) modeLabel = 'Bulking (2 Vessel)';
  else if (hasTruck && hasV1)           modeLabel = 'Bulking (Truck + Vessel)';
  else if (hasTruck)                    modeLabel = 'Direct Trucking';
  else                                  modeLabel = 'Direct Vessel';

  var distParts = [];
  if (hasTruck) distParts.push(dTruck + ' km (truck)');
  if (hasV1)    distParts.push(dV1 + ' km (V1)');
  if (hasV2)    distParts.push(dV2 + ' km (V2)');
  var distLabel = distParts.join(' + ') || '—';

  var EF_used        = (dest === 'TPG' || dest === 'GLM') ? EF_B10 : EF_B40;
  var EF_vessel_used = (dest === 'TPG' || dest === 'GLM') ? EF_HFO : EF_B40;
  var EF_label        = (dest === 'TPG' || dest === 'GLM') ? 'EF_B10' : 'EF_B40';
  var EF_vessel_label = (dest === 'TPG' || dest === 'GLM') ? 'EF_HFO' : 'EF_B40';

  var etd_truck = hasTruck ? dTruck * h_truck * EF_used * MmPOME : 0;
  var etd_v1    = hasV1    ? dV1 * h_vessel * EF_vessel_used * MmPOME : 0;
  var etd_v2    = hasV2    ? dV2 * h_vessel * EF_vessel_used * MmPOME : 0;

  // Base cells using tables only (no flex / grid / page-break-inside)
  var th  = 'background:#1e293b;color:#fff;padding:5px 8px;text-align:left;font-size:8pt;font-weight:700;letter-spacing:.3px';
  var thR = th + ';text-align:right';
  var td  = 'padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:8pt';
  var tdV = 'padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:8pt;text-align:right;font-weight:600;color:#dc2626';
  var tdVb= 'padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:8pt;text-align:right;font-weight:600;color:#111827';
  var tdF = 'padding:2px 8px 5px;font-size:7pt;color:#9ca3af;border-bottom:1px solid #f1f5f9';

  // Header strip
  var hdr = ''
    + '<table style="width:100%;border-collapse:collapse;background:#1e293b">'
    +   '<tr>'
    +     '<td style="padding:7px 10px;color:#fff;font-size:9pt;font-weight:700">#'+(idx+1)+' '+escH(r.supplier||'—')
    +       '<span style="font-weight:400;color:#94a3b8;font-size:8pt"> &nbsp; '+escH(r.vesselName||'')+' '+escH(r.blNumber||'')+'</span>'
    +     '</td>'
    +     '<td style="padding:7px 10px;color:#94a3b8;font-size:7.5pt;text-align:right">'+escH(r.savedAt||'')+'</td>'
    +   '</tr>'
    + '</table>';

  // Meta strip (use table instead of flex)
  var meta = ''
    + '<table style="width:100%;border-collapse:collapse;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:7.5pt;color:#475569">'
    +   '<tr>'
    +     '<td style="padding:5px 10px"><b>BL Date:</b> '+escH(r.blDate||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>Loading Port:</b> '+escH(r.loadingPort||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>Origin:</b> '+escH(r.origin||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>Cert:</b> '+escH(r.certType||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>SD Number:</b> '+escH(r.sdNumber||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>Refinery:</b> '+escH(r.refinery||'—')+'</td>'
    +     '<td style="padding:5px 10px"><b>Shipment Dest:</b> '+escH(r.shipmentDest||'—')+'</td>'
    +   '</tr>'
    +   '<tr>'
    +     '<td colspan="6" style="padding:5px 10px;background:#eef2f7;color:#334155;font-size:7.5pt">'
    +       '<b>Transport:</b> '+escH(destLabel)+' · '+modeLabel+' &nbsp;|&nbsp; <b>Distances:</b> '+distLabel
    +     '</td>'
    +   '</tr>'
    + '</table>';

  // Summary cards as a 4-col table (avoid flex-wrap so nothing gets pushed)
  var card = function(label, val, unit, highlight) {
    var c = highlight ? '#dc2626' : '#0f172a';
    var bg = highlight ? '#fef2f2' : '#f9fafb';
    var bd = highlight ? '#fecaca' : '#e5e7eb';
    return '<td style="width:20%;border:1px solid '+bd+';background:'+bg+';padding:6px 8px;vertical-align:top">'
      + '<div style="font-size:6.5pt;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;margin-bottom:2px">'+escH(label)+'</div>'
      + '<div style="font-size:10.5pt;font-weight:800;color:'+c+';line-height:1.1">'+val+'</div>'
      + '<div style="font-size:6.5pt;color:#94a3b8;margin-top:1px">'+unit+'</div>'
      + '</td>';
  };
  var cardsCells = '';
  if (hasTruck) cardsCells += card('Etd POME Trucking', etd_truck.toFixed(2), 'kgCO₂e/dry-t', false);
  if (hasV1)    cardsCells += card('Etd POME Vessel'+(hasV2?' 1':''), etd_v1.toFixed(2), 'kgCO₂e/dry-t', false);
  if (hasV2)    cardsCells += card('Etd POME Vessel 2', etd_v2.toFixed(2), 'kgCO₂e/dry-t', false);
  cardsCells += card('Ep Refinery', Ep.toFixed(2), 'kgCO₂e/dry-t', false);
  cardsCells += card('Etd FOB '+(dest||''), N.toFixed(2), 'kgCO₂e/dry-t', true);
  cardsCells += card('Total FOB '+(dest||''), R.toFixed(2), 'kgCO₂e/dry-t', false);
  var cards = '<table style="width:100%;border-collapse:separate;border-spacing:4px;margin:6px 0;table-layout:fixed"><tr>'+cardsCells+'</tr></table>';

  // Breakdown table
  var rowsHtml = '';
  if (hasTruck) {
    rowsHtml += '<tr><td style="'+td+'">Etd POME — Trucking</td><td style="'+tdV+'">'+etd_truck.toFixed(2)+'</td></tr>'
              + '<tr><td colspan="2" style="'+tdF+'">'+dTruck+' km × η_truck('+h_truck+') × '+EF_label+'('+EF_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  if (hasV1) {
    rowsHtml += '<tr><td style="'+td+'">Etd POME — Vessel'+(hasV2?' 1':'')+'</td><td style="'+tdV+'">'+etd_v1.toFixed(2)+'</td></tr>'
              + '<tr><td colspan="2" style="'+tdF+'">'+dV1+' km × η_vessel('+h_vessel+') × '+EF_vessel_label+'('+EF_vessel_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  if (hasV2) {
    rowsHtml += '<tr><td style="'+td+'">Etd POME — Vessel 2</td><td style="'+tdV+'">'+etd_v2.toFixed(2)+'</td></tr>'
              + '<tr><td colspan="2" style="'+tdF+'">'+dV2+' km × η_vessel('+h_vessel+') × '+EF_vessel_label+'('+EF_vessel_used.toFixed(5)+') × Mm_POME('+MmPOME.toFixed(6)+')</td></tr>';
  }
  rowsHtml += '<tr><td style="'+td+'">Ep Refinery</td><td style="'+tdV+'">'+Ep.toFixed(2)+'</td></tr>'
            + '<tr><td colspan="2" style="'+tdF+'">Data CB — '+escH(destLabel)+'</td></tr>'
            + '<tr><td style="'+td+';font-weight:700">Etd FOB '+(dest||'')+' (N)</td><td style="'+tdV+'">'+N.toFixed(2)+'</td></tr>';
  if (S !== null) rowsHtml += '<tr><td style="'+td+'">Etd FOB Tj. Langsat (O)</td><td style="'+tdVb+'">'+(dest==='TPG' ? N.toFixed(2) : (S - Ep).toFixed(2))+'</td></tr>';
  if (T !== null) rowsHtml += '<tr><td style="'+td+'">Etd FOB Port Klang (P)</td><td style="'+tdVb+'">'+(dest==='GLM' ? N.toFixed(2) : (T - Ep).toFixed(2))+'</td></tr>';
  rowsHtml += '<tr><td style="'+td+';font-weight:700;background:#fef2f2">Total FOB '+(dest||'')+' (R)</td><td style="'+tdVb+';background:#fef2f2">'+R.toFixed(2)+'</td></tr>';

  var breakdown = '<table style="width:100%;border-collapse:collapse;margin:4px 0 6px"><thead><tr>'
    + '<th style="'+th+'">Komponen</th><th style="'+thR+'">Nilai (kgCO₂e/dry-t)</th>'
    + '</tr></thead><tbody>'+rowsHtml+'</tbody></table>';

  // Factors as compact 2-row table
  var FF = d.FF || 0, AF = d.AF || 0;
  var factors = '<table style="width:100%;border-collapse:collapse;font-size:7.5pt;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;margin-bottom:4px">'
    + '<tr>';
  if (hasTruck)     factors += '<td style="padding:4px 8px"><span style="color:#6b7280">η truck</span> <b>'+h_truck+'</b></td>';
  if (hasV1||hasV2) factors += '<td style="padding:4px 8px"><span style="color:#6b7280">η vessel</span> <b>'+h_vessel+'</b></td>';
  factors += '<td style="padding:4px 8px"><span style="color:#6b7280">'+EF_label+'</span> <b>'+EF_used.toFixed(5)+'</b></td>';
  if (hasV1||hasV2) factors += '<td style="padding:4px 8px"><span style="color:#6b7280">'+EF_vessel_label+'</span> <b>'+EF_vessel_used.toFixed(5)+'</b></td>';
  factors += '<td style="padding:4px 8px"><span style="color:#6b7280">Mm POME</span> <b>'+MmPOME.toFixed(8)+'</b></td>'
    + '<td style="padding:4px 8px"><span style="color:#6b7280">Mm RPOME</span> <b>'+MmRPOME.toFixed(10)+'</b></td>'
    + '<td style="padding:4px 8px"><span style="color:#6b7280">FF ('+(dest||'')+')</span> <b>'+FF+'</b></td>'
    + '<td style="padding:4px 8px"><span style="color:#6b7280">AF ('+(dest||'')+')</span> <b>'+AF+'</b></td>'
    + '</tr></table>';

  return '<div style="margin-bottom:10px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">'
    + hdr + meta
    + '<div style="padding:6px 8px;background:#fff">'
    + cards + breakdown + factors
    + '</div>'
    + '</div>';
}

function exportEtdResultsPdf() {
  if (!etdResultsLog.length) { showToast('No ETD results data yet', 'error'); return; }
  if (pdfExportIsBusy()) { showToast('PDF export already in progress…', 'error'); return; }
  if (!html2pdfIsReady()) { showToast('PDF library not loaded', 'error'); return; }

  var sel = document.getElementById('etd-export-select');
  var selectedId = sel ? sel.value : 'all';
  var exportRows = etdResultsLog.filter(_isMeaningfulEtdRecord_);
  if (selectedId && selectedId !== 'all') {
    exportRows = exportRows.filter(function(r){ return String(r.id || '') === selectedId; });
  }
  if (!exportRows.length) {
    showToast('No valid ETD results to export. Select another record.', 'error');
    return;
  }

  var now = new Date().toLocaleDateString('en-GB', {year:'numeric', month:'short', day:'numeric'});
  var etdGgl = (typeof ETD_VARIANT !== 'undefined' && ETD_VARIANT === 'ggl');
  var etdModuleLabel = etdGgl ? 'ETD — GGL' : 'ETD — RPOME';
  var etdPdfSub = etdGgl
    ? 'Transportation &amp; Distribution Emissions · GGL'
    : 'Transportation &amp; Distribution Emissions · Converted to Product';

  var resultBlocks = exportRows.map(function(r, idx){ return _buildEtdResultBlockPdf(r, idx); }).join('');

  var html = '<div style="font-family:\'Plus Jakarta Sans\',Arial,sans-serif;padding:10px 12px;font-size:8pt;color:#1e293b;background:#fff;line-height:1.3">'
    + '<table style="width:100%;border-collapse:collapse;border-bottom:2.5px solid #1e293b;margin-bottom:8px">'
    +   '<tr>'
    +     '<td style="padding:4px 0;vertical-align:bottom">'
    +       '<div style="font-size:7pt;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#64748b">KPN Downstream — Sustainability</div>'
    +       '<div style="font-size:14pt;font-weight:800;color:#1e293b;letter-spacing:-0.3px">ETD Results' + (etdGgl ? ' — GGL' : '') + '</div>'
    +       '<div style="font-size:7.5pt;color:#64748b;margin-top:2px">' + etdPdfSub + '</div>'
    +     '</td>'
    +     '<td style="padding:4px 0;vertical-align:bottom;text-align:right;font-size:8pt;color:#475569;line-height:1.5">'
    +       '<strong>Generated: '+now+'</strong><br>'
    +       'Records: '+exportRows.length
    +     '</td>'
    +   '</tr>'
    + '</table>'
    + '<table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:4px;margin-bottom:8px">'
    +   '<tr>'
    +     '<td style="padding:6px 10px;color:#fff;width:25%"><div style="font-size:6.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Module</div><div style="font-weight:800;font-size:9pt">' + etdModuleLabel + '</div></td>'
    +     '<td style="padding:6px 10px;color:#fff;width:25%"><div style="font-size:6.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Methodology</div><div style="font-weight:800;font-size:9pt">RED III</div></td>'
    +     '<td style="padding:6px 10px;color:#fff;width:25%"><div style="font-size:6.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Unit</div><div style="font-weight:800;font-size:9pt">kg CO&#x2082;eq/dry-t</div></td>'
    +     '<td style="padding:6px 10px;color:#fff;width:25%"><div style="font-size:6.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Records</div><div style="font-weight:800;font-size:9pt">'+exportRows.length+'</div></td>'
    +   '</tr>'
    + '</table>'
    + '<div style="font-size:7.5pt;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid #e2e8f0">'
    + 'ETD GHG Results — BL Date · Loading Port · Country of Origin · Vessel Name · Cert · SD Number'
    + '</div>'
    + resultBlocks
    + '<div style="margin-top:6px;font-size:6.5pt;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:4px;text-transform:uppercase;letter-spacing:.3px">'
    + 'KPN Downstream Sustainability Calculator · ETD Report · '+now
    + '</div>'
    + '</div>';

  var el = document.createElement('div');
  el.innerHTML = html;
  el.style.width = '277mm';
  el.style.background = '#fff';

  var pdfOpts = {
    margin: [6,6,6,6],
    filename: 'ETD_Results_'+new Date().toISOString().slice(0,10)+'.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'] }
  };

  safePdfExport(el, pdfOpts, {
    onBusy: function(msg) { showToast(msg, 'error'); }
  }).then(function() {
    showToast('PDF ETD Results exported', 'success');
  }).catch(function(e) {
    showToast('PDF error: ' + e.message, 'error');
  });
}

function exportEtdResultsExcel() {
  if (!etdResultsLog.length) { showToast('No ETD results data yet', 'error'); return; }
  if (excelExportIsBusy()) { showToast('Excel export already in progress…', 'error'); return; }

  var etdGglX = (typeof ETD_VARIANT !== 'undefined' && ETD_VARIANT === 'ggl');
  var headerMeta = [
    ['ETD RESULTS — TRANSPORTATION & DISTRIBUTION EMISSIONS' + (etdGglX ? ' (GGL)' : '')],
    ['Module', etdGglX ? 'ETD — GGL' : 'ETD — RPOME', '', 'Methodology', 'RED III', '', 'Unit', 'kg CO2eq/dry-t'],
    [],
    ['BL Date','Loading Port','Country of Origin','Vessel Name','Cert Type','SD Number','Supplier','Refinery','Dist. Trucking (km)','Dist. Vessel 1 (km)','Dist. Vessel 2 (km)','ETD Total FOB (kg CO2eq/dry-t)']
  ];
  var dataRows = etdResultsLog.map(function(r){
    return [r.blDate||'',r.loadingPort||'',r.origin||'',r.vesselName||'',r.certType||'',r.sdNumber||'',r.supplier||'',r.refinery||'',r.truckDist||0,r.vesselDist1||0,r.vesselDist2||0,r.etdTotal||0];
  });

  var allRows = headerMeta.concat(dataRows);
  var ws = XLSX.utils.aoa_to_sheet(allRows);
  ws['!cols'] = [{wch:14},{wch:18},{wch:18},{wch:20},{wch:12},{wch:14},{wch:28},{wch:12},{wch:20},{wch:20},{wch:20},{wch:28}];
  ws['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:11}}];

  runLockedExcel(function() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ETD Results');
    XLSX.writeFile(wb, 'ETD_Results_'+new Date().toISOString().slice(0,10)+'.xlsx');
    showToast('Excel ETD Results exported', 'success');
  }, function(msg) { showToast(msg, 'error'); });
}
