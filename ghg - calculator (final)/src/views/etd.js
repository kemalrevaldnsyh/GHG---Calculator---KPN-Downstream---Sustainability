/** View: etd — auto-generated from etd.html */
import { headerHubPortalLink } from '../app/hub-portal.js';

export const etdView = `<div class="page" id="etd-app-wrap">
  <div class="header">
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn btn-outline header-back" onclick="goToOverview()">←</button>
      <div>
        <div class="header-title" id="etd-header-title">ETD — RPOME</div>
        <div class="header-sub" id="etd-header-sub">Transportation &amp; processing (lokal)</div>
      </div>
    </div>
    ${headerHubPortalLink()}
  </div>
  <div class="etd-subtabs">
    <button class="etd-subtab active" id="etd-tab-calc" onclick="switchEtdSubTab('calc',this)">Calculator</button>
    <button class="etd-subtab" id="etd-tab-results" onclick="switchEtdSubTab('results',this)">Results</button>
  </div>
  <div id="etd-inner" class="etd-shell">
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
        <select id="destination" onchange="onEtdDestinationChange()">
          <option value="LBG">PMC Lubuk Gaung (LBG)</option>
          <option value="TJP">EUP Tanjung Pura (TJP)</option>
          <option value="BTG">EUP Bontang (BTG)</option>
          <option value="TPG">TPG Tanjung Langsat</option>
          <option value="GLM">GLM Port Klang</option>
        </select>
      </div>

      <div class="form-field">
        <label>Trucking Distance (km)</label>
        <input type="text" id="dist_truck" placeholder="e.g. 839" inputmode="decimal" oninput="updateModeHint()"/>
      </div>
      
      <div class="form-field">
        <label>Vessel Distance 1 (km)</label>
        <input type="text" id="dist_vessel" placeholder="Excel TPG: 13273.28 atau 13273,28" inputmode="decimal" oninput="updateModeHint()"/>
      </div>

      <div class="form-field full">
        <label>Vessel Distance 2 — Bulking (km) <span style="font-weight:400;color:var(--text3)">Fill in if there is a 2-leg vessel route</span></label>
        <input type="text" id="dist_vessel2" placeholder="Optional — e.g. 5000" inputmode="decimal" oninput="updateModeHint()"/>
      </div>
    </div>

    <div id="mode-hint" class="mode-hint" style="display:none"></div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" class="btn-calculate" onclick="etdCalculate()">Calculate Emmision</button>
      <button type="button" class="btn-calculate btn-calculate-save" onclick="saveETDToSheet()">Save ETD</button>
      <button type="button" class="btn-calculate etd-btn-reset" onclick="etdResetForm()">Reset</button>
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
          <th>Component</th>
          <th></th>
          <th>Value</th>
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
        <div style="text-align:center;padding:48px 0;color:#d1d5db;font-size:13px">No data yet — use Traceability Export Shipment to send results here.</div>
      </div>
    </div>
  </div><!-- end etd-sub-results -->

    </div><!-- end container -->
  </div><!-- end etd-inner -->

  <div class="modal-overlay" id="factorModal">
  <div class="modal-box modal-box-wide">
    <div class="modal-title">Edit Emission Factors — <span id="modal-dest-label"></span></div>
    <p class="modal-sub">Disimpan ke Google Sheets (tab <strong>ETD Factors</strong>) per site. Klik Save lalu Calculate ulang.</p>
    <div class="modal-scroll">
      <div class="modal-field-grid">
        <div class="modal-field"><label>η truck</label><input type="number" id="modal-h-truck" step="0.00001" min="0"/></div>
        <div class="modal-field"><label>η vessel</label><input type="number" id="modal-h-vessel" step="0.00001" min="0"/></div>
        <div class="modal-field"><label>η vessel Export (TPG biodiesel)</label><input type="number" id="modal-h-vessel-export" step="0.00001" min="0"/></div>
        <div class="modal-field"><label>EF_B10</label><input type="text" id="modal-ef-b10" inputmode="decimal"/></div>
        <div class="modal-field"><label>EF_B40</label><input type="text" id="modal-ef-b40" inputmode="decimal"/></div>
        <div class="modal-field"><label>EF_HFO</label><input type="text" id="modal-ef-hfo" inputmode="decimal"/></div>
        <div class="modal-field"><label>Mm/Md RPOME</label><input type="text" id="modal-mm-pome" inputmode="decimal"/></div>
        <div class="modal-field"><label>Mm/Md Biodiesel</label><input type="text" id="modal-mm-biodiesel" inputmode="decimal"/></div>
        <div class="modal-field"><label>FF Biodiesel</label><input type="text" id="modal-ff-biodiesel" inputmode="decimal"/></div>
        <div class="modal-field"><label>AF Biodiesel</label><input type="text" id="modal-af-biodiesel" inputmode="decimal"/></div>
        <div class="modal-field"><label>FF (<span id="modal-dest-code"></span>)</label><input type="text" id="modal-ff-input" inputmode="decimal"/></div>
        <div class="modal-field"><label>AF (<span id="modal-dest-code2"></span>)</label><input type="text" id="modal-af-input" inputmode="decimal"/></div>
      </div>
    </div>
    <div class="modal-buttons">
      <button type="button" class="modal-btn cancel" onclick="resetEtdSiteFactors()">Reset default</button>
      <button type="button" class="modal-btn cancel" onclick="closeFactorModal()">Cancel</button>
      <button type="button" class="modal-btn save" onclick="saveFactors()">Save</button>
    </div>
  </div>
   </div>
</div>`;
