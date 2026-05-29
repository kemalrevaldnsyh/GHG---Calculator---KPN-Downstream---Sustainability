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
function safePdfExport(el, opts) {
  return new Promise(function(resolve, reject) {
    if (typeof html2pdf === 'undefined') {
      reject(new Error('html2pdf library not loaded'));
      return;
    }

    var classes = el.className || '';
    var w = el.style.width || '';
    var style = 'background:#fff;' + (w ? 'width:' + w + ';' : '');
    var htmlStr = '<div class="' + classes + '" style="' + style + '">'
                + el.innerHTML + '</div>';

    el.className = '';

    // Warmup: wait for web fonts + two paint cycles before invoking html2pdf.
    // Without this, the FIRST export after the page opens can capture a blank/partial
    // render because Google Fonts / layout haven't committed yet.
    var fontsReady;
    try {
      fontsReady = (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function')
        ? document.fonts.ready
        : Promise.resolve();
    } catch (e) {
      fontsReady = Promise.resolve();
    }

    fontsReady.then(function() {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          setTimeout(function() {
            html2pdf().set(opts).from(htmlStr, 'string').save()
              .then(function() { resolve(); })
              .catch(function(err) { reject(err); });
          }, 80);
        });
      });
    }).catch(function() {
      // If fonts.ready rejects for any reason, still attempt the export.
      setTimeout(function() {
        html2pdf().set(opts).from(htmlStr, 'string').save()
          .then(function() { resolve(); })
          .catch(function(err) { reject(err); });
      }, 80);
    });
  });
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

  return new Promise(function(resolve, reject) {
    if (typeof html2pdf === 'undefined') {
      reject(new Error('html2pdf library not loaded'));
      return;
    }

    // Clone content into a fully-visible offscreen container so the renderer can
    // capture cleanly even if the source is position:absolute / left:-9999px / hidden.
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

    var readyPromise = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    readyPromise.then(function() {
      requestAnimationFrame(function() {
        setTimeout(function() {
          try {
            var worker = html2pdf().set({
              margin:      0,
              filename:    filename,
              image:       { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: scale, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
              jsPDF:       { unit: 'mm', format: format, orientation: orientation, compress: true }
            }).from(inner);

            // Run the capture + pdf build pipeline, then rebuild onto a single page.
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
        }, 40);
      });
    });
  });
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
  elec:  { label:'Electricity', group:'elec',  unit:'kWh', ef:'EF 1.1202 kg COeq/kWh', inputId:'r-elec' },
  solar: { label:'Solar',       group:'solar', unit:'kWh', ef:'EF 0.054 kg COeq/kWh',  inputId:'r-solar' },
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
    html += og('A. Electricity', groups.elec);
    html += og('B. Solar', groups.solar);
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
      stream1: 'RPOME', stream2: 'POME FAD',
      stream1lhv: 'LHV 37 MJ/kg', stream2lhv: 'LHV 37 MJ/kg',
      feedstock: 'POME', feedstockSub: 'Input material',
      epDry1: 'Ep / dry-ton RPOME', epDry2: 'Ep / dry-ton POME FAD',
      epAlloc1: 'Ep Allocated RPOME', epAlloc2: 'Ep Allocated POME FAD',
      resEp1: 'Ep / dry-ton RPOME', resEp2: 'Ep / dry-ton FAD',
      resAlloc: 'Ep Allocated RPOME',
      pdfSubtitle: 'Processing GGL',
      headerTitle: 'GHG Calculator — Processing GGL',
      headerSub: 'Ep Processing · GGL',
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
  ['row-p-fuel', 'row-p-chem', 'row-p-water'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = isGgl ? 'none' : '';
  });
  var solarRow = document.getElementById('row-p-solar');
  if (solarRow) solarRow.style.display = isGgl ? '' : 'none';
  var waterLabel = document.querySelector('#row-p-water .cr-label');
  if (waterLabel && !isGgl) waterLabel.textContent = 'D. Water';
}

function openCalculatorMode(mode) {
  if (mode === 'biodiesel') CALC_MODE = 'biodiesel';
  else if (mode === 'ggl') CALC_MODE = 'ggl';
  else CALC_MODE = 'refinery';
  syncItemCatalog();
  rebuildItemSelect();
  applyModeLabels();
  document.getElementById('page-landing').classList.remove('active');
  var etdWrap = document.getElementById('etd-app-wrap');
  if (etdWrap) etdWrap.classList.remove('active');
  var savingsWrap = document.getElementById('ghg-savings-wrap');
  if (savingsWrap) savingsWrap.classList.remove('active');
  var trcWrap = document.getElementById('traceability-wrap');
  if (trcWrap) trcWrap.classList.remove('active');
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
      : CALC_MODE === 'ggl' ? 'Mode: Processing GGL'
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

