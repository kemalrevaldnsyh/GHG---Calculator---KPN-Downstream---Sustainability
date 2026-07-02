/** View: raw-data */
import { headerHubPortalLink } from '../app/hub-portal.js';

export const rawDataView = `<div id="raw-data-wrap">

<div class="header">
  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px">
    <button type="button" class="btn btn-outline header-back" onclick="goToOverview()">←</button>
    <div>
      <div class="header-title">Raw Data</div>
      <div class="header-sub">CPO Calculation Input · Monthly Data Perhitungan · Multi-Site EUP</div>
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    ${headerHubPortalLink()}
    <button type="button" class="btn btn-outline btn-sm" onclick="rdSaveToSheets()">↑ Save</button>
    <button type="button" class="btn btn-sm btn-trc-excel" onclick="rdExportExcel()">↓ Excel</button>
  </div>
</div>

<div class="rd-page">

  <div class="rd-toolbar trc-section">
    <div class="rd-toolbar-grid">
      <div class="trc-field">
        <label>Site / EUP</label>
        <input type="text" id="rd-site" list="rd-site-list" placeholder="EUP Bontang" oninput="rdOnSiteChange()">
        <datalist id="rd-site-list"></datalist>
      </div>
      <div class="trc-field">
        <label>Period Start</label>
        <input type="month" id="rd-period-start" onchange="rdOnPeriodChange()">
      </div>
      <div class="trc-field">
        <label>Months</label>
        <input type="number" id="rd-month-count" min="1" max="36" step="1" value="12" onchange="rdOnPeriodChange()" oninput="rdOnPeriodChange()">
      </div>
      <div class="trc-field">
        <label>Load sebelumnya</label>
        <select id="rd-recent" onchange="rdLoadRecent(this.value)">
          <option value="">— Pilih data tersimpan —</option>
        </select>
      </div>
      <div class="trc-field rd-toolbar-actions">
        <label>&nbsp;</label>
        <div class="rd-btn-row">
          <button type="button" class="btn btn-dark btn-sm" onclick="rdLoadRecord()">Load</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="rdResetBlank()">Blank</button>
        </div>
      </div>
    </div>
    <div class="rd-toolbar-meta">
      <strong id="rd-sheet-site">—</strong>
      <span id="rd-sheet-period"></span>
      <span class="rd-meta-sep">·</span>
      <span id="rd-meta-updated"></span>
      <span class="rd-meta-sep">·</span>
      <span id="rd-status" class="rd-status-inline">Auto-save aktif di browser ini.</span>
    </div>
  </div>

  <div class="rd-table-shell trc-section">
    <div class="rd-table-toolbar">
      <div class="rd-filter-chips" id="rd-category-chips"></div>
    </div>
    <div class="rd-table-scroll" id="rd-table-scroll">
      <table class="rd-table" id="rd-data-table">
        <thead id="rd-table-head"></thead>
        <tbody id="rd-table-body"></tbody>
      </table>
    </div>
  </div>

</div>
</div><!-- end raw-data-wrap -->`;
