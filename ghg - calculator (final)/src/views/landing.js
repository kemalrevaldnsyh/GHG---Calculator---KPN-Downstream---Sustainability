/** View: landing — auto-generated from landing.html */
export const landingView = `<div class="page active" id="page-landing">
  <div class="landing-wrap">
    <div class="landing-hero">
      <p class="landing-eyebrow">KPN Downstream - Sustainability</p>
      <h1>Choose your calculator!</h1>
      <p>Select the calculator that fits your emission assessment needs. Each module delivers concise, reliable, and corporate-ready results.</p>
    </div>
    <div class="landing-grid">
      <button type="button" class="landing-card etd" onclick="openETDMode()">
        <div class="lc-meta">ETD</div>
        <h2>ETD</h2>
        <p>Transport and distribution emissions, with local calculation and no external sheet integration.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open Calculator</span>
      </button>
      <button type="button" class="landing-card etd-ggl" onclick="openETDGGLMode()">
        <div class="lc-meta">GGL</div>
        <h2>ETD GGL</h2>
        <p>Same ETD calculator as RPOME, configured for GGL transport and distribution.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open Calculator</span>
      </button>
      <button type="button" class="landing-card refinery" onclick="openCalculatorMode('refinery')">
        <div class="lc-meta">REFINERY</div>
        <h2>Refinery — GHG (POME)</h2>
        <p>Processing emission calculation that covers fuel, chemicals, electricity, water, and RPOME/POME allocation.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open calculator</span>
      </button>
      <button type="button" class="landing-card biodiesel" onclick="openCalculatorMode('biodiesel')">
        <div class="lc-meta">BIODIESEL</div>
        <h2>Biodiesel — GHG</h2>
        <p>Includes refinery features plus biodiesel-specific emissions and energy intensity per MJ PME.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open calculator</span>
      </button>
      <button type="button" class="landing-card ggl-processing" onclick="openCalculatorMode('ggl')">
        <div class="lc-meta">GGL</div>
        <h2>Processing GGL</h2>
        <p>Same processing layout as Refinery POME — emission factors limited to electricity and solar only.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open calculator</span>
      </button>
      <button type="button" class="landing-card ghg-savings" onclick="openGHGSavingsMode()">
        <div class="lc-meta">GHG SAVINGS</div>
        <h2>GHG Savings Biodiesel</h2>
        <p>Calculate GHG savings for biodiesel PME from FOB to import, with Datacenter lookup, per ISCC/EU Directive 2018/2001.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open Calculator</span>
      </button>
      <button type="button" class="landing-card traceability" onclick="openTraceabilityMode()">
        <div class="lc-meta">DATA</div>
        <h2>Traceability Export Shipment ISCC/INS</h2>
        <p>Select supplier by name &amp; destination, enter BL data, auto-select farthest distance, and save to ETD.</p>
        <span class="btn btn-dark btn-sm" style="pointer-events:none">Open Menu</span>
      </button>
    </div>
  </div>
</div>`;
