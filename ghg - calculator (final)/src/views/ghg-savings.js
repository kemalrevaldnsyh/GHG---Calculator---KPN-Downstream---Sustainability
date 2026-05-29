/** View: ghg-savings — auto-generated from ghg-savings.html */
export const ghgSavingsView = `<div class="page" id="ghg-savings-wrap">

<div class="header">
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
    <button type="button" class="btn btn-outline header-back" onclick="goToOverview()">←</button>
    <div>
      <div class="header-title">GHG Savings Biodiesel</div>
      <div class="header-sub">ISCC/EU 2018/2001 · Ref. 94 g CO₂eq/MJ · LHV PME 37 MJ/kg</div>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="ghgSavingsReset()">Reset</button>
    <button class="btn btn-outline" onclick="ghgSavingsSaveCurrentResult()">Save Result</button>
    <button class="btn btn-dark" onclick="openGHGSavingsExportModal()">&#8595; Export</button>
  </div>
</div>

<div class="main gs-layout">
  <div class="gs-left-col">

  <!-- INPUT CARD -->
  <div class="card">
    <div class="card-header">
      <div class="card-header-title">GHG Components Input</div>
      <div class="card-header-sub">Default: kg CO₂eq/dry-ton · switch to g CO₂eq/MJ to view value ÷ 37</div>
    </div>
    <div class="card-body">
      <div class="grid g2" style="margin-bottom:14px">
        <div class="field">
          <label>Period (for save/export)</label>
          <div class="input-wrap">
            <input type="text" id="gs-period" value="" placeholder="e.g. 2026">
            <span class="input-unit">year</span>
          </div>
        </div>
        <div class="field gs-site-field">
          <label>Site — GHG Savings Datacenter</label>
          <div class="gs-site-search-wrap">
            <div class="input-wrap">
              <input type="text" id="gs-site" value="" placeholder="Ketik untuk cari site… e.g. EUP Bontang" autocomplete="off"
                oninput="ghgSavingsOnSiteSearchInput()" onfocus="ghgSavingsOnSiteSearchInput()" onkeydown="ghgSavingsOnSiteSearchKeydown(event)" onblur="ghgSavingsHideSitePickerSoon()">
              <span class="input-unit">site</span>
            </div>
            <div id="gs-site-picker" class="gs-site-picker"></div>
          </div>
          <div class="gs-log-note" id="gs-datacenter-status">Loading GHG Savings Datacenter…</div>
          <button type="button" class="btn btn-outline" style="margin-top:8px;width:100%" onclick="ghgSavingsApplyDatacenter()">Load Ep Refinery &amp; Biodiesel from Datacenter</button>
        </div>
      </div>

      <div class="section-title" style="margin-top:0">Processing &amp; Transport to FOB Port</div>
      <div class="grid g2" style="margin-bottom:16px">
        <div class="field">
          <label>Ep Refinery</label>
          <div class="input-wrap">
            <input type="number" id="gs-ep-refinery" value="0" step="any" oninput="ghgSavingsCalc()">
            <select id="gs-ep-refinery-unit" class="gs-unit-select" onchange="ghgSavingsOnUnitChange('gs-ep-refinery','gs-ep-refinery-unit')">
              <option value="dry" selected>kg CO₂/dry-t</option>
              <option value="mj">g CO₂/MJ (÷ 37)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Ep Biodiesel (PME)</label>
          <div class="input-wrap">
            <input type="number" id="gs-ep-biodiesel" value="0" step="any" oninput="ghgSavingsCalc()">
            <select id="gs-ep-biodiesel-unit" class="gs-unit-select" onchange="ghgSavingsOnUnitChange('gs-ep-biodiesel','gs-ep-biodiesel-unit')">
              <option value="dry" selected>kg CO₂/dry-t</option>
              <option value="mj">g CO₂/MJ (÷ 37)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Etd FOB kg (Trucking) — ETD1</label>
          <div class="input-wrap">
            <input type="number" id="gs-etd" value="0" step="any" oninput="ghgSavingsCalc()">
            <select id="gs-etd-unit" class="gs-unit-select" onchange="ghgSavingsOnUnitChange('gs-etd','gs-etd-unit')">
              <option value="dry" selected>kg CO₂/dry-t</option>
              <option value="mj">g CO₂/MJ (÷ 37)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Etd FOB kg (Vessel)</label>
          <div class="input-wrap">
            <input type="number" id="gs-etd-vessel" value="0" step="any" oninput="ghgSavingsCalc()">
            <select id="gs-etd-vessel-unit" class="gs-unit-select" onchange="ghgSavingsOnUnitChange('gs-etd-vessel','gs-etd-vessel-unit')">
              <option value="dry" selected>kg CO₂/dry-t</option>
              <option value="mj">g CO₂/MJ (÷ 37)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="section-title">Transport FOB → Import</div>
      <div class="grid g2">
        <div class="field">
          <label>Vessel Emissions (FOB → Import) — ETD2</label>
          <div class="input-wrap">
            <input type="number" id="gs-vessel-em" value="0" step="any" oninput="ghgSavingsCalc()">
            <select id="gs-vessel-em-unit" class="gs-unit-select" onchange="ghgSavingsOnUnitChange('gs-vessel-em','gs-vessel-em-unit')">
              <option value="dry" selected>kg CO₂/dry-t</option>
              <option value="mj">g CO₂/MJ (÷ 37)</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Import Country — Depot &amp; Filling Station</label>
          <div class="input-wrap">
            <select id="gs-country-select" onchange="ghgSavingsOnCountrySelect()" style="flex:1;background:#f9fafb;border:none;padding:7px 10px;font-family:inherit;font-size:12px;color:#111;outline:none;">
              <option value="0.11" data-label="France">France — 0.11 g CO₂/MJ</option>
              <option value="0.02" data-label="Sweden">Sweden — 0.02 g CO₂/MJ</option>
              <option value="0.09" data-label="Austria">Austria — 0.09 g CO₂/MJ</option>
              <option value="0.18" data-label="Belgium">Belgium — 0.18 g CO₂/MJ</option>
              <option value="0.23" data-label="Spain">Spain — 0.23 g CO₂/MJ</option>
              <option value="0.34" data-label="Italy">Italy — 0.34 g CO₂/MJ</option>
              <option value="0.43" data-label="Germany">Germany — 0.43 g CO₂/MJ</option>
              <option value="0.52" data-label="Netherlands">Netherlands — 0.52 g CO₂/MJ</option>
              <option value="0.82" data-label="Poland">Poland — 0.82 g CO₂/MJ</option>
              <option value="0.34" data-label="EU-27 avg">EU-27 avg — 0.34 g CO₂/MJ</option>
              <option value="custom" data-label="Custom" selected>Custom…</option>
            </select>
          </div>
        </div>
        <div class="field" id="gs-custom-depot-field" style="display:none">
          <label>Custom Depot &amp; Filling Value</label>
          <div class="input-wrap">
            <input type="number" id="gs-depot-custom" value="0" step="any" oninput="ghgSavingsCalc()">
            <span class="input-unit">g CO₂eq/MJ</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- RESULT SUMMARY CARDS -->
  <div class="summary-grid" id="gs-result-summary" style="display:none">
    <div class="rs-card">
      <div class="rs-label">Total GHG (dry-ton)</div>
      <div class="rs-value c-blue" id="gs-res-total-dry">—</div>
      <div class="rs-unit">kg CO₂eq/dry-ton</div>
    </div>
    <div class="rs-card">
      <div class="rs-label">GHG FOB (g CO₂eq/MJ)</div>
      <div class="rs-value c-purple" id="gs-res-fob-mj">—</div>
      <div class="rs-unit">g CO₂eq/MJ</div>
    </div>
    <div class="rs-card">
      <div class="rs-label">GHG Saving — FOB</div>
      <div class="rs-value c-green" id="gs-res-saving-fob">—</div>
      <div class="rs-unit">%</div>
    </div>
    <div class="rs-card">
      <div class="rs-label">GHG Saving</div>
      <div class="rs-value c-amber" id="gs-res-saving-discharge">—</div>
      <div class="rs-unit">%</div>
    </div>
  </div>

  <!-- CALCULATION CHAIN -->
  <div class="card">
    <div class="card-header">
      <div class="card-header-title">Calculation Chain</div>
      <div class="card-header-sub">Live update</div>
    </div>
    <div class="card-body">
      <div style="display:flex;flex-direction:column;gap:0">
        <div class="calc-row"><span class="cr-label">Ep Refinery + Etd Trucking + Etd Vessel + Ep Biodiesel (g CO₂eq/MJ)</span><span class="cr-val c-blue" id="gs-chain-fob-mj">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">g CO₂eq/MJ</small></span></div>
        <div class="calc-row"><span class="cr-label" style="color:#9ca3af">Reference total (dry-ton)</span><span class="cr-val" id="gs-chain-total-dry">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">kg CO₂eq/dry-t</small></span></div>
        <div class="calc-row"><span class="cr-label">GHG Saving FOB = (94 − FoB) ÷ 94 × 100</span><span class="cr-val c-green" id="gs-chain-saving-fob">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">%</small></span></div>
        <hr>
        <div class="calc-row"><span class="cr-label" style="color:#9ca3af">+ Vessel Emissions (ETD2)</span><span class="cr-val" id="gs-chain-vessel">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">g CO₂eq/MJ</small></span></div>
        <div class="calc-row"><span class="cr-label" style="color:#9ca3af">+ Depot &amp; Filling</span><span class="cr-val" id="gs-chain-depot">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">g CO₂eq/MJ</small></span></div>
        <div class="calc-row"><span class="cr-label" style="color:#2563eb;font-weight:600">Total GHG = FoB + Vessel + Depot</span><span class="cr-val c-blue" id="gs-chain-discharge-mj">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">g CO₂eq/MJ</small></span></div>
        <div class="calc-row"><span class="cr-label" style="color:#059669;font-weight:600">GHG Saving = (94 − Total) ÷ 94 × 100</span><span class="cr-val c-green" id="gs-chain-saving-discharge" style="font-size:16px;font-weight:700">—<small style="font-size:10px;color:#9ca3af;margin-left:4px">%</small></span></div>
      </div>
    </div>
  </div>

  <!-- RESULTS CARD (FOB + DISCHARGE) -->
  <div class="card" id="gs-results-card">
    <div class="card-header">
      <div class="card-header-title">Results &amp; Threshold Assessment</div>
      <div class="card-header-sub">ISCC / EU Directive 2018/2001</div>
    </div>
    <div class="card-body">
      <div class="grid g2" style="gap:16px">
        <div style="background:#f0fdf4;border:1px solid #d1fae5;border-radius:8px;padding:18px 20px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#059669;border-radius:8px 8px 0 0"></div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;margin-bottom:8px">GHG Saving — FOB</div>
          <div style="font-size:36px;font-weight:700;color:#059669;line-height:1" id="gs-result-fob-big">—<span style="font-size:18px;font-weight:400">%</span></div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px" id="gs-result-fob-sub">— g CO₂eq/MJ · ref 94</div>
          <div id="gs-badge-fob" style="margin-top:10px"></div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:18px 20px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#2563eb;border-radius:8px 8px 0 0"></div>
          <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#6b7280;margin-bottom:8px">GHG Saving</div>
          <div style="font-size:36px;font-weight:700;color:#2563eb;line-height:1" id="gs-result-discharge-big">—<span style="font-size:18px;font-weight:400">%</span></div>
          <div style="font-size:11px;color:#6b7280;margin-top:6px" id="gs-result-discharge-sub">— g CO₂eq/MJ · ref 94</div>
          <div id="gs-badge-discharge" style="margin-top:10px"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- FORMULA REFERENCE -->
  <div class="card">
    <div class="card-header">
      <div class="card-header-title">Formula Reference</div>
      <div class="card-header-sub">per Excel / ISCC Methodology</div>
    </div>
    <div class="card-body formula-wrap open">
      <div class="formula-grid">
        <div class="formula-box">
          <div class="formula-title">Calculation Steps</div>
          <div class="formula-line"><span class="formula-l">Each component (g CO₂eq/MJ)</span><span class="formula-r formula-mono">kg/dry-t ÷ 37, or enter g/MJ directly</span></div>
          <div class="formula-line"><span class="formula-l">TOTAL GHG FOB (g CO₂eq/MJ)</span><span class="formula-r formula-mono">Ep_Ref + Etd_Truck + Etd_Vessel + Ep_BD</span></div>
          <div class="formula-line"><span class="formula-l">GHG Saving FOB (%)</span><span class="formula-r formula-mono">(94 − GHG_MJ_FoB) ÷ 94 × 100</span></div>
          <div class="formula-line"><span class="formula-l">Vessel (g CO₂eq/MJ)</span><span class="formula-r formula-mono">kg/dry-t ÷ 37, or g/MJ direct</span></div>
          <div class="formula-line"><span class="formula-l">Total GHG (g CO₂eq/MJ)</span><span class="formula-r formula-mono">FoB + Vessel_MJ + Depot</span></div>
          <div class="formula-line"><span class="formula-l">GHG Saving (%)</span><span class="formula-r formula-mono">(94 − Total_GHG) ÷ 94 × 100</span></div>
          <div class="formula-hint">* LHV PME = 37 MJ/kg · 1 dry-ton = 37,000 MJ · Ref fossil = 94 g CO₂eq/MJ</div>
        </div>
        <div class="formula-box">
          <div class="formula-title">Threshold (ISCC EU)</div>
          <div class="formula-line"><span class="formula-l">≥ 65%</span><span class="formula-r" style="color:#059669">ISCC EU Pass ✓</span></div>
          <div class="formula-line"><span class="formula-l">≥ 50%</span><span class="formula-r" style="color:#d97706">Minimum Pass ✓</span></div>
          <div class="formula-line"><span class="formula-l">&lt; 50%</span><span class="formula-r" style="color:#dc2626">Below Threshold ✗</span></div>
          <div class="formula-hint">Depot &amp; Filling EF: JRC data g/MJ, recognized under EU 2022/996</div>
        </div>
      </div>
    </div>
  </div>

  <!-- JRC EU COUNTRY TABLE -->
  <div class="card">
    <div class="card-header">
      <div class="card-header-title">JRC Electricity EF Table — EU 2022/996</div>
      <div class="card-header-sub">Click row to apply</div>
    </div>
    <div style="overflow-x:auto">
      <table class="rtable" id="gs-eu-table">
        <thead>
          <tr>
            <th>Country</th>
            <th style="text-align:right">Electricity EF (t CO₂/MWh)</th>
            <th style="text-align:right">g CO₂/MJ</th>
            <th style="text-align:right">Depot + Filling (g CO₂/MJ)</th>
          </tr>
        </thead>
        <tbody id="gs-eu-tbody"></tbody>
      </table>
    </div>
  </div>

  </div>
</div><!-- /main savings -->

<!-- GHG SAVINGS EXPORT MODAL -->
<div class="modal-overlay" id="gs-export-modal" onclick="closeGHGSavingsExportModal(event)">
  <div class="modal-card">
    <div class="modal-title">Export — GHG Savings Biodiesel</div>
    <div class="modal-sub">Download a corporate report for GHG savings calculation.</div>
    <div style="margin-bottom:16px">
      <label class="modal-label">Select Saved Result</label>
      <select id="gs-export-record" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;font-family:inherit;font-size:12px;color:#111;outline:none;margin-bottom:10px;"></select>
      <label class="modal-label">Company / Project Name</label>
      <input type="text" id="gs-export-company" placeholder="e.g. PT KPN Mekar Nusantara" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;font-family:inherit;font-size:12px;color:#111;outline:none;margin-bottom:10px;">
      <label class="modal-label">Reporting Period</label>
      <input type="text" id="gs-export-period" placeholder="e.g. Q1 2025 / Jan–Mar 2025" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;font-family:inherit;font-size:12px;color:#111;outline:none;margin-bottom:10px;">
      <label class="modal-label">Prepared By</label>
      <input type="text" id="gs-export-preparer" placeholder="e.g. Sustainability Team" style="width:100%;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;font-family:inherit;font-size:12px;color:#111;outline:none;">
    </div>
    <div class="modal-actions" onclick="event.stopPropagation()">
      <button type="button" class="btn btn-outline" onclick="closeGHGSavingsExportModal()">Cancel</button>
      <button type="button" class="btn btn-outline" onclick="ghgSavingsExportExcel()" style="border-color:#0070c0;color:#0070c0">&#8595; Excel</button>
      <button type="button" class="btn btn-red" onclick="ghgSavingsExportPDF()">&#8595; PDF</button>
    </div>
  </div>
</div>

</div><!-- /ghg-savings-wrap -->`;
