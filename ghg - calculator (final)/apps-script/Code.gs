/***************************************
 * GHG Calculator Backend (Apps Script)
 * Sheets:
 *  - GHG Log
 *  - ETD Log
 *  - GHG Savings Log
 *  - GHG Savings Datacenter
 *  - EF_MASTER
 *  - TES Data  (supplier Traceability — action=getSuppliers)
 ***************************************/

const SECRET_TOKEN = 'ghg111111117-calcu-ssttn';

const CFG = {
  SHEET_GHG_LOG: 'GHG Log',
  SHEET_ETD_LOG: 'ETD Log',
  SHEET_GHG_SAVINGS_LOG: 'GHG Savings Log',
  SHEET_GHG_SAVINGS_DATACENTER: 'GHG Savings Datacenter',
  SHEET_EF_MASTER: 'EF_MASTER',
  SHEET_TES_DATA: 'TES Data',
  TIMEZONE: Session.getScriptTimeZone() || 'Asia/Jakarta',
};

/* =========================
  Entry points
========================= */

function doGet(e) {
  try {
    if (getParam_(e, 'token') !== SECRET_TOKEN) {
      return jsonOut_({ status: 'error', message: 'Unauthorized' });
    }
    const action = getParam_(e, 'action');

    if (action === 'getEfMaster') return jsonOut_(getEfMasterRows_());
    if (action === 'getEtdLog') return jsonOut_(getEtdLogRows_());
    if (action === 'getGhgSavingsLog') return jsonOut_(getGhgSavingsLogRows_());
    if (action === 'getGhgSavingsDatacenter') return jsonOut_(getGhgSavingsDatacenterRows_());
    if (action === 'getSuppliers') return jsonOut_(getTraceabilitySuppliers_());

    return jsonOut_(getGhgLogRows_());
  } catch (err) {
    return jsonOut_({ status: 'error', message: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);

    if (!body || body.token !== SECRET_TOKEN) {
      return jsonOut_({ status: 'error', message: 'Unauthorized' });
    }

    if (body.action === 'updateEfMaster') {
      const result = updateEfMaster_(body.rows || []);
      return jsonOut_({ status: 'ok', message: 'EF master updated', updated: result.updated });
    }

    if (body.action === 'saveETDResult') {
      const result = saveEtdLog_(mapTraceabilityEtdPayload_(body.data || {}));
      return jsonOut_({ status: 'ok', id: result.id, message: 'ETD result saved' });
    }

    const mode = safeStr_(body.mode).toLowerCase();

    if (mode === 'etd') {
      const result = saveEtdLog_(body || {});
      return jsonOut_({ status: 'ok', id: result.id, message: 'ETD saved' });
    }

    if (mode === 'ghg_savings') {
      const result = saveGhgSavingsLog_(body || {});
      return jsonOut_({ status: 'ok', id: result.id, message: 'GHG Savings saved' });
    }

    const result = saveGhgLog_(body || {});
    return jsonOut_({ status: 'ok', id: result.id, message: 'Saved' });
  } catch (err) {
    return jsonOut_({ status: 'error', message: err && err.message ? err.message : String(err) });
  }
}

/* =========================
  GHG SAVINGS DATACENTER
  Tab columns (row 1):
  year | site | epRefineryKG | etdFobkG (Trucking) | etdFobkG (Vessel) | epBiodieselKG | vesselEmmisionKG
========================= */

function getGhgSavingsDatacenterRows_() {
  const sh = getSheetOrThrow_(CFG.SHEET_GHG_SAVINGS_DATACENTER);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(v) { return safeStr_(v); });
  const h = headerMap_(headers);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;

    const site = safeStr_(getAnyByHeader_(row, h, ['site', 'Site']));
    if (!site) continue;

    const year = safeStr_(getAnyByHeader_(row, h, ['year', 'Year', 'period', 'Period']));
    out.push({
      year: year,
      period: year,
      site: site,
      epRefineryKG: toNum_(getAnyByHeader_(row, h, [
        'epRefineryKG', 'epRefinery', 'Ep Refinery KG'
      ])),
      etdTrucking: toNum_(getAnyByHeader_(row, h, [
        'etdFobkG (Trucking)', 'etdFobKG (Trucking)', 'etdTrucking', 'etd', 'Etd FOB kg (Trucking)'
      ])),
      etdVessel: toNum_(getAnyByHeader_(row, h, [
        'etdFobkG (Vessel)', 'etdFobKG (Vessel)', 'etdVessel', 'Etd FOB kg (Vessel)'
      ])),
      epBiodieselKG: toNum_(getAnyByHeader_(row, h, [
        'epBiodieselKG', 'epBiodiesel', 'Ep Biodiesel KG'
      ])),
      vesselEmissionKG: toNum_(getAnyByHeader_(row, h, [
        'vesselEmmisionKG', 'vesselEmissionKG', 'vesselEmission', 'vessel', 'Vessel Emission KG'
      ])),
    });
  }
  return out;
}

/* =========================
  TRACEABILITY — Sheet "TES Data"
========================= */

function getTraceabilitySuppliers_() {
  const sh = getSheetOrThrow_(CFG.SHEET_TES_DATA);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(function(v) { return safeStr_(v); });
  const h = headerMap_(headers);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;

    const namaSupplier = safeStr_(getByHeader_(row, h, 'namaSupplier'));
    if (!namaSupplier) continue;

    const scope = safeStr_(getByHeader_(row, h, 'scope'));
    const origin = safeStr_(getByHeader_(row, h, 'origin'));
    const area = safeStr_(getByHeader_(row, h, 'area'));
    const certificate = safeStr_(getByHeader_(row, h, 'certificate'));
    const transportation = safeStr_(getByHeader_(row, h, 'transportation'));
    const destination = safeStr_(getByHeader_(row, h, 'destination'));

    const distTruck   = toNum_(getByHeader_(row, h, 'distanceTrucking'));
    const distVessel1 = toNum_(getByHeader_(row, h, 'distanceVessel1'));
    const distVessel2 = toNum_(getByHeader_(row, h, 'distanceVessel2'));

    out.push({
      name: namaSupplier,
      namaSupplier: namaSupplier,
      scope: scope,
      origin: origin,
      area: area,
      certificate: certificate,
      cert: certificate,
      transportation: transportation,
      transport: transportation,
      destination: destination,
      dest: destination,
      distTruck: distTruck,
      distVessel1: distVessel1,
      distVessel2: distVessel2
    });
  }
  return out;
}

/* =========================
  GHG LOG
========================= */

function saveGhgLog_(payload) {
  const sh = getSheetOrThrow_(CFG.SHEET_GHG_LOG);
  const headers = getHeaders_(sh);
  const h = headerMap_(headers);

  const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const id = makeId_();

  const calcType = normalizeCalcType_(payload.calcType);
  const year = safeStr_(payload.year);
  const period = payload.period ? safeStr_(payload.period) : year;
  const site = safeStr_(payload.site);
  const total = toNum_(payload.total);

  const epProduct1 = toNum_(payload.epProduct1, payload.epRpome);
  const epProduct2 = toNum_(payload.epProduct2, payload.epFad);
  const epAlloc1   = toNum_(payload.epAlloc1, payload.epRpomeAlloc);
  const epAlloc2   = toNum_(payload.epAlloc2, payload.epFadAlloc);
  const epMj       = toNum_(payload.epMj);

  const methanol        = toNum_(payload.methanol);
  const sodiumMethylate = toNum_(payload.sodiumMethylate);
  const citricAcid      = toNum_(payload.citricAcid);

  const rawPayload = firstNonEmpty_(
    safeStr_(payload.rawPayload),
    safeStr_(payload.rawPayloadJSON),
    safeStr_(payload.raw_payload),
    ''
  );

  const row = new Array(headers.length).fill('');
  const set = (headerName, value) => setByHeader_(row, h, headerName, value);

  set('ID', id); set('id', id);
  set('Timestamp', now); set('savedAt', now); set('saved_at', now);
  set('Year', year); set('year', year); set('period', period);
  set('Site', site); set('site', site);
  set('calcType', calcType);
  set('Total Ep', total); set('total', total);
  set('epProduct1', epProduct1);
  set('epProduct2', epProduct2);
  set('epAlloc1', epAlloc1);
  set('epAlloc2', epAlloc2);
  set('epMj', epMj);
  set('methanol', methanol);
  set('sodiumMethylate', sodiumMethylate);
  set('citricAcid', citricAcid);
  set('Ep RPOME', epProduct1); set('epRpome', epProduct1);
  set('Ep FAD', epProduct2); set('epFad', epProduct2);
  set('Ep Alloc RPOME', epAlloc1); set('epRpomeAlloc', epAlloc1);
  set('Ep Alloc FAD', epAlloc2); set('epFadAlloc', epAlloc2);
  set('Coal', toNum_(payload.coal)); set('coal', toNum_(payload.coal));
  set('Biosolar', toNum_(payload.biosolar)); set('biosolar', toNum_(payload.biosolar));
  set('LNG', toNum_(payload.lng)); set('lng', toNum_(payload.lng));
  set('Fuel Total', toNum_(payload.fuelTotal)); set('fuelTotal', toNum_(payload.fuelTotal));
  set('na2co3', toNum_(payload.na2co3));
  set('na2so3', toNum_(payload.na2so3));
  set('pac', toNum_(payload.pac));
  set('NaOH', toNum_(payload.naoh)); set('naoh', toNum_(payload.naoh));
  set('cyclohex', toNum_(payload.cyclohex));
  set('nhex', toNum_(payload.nhex));
  set('IPA', toNum_(payload.ipa)); set('ipa', toNum_(payload.ipa));
  set('HCl', toNum_(payload.hcl)); set('hcl', toNum_(payload.hcl));
  set('BE', toNum_(payload.be)); set('be', toNum_(payload.be));
  set('H3PO4', toNum_(payload.h3po4)); set('h3po4', toNum_(payload.h3po4));
  set('Chemical Total', toNum_(payload.chemTotal)); set('chemTotal', toNum_(payload.chemTotal));
  set('Electricity', toNum_(payload.elec)); set('elec', toNum_(payload.elec));
  set('Water', toNum_(payload.water)); set('water', toNum_(payload.water));
  set('Raw Payload JSON', rawPayload);
  set('rawPayload', rawPayload);
  set('rawPayloadJSON', rawPayload);
  set('raw_payload', rawPayload);

  sh.appendRow(row);
  return { id: id };
}

function getGhgLogRows_() {
  const sh = getSheetOrThrow_(CFG.SHEET_GHG_LOG);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(v => safeStr_(v));
  const h = headerMap_(headers);

  const out = [];
  function get(rowArr, headerName) { return getByHeader_(rowArr, h, headerName); }
  function getAny(rowArr, names) {
    for (let i = 0; i < names.length; i++) {
      const v = get(rowArr, names[i]);
      if (v != null && String(v).trim() !== '') return v;
    }
    return '';
  }

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;

    const calcType = normalizeCalcType_(getAny(row, ['calcType']));
    const period = safeStr_(firstNonEmpty_(getAny(row, ['period']), getAny(row, ['Year']), getAny(row, ['year']), ''));
    const epProduct1 = toNum_(getAny(row, ['epProduct1', 'Ep RPOME', 'epRpome']));
    const epProduct2 = toNum_(getAny(row, ['epProduct2', 'Ep FAD', 'epFad']));
    const epAlloc1   = toNum_(getAny(row, ['epAlloc1', 'Ep Alloc RPOME', 'epRpomeAlloc']));
    const epAlloc2   = toNum_(getAny(row, ['epAlloc2', 'Ep Alloc FAD', 'epFadAlloc']));
    const epMj       = toNum_(getAny(row, ['epMj']));

    out.push({
      id: safeStr_(firstNonEmpty_(getAny(row, ['id']), getAny(row, ['ID']), '')),
      savedAt: safeStr_(firstNonEmpty_(getAny(row, ['savedAt']), getAny(row, ['saved_at']), getAny(row, ['Timestamp']), '')),
      period: period,
      site: safeStr_(firstNonEmpty_(getAny(row, ['site']), getAny(row, ['Site']), '')),
      calcType: calcType,
      total: toNum_(firstNonEmpty_(getAny(row, ['total']), getAny(row, ['Total Ep']), 0)),
      epProduct1, epProduct2, epAlloc1, epAlloc2, epMj,
      epRpome: epProduct1,
      epFad: epProduct2,
      epRpomeAlloc: epAlloc1,
      epFadAlloc: epAlloc2,
      rawPayload: safeStr_(firstNonEmpty_(getAny(row, ['rawPayload']), getAny(row, ['rawPayloadJSON']), getAny(row, ['raw_payload']), getAny(row, ['Raw Payload JSON']), '')),
      coal: toNum_(firstNonEmpty_(getAny(row, ['coal']), getAny(row, ['Coal']), 0)),
      biosolar: toNum_(firstNonEmpty_(getAny(row, ['biosolar']), getAny(row, ['Biosolar']), 0)),
      lng: toNum_(firstNonEmpty_(getAny(row, ['lng']), getAny(row, ['LNG']), 0)),
      fuelTotal: toNum_(firstNonEmpty_(getAny(row, ['fuelTotal']), getAny(row, ['Fuel Total']), 0)),
      na2co3: toNum_(getAny(row, ['na2co3'])),
      na2so3: toNum_(getAny(row, ['na2so3'])),
      pac: toNum_(getAny(row, ['pac'])),
      naoh: toNum_(firstNonEmpty_(getAny(row, ['naoh']), getAny(row, ['NaOH']), 0)),
      cyclohex: toNum_(getAny(row, ['cyclohex'])),
      nhex: toNum_(getAny(row, ['nhex'])),
      ipa: toNum_(firstNonEmpty_(getAny(row, ['ipa']), getAny(row, ['IPA']), 0)),
      hcl: toNum_(firstNonEmpty_(getAny(row, ['hcl']), getAny(row, ['HCl']), 0)),
      be: toNum_(firstNonEmpty_(getAny(row, ['be']), getAny(row, ['BE']), 0)),
      h3po4: toNum_(firstNonEmpty_(getAny(row, ['h3po4']), getAny(row, ['H3PO4']), 0)),
      chemTotal: toNum_(firstNonEmpty_(getAny(row, ['chemTotal']), getAny(row, ['Chemical Total']), 0)),
      elec: toNum_(firstNonEmpty_(getAny(row, ['elec']), getAny(row, ['Electricity']), 0)),
      water: toNum_(firstNonEmpty_(getAny(row, ['water']), getAny(row, ['Water']), 0)),
      methanol: toNum_(getAny(row, ['methanol'])),
      sodiumMethylate: toNum_(getAny(row, ['sodiumMethylate'])),
      citricAcid: toNum_(getAny(row, ['citricAcid'])),
    });
  }
  return out;
}

/* =========================
  ETD LOG
========================= */

function mapTraceabilityEtdPayload_(data) {
  const d = data || {};
  const rawPayloadObj = (d.rawPayload && typeof d.rawPayload === 'object') ? d.rawPayload : {};
  const rawPayloadInput = (typeof d.rawPayload === 'string') ? d.rawPayload : '';
  const rawPayloadStr = firstNonEmpty_(safeStr_(rawPayloadInput), safeStr_(JSON.stringify(rawPayloadObj)), '');
  return {
    id: safeStr_(d.id),
    savedAt: safeStr_(d.savedAt),
    period: safeStr_(d.period),
    site: safeStr_(firstNonEmpty_(d.supplier, d.site)),
    route: safeStr_(firstNonEmpty_(d.refinery, d.route, d.shipmentDest)),
    etdValue: toNum_(firstNonEmpty_(d.etdN, rawPayloadObj.N, d.etdValue)),
    unit: firstNonEmpty_(safeStr_(d.unit), 'kg CO2eq/dry-ton'),
    supplier: safeStr_(d.supplier),
    refinery: safeStr_(d.refinery),
    origin: safeStr_(d.origin),
    certType: safeStr_(d.certType),
    loadingPort: safeStr_(d.loadingPort),
    blDate: safeStr_(d.blDate),
    blNumber: safeStr_(d.blNumber),
    vesselName: safeStr_(d.vesselName),
    shipmentDest: safeStr_(d.shipmentDest),
    sdNumber: safeStr_(d.sdNumber),
    truckDist: toNum_(d.truckDist),
    vesselDist1: toNum_(d.vesselDist1),
    vesselDist2: toNum_(d.vesselDist2),
    etdN: toNum_(firstNonEmpty_(d.etdN, rawPayloadObj.N)),
    etdR: toNum_(firstNonEmpty_(d.etdR, rawPayloadObj.R)),
    etdS: toNum_(firstNonEmpty_(d.etdS, rawPayloadObj.S)),
    etdT: toNum_(firstNonEmpty_(d.etdT, rawPayloadObj.T)),
    etdTotal: toNum_(firstNonEmpty_(d.etdTotal, d.etdR, rawPayloadObj.R)),
    rawPayload: rawPayloadStr,
  };
}

function saveEtdLog_(payload) {
  const sh = getSheetOrThrow_(CFG.SHEET_ETD_LOG);
  const headers = getHeaders_(sh);
  const h = headerMap_(headers);

  const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const id = safeStr_(payload.id) || makeId_();

  const row = new Array(headers.length).fill('');
  const set = (name, val) => setByHeader_(row, h, name, val);

  set('id', id);
  set('savedAt', firstNonEmpty_(safeStr_(payload.savedAt), now));
  set('period', safeStr_(payload.period));
  set('site', safeStr_(payload.site));
  set('route', safeStr_(payload.route));
  set('etdValue', toNum_(payload.etdValue));
  set('unit', firstNonEmpty_(safeStr_(payload.unit), 'kg CO2eq/dry-ton'));
  set('supplier', safeStr_(payload.supplier));
  set('refinery', safeStr_(payload.refinery));
  set('origin', safeStr_(payload.origin));
  set('certType', safeStr_(payload.certType));
  set('loadingPort', safeStr_(payload.loadingPort));
  set('blDate', safeStr_(payload.blDate));
  set('blNumber', safeStr_(payload.blNumber));
  set('vesselName', safeStr_(payload.vesselName));
  set('shipmentDest', safeStr_(payload.shipmentDest));
  set('sdNumber', safeStr_(payload.sdNumber));
  set('truckDist', toNum_(payload.truckDist));
  set('vesselDist1', toNum_(payload.vesselDist1));
  set('vesselDist2', toNum_(payload.vesselDist2));
  set('etdN', toNum_(payload.etdN));
  set('etdR', toNum_(payload.etdR));
  set('etdS', toNum_(payload.etdS));
  set('etdT', toNum_(payload.etdT));
  set('etdTotal', toNum_(payload.etdTotal));

  const rawPayload = firstNonEmpty_(
    safeStr_(payload.rawPayload),
    safeStr_(payload.rawPayloadJSON),
    safeStr_(payload.raw_payload),
    ''
  );
  set('rawPayload', rawPayload);

  sh.appendRow(row);
  return { id };
}

function getEtdLogRows_() {
  const sh = getSheetOrThrow_(CFG.SHEET_ETD_LOG);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(v => safeStr_(v));
  const h = headerMap_(headers);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;

    out.push({
      id: safeStr_(getByHeader_(row, h, 'id')),
      savedAt: safeStr_(getByHeader_(row, h, 'savedAt')),
      period: safeStr_(getByHeader_(row, h, 'period')),
      site: safeStr_(getByHeader_(row, h, 'site')),
      route: safeStr_(getByHeader_(row, h, 'route')),
      etdValue: toNum_(getByHeader_(row, h, 'etdValue')),
      unit: safeStr_(getByHeader_(row, h, 'unit')),
      rawPayload: safeStr_(getByHeader_(row, h, 'rawPayload')),
      supplier: safeStr_(getByHeader_(row, h, 'supplier')),
      refinery: safeStr_(getByHeader_(row, h, 'refinery')),
      origin: safeStr_(getByHeader_(row, h, 'origin')),
      certType: safeStr_(getByHeader_(row, h, 'certType')),
      loadingPort: safeStr_(getByHeader_(row, h, 'loadingPort')),
      blDate: safeStr_(getByHeader_(row, h, 'blDate')),
      blNumber: safeStr_(getByHeader_(row, h, 'blNumber')),
      vesselName: safeStr_(getByHeader_(row, h, 'vesselName')),
      shipmentDest: safeStr_(getByHeader_(row, h, 'shipmentDest')),
      sdNumber: safeStr_(getByHeader_(row, h, 'sdNumber')),
      truckDist: toNum_(getByHeader_(row, h, 'truckDist')),
      vesselDist1: toNum_(getByHeader_(row, h, 'vesselDist1')),
      vesselDist2: toNum_(getByHeader_(row, h, 'vesselDist2')),
      etdN: toNum_(getByHeader_(row, h, 'etdN')),
      etdR: toNum_(getByHeader_(row, h, 'etdR')),
      etdS: toNum_(getByHeader_(row, h, 'etdS')),
      etdT: toNum_(getByHeader_(row, h, 'etdT')),
      etdTotal: toNum_(getByHeader_(row, h, 'etdTotal')),
    });
  }
  return out;
}

/* =========================
  GHG SAVINGS LOG
  Add columns (if not yet): etdTrucking | etdVessel | vesselEmission
  Legacy "etd" = trucking, legacy "vessel" = FOB→Import emission
========================= */

function saveGhgSavingsLog_(payload) {
  const sh = getSheetOrThrow_(CFG.SHEET_GHG_SAVINGS_LOG);
  const headers = getHeaders_(sh);
  const h = headerMap_(headers);

  const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  const id = safeStr_(payload.id) || makeId_();

  const etdTrucking = toNum_(firstNonEmpty_(payload.etdTrucking, payload.etd));
  const etdVessel = toNum_(payload.etdVessel);
  const vesselEmission = toNum_(firstNonEmpty_(payload.vesselEmission, payload.vessel));

  const row = new Array(headers.length).fill('');
  const set = (name, val) => setByHeader_(row, h, name, val);

  set('id', id);
  set('savedAt', firstNonEmpty_(safeStr_(payload.savedAt), now));
  set('period', safeStr_(payload.period));
  set('site', safeStr_(payload.site));
  set('country', safeStr_(payload.country));
  set('eec', toNum_(payload.eec));
  set('el', toNum_(payload.el));
  set('epRefinery', toNum_(payload.epRefinery));
  set('etdTrucking', etdTrucking);
  set('etdVessel', etdVessel);
  set('etd', etdTrucking);
  set('epBiodiesel', toNum_(payload.epBiodiesel));
  set('vesselEmission', vesselEmission);
  set('vessel', vesselEmission);
  set('depot', toNum_(payload.depot));
  set('savingFob', toNum_(payload.savingFob));
  set('savingDischarge', toNum_(payload.savingDischarge));

  sh.appendRow(row);
  return { id };
}

function getGhgSavingsLogRows_() {
  const sh = getSheetOrThrow_(CFG.SHEET_GHG_SAVINGS_LOG);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(v => safeStr_(v));
  const h = headerMap_(headers);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;

    const etdTrucking = toNum_(getAnyByHeader_(row, h, ['etdTrucking', 'etd']));
    const etdVessel = toNum_(getAnyByHeader_(row, h, ['etdVessel']));
    const vesselEmission = toNum_(getAnyByHeader_(row, h, ['vesselEmission', 'vesselEmissionKG', 'vessel']));

    out.push({
      id: safeStr_(getByHeader_(row, h, 'id')),
      savedAt: safeStr_(getByHeader_(row, h, 'savedAt')),
      period: safeStr_(getByHeader_(row, h, 'period')),
      site: safeStr_(getByHeader_(row, h, 'site')),
      country: safeStr_(getByHeader_(row, h, 'country')),
      eec: toNum_(getByHeader_(row, h, 'eec')),
      el: toNum_(getByHeader_(row, h, 'el')),
      epRefinery: toNum_(getByHeader_(row, h, 'epRefinery')),
      etdTrucking: etdTrucking,
      etdVessel: etdVessel,
      etd: etdTrucking,
      epBiodiesel: toNum_(getByHeader_(row, h, 'epBiodiesel')),
      vesselEmission: vesselEmission,
      vessel: vesselEmission,
      depot: toNum_(getByHeader_(row, h, 'depot')),
      savingFob: toNum_(getByHeader_(row, h, 'savingFob')),
      savingDischarge: toNum_(getByHeader_(row, h, 'savingDischarge')),
    });
  }
  return out;
}

/* =========================
  EF MASTER
========================= */

function getEfMasterRows_() {
  const sh = getSheetOrThrow_(CFG.SHEET_EF_MASTER);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(v => safeStr_(v));
  const h = headerMap_(headers);

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.join('') === '') continue;
    const key = safeStr_(getByHeader_(row, h, 'key'));
    if (!key) continue;
    rows.push({
      key: key,
      label: safeStr_(getByHeader_(row, h, 'label')),
      ef: toNum_(getByHeader_(row, h, 'ef')),
      reference: safeStr_(getByHeader_(row, h, 'reference')),
      unit: safeStr_(getByHeader_(row, h, 'unit')),
      updatedAt: safeStr_(getByHeader_(row, h, 'updatedAt')),
    });
  }
  return rows;
}

function updateEfMaster_(rows) {
  const sh = getSheetOrThrow_(CFG.SHEET_EF_MASTER);
  const values = sh.getDataRange().getValues();
  if (values.length < 1) throw new Error('EF_MASTER header not found');

  const headers = values[0].map(v => safeStr_(v));
  const h = headerMap_(headers);
  const keyCol = h['key'];
  if (keyCol == null) throw new Error('EF_MASTER must have "key" column');

  const existing = {};
  for (let r = 1; r < values.length; r++) {
    const k = safeStr_(values[r][keyCol]);
    if (k) existing[k] = r + 1;
  }

  let updated = 0;
  const now = Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  rows.forEach(item => {
    const key = safeStr_(item.key);
    if (!key) return;
    const rowArr = new Array(headers.length).fill('');
    setByHeader_(rowArr, h, 'key', key);
    setByHeader_(rowArr, h, 'label', safeStr_(item.label));
    setByHeader_(rowArr, h, 'ef', toNum_(item.ef));
    setByHeader_(rowArr, h, 'reference', safeStr_(item.reference));
    setByHeader_(rowArr, h, 'unit', safeStr_(item.unit));
    setByHeader_(rowArr, h, 'updatedAt', now);

    if (existing[key]) sh.getRange(existing[key], 1, 1, headers.length).setValues([rowArr]);
    else sh.appendRow(rowArr);
    updated++;
  });

  return { updated: updated };
}

/* =========================
  Helpers
========================= */

function getSheetOrThrow_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}

function getHeaders_(sheet) {
  const lc = sheet.getLastColumn();
  if (lc < 1) throw new Error('Header row not found in sheet: ' + sheet.getName());
  return sheet.getRange(1, 1, 1, lc).getValues()[0].map(v => safeStr_(v));
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((hh, i) => {
    const k = normalizeHeader_(hh);
    if (k) map[k] = i;
  });
  return map;
}

function normalizeHeader_(s) {
  return safeStr_(s).replace(/\s+/g, '').toLowerCase();
}

function setByHeader_(rowArr, hMap, headerName, value) {
  const idx = hMap[normalizeHeader_(headerName)];
  if (idx != null) rowArr[idx] = value;
}

function getByHeader_(rowArr, hMap, headerName) {
  const idx = hMap[normalizeHeader_(headerName)];
  return idx == null ? '' : rowArr[idx];
}

function getAnyByHeader_(rowArr, hMap, names) {
  for (let i = 0; i < names.length; i++) {
    const v = getByHeader_(rowArr, hMap, names[i]);
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const txt = e.postData.contents;
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch (err) {
    throw new Error('Invalid JSON body');
  }
}

function getParam_(e, key) {
  if (!e || !e.parameter) return '';
  return safeStr_(e.parameter[key]);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeStr_(v) {
  if (v == null) return '';
  return String(v).trim();
}

function toNum_(v, fallback) {
  const n = Number(v);
  if (!isNaN(n) && isFinite(n)) return n;
  if (arguments.length > 1) {
    const f = Number(fallback);
    if (!isNaN(f) && isFinite(f)) return f;
  }
  return 0;
}

function firstNonEmpty_() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

function normalizeCalcType_(v) {
  const s = safeStr_(v).toLowerCase();
  return s === 'biodiesel' ? 'biodiesel' : 'refinery';
}

function makeId_() {
  return Utilities.getUuid().slice(0, 8) + '-' + Date.now();
}
