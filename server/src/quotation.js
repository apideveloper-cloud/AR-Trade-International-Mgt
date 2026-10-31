// Quotations: price offers sent to customers, with a printable PDF in the company's quotation layout.
// Mounted at /api/quotes. Reading needs quotes.view, every change needs quotes.manage.
//   Total amount = sum of (quantity x unit price). Net payable = total + installation + transport + VAT - discount.
//   Status: Draft -> Sent -> Accepted / Rejected. An Accepted quotation is locked; a Draft or Rejected one can be deleted.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Router } from 'express';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { pool } from './db.js';
import { guard } from './admin.js';
import { D, esc, fail, int, iso, nextSeq, text, today, tx, wrap } from './util.js';
import { mailReady, mailSetupHint, sendMail } from './mailer.js';
import { addAmount, addRange, addSearch, pageOf, whereOf } from './listing.js';
import { FONT_FILES, H, LINE, M, MUTED, NAVY, BLUE, INK, RIGHT, SOFT, W, LOGO, money, put, qrPng, wrap as wrapText } from './invoice.js';

const router = Router();
const VIEW = 'quotes.view', MANAGE = 'quotes.manage';
const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
// Existing: already a customer in the field app. Upcoming: a prospect there. New: typed in by hand.
const CUSTOMER_TYPES = ['Existing', 'Upcoming', 'New'];
const DEFAULT_INTRO = 'We are very proud to have had a conversation with you about your requirement. We believe that it will be an exactable quotation for your company. We hope that we will get a good result on this part. For any queries please mail or call us.';
const DEFAULT_NOTES = ['Excluding Govt. all Vat & Tax.', 'Payments Terms Cash on Delivery.', 'Quotation valid only for 3 days.', 'In 7 days we will deliver the order to purchase.', 'Quotation is valid based on availability in Bangladesh Market.'].join('\n');

export async function ensureQuotes() {
  const q = sql => pool.query(sql);
  await q(`CREATE TABLE IF NOT EXISTS quotations (id VARCHAR(24) PRIMARY KEY, quote_date DATE NOT NULL, to_name VARCHAR(200) NOT NULL, address VARCHAR(300) NOT NULL DEFAULT '', attend VARCHAR(120) NOT NULL DEFAULT '', desig VARCHAR(120) NOT NULL DEFAULT '', mobile VARCHAR(40) NOT NULL DEFAULT '', email VARCHAR(160) NOT NULL DEFAULT '',
    subject VARCHAR(300) NOT NULL DEFAULT '', intro TEXT NULL, notes TEXT NULL, valid_days INT NOT NULL DEFAULT 3, status VARCHAR(12) NOT NULL DEFAULT 'Draft',
    install_charge INT NOT NULL DEFAULT 0, transport_charge INT NOT NULL DEFAULT 0, discount INT NOT NULL DEFAULT 0, vat INT NOT NULL DEFAULT 0, total INT NOT NULL DEFAULT 0, net INT NOT NULL DEFAULT 0,
    signer_name VARCHAR(120) NOT NULL DEFAULT '', signer_desig VARCHAR(120) NOT NULL DEFAULT '', signer_dept VARCHAR(120) NOT NULL DEFAULT '', signer_cell VARCHAR(80) NOT NULL DEFAULT '',
    staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, KEY idx_date (quote_date), KEY idx_status (status))`);
  const [qc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotations'");
  const have = new Set(qc.map(r => r.c));
  for (const [c, def] of [['cust_type', "VARCHAR(10) NOT NULL DEFAULT 'New'"], ['customer_id', 'INT NULL'], ['share_token', 'VARCHAR(48) NULL']]) if (!have.has(c)) await pool.query(`ALTER TABLE quotations ADD COLUMN ${c} ${def}`);
  await q(`CREATE TABLE IF NOT EXISTS quotation_items (id INT AUTO_INCREMENT PRIMARY KEY, quote_id VARCHAR(24) NOT NULL, sl INT NOT NULL DEFAULT 1, product_id INT NULL, description VARCHAR(400) NOT NULL, qty INT NOT NULL DEFAULT 1, unit VARCHAR(12) NOT NULL DEFAULT 'PCS', warranty VARCHAR(60) NOT NULL DEFAULT '', unit_price INT NOT NULL DEFAULT 0, KEY idx_quote (quote_id))`);
}

/** Amount in words, Bangladeshi style (lakh, crore): 7500 -> "SEVEN THOUSAND FIVE HUNDRED". */
export function words(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (!n) return 'ZERO';
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const below100 = x => (x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''));
  const below1000 = x => (x >= 100 ? ones[Math.floor(x / 100)] + ' HUNDRED' + (x % 100 ? ' ' + below100(x % 100) : '') : below100(x));
  const parts = [];
  for (const [div, name] of [[10000000, 'CRORE'], [100000, 'LAKH'], [1000, 'THOUSAND']]) {
    const q = Math.floor(n / div);
    if (q) { parts.push((q >= 100 && div === 10000000 ? words(q) : below1000(q)) + ' ' + name); n %= div; }
  }
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
const totalsOf = (lines, b) => {
  const total = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  return { total, net: Math.max(0, total + b.install + b.transport + b.vat - b.discount) };
};

function bodyOf(req) {
  const b = req.body || {};
  const lines = (Array.isArray(b.lines) ? b.lines : []).slice(0, 60).map(l => ({
    productId: parseInt(l.productId, 10) || null, description: text(l.description, 400), qty: Math.max(1, int(l.qty, 100000)), unit: text(l.unit, 12).toUpperCase() || 'PCS', warranty: text(l.warranty, 60), unitPrice: int(l.unitPrice)
  })).filter(l => l.description);
  if (!text(b.toName, 200)) throw fail(400, 'Write who the quotation is for');
  if (!lines.length) throw fail(400, 'Add at least one item');
  const money = { install: int(b.install), transport: int(b.transport), discount: int(b.discount), vat: int(b.vat) };
  const t = totalsOf(lines, money);
  if (money.discount > t.total + money.install + money.transport + money.vat) throw fail(400, 'The discount is more than the quotation total');
  return {
    lines, ...money, ...t, custType: CUSTOMER_TYPES.includes(b.custType) ? b.custType : 'New', customerId: parseInt(b.customerId, 10) || null, date: iso(b.date, today()), toName: text(b.toName, 200), address: text(b.address, 300), attend: text(b.attend, 120), desig: text(b.desig, 120), mobile: text(b.mobile, 40), email: text(b.email, 160),
    subject: text(b.subject, 300), intro: text(b.intro, 2000), notes: text(b.notes, 2000), validDays: Math.max(1, int(b.validDays, 365)),
    signerName: text(b.signerName, 120), signerDesig: text(b.signerDesig, 120), signerDept: text(b.signerDept, 120), signerCell: text(b.signerCell, 80)
  };
}
const qOut = r => ({
  id: r.id, date: r.d, custType: r.cust_type, customerId: r.customer_id, toName: r.to_name, address: r.address, attend: r.attend, desig: r.desig, mobile: r.mobile, email: r.email, subject: r.subject, intro: r.intro || '', notes: r.notes || '', validDays: r.valid_days, status: r.status,
  install: r.install_charge, transport: r.transport_charge, discount: r.discount, vat: r.vat, total: r.total, net: r.net,
  signerName: r.signer_name, signerDesig: r.signer_desig, signerDept: r.signer_dept, signerCell: r.signer_cell, by: r.staff_name, createdAt: r.created_at, updatedAt: r.updated_at
});
async function load(id) {
  const [[r]] = await pool.query(`SELECT *, ${D('quote_date')} d FROM quotations WHERE id = ?`, [id]);
  if (!r) throw fail(404, 'Quotation not found');
  const [items] = await pool.query('SELECT product_id, description, qty, unit, warranty, unit_price FROM quotation_items WHERE quote_id = ? ORDER BY sl, id', [id]);
  return { ...qOut(r), lines: items.map(i => ({ productId: i.product_id, description: i.description, qty: i.qty, unit: i.unit, warranty: i.warranty, unitPrice: i.unit_price, amount: i.qty * i.unit_price })) };
}
async function saveLines(conn, id, lines) {
  await conn.query('DELETE FROM quotation_items WHERE quote_id = ?', [id]);
  for (const [i, l] of lines.entries()) await conn.query('INSERT INTO quotation_items (quote_id, sl, product_id, description, qty, unit, warranty, unit_price) VALUES (?,?,?,?,?,?,?,?)', [id, i + 1, l.productId, l.description, l.qty, l.unit, l.warranty, l.unitPrice]);
}
router.get('/', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['q.id', 'q.to_name', 'q.subject', 'q.attend', 'q.mobile'], req.query.q);
  addRange(cond, args, 'q.quote_date', req);
  addAmount(cond, args, 'q.net', req);
  if (STATUSES.includes(req.query.status)) { cond.push('q.status = ?'); args.push(req.query.status); }
  if (CUSTOMER_TYPES.includes(req.query.ctype)) { cond.push('q.cust_type = ?'); args.push(req.query.ctype); }
  const where = whereOf(cond);
  const { size, offset } = pageOf(req);
  const [rows] = await pool.query(`SELECT q.*, ${D('q.quote_date')} d, (SELECT COUNT(*) FROM quotation_items i WHERE i.quote_id = q.id) n FROM quotations q ${where} ORDER BY q.quote_date DESC, q.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(q.net), 0) net, COALESCE(SUM(q.status = 'Draft'), 0) draft, COALESCE(SUM(q.status = 'Sent'), 0) sent, COALESCE(SUM(q.status = 'Accepted'), 0) won, COALESCE(SUM(IF(q.status = 'Accepted', q.net, 0)), 0) won_net FROM quotations q ${where}`, args);
  const items = rows.map(r => ({ ...qOut(r), items: Number(r.n) }));
  res.json({ total: Number(t.n), rows: items, totals: { net: Number(t.net), draft: Number(t.draft), sent: Number(t.sent), accepted: Number(t.won), acceptedNet: Number(t.won_net) } });
}));
/** Customers to choose from when writing a quotation: Existing = active field customers, Upcoming = prospects. */
router.get('/customers', guard(MANAGE), wrap(async (req, res) => {
  const cond = [req.query.type === 'Upcoming' ? "kind = 'Upcoming'" : "kind <> 'Upcoming'"], args = [];
  addSearch(cond, args, ['name', 'contact_person', 'phone', 'email', 'area'], req.query.q);
  const [rows] = await pool.query(`SELECT id, name, contact_person, contact_role, phone, email, address, area, kind FROM field_customers ${whereOf(cond)} ORDER BY name LIMIT 12`, args).catch(() => [[]]);
  res.json({ items: rows.map(r => ({ id: r.id, name: r.name, contact: r.contact_person, role: r.contact_role, phone: r.phone, email: r.email, address: [r.address, r.area].filter(Boolean).join(', ') })) });
}));
// ---------- scan a picture of the terms (N.B.) into text ----------
// tesseract.js runs here on the server with the English data from @tesseract.js-data/eng, so it works offline. One worker is kept for later scans.
const require = createRequire(import.meta.url);
let ocrWorker = null;
async function ocr(png) {
  if (!ocrWorker) {
    const { createWorker } = await import('tesseract.js');
    const eng = require('@tesseract.js-data/eng');
    ocrWorker = createWorker('eng', 1, { langPath: eng.langPath, gzip: eng.gzip, cacheMethod: 'none' });
  }
  const w = await ocrWorker;
  return (await w.recognize(png)).data.text;
}
/** Turns the raw text of a scan into one clean term per line: bullets and numbers like "01." or "2)" are dropped, wrapped lines are joined. */
export function termsFromText(raw) {
  const lines = String(raw || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    if (/^(n\.?\s?b\.?|note|terms( and conditions)?)\s*:?$/i.test(l)) continue;
    const m = l.match(/^(?:\(?\d{1,2}[.)]|[-\u2022*\u25cf\u25aa]|\d{1,2}\s*[-:])\s*(.+)$/);
    if (m) out.push(m[1].trim().replace(/^[1l]n\b/, 'In'));
    else if (out.length && !/[.!]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + l; // a wrapped line continues the term before it
    else out.push(l);
  }
  return out.filter(l => l.length > 2);
}
router.post('/scan', guard(MANAGE), wrap(async (req, res) => {
  const m = String(req.body?.image || '').match(/^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw fail(400, 'Choose a PNG, JPG, WebP or GIF picture');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) throw fail(413, 'The picture is larger than 6 MB');
  let png;
  try { png = await sharp(buf).rotate().resize({ width: 2200, withoutEnlargement: true }).grayscale().normalise().sharpen().png().toBuffer(); } catch { throw fail(400, 'That file is not a readable picture'); }
  let raw;
  try { raw = await ocr(png); } catch (e) { ocrWorker = null; throw fail(500, 'The text could not be read from this picture: ' + (e.message || e)); }
  const lines = termsFromText(raw);
  if (!lines.length) throw fail(422, 'No readable text was found in the picture. Try a sharper, straighter photo.');
  res.json({ text: lines.join('\n'), lines: lines.length });
}));
router.get('/defaults', guard(MANAGE), wrap(async (req, res) => {
  res.json({ intro: DEFAULT_INTRO, notes: DEFAULT_NOTES });
}));
router.get('/:id', guard(VIEW), wrap(async (req, res) => res.json(await load(req.params.id))));

router.post('/', guard(MANAGE), wrap(async (req, res) => {
  const b = bodyOf(req);
  const out = await tx(async conn => {
    const yy = b.date.slice(2, 4);
    const seq = await nextSeq('quote_' + yy, 'quotations', 'A001PQT' + yy, 0);
    const id = 'A001PQT' + yy + seq.slice(('A001PQT' + yy).length).padStart(6, '0');
    await conn.query(`INSERT INTO quotations (id, quote_date, cust_type, customer_id, to_name, address, attend, desig, mobile, email, subject, intro, notes, valid_days, status, install_charge, transport_charge, discount, vat, total, net, signer_name, signer_desig, signer_dept, signer_cell, staff_name)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Draft',?,?,?,?,?,?,?,?,?,?,?)`,
    [id, b.date, b.custType, b.customerId, b.toName, b.address, b.attend, b.desig, b.mobile, b.email, b.subject, b.intro, b.notes, b.validDays, b.install, b.transport, b.discount, b.vat, b.total, b.net, b.signerName, b.signerDesig, b.signerDept, b.signerCell, req.staff.name]);
    await saveLines(conn, id, b.lines);
    return { id, net: b.net };
  });
  res.json(out);
}));
router.put('/:id', guard(MANAGE), wrap(async (req, res) => {
  const b = bodyOf(req);
  await tx(async conn => {
    const [[cur]] = await conn.query('SELECT status FROM quotations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!cur) throw fail(404, 'Quotation not found');
    if (cur.status === 'Accepted') throw fail(409, 'An accepted quotation cannot be edited. Make a copy instead.');
    await conn.query(`UPDATE quotations SET quote_date=?, cust_type=?, customer_id=?, to_name=?, address=?, attend=?, desig=?, mobile=?, email=?, subject=?, intro=?, notes=?, valid_days=?, install_charge=?, transport_charge=?, discount=?, vat=?, total=?, net=?, signer_name=?, signer_desig=?, signer_dept=?, signer_cell=? WHERE id = ?`,
      [b.date, b.custType, b.customerId, b.toName, b.address, b.attend, b.desig, b.mobile, b.email, b.subject, b.intro, b.notes, b.validDays, b.install, b.transport, b.discount, b.vat, b.total, b.net, b.signerName, b.signerDesig, b.signerDept, b.signerCell, req.params.id]);
    await saveLines(conn, req.params.id, b.lines);
  });
  res.json({ ok: true });
}));
router.post('/:id/status', guard(MANAGE), wrap(async (req, res) => {
  const status = req.body?.status;
  if (!STATUSES.includes(status)) throw fail(400, 'Unknown status');
  const [r] = await pool.query("UPDATE quotations SET status = ? WHERE id = ? AND status <> 'Accepted'", [status, req.params.id]);
  if (!r.affectedRows) {
    const [[q]] = await pool.query('SELECT status FROM quotations WHERE id = ?', [req.params.id]);
    throw q ? fail(409, 'An accepted quotation is locked. Make a copy instead.') : fail(404, 'Quotation not found');
  }
  res.json({ ok: true, status });
}));
router.delete('/:id', guard(MANAGE), wrap(async (req, res) => {
  await tx(async conn => {
    const [[cur]] = await conn.query('SELECT status FROM quotations WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!cur) throw fail(404, 'Quotation not found');
    if (cur.status === 'Accepted' || cur.status === 'Sent') throw fail(409, 'Only a draft or rejected quotation can be deleted');
    await conn.query('DELETE FROM quotation_items WHERE quote_id = ?', [req.params.id]);
    await conn.query('DELETE FROM quotations WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
}));

// ---------- the PDF ----------
const num = n => Math.round(Number(n) || 0).toLocaleString('en-US') + '.00';
const dmy = d => { const [y, m, dd] = String(d).split('-'); return `${dd}/${m}/${y}`; };

export async function buildQuotePdf(q, site = {}) {
  const qr = await qrPng(`AR TRADE | QUOTATION | ${q.id} | ${q.date} | ${Math.round(q.net)} BDT`);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${q.id} - Quotation - AR Trade International`, Author: 'AR Trade International' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    for (const [k, f] of Object.entries(FONT_FILES)) doc.registerFont(k, f);
    const PALE = '#eaf2fd', ZEBRA = '#f8fafd';
    const blueFill = (x0, x1) => { const gr = doc.linearGradient(x0, 0, x1, 0); gr.stop(0, '#1f5fb8').stop(1, '#3b8de0'); return gr; };
    const validUntil = (() => { const d = new Date(q.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + (q.validDays || 0)); return dmy(d.toISOString().slice(0, 10)); })();

    // ---- header: gradient strip, logo and company on the left, the document title on the right ----
    const g = doc.linearGradient(0, 0, W, 0); g.stop(0, NAVY).stop(1, BLUE);
    doc.rect(0, 0, W, 8).fill(g);
    let tx = M;
    if (fs.existsSync(LOGO)) { doc.image(LOGO, M, 24, { width: 56 }); tx = M + 68; }
    put(doc, 'AR TRADE INTERNATIONAL', tx, 30, { size: 15, bold: true, color: NAVY });
    put(doc, 'Committed to better service', tx, 50, { size: 9, bold: true, color: BLUE });
    put(doc, site.address || '159 (4th Floor), Santinagar, Dhaka-1217', tx, 65, { size: 8, color: MUTED });
    // the QR code sits at the right end of the header: scanning it shows the quotation number, date and net amount
    const hq = 58, hx = RIGHT - hq;
    doc.image(qr, hx, 18, { width: hq });
    put(doc, 'Scan to verify', hx + hq / 2, 78, { size: 6.2, bold: true, align: 'center', color: NAVY });
    const tr = hx - 14;
    put(doc, 'QUOTATION', tr, 24, { size: 21, bold: true, color: NAVY, align: 'right' });
    put(doc, q.id, tr, 52, { size: 10.5, bold: true, color: BLUE, align: 'right' });
    put(doc, dmy(q.date), tr, 68, { size: 9, color: MUTED, align: 'right' });
    doc.moveTo(M, 94).lineTo(RIGHT, 94).lineWidth(1.6).strokeColor(BLUE).stroke();

    // ---- two cards: who it is for, and the quotation details ----
    const colW = (RIGHT - M - 14) / 2;
    const left = [{ t: String(q.toName).toUpperCase(), bold: true, size: 11, color: NAVY }];
    if (q.attend || q.desig) left.push({ t: [q.attend, q.desig].filter(Boolean).join(', '), size: 9.5 });
    if (q.mobile) left.push({ t: q.mobile, size: 9.5 });
    if (q.email) left.push({ t: q.email, size: 9.5 });
    for (const l of wrapText(doc, q.address || '', colW - 24, 9, false)) left.push({ t: l, size: 9, color: MUTED });
    const right = [['Quotation no.', q.id], ['Date', dmy(q.date)], ['Valid until', `${validUntil} (${q.validDays} day${q.validDays === 1 ? '' : 's'})`], ['Prepared by', q.signerName || q.by || '']].filter(r => r[1]);
    const boxTop = 108, boxH = Math.max(34 + left.length * 14, 34 + right.length * 15) + 4;
    doc.roundedRect(M, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    doc.roundedRect(M + colW + 14, boxTop, colW, boxH, 10).fillAndStroke(SOFT, LINE);
    put(doc, 'QUOTATION FOR', M + 12, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    left.forEach((l, i) => put(doc, l.t, M + 12, boxTop + 27 + i * 14, { size: l.size, bold: l.bold, color: l.color || INK }));
    const rx = M + colW + 14 + 12;
    put(doc, 'DETAILS', rx, boxTop + 11, { size: 7.5, bold: true, color: BLUE });
    right.forEach(([k, v], i) => { put(doc, k, rx, boxTop + 27 + i * 15, { size: 9, color: MUTED }); put(doc, v, rx + colW - 24, boxTop + 27 + i * 15, { size: 9.5, bold: true, align: 'right' }); });
    let y = boxTop + boxH + 18;

    // ---- subject and covering letter ----
    if (String(q.subject || '').trim()) {
      const sub = wrapText(doc, q.subject, RIGHT - M - 14, 11, true);
      doc.roundedRect(M, y - 1, 3.5, sub.length * 14 + 2, 1.5).fill(BLUE);
      sub.forEach((l, i) => put(doc, l, M + 12, y + i * 14, { size: 11, bold: true, color: NAVY }));
      y += sub.length * 14 + 10;
    }
    put(doc, 'Dear Sir,', M, y, { size: 9.5, bold: true }); y += 15;
    const sentence = s => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()) : ''; };
    const intro = q.intro && q.intro === q.intro.toUpperCase() ? sentence(q.intro) : q.intro;
    for (const l of wrapText(doc, intro, RIGHT - M, 9, false)) { put(doc, l, M, y, { size: 9, color: '#2b3348' }); y += 12.5; }
    y += 10;

    // ---- items ----
    const X = { sl: M + 12, desc: M + 40, qty: M + 262, war: M + 328, price: M + 428, amt: RIGHT - 12 };
    const head = () => {
      doc.roundedRect(M, y, RIGHT - M, 24, 7).fill(blueFill(M, RIGHT));
      put(doc, 'SL', X.sl, y + 8, { size: 8, bold: true, color: '#ffffff' }); put(doc, 'DESCRIPTION', X.desc, y + 8, { size: 8, bold: true, color: '#ffffff' });
      put(doc, 'QTY', X.qty, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'center' }); put(doc, 'WARRANTY', X.war, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'center' });
      put(doc, 'UNIT PRICE', X.price, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'right' }); put(doc, 'AMOUNT', X.amt, y + 8, { size: 8, bold: true, color: '#ffffff', align: 'right' });
      y += 28;
    };
    head();
    q.lines.forEach((l, i) => {
      const ls = wrapText(doc, l.description, 190, 9.5, false);
      const rowH = Math.max(1, ls.length) * 12.5 + 9;
      if (y + rowH > H - 100) { doc.addPage(); y = 40; head(); }
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

    // ---- terms (left) and totals (right) ----
    if (y + 215 > H - 70) { doc.addPage(); y = 40; }
    y += 12;
    const notes = String(q.notes || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!notes.some(n => /valid/i.test(n))) notes.push(`Quotation valid only for ${q.validDays} days.`);
    const noteLines = notes.map(n => wrapText(doc, n, 238, 8.5, false));
    const termsH = Math.max(34 + noteLines.reduce((t, ls) => t + ls.length * 11.5 + 3, 0), 148);
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
    doc.roundedRect(bx, ny2, bw, 40, 9).fill(blueFill(bx, RIGHT));
    put(doc, 'NET PAYABLE', bx + 14, ny2 + 15, { size: 8.5, bold: true, color: '#d6e8fc' });
    put(doc, money(q.net), RIGHT - 14, ny2 + 11, { size: 17, bold: true, color: '#ffffff', align: 'right' });
    y = Math.max(y + termsH, ny2 + 40) + 10;

    // ---- amount in words ----
    doc.roundedRect(M, y, RIGHT - M, 30, 8).fill(PALE);
    put(doc, 'IN WORDS', M + 12, y + 6, { size: 6.8, bold: true, color: BLUE });
    put(doc, `Taka ${words(q.net).toLowerCase().replace(/(^| )([a-z])/g, (_, a, b) => a + b.toUpperCase())} only.`, M + 12, y + 16, { size: 9.5, bold: true, color: NAVY });
    y += 42;

    // ---- closing block: signer (left), customer acceptance (middle), QR code (right) ----
    if (y + 78 > H - 64) { doc.addPage(); y = 52; }
    const top2 = y;
    put(doc, 'Best regards,', M, top2, { size: 8.5, color: MUTED });
    const lineY = top2 + 36;
    doc.moveTo(M, lineY).lineTo(M + 175, lineY).lineWidth(0.7).strokeColor(INK).stroke();
    put(doc, String(q.signerName || q.by || '').toUpperCase(), M, lineY + 5, { size: 9.5, bold: true, color: NAVY });
    let sy = lineY + 19;
    for (const [k, v] of [['Desig:', q.signerDesig], ['Dep:', q.signerDept], ['Cell/wa.me:', q.signerCell]]) { if (v) { put(doc, k + ' ' + v, M, sy, { size: 8 }); sy += 10.5; } }
    put(doc, 'For AR Trade International', M, sy + 3, { size: 7.5, color: MUTED });
    const mx = M + 260;
    put(doc, 'Accepted by the customer', mx, top2, { size: 8.5, color: MUTED });
    doc.moveTo(mx, lineY).lineTo(mx + 200, lineY).lineWidth(0.7).strokeColor(INK).stroke();
    put(doc, 'Name, signature, date', mx, lineY + 5, { size: 7.5, color: MUTED });

    // ---- footer on every page ----
    const foot = () => {
      doc.moveTo(M, H - 62).lineTo(RIGHT, H - 62).lineWidth(0.6).strokeColor(LINE).stroke();
      put(doc, 'Management has the right to change any term or condition at any time without prior notice.', W / 2, H - 55, { size: 7, bold: true, align: 'center', color: BLUE });
      put(doc, `Office: ${site.address || '159 (4th Floor), Santinagar, Dhaka-1217'}${site.phone ? '   ·   Phone: ' + site.phone : ''}`, W / 2, H - 44, { size: 7, align: 'center', color: INK });
      put(doc, [site.email ? 'E-mail: ' + site.email : '', 'Website: www.artradeinternational.com'].filter(Boolean).join('   ·   '), W / 2, H - 34, { size: 7, align: 'center', color: MUTED });
    };
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) { doc.switchToPage(range.start + i); foot(); }
    doc.end();
  });
}
const siteInfo = async () => { try { return JSON.parse((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v || '{}'); } catch { return {}; } };
router.get('/:id/pdf', guard(VIEW), wrap(async (req, res) => {
  const q = await load(req.params.id);
  const pdf = await buildQuotePdf(q, await siteInfo());
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.id}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
}));

const EMAIL_RE = /^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/;
/** "a@x.com, b@y.com; c@z.com" -> ['a@x.com', 'b@y.com', 'c@z.com'] (lower case, no repeats); throws when one of them is not an address. */
function addressList(v, label) {
  const list = [...new Set(String(v || '').split(/[;,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (list.length > 10) throw fail(400, `${label}: at most 10 addresses`);
  const bad = list.find(a => !EMAIL_RE.test(a) || a.length > 160);
  if (bad) throw fail(400, `${label}: "${bad}" is not a valid email address`);
  return list;
}
router.post('/:id/email', guard(MANAGE), wrap(async (req, res) => {
  const q = await load(req.params.id);
  const to = String(req.body?.to || q.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(to) || to.length > 160) throw fail(400, 'Enter one valid email address for the customer');
  const cc = addressList(req.body?.cc, 'CC').filter(a => a !== to);
  const bcc = addressList(req.body?.bcc, 'BCC').filter(a => a !== to && !cc.includes(a));
  if (!mailReady('quote')) throw fail(409, 'Email sending is not set up yet. ' + mailSetupHint('quote'));
  const site = await siteInfo();
  const money = n => '\u09f3 ' + Math.round(Number(n) || 0).toLocaleString('en-US');
  const note = String(req.body?.message || '').trim().slice(0, 1000);
  const pdf = await buildQuotePdf(q, site);
  await sendMail({
    channel: 'quote', to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined, replyTo: site.email || undefined, subject: `Quotation ${q.id} from AR Trade International`,
    text: `Dear ${q.attend || q.toName},\n\n${note ? note + '\n\n' : ''}Please find our quotation ${q.id}${q.subject ? ' (' + q.subject + ')' : ''} attached as a PDF.\n\nNet payable: ${money(q.net)}\nValid for ${q.validDays} days.\n\nBest regards,\n${q.signerName || 'AR Trade International'}\nAR Trade International`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#0b1631"><p>Dear ${esc(q.attend || q.toName)},</p>${note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : ''}<p>Please find our quotation <b>${esc(q.id)}</b>${q.subject ? ' (' + esc(q.subject) + ')' : ''} attached as a PDF.</p><p>Net payable: <b>${esc(money(q.net))}</b><br>Valid for ${q.validDays} days.</p><p>Best regards,<br>${esc(q.signerName || 'AR Trade International')}<br>AR Trade International</p></div>`,
    attachments: [{ filename: q.id + '.pdf', content: pdf, contentType: 'application/pdf' }]
  });
  if (q.status === 'Draft') await pool.query("UPDATE quotations SET status = 'Sent' WHERE id = ? AND status = 'Draft'", [q.id]);
  res.json({ ok: true, to, cc, bcc });
}));

// ---------- share by link (WhatsApp, SMS, anywhere) ----------
// A quotation gets a long random token the first time it is shared. Anyone holding the link can open that one PDF, nothing else.
router.post('/:id/share', guard(MANAGE), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT id, share_token FROM quotations WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Quotation not found');
  const token = r.share_token || crypto.randomBytes(24).toString('hex');
  if (!r.share_token) await pool.query('UPDATE quotations SET share_token = ? WHERE id = ?', [token, r.id]);
  await pool.query("UPDATE quotations SET status = 'Sent' WHERE id = ? AND status = 'Draft'", [r.id]);
  res.json({ token });
}));
router.get('/shared/:file', wrap(async (req, res) => {
  const m = String(req.params.file).match(/^([a-f0-9]{48})\.pdf$/);
  if (!m) throw fail(404, 'This link is not valid');
  const [[r]] = await pool.query('SELECT id FROM quotations WHERE share_token = ?', [m[1]]);
  if (!r) throw fail(404, 'This link is not valid any more');
  const q = await load(r.id);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.id}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' }).send(await buildQuotePdf(q, await siteInfo()));
}));

export { router as quoteRouter };
