import { landingView } from '../views/landing.js';
import { etdView } from '../views/etd.js';
import { traceabilityView } from '../views/traceability.js';
import { ghgSavingsView } from '../views/ghg-savings.js';
import { refineryCalcView } from '../views/refinery-calc.js';
import { rawDataView } from '../views/raw-data.js';

export function mountViews(rootEl) {
  if (!rootEl) throw new Error('Missing #app-root');
  rootEl.innerHTML =
    landingView +
    etdView +
    traceabilityView +
    ghgSavingsView +
    refineryCalcView +
    rawDataView;
}
