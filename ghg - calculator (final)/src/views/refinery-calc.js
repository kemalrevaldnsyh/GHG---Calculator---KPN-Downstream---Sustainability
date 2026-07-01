/** View: refinery-calc — auto-generated from refinery-calc.html */
export const refineryCalcView = `<div class="page" id="calc-app-wrap">

<div class="header">
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
    <button type="button" class="btn btn-outline header-back" id="btn-back-overview" onclick="goToOverview()" style="display:none">←</button>
    <div>
      <div class="header-title" id="header-main-title">GHG Calculator — Refinery POME</div>
      <div class="header-sub" id="header-main-sub">Ep Processing · ISCC/INS</div>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="resetForm()">Reset</button>
    <button class="btn btn-dark" id="btn-save" onclick="saveToSheet()">Save Calculation</button>
  </div>
</div>

<div class="tabs" id="calc-main-tabs">
  <button class="tab active" onclick="switchTab('input',this)">Processing</button>
  <button class="tab" id="tab-etd" style="display:none" onclick="switchTab('etd',this)">ETD</button>
  <button class="tab" onclick="switchTab('result',this)">Results</button>
  <button class="tab" onclick="switchTab('history',this)">History</button>
</div>

<div class="main">

  <div class="page active" id="page-input">
    <div class="period-bar">
      <label>Year</label>
      <input type="number" id="sel-year" value="2024" min="2020" max="2035" style="width:80px">
      <label style="margin-left:8px">Site</label>
      <input type="text" id="sel-site" placeholder="e.g. Mempawah" style="width:200px">
    </div>

    <div class="gcols">
      <div>
        <div class="section-title" style="margin-top:0">Emission Sources</div>
        <div class="adder-bar">
          <select id="item-select">
            <option value="" disabled selected>Select an emission source…</option>
          </select>
          <button class="btn btn-dark btn-sm" id="btn-add-item" onclick="addItem()" style="white-space:nowrap">+ Add Item</button>
          <button class="btn btn-outline btn-sm" id="btn-manual-select" onclick="toggleManualSelectMode()" style="white-space:nowrap">Manual Select</button>
        </div>
        <div class="factors-quick-row">
          <button class="btn-ghost-subtle" id="btn-toggle-factors" onclick="toggleFactorPanel()">Manage factors</button>
        </div>
        <div class="card factor-panel" id="factor-panel">
          <div class="card-header">
            <div class="card-header-title">EF & Reference Master</div>
            <div class="card-header-sub">Shared for all users</div>
          </div>
          <div class="card-body">
            <div class="factor-grid-wrap">
              <table class="factor-table">
                <thead>
                  <tr><th style="width:170px">Source</th><th style="width:100px">EF</th><th>Reference</th></tr>
                </thead>
                <tbody id="factor-tbody"></tbody>
              </table>
            </div>
            <div class="factor-actions">
              <button class="btn btn-outline btn-sm" onclick="reloadMasterFactors()">Reload</button>
              <button class="btn btn-dark btn-sm" id="btn-save-factors" onclick="saveMasterFactors()">Save factors</button>
            </div>
          </div>
        </div>

        <div class="items-container" id="items-container">
          <div class="items-empty" id="items-empty">
            <strong>Loading emission sources…</strong>
            Please wait.
          </div>
        </div>

        <div style="display:none" aria-hidden="true">
          <input type="number" id="r-coal"     value="0">
          <input type="number" id="r-biosolar" value="0">
          <input type="number" id="r-lng"      value="0">
          <input type="number" id="r-na2co3"   value="0">
          <input type="number" id="r-na2so3"   value="0">
          <input type="number" id="r-pac"      value="0">
          <input type="number" id="r-naoh"     value="0">
          <input type="number" id="r-cyclohex" value="0">
          <input type="number" id="r-nhex"     value="0">
          <input type="number" id="r-ipa"      value="0">
          <input type="number" id="r-hcl"      value="0">
          <input type="number" id="r-be"       value="0">
          <input type="number" id="r-h3po4"    value="0">
          <input type="number" id="r-elec"     value="0">
          <input type="number" id="r-solar"    value="0">
          <input type="number" id="r-water"    value="0">
          <input type="number" id="r-methanol" value="0">
          <input type="number" id="r-sodium_methylate" value="0">
          <input type="number" id="r-citric_acid" value="0">
        </div>
      </div>

      <div>
        <div class="section-title">AF & FF — Allocation Factors</div>
        <div class="card">
          <div class="card-header" id="af-pome-block"><div class="card-header-title" id="lbl-af-feedstock">POME</div><div class="card-header-sub" id="lbl-af-feedstock-sub">Input material</div></div>
          <div class="card-body" id="af-pome-body"><div class="grid g3">
            <div class="field"><label>Value (MT)</label><div class="input-wrap"><input type="number" id="af-pome-val" placeholder="0" oninput="calculateAF()"><span class="input-unit">MT</span></div></div>
            <div class="field"><label>Moisture (%)</label><div class="input-wrap"><input type="number" id="af-pome-mc" value="1.1" oninput="calculateAF()"><span class="input-unit">%</span></div></div>
            <div class="field"><label>Processed (dry)</label><div class="input-wrap"><input type="text" id="af-pome-dry" class="ro" readonly><span class="input-unit">MT</span></div></div>
          </div></div>

          <div class="card-header"><div class="card-header-title" id="lbl-af-stream1">RPOME</div><div class="card-header-sub" id="lbl-af-stream1-lhv">LHV 37 MJ/kg</div></div>
          <div class="card-body"><div class="grid g3">
            <div class="field"><label>Produced (MT)</label><div class="input-wrap"><input type="number" id="af-rpome-val" placeholder="0" oninput="calculateAF()"><span class="input-unit">MT</span></div></div>
            <div class="field"><label>Moisture (%)</label><div class="input-wrap"><input type="number" id="af-rpome-mc" value="0.05" oninput="calculateAF()"><span class="input-unit">%</span></div></div>
            <div class="field"><label>Produced (dry)</label><div class="input-wrap"><input type="text" id="af-rpome-dry" class="ro" readonly><span class="input-unit">MT</span></div></div>
            <div class="field"><label>Extraction Rate</label><div class="input-wrap"><input type="text" id="af-rpome-er" class="ro" readonly><span class="input-unit">%</span></div></div>
            <div class="field"><label>AF</label><div class="input-wrap"><input type="text" id="af-rpome-af" class="ro" readonly><span class="input-unit">—</span></div></div>
            <div class="field"><label>FF</label><div class="input-wrap"><input type="text" id="af-rpome-ff" class="ro" readonly><span class="input-unit">—</span></div></div>
          </div></div>

          <div class="card-header" id="af-stream2-block"><div class="card-header-title" id="lbl-af-stream2">POME FAD</div><div class="card-header-sub" id="lbl-af-stream2-lhv">LHV 37 MJ/kg</div></div>
          <div class="card-body" id="af-stream2-body"><div class="grid g3">
            <div class="field"><label>Produced (MT)</label><div class="input-wrap"><input type="number" id="af-fad-val" placeholder="0" oninput="calculateAF()"><span class="input-unit">MT</span></div></div>
            <div class="field"><label>Moisture (%)</label><div class="input-wrap"><input type="number" id="af-fad-mc" value="0.33" oninput="calculateAF()"><span class="input-unit">%</span></div></div>
            <div class="field"><label>Produced (dry)</label><div class="input-wrap"><input type="text" id="af-fad-dry" class="ro" readonly><span class="input-unit">MT</span></div></div>
            <div class="field"><label>Extraction Rate</label><div class="input-wrap"><input type="text" id="af-fad-er" class="ro" readonly><span class="input-unit">%</span></div></div>
            <div class="field"><label>AF</label><div class="input-wrap"><input type="text" id="af-fad-af" class="ro" readonly><span class="input-unit">—</span></div></div>
            <div class="field"><label>FF</label><div class="input-wrap"><input type="text" id="af-fad-ff" class="ro" readonly><span class="input-unit">—</span></div></div>
          </div></div>
        </div>

        <div class="section-title">Live Result</div>
        <div class="card"><div class="card-body">
          <div class="calc-row" id="row-p-ggl-fuel" style="display:none"><span class="cr-label">A. Bio Solar</span><span class="cr-val" id="p-ggl-fuel">—</span></div>
          <div class="calc-row" id="row-p-fuel"><span class="cr-label">A. Fuel</span><span class="cr-val" id="p-fuel">—</span></div>
          <div class="calc-row" id="row-p-chem"><span class="cr-label">B. Chemical</span><span class="cr-val" id="p-chem">—</span></div>
          <div class="calc-row" id="row-p-elec"><span class="cr-label" id="lbl-p-elec">C. Electricity</span><span class="cr-val" id="p-elec">—</span></div>
          <div class="calc-row" id="row-p-solar" style="display:none"><span class="cr-label">D. Solar</span><span class="cr-val" id="p-solar">—</span></div>
          <div class="calc-row" id="row-p-water"><span class="cr-label">D. Water</span><span class="cr-val" id="p-water">—</span></div>
          <hr>
          <div class="calc-row">
            <span class="cr-label" style="font-weight:600;color:#111">Sum of Process Emissions</span>
            <span class="cr-val c-blue" id="p-total" style="font-size:14px;font-weight:600">—</span>
          </div>
          <hr>
          <div class="calc-row"><span class="cr-label" id="lbl-p-ep1">Ep / dry-ton RPOME</span><span class="cr-val c-green" id="p-ep-rpome">—</span></div>
          <div class="calc-row" id="col-p-ep2"><span class="cr-label" id="lbl-p-ep2">Ep / dry-ton POME FAD</span><span class="cr-val c-purple" id="p-ep-fad">—</span></div>
          <div class="calc-row" id="col-p-epa1"><span class="cr-label" id="lbl-p-epa1">Ep Allocated RPOME</span><span class="cr-val c-green" id="p-ep-rpome-alloc">—</span></div>
          <div class="calc-row" id="col-p-epa2"><span class="cr-label" id="lbl-p-epa2">Ep Allocated POME FAD</span><span class="cr-val c-purple" id="p-ep-fad-alloc">—</span></div>
          <div class="calc-row" id="row-ep-mj" style="display:none"><span class="cr-label">Ep (allocated) — g CO₂eq/MJ PME</span><span class="cr-val c-amber" id="p-ep-mj">—</span></div>
        </div></div>
      </div>
    </div>
  </div>

  <div class="page" id="page-etd">
    <div id="ggl-etd-inner" class="etd-shell">
      <div class="container">

        <div class="etd-block-header">
          <h1 id="ggl-etd-block-title">GHG Emission Calculator — GGL</h1>
          <p id="ggl-etd-block-sub">Transportation &amp; Processing Emissions · Cangkang</p>
          <div class="badge" id="ggl-etd-block-badge">GGL</div>
        </div>

        <div class="card">
          <div class="card-title">Input Data</div>
          <div class="form-row">
            <div class="form-field">
              <label>Period</label>
              <input type="text" id="ggl-etd-period" placeholder="e.g. 2026"/>
            </div>
            <div class="form-field full">
              <label>Supplier Name</label>
              <input type="text" id="ggl-supplier" placeholder="Type Supplier Name"/>
            </div>
            <div class="form-field full">
              <label>Destination</label>
              <select id="ggl-destination"></select>
            </div>
            <div class="form-field">
              <label>Trucking Distance (km)</label>
              <input type="number" id="ggl-dist-truck" placeholder="Insert Trucking Distance" step="0.01" min="0" oninput="updateModeHint()"/>
            </div>
            <div class="form-field">
              <label>Vessel Distance 1 (km)</label>
              <input type="number" id="ggl-dist-vessel" placeholder="Insert Vessel Distance 1" step="0.01" min="0" oninput="updateModeHint()"/>
            </div>
            <div class="form-field full">
              <label>Vessel Distance 2 — Bulking (km) <span style="font-weight:400;color:var(--text3)">Fill in if there is a 2-leg vessel route</span></label>
              <input type="number" id="ggl-dist-vessel2" placeholder="Insert Vessel Distance 2 (Optional)" step="0.01" min="0" oninput="updateModeHint()"/>
            </div>
          </div>
          <div id="ggl-mode-hint" class="mode-hint" style="display:none"></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="btn-calculate" onclick="etdCalculate()">Calculate Emmision</button>
            <button type="button" class="btn-calculate" style="background:#111827" onclick="saveETDToSheet()">Save ETD</button>
            <button type="button" class="btn-calculate etd-btn-reset" onclick="etdResetForm()">Reset</button>
          </div>
        </div>

        <div id="ggl-etd-results" class="card">
          <div class="result-header">
            <div class="result-supplier" id="ggl-r-supplier">—</div>
            <div class="result-meta" id="ggl-r-meta">—</div>
          </div>
          <div class="summary-grid" id="ggl-r-summary"></div>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Component</th>
                <th></th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody id="ggl-r-tbody"></tbody>
          </table>
          <div class="fob-grid" id="ggl-r-fob"></div>
          <div class="factors-grid" id="ggl-r-factors"></div>
        </div>

      </div>
    </div>
  </div>

  <div class="page" id="page-result">

    <div class="summary-grid summary-grid-5" id="summary-grid-main">
      <div class="rs-card"><div class="rs-label">Total Ep</div><div class="rs-value c-blue" id="res-total">—</div><div class="rs-unit">kg COeq</div></div>
      <div class="rs-card"><div class="rs-label" id="lbl-res-ep1">Ep / dry-ton RPOME</div><div class="rs-value c-green" id="res-rpome">—</div><div class="rs-unit">kg COeq / dry-ton</div></div>
      <div class="rs-card" id="card-res-ep2"><div class="rs-label" id="lbl-res-ep2">Ep / dry-ton FAD</div><div class="rs-value c-purple" id="res-fad">—</div><div class="rs-unit">kg COeq / dry-ton</div></div>
      <div class="rs-card" id="card-res-alloc"><div class="rs-label" id="lbl-res-alloc">Ep Allocated RPOME</div><div class="rs-value c-amber" id="res-alloc">—</div><div class="rs-unit">kg COeq / dry-ton</div></div>
      <div class="rs-card" id="card-res-epmj" style="display:none"><div class="rs-label">Ep (g CO₂eq/MJ PME)</div><div class="rs-value c-amber" id="res-epmj">—</div><div class="rs-unit">g CO₂eq / MJ</div></div>
    </div>

    <div class="result-toolbar">
      <div class="tb-left">
        <label>Site</label>
        <select id="result-site-filter" onchange="applyResultFilter()">
          <option value="all">All Sites (current input)</option>
        </select>
        <span id="result-filter-badge" style="font-size:10px;color:#6b7280;display:none"></span>
      </div>
      <div class="tb-right">
        <button class="btn btn-outline btn-sm" id="btn-toggle-formulas" onclick="toggleFormulas()">Show formulas</button>
        <button class="btn btn-xls-r btn-sm ttp-btn-export-xlsx" id="btn-export-ttp-xlsx">&#8595; Export Excel</button>
        <button class="btn btn-pdf btn-sm" id="btn-export-pdf">&#8595; Export PDF</button>
      </div>
    </div>

    <div class="card formula-card">
      <div class="card-header">
        <div class="card-header-title">Calculation steps</div>
        <div class="card-header-sub">+ </div>
      </div>
      <div class="card-body formula-wrap" id="formula-wrap">
        <div class="formula-grid">
          <div class="formula-box">
            <div class="formula-title">Main formulas</div>
            <div id="formula-main"></div>
            <div class="formula-hint" id="formula-note"></div>
          </div>
          <div class="formula-box">
            <div class="formula-title">Per item (value × EF)</div>
            <div id="formula-items"></div>
            <div class="formula-hint">Note: item list follows items you add on the Processing tab.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-header-title">Ep Processing Detail</div>
        <div class="card-header-sub" id="result-site-label"></div>
      </div>
      <div style="overflow-x:auto">
        <table class="rtable" id="table-ghg-results">
          <thead>
            <tr id="ghg-thead-row">
              <th style="width:180px;background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">Description</th>
              <th style="background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">Value</th>
              <th style="background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">Emission Factor</th>
              <th style="background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">UoM</th>
              <th style="background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">Result (kg CO&#x2082;eq)</th>
              <th style="background:#0070c0;color:#fff;font-weight:700;border:1px solid #000">Reference</th>
            </tr>
          </thead>
          <tbody id="result-tbody"><tr><td colspan="6" class="empty">No data — fill input form first</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="pdf-print-area"></div>

  <div class="page" id="page-history">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:12px;color:#6b7280" id="history-count">0 saved calculations</div>
      <div style="display:flex;align-items:center;gap:8px">
        <select id="history-filter" class="btn btn-outline" style="min-width:150px;font-size:12px;padding:5px 10px;cursor:pointer" onchange="renderHistory()">
          <option value="all">All Sites</option>
        </select>
        <button class="btn btn-outline btn-sm" onclick="openExportModal()">&#8595; Export Excel</button>
        <button class="btn btn-outline btn-sm" onclick="clearHistory()">Clear All</button>
      </div>
    </div>
    <div class="card">
      <div style="overflow-x:auto">
        <table class="htable">
          <thead><tr><th>Year</th><th>Type</th><th>Site</th><th>Total Ep</th><th>Ep P1</th><th>Ep P2</th><th>Alloc P1</th><th>Alloc P2</th><th>Ep MJ</th><th>Saved</th><th></th></tr></thead>
          <tbody id="history-tbody"><tr><td colspan="11" class="empty">No saved calculations yet</td></tr></tbody>
        </table>
      </div>
    </div>
  </div>

</div>
</div>
<div class="modal-overlay" id="export-modal" onclick="closeExportModal(event)">
  <div class="modal-card">
    <div class="modal-title">Export to Excel</div>
    <div class="modal-sub">Select a site and download a styled .xlsx report.</div>
    <label class="modal-label" for="modal-export-site">Filter by Site</label>
    <select id="modal-export-site" class="modal-select"></select>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeExportModal()">Cancel</button>
      <button class="btn btn-red" onclick="triggerExcelDownload()">&#8595; Download XLSX</button>
    </div>
  </div>
</div>`;
