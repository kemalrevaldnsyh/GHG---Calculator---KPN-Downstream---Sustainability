/* Core — safePdfExport, catalog, navigation */
/* ══════════════════════════════════════════════════════════════
   safePdfExport — ROBUST PDF EXPORT UTILITY
   Fixes the blank-page / partial-render race condition in html2pdf.

   Root causes of the blank-page bug:
   1. display:none → display:block → html2canvas fires before browser
      has completed a full paint cycle (layout + paint + composite).
   2. Google Fonts not yet loaded when capture fires.
   3. Grid/Flex layout not fully resolved at capture time.

   Fix strategy:
   - Keep #pdf-print-area in layout at all times (visibility:hidden,
     position:absolute, left:-9999px) so layout is always computed.
   - Wait for document.fonts.ready (ensures custom fonts are loaded).
   - Double-buffer with requestAnimationFrame + setTimeout(0) to
     guarantee at least one full browser paint cycle before capture.
   - Make element visible only during capture, invisible after.
   ══════════════════════════════════════════════════════════════ */
function safePdfExport(el, opts, lockOpts) {
  opts = opts || {};
  return runLockedHtml2Pdf(function() {
    return new Promise(function(resolve, reject) {
      var widthCss = '277mm';
      var container = document.createElement('div');
      container.setAttribute('data-pdf-export-clone', '1');
      container.style.cssText = [
        'position:fixed',
        'top:0',
        'left:0',
        'z-index:-1',
        'opacity:0.001',
        'pointer-events:none',
        'background:#ffffff',
        'width:' + widthCss,
        'overflow:visible'
      ].join(';');

      var inner = document.createElement('div');
      inner.className = el.className || 'pdf-print-area';
      inner.style.cssText = 'background:#ffffff;width:' + widthCss + ';box-sizing:border-box;';
      inner.innerHTML = el.innerHTML;
      container.appendChild(inner);
      document.body.appendChild(container);

      function cleanup() {
        if (container && container.parentNode) container.parentNode.removeChild(container);
      }

      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          html2pdf()
            .set(opts)
            .from(inner)
            .save()
            .then(function() { cleanup(); resolve(); })
            .catch(function(err) { cleanup(); reject(err); });
        });
      });
    });
  }, lockOpts || {});
}

/* 
   safePdfExportOnePage — GUARANTEES a single-page PDF.
   Uses html2pdf's own internal worker chain (which bundles html2canvas + jsPDF),
   so it works even when those libraries are not exposed as globals.
   Strategy:
     1. Run the normal html2pdf pipeline to obtain `worker.prop.canvas` and `worker.prop.pdf`.
     2. Build a NEW jsPDF (using the same constructor taken from `pdf.constructor`)
        and add the captured canvas scaled to fit within a single page.
 */
function safePdfExportOnePage(el, opts) {
  opts = opts || {};
  var filename    = opts.filename || ('Export_' + new Date().toISOString().slice(0,10) + '.pdf');
  var orientation = opts.orientation || 'landscape';
  var format      = opts.format || 'a4';
  var margin      = (typeof opts.margin === 'number') ? opts.margin : 6; // mm
  var scale       = opts.scale || 2;

  return runLockedHtml2Pdf(function() {
    return new Promise(function(resolve, reject) {
      var widthCss = el.style.width || '277mm';
      var container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;opacity:0;' +
        'pointer-events:none;background:#ffffff;width:' + widthCss + ';padding:0;margin:0';
      var inner = document.createElement('div');
      inner.className = el.className || '';
      inner.style.cssText = 'background:#ffffff;width:' + widthCss;
      inner.innerHTML = el.innerHTML;
      container.appendChild(inner);
      document.body.appendChild(container);

      function cleanup() {
        if (container && container.parentNode) container.parentNode.removeChild(container);
      }

      try {
        var worker = html2pdf().set({
          margin:      0,
          filename:    filename,
          image:       { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: scale, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
          jsPDF:       { unit: 'mm', format: format, orientation: orientation, compress: true }
        }).from(inner);

        worker.toCanvas().toPdf().then(function() {
          try {
            var canvas   = worker.prop && worker.prop.canvas;
            var pdfInst  = worker.prop && worker.prop.pdf;
            if (!canvas || !pdfInst) throw new Error('PDF renderer did not produce output');

            var JsPdfCtor = pdfInst.constructor;
            var pdf = new JsPdfCtor({ unit: 'mm', format: format, orientation: orientation, compress: true });
            var pageW = pdf.internal.pageSize.getWidth();
            var pageH = pdf.internal.pageSize.getHeight();
            var availW = pageW - 2 * margin;
            var availH = pageH - 2 * margin;
            var cssW = canvas.width  / scale;
            var cssH = canvas.height / scale;
            var ratio = Math.min(availW / cssW, availH / cssH);
            var imgW = cssW * ratio;
            var imgH = cssH * ratio;
            var offX = (pageW - imgW) / 2;
            var offY = margin;
            var imgData = canvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(imgData, 'JPEG', offX, offY, imgW, imgH, undefined, 'FAST');
            pdf.save(filename);
            cleanup();
            resolve();
          } catch (e) {
            cleanup();
            reject(e);
          }
        }).catch(function(err) { cleanup(); reject(err); });
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
  }, { onBusy: opts.onBusy, busyMessage: opts.busyMessage });
}

/* 
   EMISSION FACTORS & REFERENCES
 */
// Base EF (Refinery defaults — IR 996/2022 and other sources)
const EF_BASE = {
  coal:2.97595, biosolar:0.56265, lng:0.075,
  na2co3:1.2451, na2so3:0.47, pac:0.6, naoh:0.5297,
  cyclohex:0.723, nhex:3.6312090359999982, ipa:3.84,
  hcl:1.0611, be:0.1998, h3po4:3.1247,
  elec:1.1202, water:0.00124, solar:0.054,
  methanol:1.93, sodium_methylate:2.2077, citric_acid:0.87,
};
// Biodiesel-specific overrides (different source/standard vs Refinery)
/** GGL Cangkang — constants from EUP Excel (Palembang, Bontang, Kumai, Lubuk Gaung) */
const GGL_PROCESSING = {
  biosolar_liter_to_kg: 0.815 * 0.7,
  biosolar_ef: 0.56265,
  elec_ef: 0.94,
  cangkang_moisture_pct: 20,
  cangkang_lhv: 37,
};
const GGL_ETD = {
  h_truck: 0.87,
  h_vessel: 0.07,
  EF_diesel: 0.095,
  EF_B40: 0.095 * 0.6,
  Mm_Md: 1.25,
  destinations: {
    PLM: { label: 'EUP Palembang', Ep: 0.58389374058265631 },
    BTG: { label: 'EUP Bontang', Ep: 3.0817003485179981 },
    KUM: { label: 'EUP Kumai', Ep: 0.24414969836428579 },
    LBG: { label: 'EUP Lubuk Gaung', Ep: 0.91571517172963479 },
  },
};

const EF_GGL_OVERRIDES = {
  elec: GGL_PROCESSING.elec_ef,
  biosolar: GGL_PROCESSING.biosolar_ef,
};
const EF_BIODIESEL_OVERRIDES = {
  na2co3: 1.190228, // EU Commission standard values (vs IR 996/2022 for Refinery)
};
let EF = Object.assign({}, EF_BASE);
const REFS_BASE = {
  coal:'IR 996/2022', biosolar:'SK Dirjen Migas 0234.K/2019 · Ecoinvent 3.7',
  lng:'Ecoinvent 3.9.1 (1 m³=37.5 MJ)',
  na2co3:'IR 996/2022', na2so3:'Winnipeg WSTP', pac:'Winnipeg WSTP',
  naoh:'IR 996/2022', cyclohex:'IR 996/2022', nhex:'IR 996/2022',
  ipa:'Winnipeg WSTP', hcl:'IR 996/2022', be:'IR 996/2022', h3po4:'IR 996/2022',
  elec:'Ecoinvent 3.9.1 (ID)', water:'Ecoinvent 3.9.1', solar:'Ecoinvent 3.9.1 (PV)',
  methanol:'IR 996/2022', sodium_methylate:'IR 996/2022', citric_acid:'Ecoinvent v3.10',
};
const REFS_BIODIESEL_OVERRIDES = {
  na2co3: 'EU Commission Standard Values (ec.europa.eu/energy/biofuels)',
};
let REFS = Object.assign({}, REFS_BASE);

/* 
   ITEM CATALOGUE  — drives dropdown + rendering
 */
const ITEMS_REFINERY = {
  coal:     { label:'Coal',                  group:'fuel',     unit:'Kg',  ef:'EF 2.97595',               inputId:'r-coal'     },
  biosolar: { label:'Biosolar',              group:'fuel',     unit:'Kg',  ef:'EF 0.56265',               inputId:'r-biosolar' },
  lng:      { label:'LNG',                   group:'fuel',     unit:'m³',  ef:'EF 0.075',                 inputId:'r-lng'      },
  na2co3:   { label:'Sodium Carbonat',       group:'chemical', unit:'Kg',  ef:'EF 1.2451',                inputId:'r-na2co3'   },
  na2so3:   { label:'Sodium Sulphite',       group:'chemical', unit:'Kg',  ef:'EF 0.47',                  inputId:'r-na2so3'   },
  pac:      { label:'PAC',                   group:'chemical', unit:'Kg',  ef:'EF 0.6',                   inputId:'r-pac'      },
  naoh:     { label:'NaOH',                  group:'chemical', unit:'Kg',  ef:'EF 0.5297',                inputId:'r-naoh'     },
  cyclohex: { label:'Cycle-hexane',          group:'chemical', unit:'Kg',  ef:'EF 0.723',                 inputId:'r-cyclohex' },
  nhex:     { label:'n-Hexane',              group:'chemical', unit:'Kg',  ef:'EF 3.6312',                inputId:'r-nhex'     },
  ipa:      { label:'IPA',                   group:'chemical', unit:'Kg',  ef:'EF 3.84',                  inputId:'r-ipa'      },
  hcl:      { label:'HCl',                   group:'chemical', unit:'Kg',  ef:'EF 1.0611',                inputId:'r-hcl'      },
  be:       { label:'Bleaching Earth',       group:'chemical', unit:'Kg',  ef:'EF 0.1998',                inputId:'r-be'       },
  h3po4:    { label:'Phosphoric Acid',       group:'chemical', unit:'Kg',  ef:'EF 3.1247',                inputId:'r-h3po4'    },
  elec:     { label:'Electricity',           group:'elec',     unit:'kWh', ef:'EF 1.1202 kg COeq/kWh',  inputId:'r-elec'     },
  water:    { label:'Process Water (Boiler)',group:'water',    unit:'Kg',  ef:'EF 0.00124 kg COeq/kg',  inputId:'r-water'    },
};

const ITEMS_GGL = {
  biosolar: { label:'Bio Solar', group:'fuel', unit:'Liter', ef:'Liter×0.815×0.7×EF 0.56265', inputId:'r-biosolar' },
  elec:     { label:'Electricity', group:'elec', unit:'kWh', ef:'EF 0.94 kg COeq/kWh (Sumatera 2019)', inputId:'r-elec' },
};

const ITEMS_BIODIESEL_EXTRA = {
  methanol:           { label:'Methanol',              group:'chemical', unit:'Kg', ef:'EF (kg COeq/kg)', inputId:'r-methanol' },
  sodium_methylate:   { label:'Sodium methylate',      group:'chemical', unit:'Kg', ef:'EF (kg COeq/kg)', inputId:'r-sodium_methylate' },
  citric_acid:        { label:'Citric acid',           group:'chemical', unit:'Kg', ef:'EF (kg COeq/kg)', inputId:'r-citric_acid' },
};

var ITEMS = {};
var CALC_MODE = null;

const ALL_ITEMS_MAP = Object.assign({}, ITEMS_REFINERY, ITEMS_BIODIESEL_EXTRA, ITEMS_GGL);

function syncItemCatalog() {
  if (CALC_MODE === 'ggl') {
    ITEMS = Object.assign({}, ITEMS_GGL);
  } else if (CALC_MODE === 'biodiesel') {
    ITEMS = Object.assign({}, ITEMS_REFINERY, ITEMS_BIODIESEL_EXTRA);
  } else {
    ITEMS = Object.assign({}, ITEMS_REFINERY);
  }
  if (CALC_MODE === 'biodiesel') {
    EF   = Object.assign({}, EF_BASE,   EF_BIODIESEL_OVERRIDES);
    REFS = Object.assign({}, REFS_BASE, REFS_BIODIESEL_OVERRIDES);
  } else if (CALC_MODE === 'ggl') {
    EF   = Object.assign({}, EF_BASE, EF_GGL_OVERRIDES);
    REFS = Object.assign({}, REFS_BASE);
  } else {
    EF   = Object.assign({}, EF_BASE);
    REFS = Object.assign({}, REFS_BASE);
  }
}

function rebuildItemSelect() {
  var sel = document.getElementById('item-select');
  if (!sel) return;
  var groups = { fuel: [], chemical: [], elec: [], water: [], biodiesel: [], solar: [] };
  Object.keys(ITEMS).forEach(function(key) {
    var it = ITEMS[key];
    var gname = it.group;
    if (CALC_MODE === 'biodiesel' && (key === 'methanol' || key === 'sodium_methylate' || key === 'citric_acid')) {
      groups.biodiesel.push({ key: key, label: it.label });
    } else {
      if (!groups[gname]) groups[gname] = [];
      groups[gname].push({ key: key, label: it.label });
    }
  });
  var html = '<option value="" disabled selected>Select an emission source…</option>';
  function og(label, arr) {
    if (!arr || !arr.length) return '';
    var h = '<optgroup label="' + label + '">';
    arr.forEach(function(o) {
      h += '<option value="' + o.key + '">' + escHtml(o.label) + '</option>';
    });
    return h + '</optgroup>';
  }
  if (CALC_MODE === 'ggl') {
    html += og('A. Bio Solar (fuel)', groups.fuel);
    html += og('B. Electricity', groups.elec);
    sel.innerHTML = html;
    return;
  }
  html += og('A. Fuel', groups.fuel);
  html += og('B. Chemical', groups.chemical);
  if (groups.biodiesel.length) html += og('B2. Biodiesel (extra)', groups.biodiesel);
  html += og('C. Electricity', groups.elec);
  html += og('D. Water', groups.water);
  sel.innerHTML = html;
}

function modeLabels() {
  if (CALC_MODE === 'ggl') {
    return {
      stream1: 'CANGKANG', stream2: '—',
      stream1lhv: 'LHV 37 MJ/kg', stream2lhv: '—',
      feedstock: 'CANGKANG', feedstockSub: 'Processed (wet) · contract moisture 20%',
      epDry1: 'Ep / dry-ton Cangkang', epDry2: '—',
      epAlloc1: 'Ep / dry-ton Cangkang', epAlloc2: '—',
      resEp1: 'Ep / dry-ton Cangkang', resEp2: '—',
      resAlloc: 'Ep / dry-ton Cangkang',
      pdfSubtitle: 'GGL Cangkang · Processing & ETD',
      headerTitle: 'GHG Calculator — GGL Cangkang',
      headerSub: 'Processing & ETD · Cangkang',
    };
  }
  if (CALC_MODE === 'biodiesel') {
    return {
      stream1: 'PME', stream2: 'CG (FAD)',
      stream1lhv: 'LHV 37 MJ/kg', stream2lhv: 'LHV 16 MJ/kg',
      feedstock: 'RBDPO', feedstockSub: 'Feedstock input',
      epDry1: 'Ep / dry-ton PME', epDry2: 'Ep / dry-ton CG (FAD)',
      epAlloc1: 'Ep Allocated PME', epAlloc2: 'Ep Allocated CG',
      resEp1: 'Ep / dry-ton PME', resEp2: 'Ep / dry-ton CG',
      resAlloc: 'Ep Allocated PME',
      pdfSubtitle: 'Biodiesel · PME/CG',
      headerTitle: 'GHG Calculator — Biodiesel',
      headerSub: 'Ep Processing · ISCC/INS',
    };
  }
  return {
    stream1: 'RPOME', stream2: 'POME FAD',
    stream1lhv: 'LHV 37 MJ/kg', stream2lhv: 'LHV 37 MJ/kg',
    feedstock: 'POME', feedstockSub: 'Input material',
    epDry1: 'Ep / dry-ton RPOME', epDry2: 'Ep / dry-ton POME FAD',
    epAlloc1: 'Ep Allocated RPOME', epAlloc2: 'Ep Allocated POME FAD',
    resEp1: 'Ep / dry-ton RPOME', resEp2: 'Ep / dry-ton FAD',
    resAlloc: 'Ep Allocated RPOME',
    pdfSubtitle: 'Refinery POME',
    headerTitle: 'GHG Calculator — Refinery POME',
    headerSub: 'Ep Processing · ISCC/INS',
  };
}

function applyModeLabels() {
  var L = modeLabels();
  var set = function(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('lbl-af-stream1', L.stream1);
  set('lbl-af-stream2', L.stream2);
  set('lbl-af-stream1-lhv', L.stream1lhv);
  set('lbl-af-stream2-lhv', L.stream2lhv);
  set('lbl-af-feedstock', L.feedstock);
  set('lbl-af-feedstock-sub', L.feedstockSub);
  set('lbl-p-ep1', L.epDry1);
  set('lbl-p-ep2', L.epDry2);
  set('lbl-p-epa1', L.epAlloc1);
  set('lbl-p-epa2', L.epAlloc2);
  set('lbl-res-ep1', L.resEp1);
  set('lbl-res-ep2', L.resEp2);
  set('lbl-res-alloc', L.resAlloc);
  set('header-main-title', L.headerTitle);
  set('header-main-sub', L.headerSub);
  var rowMj = document.getElementById('row-ep-mj');
  var cardMj = document.getElementById('card-res-epmj');
  if (rowMj) rowMj.style.display = (CALC_MODE === 'biodiesel') ? '' : 'none';
  if (cardMj) cardMj.style.display = (CALC_MODE === 'biodiesel') ? '' : 'none';
  applyCalcPanelLayout();
}

function applyCalcPanelLayout() {
  var isGgl = CALC_MODE === 'ggl';
  ['row-p-fuel', 'row-p-chem', 'row-p-water', 'row-p-solar'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = isGgl ? 'none' : '';
  });
  var gglFuel = document.getElementById('row-p-ggl-fuel');
  if (gglFuel) gglFuel.style.display = isGgl ? '' : 'none';
  var lblElec = document.getElementById('lbl-p-elec');
  if (lblElec) lblElec.textContent = isGgl ? 'B. Electricity' : 'C. Electricity';
  ['af-pome-block', 'af-pome-body', 'af-stream2-block', 'af-stream2-body', 'col-p-ep2', 'col-p-epa1', 'col-p-epa2', 'card-res-ep2', 'card-res-alloc'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = isGgl ? 'none' : '';
  });
  var waterLabel = document.querySelector('#row-p-water .cr-label');
  if (waterLabel && !isGgl) waterLabel.textContent = 'D. Water';
  if (isGgl) {
    var mc = document.getElementById('af-rpome-mc');
    if (mc && (mc.value === '0.05' || mc.value === '70' || !mc.value)) mc.value = String(GGL_PROCESSING.cangkang_moisture_pct);
  }
  var tabEtd = document.getElementById('tab-etd');
  if (tabEtd) tabEtd.style.display = isGgl ? '' : 'none';
}

function openGGLMode() {
  if (typeof ETD_VARIANT !== 'undefined') ETD_VARIANT = 'ggl';
  openCalculatorMode('ggl');
  if (typeof applyEtdBranding === 'function') applyEtdBranding();
}

function openCalculatorMode(mode) {
  if (mode === 'biodiesel') CALC_MODE = 'biodiesel';
  else if (mode === 'ggl') {
    CALC_MODE = 'ggl';
    if (typeof ETD_VARIANT !== 'undefined') ETD_VARIANT = 'ggl';
  }
  else CALC_MODE = 'refinery';
  syncItemCatalog();
  rebuildItemSelect();
  applyModeLabels();
  if (CALC_MODE === 'ggl' && typeof refreshEtdDestinationOptions === 'function') refreshEtdDestinationOptions();
  document.getElementById('page-landing').classList.remove('active');
  var etdWrap = document.getElementById('etd-app-wrap');
  if (etdWrap) etdWrap.classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
  var rdWrap = document.getElementById('raw-data-wrap');
  if (rdWrap) rdWrap.classList.remove('active');
  document.getElementById('calc-app-wrap').classList.add('active');
  var back = document.getElementById('btn-back-overview');
  if (back) back.style.display = '';
  setItemInputMode('all', { force: true });
  var t0 = document.querySelector('.tabs .tab');
  if (t0) switchTab('input', t0);
  currentFilterSite = 'all';
  currentFilterYear = '';
  calculate();
  fetchHistory();
  updateResultSiteDropdown();
  requestAnimationFrame(function() { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
  showToast(
    CALC_MODE === 'biodiesel' ? 'Mode: Biodiesel'
      : CALC_MODE === 'ggl' ? 'Mode: GGL Cangkang'
      : 'Mode: Refinery',
    'success'
  );
}

function goToOverview() {
  document.getElementById('calc-app-wrap').classList.remove('active');
  var etdWrap = document.getElementById('etd-app-wrap');
  if (etdWrap) etdWrap.classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
  var rdWrap = document.getElementById('raw-data-wrap');
  if (rdWrap) rdWrap.classList.remove('active');
  document.getElementById('page-landing').classList.add('active');
  var back = document.getElementById('btn-back-overview');
  if (back) back.style.display = 'none';
  CALC_MODE = null;
  requestAnimationFrame(function() { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
}

function openGHGSavingsMode() {
  document.getElementById('page-landing').classList.remove('active');
  document.getElementById('calc-app-wrap').classList.remove('active');
  var etdWrap = document.getElementById('etd-app-wrap');
  if (etdWrap) etdWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
  var rdWrap = document.getElementById('raw-data-wrap');
  if (rdWrap) rdWrap.classList.remove('active');
  document.getElementById('ghg-savings-wrap').classList.add('active');
  var gsPeriod = document.getElementById('gs-period');
  if (gsPeriod && !gsPeriod.value) gsPeriod.value = String(new Date().getFullYear());
  var gsSite = document.getElementById('gs-site');
  var latestEtd = getLatestEtdSnapshot();
  if (gsSite && !gsSite.value && latestEtd && latestEtd.supplier) gsSite.value = latestEtd.supplier;
  CALC_MODE = null;
  ghgSavingsOnCountrySelect();
  fetchGhgSavingsDatacenter();
  requestAnimationFrame(function() { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
  showToast('Mode: GHG Savings Biodiesel', 'success');
}

