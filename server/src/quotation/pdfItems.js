// PDF sections: the item table, terms and totals, amount in words. Each takes the current y and returns the next y.
import { H, LINE, M, MUTED, NAVY, BLUE, INK, RIGHT, SOFT, money, put, wrap as wrapText } from '../invoice.js';
import { num, titleCase, words } from './totals.js';

const PALE = '#eaf2fd', ZEBRA = '#f8fafd';
const blueFill = (doc, x0, x1) => { const gr = doc.linearGradient(x0, 0, x1, 0); gr.stop(0, '#1f5fb8').stop(1, '#3b8de0'); return gr; };
const X = { sl: M + 12, desc: M + 40, qty: M + 262, war: M + 328, price: M + 428, amt: RIGHT - 12 };

/** The blue column-heading bar of the item table; returns the y of the first row. */
function tableHead(doc, y) {
  doc.roundedRect(M, y, RIGHT - M, 24, 7).fill(blueFill(doc, M, RIGHT));
  const h = { size: 8, bold: true, color: '#ffffff' };
  put(doc, 'SL', X.sl, y + 8, h); put(doc, 'DESCRIPTION', X.desc, y + 8, h);
  put(doc, 'QTY', X.qty, y + 8, { ...h, align: 'center' }); put(doc, 'WARRANTY', X.war, y + 8, { ...h, align: 'center' });
  put(doc, 'UNIT PRICE', X.price, y + 8, { ...h, align: 'right' }); put(doc, 'AMOUNT', X.amt, y + 8, { ...h, align: 'right' });
  return y + 28;
}

/** The item table, with zebra rows and a repeated heading on new pages. */
export function drawItems(doc, q, y) {
  y = tableHead(doc, y);
  q.lines.forEach((l, i) => {
    const ls = wrapText(doc, l.description, 190, 9.5, false);
    const rowH = Math.max(1, ls.length) * 12.5 + 9;
    if (y + rowH > H - 100) { doc.addPage(); y = tableHead(doc, 40); }
    if (i % 2 === 0) doc.rect(M, y - 2, RIGHT - M, rowH).fill(ZEBRA);
    put(doc, String(i + 1), X.sl, y + 4, { size: 9, color: MUTED });
    ls.forEach((t, k) => put(doc, t, X.desc, y + 4 + k * 12.5, { size: 9.5, bold: k === 0 }));
    put(doc, `${l.qty} ${l.unit}`, X.qty, y + 4, { size: 9.5, align: 'center' });
    put(doc, l.warranty || '—', X.war, y + 4, { size: 9, align: 'center', color: l.warranty ? INK : MUTED });
    put(doc, num(l.unitPrice), X.price, y + 4, { size: 9.5, align: 'right' });
    put(doc, num(l.qty * l.unitPrice), X.amt, y + 4, { size: 9.5, bold: true, align: 'right' });
    doc.moveTo(M, y + rowH - 2).lineTo(RIGHT, y + rowH - 2).lineWidth(0.5).strokeColor(LINE).stroke();
    y += rowH;
  });
  return y;
}

/** Terms and conditions (left) and the totals box with NET PAYABLE (right). */
export function drawTermsAndTotals(doc, q, y) {
  const notes = String(q.notes || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!notes.some(n => /valid/i.test(n))) notes.push(`Quotation valid only for ${q.validDays} days.`);
  const noteLines = notes.map(n => wrapText(doc, n, 238, 8.5, false));
  const termsH = Math.max(34 + noteLines.reduce((t, ls) => t + ls.length * 11.5 + 3, 0), 148);
  if (y + 12 + termsH + 55 > H - 70) { doc.addPage(); y = 40; } // long terms must not run into the footer
  y += 12;
  const bx = M + 288, bw = RIGHT - bx;
  doc.roundedRect(M, y, 272, termsH, 10).fillAndStroke(SOFT, LINE);
  put(doc, 'TERMS & CONDITIONS', M + 12, y + 11, { size: 7.5, bold: true, color: BLUE });
  let ny = y + 27;
  noteLines.forEach(ls => {
    doc.circle(M + 16, ny + 5.2, 2.2).fill(BLUE);
    ls.forEach((t, k) => { put(doc, t, M + 28, ny + k * 11.5, { size: 8.5 }); });
    ny += ls.length * 11.5 + 3;
  });
  const trow = (label, val, yy, opts = {}) => { put(doc, label, bx + 12, yy, { size: 9, color: opts.bold ? INK : MUTED, bold: opts.bold }); put(doc, (opts.minus && val ? '− ' : '') + num(val), RIGHT - 12, yy, { size: 9.5, bold: opts.bold, align: 'right', color: opts.minus && val ? '#b3261e' : INK }); };
  trow('Total amount', q.total, y + 4, { bold: true });
  doc.moveTo(bx + 12, y + 20).lineTo(RIGHT - 12, y + 20).lineWidth(0.5).strokeColor(LINE).stroke();
  trow('Installation / service charges', q.install, y + 29);
  trow('Transportation charges', q.transport, y + 46);
  trow('Add VAT', q.vat, y + 63);
  trow('Discount amount', q.discount, y + 80, { minus: true });
  const ny2 = y + 108;
  doc.roundedRect(bx, ny2, bw, 40, 9).fill(blueFill(doc, bx, RIGHT));
  put(doc, 'NET PAYABLE', bx + 14, ny2 + 15, { size: 8.5, bold: true, color: '#d6e8fc' });
  put(doc, money(q.net), RIGHT - 14, ny2 + 11, { size: 17, bold: true, color: '#ffffff', align: 'right' });
  return Math.max(y + termsH, ny2 + 40) + 10;
}

/** The "In words" bar with the net amount written out. */
export function drawWords(doc, q, y) {
  doc.roundedRect(M, y, RIGHT - M, 30, 8).fill(PALE);
  put(doc, 'IN WORDS', M + 12, y + 6, { size: 6.8, bold: true, color: BLUE });
  put(doc, `Taka ${titleCase(words(q.net))} only.`, M + 12, y + 16, { size: 9.5, bold: true, color: NAVY });
  return y + 42;
}
