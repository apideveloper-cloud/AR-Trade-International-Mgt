// The quotation PDF: header, the two cards, subject and covering letter; the rest is in pdfItems.js and pdfClosing.js.
import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { FONT_FILES, LINE, M, MUTED, NAVY, BLUE, INK, RIGHT, SOFT, W, LOGO, put, qrPng, wrap as wrapText } from '../invoice.js';
import { DEFAULT_OFFICE } from './constants.js';
import { dmy, sentence, validUntil } from './totals.js';
import { drawItems, drawTermsAndTotals, drawWords } from './pdfItems.js';
import { drawClosing, drawFooters } from './pdfClosing.js';

/** Gradient strip, logo and company on the left, QR code and document title on the right. */
function drawHeader(doc, q, site, qr) {
  const g = doc.linearGradient(0, 0, W, 0); g.stop(0, NAVY).stop(1, BLUE);
  doc.rect(0, 0, W, 8).fill(g);
  let tx = M;
  if (fs.existsSync(LOGO)) { doc.image(LOGO, M, 24, { width: 56 }); tx = M + 68; }
  put(doc, 'AR TRADE INTERNATIONAL', tx, 30, { size: 15, bold: true, color: NAVY });
  put(doc, 'Committed to better service', tx, 50, { size: 9, bold: true, color: BLUE });
  put(doc, site.address || DEFAULT_OFFICE, tx, 65, { size: 8, color: MUTED });
  // the QR code sits at the right end of the header: scanning it shows the quotation number, date and net amount
  const hq = 58, hx = RIGHT - hq;
  doc.image(qr, hx, 18, { width: hq });
  put(doc, 'Scan to verify', hx + hq / 2, 78, { size: 6.2, bold: true, align: 'center', color: NAVY });
  const tr = hx - 14;
  put(doc, 'QUOTATION', tr, 24, { size: 21, bold: true, color: NAVY, align: 'right' });
  put(doc, q.id, tr, 52, { size: 10.5, bold: true, color: BLUE, align: 'right' });
  put(doc, dmy(q.date), tr, 68, { size: 9, color: MUTED, align: 'right' });
  doc.moveTo(M, 94).lineTo(RIGHT, 94).lineWidth(1.6).strokeColor(BLUE).stroke();
}

/** Two cards: who it is for, and the quotation details. Returns the y below them. */
function drawParties(doc, q) {
  const colW = (RIGHT - M - 14) / 2;
  const left = [{ t: String(q.toName).toUpperCase(), bold: true, size: 11, color: NAVY }];
  if (q.attend || q.desig) left.push({ t: [q.attend, q.desig].filter(Boolean).join(', '), size: 9.5 });
  if (q.mobile) left.push({ t: q.mobile, size: 9.5 });
  if (q.email) left.push({ t: q.email, size: 9.5 });
  for (const l of wrapText(doc, q.address || '', colW - 24, 9, false)) left.push({ t: l, size: 9, color: MUTED });
  const right = [['Quotation no.', q.id], ['Date', dmy(q.date)], ['Valid until', `${validUntil(q.date, q.validDays)} (${q.validDays} day${q.validDays === 1 ? '' : 's'})`], ['Prepared by', q.signerName || q.by || '']].filter(r => r[1]);
  const boxTop = 108, boxH = Math.max(34 + left.length * 14, 34 + right.length * 15) + 4;
  doc.roundedRect(M, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
  doc.roundedRect(M + colW + 14, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
  put(doc, 'QUOTATION FOR', M + 12, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
  left.forEach((l, i) => put(doc, l.t, M + 12, boxTop + 27 + i * 14, { size: l.size, bold: l.bold, color: l.color || INK }));
  const rx = M + colW + 14 + 12;
  put(doc, 'DETAILS', rx, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
  right.forEach(([k, v], i) => { put(doc, k, rx, boxTop + 27 + i * 15, { size: 9, color: MUTED }); put(doc, v, rx + colW - 24, boxTop + 27 + i * 15, { size: 9.5, bold: true, align: 'right' }); });
  return boxTop + boxH + 18;
}

/** Subject line and covering letter. Returns the y below them. */
function drawLetter(doc, q, y) {
  if (String(q.subject || '').trim()) {
    const sub = wrapText(doc, q.subject, RIGHT - M - 14, 11, true);
    doc.roundedRect(M, y - 1, 3.5, sub.length * 14 + 2, 1.5).fill(BLUE);
    sub.forEach((l, i) => put(doc, l, M + 12, y + i * 14, { size: 11, bold: true, color: NAVY }));
    y += sub.length * 14 + 10;
  }
  put(doc, 'Dear Sir,', M, y, { size: 9.5, bold: true }); y += 15;
  const intro = q.intro && q.intro === q.intro.toUpperCase() ? sentence(q.intro) : q.intro;
  for (const l of wrapText(doc, intro, RIGHT - M, 9, false)) { put(doc, l, M, y, { size: 9, color: '#2b3348' }); y += 12.5; }
  return y + 10;
}

/** Builds the quotation PDF (A4, one or more pages) and resolves with the file bytes. */
export async function buildQuotePdf(q, site = {}) {
  const qr = await qrPng(`AR TRADE | QUOTATION | ${q.id} | ${q.date} | ${Math.round(q.net)} BDT`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${q.id} - Quotation - AR Trade International`, Author: 'AR Trade International' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    for (const [k, f] of Object.entries(FONT_FILES)) doc.registerFont(k, f);
    drawHeader(doc, q, site, qr);
    let y = drawParties(doc, q);
    y = drawLetter(doc, q, y);
    y = drawItems(doc, q, y);
    y = drawTermsAndTotals(doc, q, y);
    y = drawWords(doc, q, y);
    drawClosing(doc, q, y);
    drawFooters(doc, site);
    doc.end();
  });
}
