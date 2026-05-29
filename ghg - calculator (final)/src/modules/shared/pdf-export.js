/* Shared export guards — jsPDF (GHG Savings) + html2pdf (Refinery / ETD / Traceability) */
var ghgPdfExportLocks = { pdf: false, excel: false, savings: false };

function acquirePdfExportLock(key) {
  if (ghgPdfExportLocks[key]) return false;
  ghgPdfExportLocks[key] = true;
  return true;
}

function releasePdfExportLock(key) {
  ghgPdfExportLocks[key] = false;
}

function pdfExportIsBusy() {
  return !!ghgPdfExportLocks.pdf;
}

function excelExportIsBusy() {
  return !!ghgPdfExportLocks.excel;
}

function html2pdfIsReady() {
  return typeof html2pdf !== 'undefined';
}

/** Fonts + two paint frames before html2canvas (prevents blank first export). */
function exportWaitForPaint(delayMs) {
  var delay = typeof delayMs === 'number' ? delayMs : 80;
  var fontsReady;
  try {
    fontsReady = (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function')
      ? document.fonts.ready
      : Promise.resolve();
  } catch (e) {
    fontsReady = Promise.resolve();
  }
  return fontsReady.then(function() {
    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          setTimeout(resolve, delay);
        });
      });
    });
  }).catch(function() {
    return new Promise(function(resolve) {
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          setTimeout(resolve, delay);
        });
      });
    });
  });
}

/**
 * Single global mutex for all html2pdf exports (Refinery, ETD, Traceability).
 * GHG Savings uses jsPDF directly and keeps its own "savings" lock.
 */
function runLockedHtml2Pdf(taskFn, opts) {
  opts = opts || {};
  if (!html2pdfIsReady()) {
    return Promise.reject(new Error('html2pdf library not loaded'));
  }
  if (!acquirePdfExportLock('pdf')) {
    var busyMsg = opts.busyMessage || 'PDF export already in progress';
    if (typeof opts.onBusy === 'function') opts.onBusy(busyMsg);
    return Promise.reject(new Error(busyMsg));
  }
  var warmup = typeof opts.warmupMs === 'number' ? opts.warmupMs : 80;
  return exportWaitForPaint(warmup)
    .then(function() {
      var result = taskFn();
      if (result && typeof result.then === 'function') return result;
      return Promise.resolve(result);
    })
    .finally(function() { releasePdfExportLock('pdf'); });
}

/** Prevents double-click / overlapping Excel downloads. */
function runLockedExcel(fn, onBusy) {
  if (!acquirePdfExportLock('excel')) {
    if (typeof onBusy === 'function') onBusy('Excel export already in progress');
    return false;
  }
  try {
    fn();
    return true;
  } finally {
    releasePdfExportLock('excel');
  }
}

function pdfGetJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  if (typeof window.jsPDF === 'function') return window.jsPDF;
  return null;
}

function pdfApplyAutoTablePlugin(JsPDF) {
  if (!JsPDF) return false;
  try {
    if (typeof new JsPDF().autoTable === 'function') return true;
  } catch (e) {}

  if (window.jspdf && typeof window.jspdf.autoTable === 'function') {
    try {
      window.jspdf.autoTable(JsPDF);
    } catch (e2) {}
  }
  if (typeof window.applyPlugin === 'function') {
    try {
      window.applyPlugin(JsPDF);
    } catch (e3) {}
  }

  try {
    return typeof new JsPDF().autoTable === 'function';
  } catch (e4) {
    return false;
  }
}

function pdfHasLibraries() {
  var JsPDF = pdfGetJsPDF();
  if (!JsPDF) return false;
  return pdfApplyAutoTablePlugin(JsPDF);
}

function pdfEnsureLibraries() {
  var JsPDF = pdfGetJsPDF();
  if (!JsPDF) return null;
  return pdfApplyAutoTablePlugin(JsPDF) ? JsPDF : null;
}

function pdfWaitForLibraries(maxMs) {
  var timeout = typeof maxMs === 'number' ? maxMs : 10000;
  return new Promise(function(resolve, reject) {
    var started = Date.now();
    function tick() {
      var JsPDF = pdfEnsureLibraries();
      if (JsPDF) {
        resolve(JsPDF);
        return;
      }
      if (Date.now() - started >= timeout) {
        reject(new Error('PDF libraries not ready'));
        return;
      }
      window.setTimeout(tick, 50);
    }
    tick();
  });
}

var PDF_MARGIN = 14;
var PDF_BRAND = [178, 31, 36];
var PDF_BRAND_LIGHT = [253, 236, 236];
var PDF_TEAL = PDF_BRAND;
var PDF_HEAD = { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold' };
var PDF_BODY = { fontSize: 8, cellPadding: 2.8, valign: 'middle', overflow: 'linebreak' };
var PDF_ALT = { fillColor: [249, 250, 251] };

function pdfTableWidth(doc) {
  return doc.internal.pageSize.getWidth() - (PDF_MARGIN * 2);
}

function pdfColumnStyles(doc, ratios, perCol) {
  var total = pdfTableWidth(doc);
  var weightSum = ratios.reduce(function(sum, w) { return sum + w; }, 0);
  var styles = {};
  var used = 0;
  for (var i = 0; i < ratios.length; i++) {
    var width = i === ratios.length - 1
      ? Math.round((total - used) * 100) / 100
      : Math.round((total * ratios[i] / weightSum) * 100) / 100;
    used += width;
    styles[i] = Object.assign({ cellWidth: width }, (perCol && perCol[i]) || {});
  }
  return styles;
}

function pdfTableDefaults(overrides) {
  return Object.assign({
    styles: PDF_BODY,
    headStyles: PDF_HEAD,
    alternateRowStyles: PDF_ALT,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    theme: 'grid',
    tableLineColor: [203, 213, 225],
    tableLineWidth: 0.35,
  }, overrides || {});
}

function pdfSectionRow(label, colSpan) {
  return [{
    content: label,
    colSpan: colSpan || 5,
    styles: {
      fillColor: [226, 232, 240],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
  }];
}

function pdfWriteBanner(doc, opts) {
  var pageW = doc.internal.pageSize.getWidth();
  var title = opts.title || 'Report';
  var subtitle = opts.subtitle || '';
  var metaLines = opts.metaLines || [];

  doc.setFillColor.apply(doc, PDF_BRAND);
  doc.rect(0, 0, pageW, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('KPN SUSTAINABILITY · GHG CALCULATOR', PDF_MARGIN, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(String(title), PDF_MARGIN, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  metaLines.forEach(function(line, i) {
    doc.text(String(line), pageW - PDF_MARGIN, 8 + (i * 4.3), { align: 'right' });
  });

  var y = 32;
  if (subtitle) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(String(subtitle), PDF_MARGIN, y);
    y += 6;
  }
  doc.setTextColor(0, 0, 0);
  return y;
}

function pdfWriteSectionLabel(doc, text, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(String(text), PDF_MARGIN, y);
  doc.setTextColor(0, 0, 0);
  return y + 4;
}

function pdfWriteFooter(doc, leftText, rightText) {
  var pageH = doc.internal.pageSize.getHeight();
  var pageW = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(String(leftText || ''), PDF_MARGIN, pageH - 8);
  doc.text(String(rightText || ''), pageW - PDF_MARGIN, pageH - 8, { align: 'right' });
}

function pdfWriteHeader(doc, lines, startY) {
  var y = startY || PDF_MARGIN;
  var pageW = doc.internal.pageSize.getWidth();
  lines.forEach(function(block) {
    if (block.type === 'title') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(block.size || 16);
      doc.setTextColor(30, 41, 59);
      doc.text(String(block.text || ''), PDF_MARGIN, y);
      y += block.gap || 7;
    } else if (block.type === 'subtitle') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(block.size || 9);
      doc.setTextColor(100, 116, 139);
      doc.text(String(block.text || ''), PDF_MARGIN, y);
      y += block.gap || 5;
    } else if (block.type === 'right') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(block.size || 9);
      doc.setTextColor(71, 85, 105);
      var rightLines = String(block.text || '').split('\n');
      var ry = block.y != null ? block.y : PDF_MARGIN;
      rightLines.forEach(function(line, i) {
        doc.text(line, pageW - PDF_MARGIN, ry + (i * 4.5), { align: 'right' });
      });
    } else if (block.type === 'rule') {
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.4);
      doc.line(PDF_MARGIN, y, pageW - PDF_MARGIN, y);
      y += block.gap || 4;
    }
  });
  doc.setTextColor(0, 0, 0);
  return y;
}

function pdfSafeText(v) {
  return String(v == null ? '' : v)
    .replace(/\u2082/g, '2')
    .replace(/\u2082/g, '2');
}
