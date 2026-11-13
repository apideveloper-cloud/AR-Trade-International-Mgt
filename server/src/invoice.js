// Order / invoice PDF for the admin console: built on the server so it can be downloaded or emailed to the customer.
// Text may contain Bengali (customer names, addresses): Bengali runs are drawn with Noto Sans Bengali, everything else with Noto Sans.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { money } from './util.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const fonts = pkg => path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), 'files');
const LATIN = fonts('noto-sans'), BENGALI = fonts('noto-sans-bengali');
export const FONT_FILES = {
  r: path.join(LATIN, 'noto-sans-latin-400-normal.woff'), b: path.join(LATIN, 'noto-sans-latin-700-normal.woff'),
  br: path.join(BENGALI, 'noto-sans-bengali-bengali-400-normal.woff'), bb: path.join(BENGALI, 'noto-sans-bengali-bengali-700-normal.woff')
};
export const LOGO = path.resolve(here, '../uploads/site/ar-icon-round.png');

export const W = 595.28, H = 841.89, M = 40, RIGHT = W - M;
export const NAVY = '#0b1631', BLUE = '#2f7fd6', INK = '#16181d', MUTED = '#6b7388', LINE = '#e1e7f0', SOFT = '#f4f7fc';

/** A QR code as PNG bytes (no margin: the header leaves its own white space). */
export const qrPng = text => QRCode.toBuffer(String(text), { margin: 0, width: 240, errorCorrectionLevel: 'M', color: { dark: '#0b1631', light: '#ffffff' } });
export const siteBase = () => (process.env.SITE_URL || '').replace(/\/$/, '') || 'https://artradeinternational.birgroupholdings.net';

/** The header of every document: no filled band, just the logo, the company, the document title and a QR code, with a thin accent line under it. */
export function drawHeader(doc, { title, number, date, site = {}, qr, caption = 'Scan to open' }) {
  let tx = M;
  if (fs.existsSync(LOGO)) { doc.image(LOGO, M, 22, { width: 54 }); tx = M + 68; }
  put(doc, 'AR TRADE INTERNATIONAL', tx, 25, { size: 17, bold: true, color: NAVY });
  put(doc, site.address || '159 Santinagar, Dhaka-1217', tx, 48, { size: 8.5, color: MUTED });
  put(doc, [site.phone, site.email].filter(Boolean).join('   ·   '), tx, 61, { size: 8.5, color: MUTED });
  const qx = RIGHT - 64;
  if (qr) {
    doc.image(qr, qx, 20, { width: 64 });
    put(doc, caption, qx + 32, 87, { size: 6.5, color: MUTED, align: 'center' });
  }
  const tr = qr ? qx - 14 : RIGHT;
  // the title shrinks until it clears the company name (a long title like DELIVERY NOTE would run into it)
  const leftEnd = tx + measure(doc, 'AR TRADE INTERNATIONAL', 17, true) + 18;
  let ts = 24;
  while (ts > 15 && measure(doc, title, ts, true) > tr - leftEnd) ts -= 1;
  put(doc, title, tr, 20 + (24 - ts) / 2, { size: ts, bold: true, color: NAVY, align: 'right' });
  put(doc, number, tr, 52, { size: 11, bold: true, color: BLUE, align: 'right' });
  if (date) put(doc, date, tr, 68, { size: 8.5, color: MUTED, align: 'right' });
  doc.moveTo(M, 100).lineTo(RIGHT, 100).lineWidth(2).strokeColor(BLUE).stroke();
}

export const invoiceNo = id => 'INV-' + String(id).replace(/^\D+/, '');
export { money };
export const when = (d, time = true) => {
  const x = new Date(d);
  if (isNaN(x)) return '';
  return x.toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) });
};

/** Splits text into Bengali / non-Bengali runs (a space stays with the run before it so Bengali phrases are not chopped up). */
function runs(str) {
  const out = [];
  for (const ch of String(str ?? '').replace(/[\r\n\t]+/g, ' ')) {
    const bn = /[।॥ঀ-৿]/.test(ch) || (ch === ' ' && out.length && out[out.length - 1].bn);
    if (out.length && out[out.length - 1].bn === bn) out[out.length - 1].t += ch; else out.push({ t: ch, bn });
  }
  return out;
}
const face = (bn, bold) => (bn ? (bold ? 'bb' : 'br') : (bold ? 'b' : 'r'));
export const measure = (doc, str, size, bold) => runs(str).reduce((w, r) => w + doc.font(face(r.bn, bold)).fontSize(size).widthOfString(r.t), 0);

/** One line of text; align 'left' (x = left edge), 'right' (x = right edge) or 'center' (x = middle). */
export function put(doc, str, x, y, { size = 10, bold = false, color = INK, align = 'left' } = {}) {
  const total = measure(doc, str, size, bold);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  doc.fillColor(color);
  for (const r of runs(str)) {
    doc.font(face(r.bn, bold)).fontSize(size);
    doc.text(r.t, cx, y, { lineBreak: false });
    cx += doc.widthOfString(r.t);
  }
}

/** Word-wraps text into lines no wider than maxW. */
export function wrap(doc, str, maxW, size, bold) {
  const lines = [];
  let cur = '';
  for (const word of String(str ?? '').replace(/[\r\n\t]+/g, ' ').split(' ').filter(Boolean)) {
    const next = cur ? cur + ' ' + word : word;
    if (measure(doc, next, size, bold) <= maxW) { cur = next; continue; }
    if (cur) lines.push(cur);
    let w = word;
    while (measure(doc, w, size, bold) > maxW && w.length > 1) { // a single very long word
      let n = w.length - 1;
      while (n > 1 && measure(doc, w.slice(0, n), size, bold) > maxW) n--;
      lines.push(w.slice(0, n)); w = w.slice(n);
    }
    cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Builds the invoice for order `o` (the shape returned by the admin orders API) and resolves to the PDF bytes. */
export async function buildInvoicePdf(o, site = {}) {
  const phone = String(o.customer?.phone || '').replace(/\D/g, '');
  const qr = await qrPng(`${siteBase()}/track?id=${encodeURIComponent(o.id)}${phone ? '&phone=' + phone : ''}`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${invoiceNo(o.id)} - AR Trade International`, Author: 'AR Trade International' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const [k, f] of Object.entries(FONT_FILES)) doc.registerFont(k, f);

    const inv = invoiceNo(o.id);
    const paid = o.payStatus === 'Paid';

    drawHeader(doc, { title: 'INVOICE', number: inv, date: when(o.date), site, qr, caption: 'Scan to track the order' });

    // ---- billed to / order details ----
    const colW = (RIGHT - M - 14) / 2;
    const left = [];
    left.push({ t: o.customer?.name || 'Customer', bold: true, size: 11.5 });
    if (o.company) left.push({ t: o.company + (o.bin ? ' (BIN ' + o.bin + ')' : ''), size: 9.5 });
    if (o.customer?.phone) left.push({ t: o.customer.phone, size: 9.5 });
    if (o.customer?.email) left.push({ t: o.customer.email, size: 9.5 });
    for (const l of wrap(doc, o.address || '', colW - 24, 9.5, false)) left.push({ t: l, size: 9.5, color: MUTED });
    const AREA = { inside: 'Inside Dhaka', suburb: 'Dhaka suburbs', outside: 'Outside Dhaka' };
    const right = [['Order ID', o.id], ['Order date', when(o.date)], ['Status', o.status], ['Payment', o.payment || ''], ['Payment status', paid ? 'Paid' : 'Unpaid'], ['Delivery area', AREA[o.area] || ''], ...(o.slot ? [['Delivery slot', o.slot]] : [])];
    const boxTop = 120;
    const boxH = Math.max(34 + left.length * 14, 34 + right.length * 14) + 6;
    doc.roundedRect(M, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    doc.roundedRect(M + colW + 14, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    put(doc, 'BILLED TO', M + 12, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    left.forEach((l, i) => put(doc, l.t, M + 12, boxTop + 27 + i * 14, { size: l.size, bold: l.bold, color: l.color || INK }));
    const rx = M + colW + 14 + 12;
    put(doc, 'ORDER DETAILS', rx, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    right.forEach(([k, v], i) => {
      put(doc, k, rx, boxTop + 27 + i * 14, { size: 9, color: MUTED });
      put(doc, v, rx + colW - 24, boxTop + 27 + i * 14, { size: 9.5, bold: true, align: 'right', color: k === 'Payment status' ? (paid ? '#1f8a4c' : '#a86400') : INK });
    });

    // ---- items table ----
    const X = { sl: M + 10, item: M + 40, qty: M + 340, unit: M + 425, amt: RIGHT - 10 };
    const itemW = 262;
    let y = boxTop + boxH + 18;
    const head = () => {
      doc.roundedRect(M, y, RIGHT - M, 24, 7).fill(NAVY);
      put(doc, 'SL', X.sl, y + 8, { size: 8, bold: true, color: '#ffffff' });
      put(doc, 'ITEM', X.item, y + 8, { size: 8, bold: true, color: '#ffffff' });
      put(doc, 'QTY', X.qty, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'right' });
      put(doc, 'UNIT PRICE', X.unit, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'right' });
      put(doc, 'AMOUNT', X.amt, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'right' });
      y += 28;
    };
    head();
    (o.items || []).forEach((it, i) => {
      const lines = wrap(doc, it.name, itemW, 9.5, false);
      if (it.backorder > 0) lines.push(`${it.backorder} on back-order, shipped when restocked`);
      const rowH = lines.length * 13 + 12;
      if (y + rowH > H - 130) { doc.addPage(); y = 40; head(); }
      if (i % 2 === 0) doc.rect(M, y - 2, RIGHT - M, rowH).fill('#f8fafd');
      put(doc, String(i + 1), X.sl, y + 5, { size: 9, color: MUTED });
      lines.forEach((l, k) => put(doc, l, X.item, y + 5 + k * 13, { size: k >= lines.length - (it.backorder > 0 ? 1 : 0) && it.backorder > 0 ? 8.5 : 9.5, color: k >= lines.length - (it.backorder > 0 ? 1 : 0) && it.backorder > 0 ? '#a86400' : INK }));
      put(doc, String(it.qty), X.qty, y + 5, { size: 9.5, align: 'right' });
      put(doc, money(it.price), X.unit, y + 5, { size: 9.5, align: 'right' });
      put(doc, money(it.price * it.qty), X.amt, y + 5, { size: 9.5, bold: true, align: 'right' });
      doc.moveTo(M, y + rowH - 2).lineTo(RIGHT, y + rowH - 2).lineWidth(.5).strokeColor(LINE).stroke();
      y += rowH;
    });

    // ---- totals (right) and payment note (left) ----
    const totals = [['Subtotal', money(o.subtotal)], ['Discount', o.discount ? '− ' + money(o.discount) : money(0)], ['Delivery', o.delivery ? money(o.delivery) : 'Free'], ['VAT (included)', money(o.vat)]];
    if (y + 40 + totals.length * 17 + 46 > H - 90) { doc.addPage(); y = 40; }
    y += 14;
    const bx = M + 285, bw = RIGHT - bx;
    totals.forEach(([k, v], i) => {
      put(doc, k, bx + 12, y + i * 17, { size: 9.5, color: MUTED });
      put(doc, v, RIGHT - 12, y + i * 17, { size: 9.5, align: 'right' });
    });
    const ty = y + totals.length * 17 + 4;
    doc.roundedRect(bx, ty, bw, 32, 8).fill('#e4eefb');
    put(doc, 'TOTAL', bx + 12, ty + 11, { size: 9, bold: true, color: NAVY });
    put(doc, money(o.total), RIGHT - 12, ty + 8, { size: 15, bold: true, color: NAVY, align: 'right' });

    // payment badge + note on the left
    const badge = paid ? 'PAID' : 'PAYMENT DUE';
    const bcol = paid ? '#1f8a4c' : '#a86400';
    doc.roundedRect(M, y - 3, 112, 24, 12).fill(paid ? '#e6f6ec' : '#fff3dc');
    put(doc, badge, M + 56, y + 4, { size: 10, bold: true, color: bcol, align: 'center' });
    let ny = y + 30;
    put(doc, paid ? 'Payment received. Thank you!' : (/cash/i.test(o.payment || '') ? 'Please pay the rider on delivery.' : 'Payment is pending.'), M, ny, { size: 9, color: MUTED });
    if (o.note) {
      ny += 20;
      put(doc, 'NOTE', M, ny, { size: 7.5, bold: true, color: BLUE });
      for (const l of wrap(doc, o.note, 250, 9, false).slice(0, 4)) { ny += 12; put(doc, l, M, ny, { size: 9, color: INK }); }
    }

    // ---- footer on every page ----
    const foot = () => {
      doc.moveTo(M, H - 66).lineTo(RIGHT, H - 66).lineWidth(.6).strokeColor(LINE).stroke();
      put(doc, 'Thank you for shopping with AR Trade International.', M, H - 56, { size: 9.5, bold: true, color: NAVY });
      put(doc, [site.address || '159 Santinagar, Dhaka-1217', site.phone, site.email].filter(Boolean).join('   ·   '), M, H - 42, { size: 8, color: MUTED });
      put(doc, 'This is a computer-generated invoice and does not need a signature.', M, H - 30, { size: 8, color: MUTED });
    };
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); foot(); }
    doc.end();
  });
}
