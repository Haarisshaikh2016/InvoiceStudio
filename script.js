// ==========================
// Invoice Studio main script
// ==========================

// NOTE (me): using the jsPDF UMD export from the CDN
const { jsPDF } = window.jspdf;

// NOTE (me): this state object is the single source of truth
// for everything that's going into the invoice.
const state = {
  title: '',
  number: '',
  date: '',
  fromEmail: '',
  toEmail: '',
  fromAddress: '',
  toAddress: '',
  fromPhone: '',
  toPhone: '',
  carMake: '',
  carModel: '',
  engineSize: '',
  registration: '',
  parts: [],
  labourCost: '',
  extras: []
};

let previewDiv;
let partsContainer;
let extraContainer;

// ==========================
// Theme toggle
// ==========================

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
    });
  }

  // If preview doesn't exist we are on the intro page so stop here.
  previewDiv = document.getElementById('preview');
  if (!previewDiv) return;

  // Cache key elements used in the builder.
  partsContainer = document.getElementById('partsContainer');
  extraContainer = document.getElementById('extraContainer');

  // Wire up buttons.
  document
    .getElementById('addPartBtn')
    .addEventListener('click', () => addRow(partsContainer));
  document
    .getElementById('addExtraBtn')
    .addEventListener('click', () => addRow(extraContainer));
  document
    .getElementById('downloadJsonBtn')
    .addEventListener('click', downloadJson);
  document
    .getElementById('downloadPdfBtn')
    .addEventListener('click', generateModernPdf);

  // Attach input listeners to all inputs + textareas so preview is always live.
  document.querySelectorAll('input, textarea').forEach((el) => {
    el.addEventListener('input', updateState);
  });

  // Start with one empty Part row so the UI doesn't look dead.
  addRow(partsContainer);
  updateState();
});

// ==========================
// Helpers for state & rows
// ==========================

function updateState() {
  // NOTE (me): read everything out of the DOM once and push into state.
  state.title =
    document.getElementById('invoiceTitle')?.value.trim() || 'Invoice';
  state.number = document.getElementById('invoiceNumber')?.value.trim() || '';
  state.date = document.getElementById('invoiceDate')?.value || '';

  state.fromEmail = document.getElementById('fromEmail')?.value.trim() || '';
  state.toEmail = document.getElementById('toEmail')?.value.trim() || '';

  state.fromAddress = document.getElementById('fromAddress')?.value || '';
  state.toAddress = document.getElementById('toAddress')?.value || '';

  state.fromPhone = document.getElementById('fromPhone')?.value.trim() || '';
  state.toPhone = document.getElementById('toPhone')?.value.trim() || '';

  state.carMake = document.getElementById('carMake')?.value.trim() || '';
  state.carModel = document.getElementById('carModel')?.value.trim() || '';
  state.engineSize = document.getElementById('engineSize')?.value.trim() || '';
  state.registration =
    document.getElementById('registration')?.value.trim() || '';

  state.labourCost = document.getElementById('labourCost')?.value.trim() || '';

  // NOTE (me): build parts from all the dynamic rows.
  state.parts = Array.from(
    partsContainer.querySelectorAll('.section-row')
  ).reduce((acc, row) => {
    const name = row.querySelector('.section-title').value.trim();
    const price = row.querySelector('.section-value').value.trim();
    if (name || price) acc.push({ name, price });
    return acc;
  }, []);

  // Additional costs behave the same as parts (label + price).
  state.extras = Array.from(
    extraContainer.querySelectorAll('.section-row')
  ).reduce((acc, row) => {
    const name = row.querySelector('.section-title').value.trim();
    const price = row.querySelector('.section-value').value.trim();
    if (name || price) acc.push({ name, price });
    return acc;
  }, []);

  renderPreview();
}

// NOTE (me): this adds one row to either Parts or Extras container.
function addRow(container) {
  const row = document.createElement('div');
  row.className = 'section-row';
  row.innerHTML = `
    <input class="section-title" placeholder="Short label for this item" />
    <input class="section-value" placeholder="Cost for this item (e.g. £50)" />
    <button class="remove-btn" type="button" aria-label="Remove row">&times;</button>
  `;

  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
    updateState();
  });

  row.querySelectorAll('input').forEach((el) =>
    el.addEventListener('input', updateState)
  );

  container.appendChild(row);
}

// Simple helper to turn a price-like string into a number safely.
function toNum(v) {
  return Number(String(v).replace(/[^0-9.]/g, '')) || 0;
}

// NOTE (me): centralised totals logic so preview + PDF use the same maths.
function getTotals() {
  const partsTotal = state.parts.reduce((sum, p) => sum + toNum(p.price), 0);
  const labour = toNum(state.labourCost);
  const extrasTotal = state.extras.reduce((sum, e) => sum + toNum(e.price), 0);
  return {
    partsTotal,
    labour,
    extrasTotal,
    grandTotal: partsTotal + labour + extrasTotal
  };
}

// Safe HTML escape so we don't accidentally inject anything weird into preview.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==========================
// Preview renderer
// ==========================

function renderPreview() {
  const totals = getTotals();

  const partsHtml = state.parts
    .map((p) => `<li>${escapeHtml(p.name)}: ${escapeHtml(p.price)}</li>`)
    .join('');

  const extrasHtml = state.extras
    .map((e) => `<li>${escapeHtml(e.name)}: ${escapeHtml(e.price)}</li>`)
    .join('');

  previewDiv.innerHTML = `
    <h3>${escapeHtml(state.title)}</h3>
    <p><strong>Invoice No:</strong> ${escapeHtml(state.number)}</p>
    <p><strong>Date:</strong> ${escapeHtml(state.date)}</p>

    <h4 id="previewSubHeads">Business contact</h4>
    <p>
      ${escapeHtml(state.fromAddress).replace(/\n/g, '<br>')}<br>
      ${state.fromPhone ? `Tel: ${escapeHtml(state.fromPhone)}<br>` : ''}
      ${state.fromEmail ? `Email: ${escapeHtml(state.fromEmail)}` : ''}
    </p>

    <h4 id="previewSubHeads">Client contact</h4>
    <p>
      ${escapeHtml(state.toAddress).replace(/\n/g, '<br>')}<br>
      ${state.toPhone ? `Tel: ${escapeHtml(state.toPhone)}<br>` : ''}
      ${state.toEmail ? `Email: ${escapeHtml(state.toEmail)}` : ''}
    </p>

    <h4 id="previewSubHeads">Car details</h4>
    <p>
      ${escapeHtml(state.carMake)} ${escapeHtml(state.carModel)}
      ${state.engineSize ? `(${escapeHtml(state.engineSize)})` : ''}<br>
      Reg: ${escapeHtml(state.registration)}
    </p>

    <h4 id="previewSubHeads">Parts</h4>
    <ul>${partsHtml || '<li>No parts recorded</li>'}</ul>

    <h4 id="previewSubHeads">Labour</h4>
    <h3>${escapeHtml("£" + state.labourCost || '£0')}</h3>


    ${
      state.extras.length
        ? `<h4>Additional costs</h4><ul>${extrasHtml}</ul>`
        : ''
    }

    <h3 id="t1" >Total: £${totals.grandTotal.toFixed(2)}</h3>
  `;
}

// ==========================
// JSON export (debug / backup)
// ==========================

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invoice-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================
// Modern PDF generator
// ==========================

function generateModernPdf() {
  const doc = new jsPDF();
  let y = 18;
  const left = 15;
  const rightColX = 120; // right column for contact info
  const totals = getTotals();

  // ---- Header: title, invoice no, date ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(state.title || 'Invoice', left, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${state.number || '-'}`, left, y);
  y += 5;
  doc.text(`Date: ${state.date || '-'}`, left, y);
  y += 8;

  // ---- Business + client contact block ----
  const fromLines = doc.splitTextToSize(
    (state.fromAddress || '').replace(/\r/g, ''),
    80
  );
  const toLines = doc.splitTextToSize(
    (state.toAddress || '').replace(/\r/g, ''),
    80
  );

  doc.setFont('helvetica', 'bold');
  doc.text('From (Business)', left, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fromLines, left, y + 5);

  let contactYOffset = y + 5 + fromLines.length * 5 + 2;
  if (state.fromPhone) {
    doc.text(`Tel: ${state.fromPhone}`, left, contactYOffset);
    contactYOffset += 5;
  }
  if (state.fromEmail) {
    doc.text(`Email: ${state.fromEmail}`, left, contactYOffset);
  }

  doc.setFont('helvetica', 'bold');
  doc.text('To (Client)', rightColX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(toLines, rightColX, y + 5);

  let clientYOffset = y + 5 + toLines.length * 5 + 2;
  if (state.toPhone) {
    doc.text(`Tel: ${state.toPhone}`, rightColX, clientYOffset);
    clientYOffset += 5;
  }
  if (state.toEmail) {
    doc.text(`Email: ${state.toEmail}`, rightColX, clientYOffset);
  }

  // move y to below both contact blocks
  y = Math.max(contactYOffset, clientYOffset) + 10;

  // ---- Car details as a tidy table ----
  doc.setFont('helvetica', 'bold');
  doc.text('Car details', left, y);
  y += 3;

  doc.autoTable({
    startY: y,
    head: [['Field', 'Value']],
    body: [
      ['Make', state.carMake || '-'],
      ['Model', state.carModel || '-'],
      ['Engine size', state.engineSize || '-'],
      ['Registration', state.registration || '-']
    ],
    headStyles: { fillColor: [10, 26, 47], textColor: 255 },
    styles: { fontSize: 10 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ---- Parts table ----
  doc.setFont('helvetica', 'bold');
  doc.text('Parts', left, y);
  y += 3;

  const partsBody = state.parts.length
    ? state.parts.map((p) => [p.name || '-', p.price || '-'])
    : [['No parts recorded', '-']];

  doc.autoTable({
    startY: y,
    head: [['Description', 'Price']],
    body: partsBody,
    headStyles: { fillColor: [10, 26, 47], textColor: 255 },
    styles: { fontSize: 10 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ---- Labour table (single row) ----
  doc.setFont('helvetica', 'bold');
  doc.text('Labour', left, y);
  y += 3;

  doc.autoTable({
    startY: y,
    head: [['Description', 'Price']],
    body: [['Labour', state.labourCost || '£0']],
    headStyles: { fillColor: [212, 160, 23], textColor: 0 },
    styles: { fontSize: 10 }
  });

  y = doc.lastAutoTable.finalY + 8;

  // ---- Additional costs (only if present) ----
  if (state.extras.length) {
    doc.setFont('helvetica', 'bold');
    doc.text('Additional costs', left, y);
    y += 3;

    const extrasBody = state.extras.map((e) => [
      e.name || '-',
      e.price || '-'
    ]);

    doc.autoTable({
      startY: y,
      head: [['Description', 'Price']],
      body: extrasBody,
      headStyles: { fillColor: [212, 160, 23], textColor: 0 },
      styles: { fontSize: 10 }
    });

    y = doc.lastAutoTable.finalY + 8;
  }

  // ---- Totals summary table ----
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', left, y);
  y += 3;

  doc.autoTable({
    startY: y,
    head: [['Type', 'Amount']],
    body: [
      ['Parts total', `£${totals.partsTotal.toFixed(2)}`],
      ['Labour total', `£${totals.labour.toFixed(2)}`],
      [
        'Additional costs total',
        `£${totals.extrasTotal.toFixed(2)}`
      ],
      ['Grand total', `£${totals.grandTotal.toFixed(2)}`]
    ],
    headStyles: { fillColor: [10, 26, 47], textColor: 255 },
    styles: { fontSize: 10 }
  });

  // ---- File name = Title + Invoice Number ----
  let fileName = state.title || 'Invoice';
  if (state.number) {
    fileName += ' - ' + state.number;
  }
  // basic clean so the OS doesn't freak out
  fileName = fileName.replace(/[^a-z0-9\- ]/gi, '').trim() || 'invoice';

  doc.save(`${fileName}.pdf`);
}
