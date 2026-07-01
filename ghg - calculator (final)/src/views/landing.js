/** View: landing — auto-generated from landing.html */
const LC_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`;

function lcCard(className, onclick, title, desc, actionLabel) {
  return `<button type="button" class="landing-card ${className}" onclick="${onclick}">
    <div class="lc-card-head">
      <span class="lc-icon-wrap"><span class="lc-icon">${LC_ICON}</span></span>
      <span class="lc-badge">Active</span>
    </div>
    <h2>${title}</h2>
    <p>${desc}</p>
    <span class="lc-action">${actionLabel}</span>
  </button>`;
}

export const landingView = `<div class="page active" id="page-landing">
  <div class="landing-wrap">
    <div class="landing-inner">
      <div class="landing-header-row">
        <div class="landing-brand">
          <div class="landing-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none"><path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" stroke="white" stroke-width="1.5"/><circle cx="16" cy="16" r="5.5" stroke="white" stroke-width="1.5"/></svg>
          </div>
          <span>GHG Calculator</span>
        </div>
        <div class="landing-topbar" id="landing-auth-bar" hidden>
          <span class="landing-user-email" id="landing-user-email"></span>
          <span class="landing-user-avatar" id="landing-user-avatar" aria-hidden="true"></span>
          <button type="button" class="landing-signout" id="btn-landing-signout">Sign out</button>
        </div>
      </div>
      <div class="landing-hero">
        <p class="landing-welcome" id="landing-welcome">Welcome</p>
        <h1>GHG Emission Calculators</h1>
        <p class="landing-tagline">Sustainable Supply. Responsible Refining.</p>
        <p class="landing-desc">Choose the module that fits your emission assessment needs — concise, reliable, and corporate-ready results.</p>
      </div>
      <div class="landing-cards">
        <div class="landing-grid landing-grid-main">
          ${lcCard('etd', 'openETDMode()', 'ETD', 'Transport and distribution emissions, with local calculation and no external sheet integration.', 'Open calculator →')}
          ${lcCard('refinery', "openCalculatorMode('refinery')", 'Refinery — GHG (POME)', 'Processing emission calculation that covers fuel, chemicals, electricity, water, and RPOME/POME allocation.', 'Open calculator →')}
          ${lcCard('biodiesel', "openCalculatorMode('biodiesel')", 'Biodiesel — GHG', 'Includes refinery features plus biodiesel-specific emissions and energy intensity per MJ PME.', 'Open calculator →')}
          ${lcCard('ghg-savings', 'openGHGSavingsMode()', 'GHG Savings Biodiesel', 'Calculate GHG savings for biodiesel PME from FOB to import, with Datacenter lookup, per ISCC/EU Directive 2018/2001.', 'Open calculator →')}
          ${lcCard('traceability', 'openTraceabilityMode()', 'Traceability Export Shipment ISCC/INS', 'Select supplier by name &amp; destination, enter BL data, auto-select farthest distance, and save to ETD.', 'Open menu →')}
          ${lcCard('raw-data', 'openRawDataMode()', 'Raw Data — CPO Calculation', 'Monthly input Data Perhitungan per EUP site (Bontang, Lubuk Gaung, …), save to Sheets &amp; export Excel.', 'Open menu →')}
          ${lcCard('ggl-combined', 'openGGLMode()', 'GGL — Shell (Cangkang)', 'Combined processing and ETD for shell — bio solar, electricity, mass balance, and transport to EUP destinations.', 'Open calculator →')}
        </div>
      </div>
    </div>
  </div>
</div>`;
