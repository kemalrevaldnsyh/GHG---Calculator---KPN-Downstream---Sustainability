/** View: etd — auto-generated from etd.html */
export const etdView = `<div class="page" id="etd-app-wrap">
  <div class="header">
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn btn-outline header-back" onclick="goToOverview()">←</button>
      <div>
        <div class="header-title" id="etd-header-title">ETD — RPOME</div>
        <div class="header-sub" id="etd-header-sub">Transportation &amp; processing (lokal)</div>
      </div>
    </div>
  </div>
  <div class="etd-subtabs">
    <button class="etd-subtab active" id="etd-tab-calc" onclick="switchEtdSubTab('calc',this)">Calculator</button>
    <button class="etd-subtab" id="etd-tab-results" onclick="switchEtdSubTab('results',this)">Results</button>
  </div>
  <div id="etd-inner">
    <div class="container">

  <!-- ── Sub-page: Calculator ── -->
  <div class="etd-subpage active" id="etd-sub-calc">

  <div class="etd-block-header">
    <h1 id="etd-block-title">GHG Emission Calculator</h1>
    <p id="etd-block-sub">Transportation &amp; Processing Emissions</p>
    <div class="badge" id="etd-block-badge">Precision Formula Based</div>
  </div>

  <div class="card">
    <div class="card-title">Input Data</div>
    
    <div class="form-row">
      <div class="form-field">
        <label>Period</label>
        <input type="text" id="etd-period" placeholder="e.g. 2026"/>
      </div>
      <div class="form-field full">
        <label>Supplier Name</label>
        <input type="text" id="supplier" placeholder="Type Supplier Name"/>
      </div>
      
      <div class="form-field full">
        <label>Destination</label>
        <select id="destination">
          <option value="LBG">PMC Lubuk Gaung (LBG)</option>
          <option value="TJP">EUP Tanjung Pura (TJP)</option>
          <option value="BTG">EUP Bontang (BTG)</option>
          <option value="TPG">TPG Tanjung Langsat</option>
          <option value="GLM">GLM Port Klang</option>
        </select>
      </div>

      <div class="form-field">
        <label>Trucking Distance (km)</label>
        <input type="number" id="dist_truck" placeholder="Insert Trucking Distance" step="0.01" min="0" oninput="updateModeHint()"/>
      </div>
      
      <div class="form-field">
        <label>Vessel Distance 1 (km)</label>
        <input type="number" id="dist_vessel" placeholder="Insert Vessel Distance 1" step="0.01" min="0" oninput="updateModeHint()"/>
      </div>

      <div class="form-field full">
        <label>Vessel Distance 2 — Bulking (km) <span style="font-weight:400;color:var(--text3)">Isi jika ada 2 leg vessel</span></label>
        <input type="number" id="dist_vessel2" placeholder="Insert Vessel Distance 2 (Optional)" step="0.01" min="0" oninput="updateModeHint()"/>
      </div>
    </div>

    <div id="mode-hint" class="mode-hint" style="display:none"></div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-calculate" onclick="etdCalculate()">Calculate Emmision</button>
      <button class="btn-calculate" style="background:#111827" onclick="saveETDToSheet()">Save ETD</button>
    </div>
  </div>

  <div id="results" class="card">
    <div class="result-header">
      <div class="result-supplier" id="r-supplier">—</div>
      <div class="result-meta" id="r-meta">—</div>
    </div>

    <div class="summary-grid" id="r-summary"></div>

    <table class="breakdown-table">
      <thead>
        <tr>
          <th>Komponen</th>
          <th></th>
          <th>Nilai</th>
        </tr>
      </thead>
      <tbody id="r-tbody"></tbody>
    </table>

    <div class="fob-grid" id="r-fob"></div>

    <div class="factors-grid" id="r-factors"></div>
  </div>

  </div><!-- end etd-sub-calc -->

  <!-- ── Sub-page: Results (dari Traceability) ── -->
  <div class="etd-subpage" id="etd-sub-results">
    <div id="etd-results-page">
      <div class="etd-results-toolbar">
        <div style="font-size:13px;font-weight:600;color:#111">ETD Results — Converted Product</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <select id="etd-export-select" style="min-width:240px;background:#f8fafc;border:1px solid #dbe3ef;border-radius:6px;padding:6px 8px;font-size:12px;color:#0f172a">
            <option value="all">All ETD Results (valid only)</option>
          </select>
          <button class="btn btn-sm btn-trc-excel" onclick="exportEtdResultsExcel()">↓ Export Excel</button>
          <button class="btn btn-sm btn-trc-pdf" onclick="exportEtdResultsPdf()">↓ Export PDF</button>
        </div>
      </div>
      <div id="etd-results-list">
        <div style="text-align:center;padding:48px 0;color:#d1d5db;font-size:13px">Belum ada data — gunakan menu Traceability Export Shipment untuk mengirim hasil ke sini.</div>
      </div>
    </div>
  </div><!-- end etd-sub-results -->

    </div><!-- end container -->
  </div><!-- end etd-inner -->

  <div class="modal-overlay" id="factorModal">
  <div class="modal-box">
    <div class="modal-title">Edit Emission Factors</div>
    <div class="modal-field">
      <label>Allocation Factor (AF) - <span id="modal-dest-label"></span></label>
      <input type="number" id="modal-af-input" step="0.00001" min="0" max="1"/>
    </div>
    <div class="modal-field">
      <label>Fossil Factor (FF) - <span id="modal-dest-label2"></span></label>
      <input type="number" id="modal-ff-input" step="0.00001" min="0"/>
    </div>
    <div class="modal-buttons">
      <button class="modal-btn cancel" onclick="closeFactorModal()">Cancel</button>
      <button class="modal-btn save" onclick="saveFactors()">Save</button>
    </div>
  </div>
   </div>
</div>`;
