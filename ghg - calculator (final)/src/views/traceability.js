/** View: traceability — auto-generated from traceability.html */
export const traceabilityView = `<div id="traceability-wrap">

<div class="header">
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
    <button type="button" class="btn btn-outline header-back" onclick="goToOverview()">←</button>
    <div>
      <div class="header-title">Traceability Export Shipment ISCC/INS</div>
      <div class="header-sub">Supplier Selection · BL Data · Distance Auto-Select · Save to ETD</div>
    </div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-sm btn-trc-pdf" onclick="exportTrcPdf()">↓ Export PDF</button>
    <button class="btn btn-sm btn-trc-excel" onclick="exportTrcExcel()">↓ Export Excel</button>
  </div>
</div>

<div style="padding:20px 28px;max-width:1300px;margin:0 auto">

  <!-- 1. BL Header Data -->
  <div class="trc-section">
    <div class="trc-section-title">1. BL Header &amp; Shipment Info</div>
    <div class="trc-grid trc-g4">
      <div class="trc-field"><label>Vessel Name</label><input type="text" id="trc-vessel" placeholder="e.g. MV PACIFIC STAR"></div>
      <div class="trc-field"><label>BL Number</label><input type="text" id="trc-bl-number" placeholder="e.g. JKT-2026-001"></div>
      <div class="trc-field"><label>BL Date</label><input type="date" id="trc-bl-date"></div>
      <div class="trc-field"><label>Certification Type</label>
        <select id="trc-cert-type">
          <option value="ISCC">ISCC</option>
          <option value="INS">INS</option>
        </select>
      </div>
      <div class="trc-field"><label>Kode SD</label><input type="text" id="trc-kode-sd" placeholder="e.g. SD-001"></div>
      <div class="trc-field"><label>Loading Port</label><input type="text" id="trc-loading-port" placeholder="e.g. Port of Dumai"></div>
      <div class="trc-field" style="grid-column:span 2"><label>Shipment Destination</label>
        <select id="trc-shipment-dest">
          <option value="">— Select Destination —</option>
        </select>
      </div>
    </div>
  </div>

  <!-- 2. Supplier Selection -->
  <div class="trc-section">
    <div class="trc-section-title">2. Supplier Selection</div>
    <div class="trc-grid trc-g3" style="margin-bottom:12px">
      <div class="trc-field"><label>Filter Nama Supplier</label>
        <input type="text" id="trc-filter-supplier" oninput="trcFilterSuppliers()" placeholder="Ketik nama supplier...">
      </div>
      <div class="trc-field"><label>Filter Destination</label>
        <select id="trc-filter-dest" onchange="trcFilterSuppliers()">
          <option value="">— Semua Destination —</option>
        </select>
      </div>
      <div class="trc-field"><label>Filter Mode Transport</label>
        <select id="trc-filter-mode" onchange="trcFilterSuppliers()">
          <option value="">— Semua Mode —</option>
          <option value="Trucking">Trucking Only</option>
          <option value="Trucking+Vessel">Trucking + Vessel</option>
        </select>
      </div>
    </div>
    <div class="supplier-table-wrap">
      <table class="supplier-table" id="trc-supplier-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="trc-check-all" onchange="trcToggleAll(this)"></th>
            <th>Supplier Name</th>
            <th>Scope</th>
            <th>Origin</th>
            <th>Area</th>
            <th>Certificate</th>
            <th>Transport</th>
            <th>Destination</th>
            <th>Dist. Trucking (km)</th>
            <th>Dist. Vessel 1 (km)</th>
            <th>Dist. Vessel 2 (km)</th>
          </tr>
        </thead>
        <tbody id="trc-supplier-tbody"></tbody>
      </table>
      <div class="trc-table-footer">
        <button type="button" class="trc-input-supplier-btn" onclick="trcOpenInputSupplierModal()">+ Input supplier</button>
        <div class="trc-pagination-wrap">
          <span class="trc-pagination-info" id="trc-pagination-info"></span>
          <div class="trc-pagination" id="trc-pagination" aria-label="Pagination supplier"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 3. Plan Refinery & Allocation Factors -->
  <div class="trc-section">
    <div class="trc-section-title">3. Plan Refinery Tujuan (Allocation &amp; Feed Factor)</div>
    <div class="trc-grid trc-g4">
      <div class="trc-field"><label>Plan Refinery</label>
        <select id="trc-refinery" onchange="trcOnRefineryChange()">
          <option value="">— Pilih Refinery —</option>
          <option value="LBG">PMC Lubuk Gaung (LBG)</option>
          <option value="TJP">EUP Tanjung Pura (TJP)</option>
          <option value="BTG">EUP Bontang (BTG)</option>
          <option value="TPG">TPG Tanjung Langsat</option>
          <option value="GLM">GLM Port Klang</option>
        </select>
      </div>
      <div class="trc-field"><label>Allocation Factor (AF)</label><input type="text" id="trc-af" class="readonly" readonly placeholder="—"></div>
      <div class="trc-field"><label>Feed Factor (FF)</label><input type="text" id="trc-ff" class="readonly" readonly placeholder="—"></div>
      <div class="trc-field"><label>Ep Refinery (kg CO₂e/dry-t)</label><input type="text" id="trc-ep-refinery" class="readonly" readonly placeholder="—"></div>
    </div>
  </div>

  <!-- 4. Auto Distance Selection -->
  <div class="trc-section">
    <div class="trc-section-title">4. Seleksi Jarak Otomatis</div>
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-trc-primary btn-sm" onclick="trcSelectFarthestTruck()">Cari Trucking Terjauh</button>
      <button class="btn btn-trc-primary btn-sm" onclick="trcSelectFarthestVessel()">Cari Trucking+Vessel Terjauh</button>
      <button class="btn btn-sm btn-outline" onclick="trcClearSelection()">Reset Pilihan</button>
    </div>
    <div class="dist-summary-grid" id="trc-dist-summary">
      <div class="dist-card">
        <div class="dist-card-label">Jarak Trucking Terpilih</div>
        <div class="dist-card-val" id="trc-sel-truck-dist">—</div>
        <div class="dist-card-sub" id="trc-sel-truck-supplier">Belum dipilih</div>
      </div>
      <div class="dist-card">
        <div class="dist-card-label">Jarak Vessel 1 Terpilih</div>
        <div class="dist-card-val" id="trc-sel-vessel1-dist">—</div>
        <div class="dist-card-sub" id="trc-sel-vessel1-supplier">Belum dipilih</div>
      </div>
      <div class="dist-card">
        <div class="dist-card-label">Jarak Vessel 2 Terpilih</div>
        <div class="dist-card-val" id="trc-sel-vessel2-dist">—</div>
        <div class="dist-card-sub" id="trc-sel-vessel2-supplier">Belum dipilih</div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="trc-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
        <div class="trc-field"><label>Supplier Terpilih</label><input type="text" id="trc-selected-supplier" class="auto-selected" readonly placeholder="—"></div>
        <div class="trc-field"><label>Trucking (km)</label><input type="text" id="trc-final-truck" class="auto-selected" readonly placeholder="—"></div>
        <div class="trc-field"><label>Vessel 1 (km)</label><input type="text" id="trc-final-vessel1" class="auto-selected" readonly placeholder="—"></div>
        <div class="trc-field"><label>Vessel 2 (km)</label><input type="text" id="trc-final-vessel2" class="auto-selected" readonly placeholder="—"></div>
        <div class="trc-field"><label>Mode Transport</label><input type="text" id="trc-final-mode" class="auto-selected" readonly placeholder="—"></div>
      </div>
    </div>
    <div class="trc-action-bar">
      <button class="btn btn-trc-save" onclick="trcSaveToETD()">Save to ETD &amp; Hitung Otomatis</button>
      <span style="font-size:11px;color:#6b7280" id="trc-save-status"></span>
    </div>
  </div>

  <!-- 5. Result Summary -->
  <div class="trc-section" id="trc-result-section" style="display:none">
    <div class="trc-section-title">5. ETD Calculation Result</div>
    <div id="trc-result-meta" style="margin-bottom:14px"></div>
    <div id="trc-result-etd-clone"></div>
  </div>

</div><!-- end main padding -->

<div class="modal-overlay" id="trc-input-supplier-modal" onclick="trcInputSupplierModalBackdrop(event)">
  <div class="modal-card" onclick="event.stopPropagation()">
    <div class="modal-title">Input supplier</div>
    <div class="modal-sub">Data ditambahkan ke daftar lokal (sesi ini). Untuk menyimpan ke Google Sheets, gunakan sheet secara langsung atau hubungi admin.</div>
    <div class="trc-modal-grid">
      <div class="full">
        <label>Nama supplier</label>
        <input type="text" id="trc-in-name" placeholder="Wajib" autocomplete="off">
      </div>
      <div>
        <label>Scope</label>
        <input type="text" id="trc-in-scope" placeholder="e.g. PoO" autocomplete="off">
      </div>
      <div>
        <label>Origin</label>
        <input type="text" id="trc-in-origin" placeholder="Alamat / negara" autocomplete="off">
      </div>
      <div>
        <label>Area</label>
        <input type="text" id="trc-in-area" placeholder="mis. Pelalawan, RIAU" autocomplete="off">
      </div>
      <div>
        <label>Certificate</label>
        <input type="text" id="trc-in-cert" placeholder="e.g. ISCC + INS" autocomplete="off">
      </div>
      <div>
        <label>Transport</label>
        <select id="trc-in-transport">
          <option value="Trucking">Trucking</option>
          <option value="Trucking+Vessel">Trucking + Vessel</option>
        </select>
      </div>
      <div class="full">
        <label>Destination</label>
        <input type="text" id="trc-in-dest" placeholder="Sesuai kolom destination di sheet" autocomplete="off">
      </div>
      <div>
        <label>Distance Trucking (km)</label>
        <input type="number" id="trc-in-dist-truck" placeholder="0" step="any" min="0">
      </div>
      <div>
        <label>Distance Vessel 1 (km)</label>
        <input type="number" id="trc-in-dist-vessel1" placeholder="0" step="any" min="0">
      </div>
      <div>
        <label>Distance Vessel 2 (km)</label>
        <input type="number" id="trc-in-dist-vessel2" placeholder="0 (opsional)" step="any" min="0">
      </div>
    </div>
    <div class="modal-actions" style="margin-top:8px">
      <button type="button" class="btn btn-outline" onclick="trcCloseInputSupplierModal()">Batal</button>
      <button type="button" class="btn btn-trc-primary" style="border:none" onclick="trcSaveInputSupplier()">Simpan</button>
    </div>
  </div>
</div>

</div><!-- end traceability-wrap -->`;
