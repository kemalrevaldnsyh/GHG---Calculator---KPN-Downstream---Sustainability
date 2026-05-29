const SCRIPT_ORDER = [
  '/modules/shared/pdf-export.js',
  '/modules/refinery-calc/core.js',
  '/modules/ghg-savings/index.js',
  '/modules/refinery-calc/app.js',
  '/modules/etd/index.js',
  '/modules/traceability/index.js',
];

const SCRIPT_VERIFY = {
  '/modules/shared/pdf-export.js': () => typeof acquirePdfExportLock === 'function',
  '/modules/refinery-calc/core.js': () => typeof openCalculatorMode === 'function',
  '/modules/ghg-savings/index.js': () => typeof ghgSavingsCalc === 'function',
  '/modules/refinery-calc/app.js': () => typeof showToast === 'function',
  '/modules/etd/index.js': () => typeof etdCalculate === 'function',
  '/modules/traceability/index.js': () => typeof openTraceabilityMode === 'function',
};

function verifyClassicScript(src) {
  const verify = SCRIPT_VERIFY[src];
  if (!verify) return true;
  return verify();
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ghg-src="${src}"]`);
    if (existing) {
      if (verifyClassicScript(src)) {
        resolve();
        return;
      }
      existing.remove();
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.ghgSrc = src;
    script.onload = () => {
      if (!verifyClassicScript(src)) {
        reject(new Error(`${src} loaded but did not initialize (syntax or runtime error)`));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

/** Load classic script modules in dependency order (public/modules/). */
export async function bootCalculatorScripts() {
  for (const src of SCRIPT_ORDER) {
    await loadClassicScript(src);
  }
}
