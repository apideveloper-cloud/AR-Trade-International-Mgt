// Purchasing & stock: vendors, goods receipts (purchase bills), stock ledger, damage, returns to vendors and vendor payments.
// Mounted at /api/inv. Reading needs inventory.view, every change needs inventory.manage.
//   Vendor balance (what we owe) = opening balance + bills (receipts) - returns - payments.
//   Every change to products.stock made here also writes one row to stock_moves, so each number can be explained.
import { Router } from 'express';
import { pool } from './db.js';
import sanitizeHtml from 'sanitize-html';
import { guard } from './admin.js';
import { SAN } from './adminContent.js';
import { assignSlug } from './productSlugs.js';
import { D, fail, int, iso, localImg, monthBounds, nextSeq, text, today, tx, wrap } from './util.js';
import { addAmount, addRange, addSearch, pageOf, whereOf, wantsPage } from './listing.js';

const router = Router();
const VIEW = 'inventory.view', MANAGE = 'inventory.manage', APPROVE = 'inventory.approve';
// A purchase moves Pending -> Approved -> Stocked (or Rejected). It is a bill on the vendor's account once Approved, and adds to stock only when Stocked.
const BILLED = "status IN ('Approved','Stocked')";
const METHODS = ['Cash', 'Bank transfer', 'bKash', 'Nagad', 'Cheque'];
const LOW = 5; // same "low stock" line the Products page uses

/** Next vendor profile ID: VEN-YY-00001. The number restarts at 00001 every year (YY = the year the vendor was added). */
async function nextVendorCode(yy) {
  const prefix = `VEN-${yy}-`;
  await pool.query('CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, v BIGINT NOT NULL)');
  await pool.query('INSERT IGNORE INTO counters (name, v) SELECT ?, COALESCE(MAX(CAST(SUBSTRING(code, ?) AS UNSIGNED)), 0) FROM field_vendors WHERE code LIKE ?', ['ven_' + yy, prefix.length + 1, prefix + '%']);
  const [r] = await pool.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', ['ven_' + yy]);
  return prefix + String(r.insertId).padStart(5, '0');
}
/** The vendor invoice number of a purchase: VSI-YY-00001, restarting every year (YY = the purchase year). `peek` shows the next one without using it. */
async function nextInvoiceNo(yy, peek = false) {
  const prefix = `VSI-${yy}-`;
  const [[m]] = await pool.query('SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, ?) AS UNSIGNED)), 0) n FROM stock_receipts WHERE invoice_no LIKE ?', [prefix.length + 1, prefix + '%']);
  await pool.query('CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, v BIGINT NOT NULL)');
  if (peek) {
    const [[c]] = await pool.query('SELECT v FROM counters WHERE name = ?', ['vsi_' + yy]).then(r => (r[0].length ? r : [[{ v: 0 }]]));
    return prefix + String(Math.max(Number(m.n), Number(c.v)) + 1).padStart(5, '0');
  }
  await pool.query('INSERT IGNORE INTO counters (name, v) VALUES (?, ?)', ['vsi_' + yy, Number(m.n)]);
  await pool.query('UPDATE counters SET v = GREATEST(v, ?) WHERE name = ?', [Number(m.n), 'vsi_' + yy]);
  const [r] = await pool.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', ['vsi_' + yy]);
  return prefix + String(r.insertId).padStart(5, '0');
}
/** Gives an ID to every vendor that has none (older ones, and those added by the field app), oldest first. */
async function fillVendorCodes() {
  const [rows] = await pool.query("SELECT id, created_at FROM field_vendors WHERE code IS NULL OR code = '' ORDER BY created_at, id");
  for (const r of rows) await pool.query('UPDATE field_vendors SET code = ? WHERE id = ?', [await nextVendorCode(String(new Date(r.created_at).getFullYear()).slice(2)), r.id]);
}

export async function ensureInventory() {
  await pool.query(`CREATE TABLE IF NOT EXISTS field_vendors (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160) NOT NULL, kind VARCHAR(60) NOT NULL DEFAULT '', phone VARCHAR(30) NOT NULL DEFAULT '', email VARCHAR(160) NOT NULL DEFAULT '', address VARCHAR(300) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_vendor_name (name))`);
  const [vc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'field_vendors'");
  const have = new Set(vc.map(r => r.c));
  for (const [c, def] of [['contact', "VARCHAR(120) NOT NULL DEFAULT ''"], ['opening', 'INT NOT NULL DEFAULT 0'], ['active', 'TINYINT(1) NOT NULL DEFAULT 1'], ['note', "VARCHAR(300) NOT NULL DEFAULT ''"], ['code', 'VARCHAR(20) NULL'], ['pic_desig', "VARCHAR(80) NOT NULL DEFAULT ''"], ['pic_phone', "VARCHAR(30) NOT NULL DEFAULT ''"], ['vtype', "VARCHAR(10) NOT NULL DEFAULT 'Local'"]]) {
    if (!have.has(c)) await pool.query(`ALTER TABLE field_vendors ADD COLUMN ${c} ${def}`);
  }
  await fillVendorCodes();
  const [ix] = await pool.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'field_vendors' AND INDEX_NAME = 'uq_vendor_code' LIMIT 1");
  if (!ix.length) await pool.query('ALTER TABLE field_vendors ADD UNIQUE KEY uq_vendor_code (code)');
  // The purchase workflow was added later: purchases that already exist were received straight into stock, so they count as Stocked.
  const addCols = async (table, cols) => {
    const [cc] = await pool.query('SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
    const have2 = new Set(cc.map(r => r.c));
    for (const [c, def] of cols) if (!have2.has(c)) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${c} ${def}`);
  };
  const q = s => pool.query(s);
  await q(`CREATE TABLE IF NOT EXISTS stock_receipts (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, po_id VARCHAR(20) NULL, invoice_no VARCHAR(60) NOT NULL DEFAULT '', received_on DATE NOT NULL, note VARCHAR(300) NOT NULL DEFAULT '', total INT NOT NULL DEFAULT 0, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, received_on), KEY idx_po (po_id))`);
  await q(`CREATE TABLE IF NOT EXISTS stock_receipt_items (id INT AUTO_INCREMENT PRIMARY KEY, receipt_id VARCHAR(20) NOT NULL, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, KEY idx_receipt (receipt_id))`);
  await addCols('stock_receipts', [['status', "VARCHAR(12) NOT NULL DEFAULT 'Stocked'"], ['decided_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['decided_at', 'TIMESTAMP NULL'], ['decision_note', "VARCHAR(300) NOT NULL DEFAULT ''"], ['stocked_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['stocked_at', 'TIMESTAMP NULL']]);
  await addCols('stock_receipt_items', [['sale_price', 'INT NULL'], ['remarks', "VARCHAR(200) NOT NULL DEFAULT ''"], ['discount', 'INT NOT NULL DEFAULT 0']]);
  await addCols('stock_receipts', [['reference_no', "VARCHAR(60) NOT NULL DEFAULT ''"]]);
  await q(`CREATE TABLE IF NOT EXISTS stock_moves (id INT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, kind VARCHAR(20) NOT NULL, qty INT NOT NULL, unit_cost INT NULL, balance INT NOT NULL DEFAULT 0, ref VARCHAR(30) NOT NULL DEFAULT '', note VARCHAR(300) NOT NULL DEFAULT '', staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_product (product_id, id))`);
  await q(`CREATE TABLE IF NOT EXISTS stock_damages (id VARCHAR(20) PRIMARY KEY, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, reason VARCHAR(300) NOT NULL DEFAULT '', vendor_id INT NULL, damaged_on DATE NOT NULL, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_date (damaged_on))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_returns (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, receipt_id VARCHAR(20) NULL, returned_on DATE NOT NULL, reason VARCHAR(300) NOT NULL DEFAULT '', total INT NOT NULL DEFAULT 0, staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, returned_on))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_return_items (id INT AUTO_INCREMENT PRIMARY KEY, return_id VARCHAR(20) NOT NULL, product_id INT NOT NULL, name VARCHAR(255) NOT NULL, qty INT NOT NULL, unit_cost INT NOT NULL DEFAULT 0, KEY idx_return (return_id))`);
  await q(`CREATE TABLE IF NOT EXISTS vendor_payments (id VARCHAR(20) PRIMARY KEY, vendor_id INT NOT NULL, receipt_id VARCHAR(20) NULL, amount INT NOT NULL, method VARCHAR(20) NOT NULL DEFAULT 'Cash', reference VARCHAR(80) NOT NULL DEFAULT '', paid_on DATE NOT NULL, note VARCHAR(300) NOT NULL DEFAULT '', staff_name VARCHAR(120) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_vendor (vendor_id, paid_on), KEY idx_receipt (receipt_id))`);
}

/** Changes one product's stock by delta (never below zero) and records the movement. */
async function move(conn, { productId, delta, kind, ref, note, cost = null, by }) {
  const [[p]] = await conn.query('SELECT id, name, stock FROM products WHERE id = ? FOR UPDATE', [productId]);
  if (!p) throw fail(400, 'A product on the list no longer exists');
  const next = p.stock + delta;
  if (next < 0) throw fail(409, `Only ${p.stock} of "${p.name}" in stock, so ${-delta} cannot be taken out`);
  await conn.query('UPDATE products SET stock = ? WHERE id = ?', [next, p.id]);
  await conn.query('INSERT INTO stock_moves (product_id, kind, qty, unit_cost, balance, ref, note, staff_name) VALUES (?,?,?,?,?,?,?,?)', [p.id, kind, delta, cost, next, ref || '', text(note, 300), by]);
  return p;
}

/** Validates posted lines: [{ productId, qty, unitCost }] -> clean list with product names. */
async function cleanLines(conn, raw, { needCost = true } = {}) {
  const lines = (Array.isArray(raw) ? raw : []).slice(0, 60).map(l => ({ productId: parseInt(l.productId, 10), qty: int(l.qty, 100000), unitCost: int(l.unitCost), discount: int(l.discount) })).filter(l => l.productId && l.qty > 0);
  if (!lines.length) throw fail(400, 'Add at least one product with a quantity');
  if (needCost && lines.some(l => l.unitCost <= 0)) throw fail(400, 'Every product needs its buying price');
  if (lines.some(l => l.discount > l.qty * l.unitCost)) throw fail(400, 'A discount cannot be more than that product\'s amount');
  const [rows] = await conn.query('SELECT id, name FROM products WHERE id IN (?)', [lines.map(l => l.productId)]);
  return lines.map(l => { const p = rows.find(r => r.id === l.productId); if (!p) throw fail(400, 'A product on the list no longer exists'); return { ...l, name: p.name }; });
}
const sum = lines => lines.reduce((t, l) => t + l.qty * l.unitCost - (l.discount || 0), 0);
const vendorOf = async (conn, id) => {
  const [[v]] = await conn.query('SELECT id, name FROM field_vendors WHERE id = ?', [parseInt(id, 10)]);
  if (!v) throw fail(400, 'Choose a vendor first');
  return v;
};

// ---------- vendors ----------
const BAL = `(v.opening + COALESCE((SELECT SUM(total) FROM stock_receipts r WHERE r.vendor_id = v.id AND r.${BILLED}), 0) - COALESCE((SELECT SUM(total) FROM vendor_returns t WHERE t.vendor_id = v.id), 0) - COALESCE((SELECT SUM(amount) FROM vendor_payments p WHERE p.vendor_id = v.id), 0))`;
const vOut = r => ({
  id: r.id, code: r.code || '', name: r.name, vtype: r.vtype === 'Foreign' ? 'Foreign' : 'Local', kind: r.kind, contact: r.contact, picDesig: r.pic_desig || '', picPhone: r.pic_phone || '', phone: r.phone, email: r.email, address: r.address, note: r.note, active: !!r.active, opening: r.opening,
  bills: Number(r.bills || 0), returns: Number(r.rets || 0), paid: Number(r.paid || 0), balance: Number(r.balance || 0), lastBill: r.last_bill
});
router.get('/vendors', guard(VIEW), wrap(async (req, res) => {
  await fillVendorCodes();
  const cond = [], args = [];
  addSearch(cond, args, ['v.code', 'v.name', 'v.kind', 'v.contact', 'v.phone', 'v.email'], req.query.q);
  if (req.query.vtype === 'Local' || req.query.vtype === 'Foreign') { cond.push('v.vtype = ?'); args.push(req.query.vtype); }
  if (req.query.status === 'active') cond.push('v.active = 1');
  if (req.query.status === 'inactive') cond.push('v.active = 0');
  if (req.query.status === 'owing') cond.push(`${BAL} > 0`);
  if (req.query.status === 'advance') cond.push(`${BAL} < 0`);
  const where = whereOf(cond);
  const sel = `SELECT v.*, COALESCE((SELECT SUM(total) FROM stock_receipts r WHERE r.vendor_id = v.id AND r.${BILLED}), 0) bills, COALESCE((SELECT SUM(total) FROM vendor_returns t WHERE t.vendor_id = v.id), 0) rets,
    COALESCE((SELECT SUM(amount) FROM vendor_payments p WHERE p.vendor_id = v.id), 0) paid, ${BAL} balance, (SELECT ${D('MAX(received_on)')} FROM stock_receipts r WHERE r.vendor_id = v.id) last_bill FROM field_vendors v ${where} ORDER BY v.active DESC, v.name`;
  if (!wantsPage(req)) { const [rows] = await pool.query(sel, args); return res.json({ items: rows.map(vOut) }); }
  const { size, offset } = pageOf(req);
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(${BAL}), 0) payable, COALESCE(SUM(${BAL} > 0), 0) owing FROM field_vendors v ${where}`, args);
  const [rows] = await pool.query(`${sel} LIMIT ${size} OFFSET ${offset}`, args);
  res.json({ total: Number(t.n), rows: rows.map(vOut), totals: { payable: Number(t.payable), owing: Number(t.owing) } });
}));
const vendorBody = b => ({ name: text(b.name, 160), vtype: b.vtype === 'Foreign' ? 'Foreign' : 'Local', kind: text(b.kind, 60), contact: text(b.contact, 120), picDesig: text(b.picDesig, 80), picPhone: text(b.picPhone, 30), phone: text(b.phone, 30), email: text(b.email, 160), address: text(b.address, 300), note: text(b.note, 300), opening: Math.round(Number(b.opening) || 0), active: b.active === false ? 0 : 1 });
router.post('/vendors', guard(MANAGE), wrap(async (req, res) => {
  const v = vendorBody(req.body);
  if (!v.name) throw fail(400, 'Vendor name is required');
  try {
    const code = await nextVendorCode(String(new Date(Date.now() + 6 * 3600e3).getUTCFullYear()).slice(2));
    const [r] = await pool.query('INSERT INTO field_vendors (code, name, vtype, kind, contact, pic_desig, pic_phone, phone, email, address, note, opening, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [code, v.name, v.vtype, v.kind, v.contact, v.picDesig, v.picPhone, v.phone, v.email, v.address, v.note, v.opening, v.active]);
    res.json({ id: r.insertId, code });
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(409, 'A vendor with this name already exists'); throw e; }
}));
router.put('/vendors/:id', guard(MANAGE), wrap(async (req, res) => {
  const v = vendorBody(req.body);
  if (!v.name) throw fail(400, 'Vendor name is required');
  try { await pool.query('UPDATE field_vendors SET name=?, vtype=?, kind=?, contact=?, pic_desig=?, pic_phone=?, phone=?, email=?, address=?, note=?, opening=?, active=? WHERE id=?', [v.name, v.vtype, v.kind, v.contact, v.picDesig, v.picPhone, v.phone, v.email, v.address, v.note, v.opening, v.active, req.params.id]); } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(409, 'A vendor with this name already exists'); throw e; }
  res.json({ ok: true });
}));
router.delete('/vendors/:id', guard(MANAGE), wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [[u]] = await pool.query('SELECT (SELECT COUNT(*) FROM stock_receipts WHERE vendor_id = ?) + (SELECT COUNT(*) FROM vendor_payments WHERE vendor_id = ?) + (SELECT COUNT(*) FROM vendor_returns WHERE vendor_id = ?) + (SELECT COUNT(*) FROM field_purchase_orders WHERE vendor_id = ?) n', [id, id, id, id]).catch(() => [[{ n: 1 }]]);
  if (Number(u.n)) throw fail(409, 'This vendor has purchases or payments on record. Mark it inactive instead of deleting it.');
  await pool.query('DELETE FROM field_vendors WHERE id = ?', [id]);
  res.json({ ok: true });
}));

/** Statement: opening balance, then bills, returns and payments in date order with a running balance. */
/** All vendor transactions in one list: bills (approved purchases), returns to vendors and payments, newest first. */
router.get('/transactions', guard(VIEW), wrap(async (req, res) => {
  const union = `SELECT 'Bill' type, r.id ref, r.vendor_id, r.received_on d, r.total credit, 0 debit, CONCAT_WS(' \u00b7 ', NULLIF(r.invoice_no, ''), NULLIF(r.note, '')) info, r.created_at at FROM stock_receipts r WHERE r.${BILLED}
    UNION ALL SELECT 'Return', t.id, t.vendor_id, t.returned_on, 0, t.total, t.reason, t.created_at FROM vendor_returns t
    UNION ALL SELECT 'Payment', p.id, p.vendor_id, p.paid_on, 0, p.amount, CONCAT_WS(' \u00b7 ', p.method, NULLIF(p.reference, ''), NULLIF(p.receipt_id, '')), p.created_at FROM vendor_payments p`;
  const cond = [], args = [];
  const vendor = parseInt(req.query.vendor, 10);
  if (vendor) { cond.push('x.vendor_id = ?'); args.push(vendor); }
  if (['Bill', 'Return', 'Payment'].includes(req.query.type)) { cond.push('x.type = ?'); args.push(req.query.type); }
  addSearch(cond, args, ['x.ref', 'v.name', 'x.info'], req.query.q);
  addRange(cond, args, 'x.d', req);
  addAmount(cond, args, 'GREATEST(x.credit, x.debit)', req);
  const from = `FROM (${union}) x JOIN field_vendors v ON v.id = x.vendor_id ${whereOf(cond)}`;
  const { size, offset } = pageOf(req);
  const [rows] = await pool.query(`SELECT x.type, x.ref, x.vendor_id, v.name vendor, ${D('x.d')} d, x.credit, x.debit, x.info, x.at ${from} ORDER BY x.d DESC, x.at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(x.credit), 0) bills, COALESCE(SUM(IF(x.type = 'Return', x.debit, 0)), 0) returns, COALESCE(SUM(IF(x.type = 'Payment', x.debit, 0)), 0) paid ${from}`, args);
  res.json({ total: Number(t.n), rows: rows.map(r => ({ type: r.type, ref: r.ref, vendorId: r.vendor_id, vendor: r.vendor, date: r.d, bill: Number(r.credit), settled: Number(r.debit), info: r.info || '' })), totals: { bills: Number(t.bills), returns: Number(t.returns), paid: Number(t.paid) } });
}));
router.get('/vendors/:id/ledger', guard(VIEW), wrap(async (req, res) => {
  await fillVendorCodes();
  const id = parseInt(req.params.id, 10);
  const [[v]] = await pool.query('SELECT * FROM field_vendors WHERE id = ?', [id]);
  if (!v) throw fail(404, 'Vendor not found');
  const [bills] = await pool.query(`SELECT id, ${D('received_on')} d, invoice_no, total, created_at FROM stock_receipts WHERE vendor_id = ? AND ${BILLED}`, [id]);
  const [rets] = await pool.query(`SELECT id, ${D('returned_on')} d, reason, total, created_at FROM vendor_returns WHERE vendor_id = ?`, [id]);
  const [pays] = await pool.query(`SELECT id, ${D('paid_on')} d, method, reference, receipt_id, amount, created_at FROM vendor_payments WHERE vendor_id = ?`, [id]);
  const rows = [
    ...bills.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Bill', text: b.invoice_no ? 'Invoice ' + b.invoice_no : 'Goods received', debit: 0, credit: b.total })),
    ...rets.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Return', text: b.reason || 'Goods returned', debit: b.total, credit: 0 })),
    ...pays.map(b => ({ at: b.created_at, d: b.d, ref: b.id, type: 'Payment', text: [b.method, b.reference, b.receipt_id && 'for ' + b.receipt_id].filter(Boolean).join(' · '), debit: b.amount, credit: 0 }))
  ].sort((a, b) => (a.d === b.d ? new Date(a.at) - new Date(b.at) : a.d < b.d ? -1 : 1));
  let bal = v.opening;
  res.json({ vendor: vOut({ ...v, bills: 0, returns: 0, paid: 0, balance: 0 }), opening: v.opening, items: rows.map(r => ({ ...r, balance: (bal += r.credit - r.debit) })), balance: bal });
}));

// ---------- products (picker) and stock ----------
router.get('/products', guard(VIEW), wrap(async (req, res) => {
  const q = '%' + text(req.query.q, 60).replace(/[%_]/g, '') + '%';
  const [rows] = await pool.query(`SELECT id, brand, name, price, stock, img, (SELECT unit_cost FROM stock_moves m WHERE m.product_id = products.id AND m.kind = 'Purchase' ORDER BY m.id DESC LIMIT 1) lastCost FROM products WHERE (name LIKE ? OR brand LIKE ? OR CAST(id AS CHAR) LIKE ?) ORDER BY active DESC, name LIMIT 25`, [q, q, q]);
  res.json({ items: rows });
}));
/** The categories a new product can be filed under (the Products page is only for editing). */
router.get('/categories', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, title FROM categories ORDER BY sort_order');
  res.json({ items: rows });
}));
/** A product that is bought for the first time is created here, with the purchase. Price and stock start at 0 and stay hidden from the shop until its first purchase is stocked in. */
router.post('/products', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body || {};
  const name = text(b.name, 200), brand = text(b.brand, 80), cat = text(b.cat, 60);
  if (!name || !brand || !cat) throw fail(400, 'Name, brand and category are required');
  const [[c]] = await pool.query('SELECT id FROM categories WHERE id = ?', [cat]);
  if (!c) throw fail(400, 'Choose a category');
  const [[dup]] = await pool.query('SELECT id FROM products WHERE name = ? AND brand = ? LIMIT 1', [name, brand]);
  if (dup) throw fail(409, 'This product already exists (#' + dup.id + '). Search for it instead.');
  const [[{ m }]] = await pool.query('SELECT COALESCE(MAX(id), 29999) m FROM products WHERE id >= 30000');
  const id = Math.max(30000, m + 1);
  const gallery = (Array.isArray(b.gallery) ? b.gallery : []).map(u => localImg(u)).filter(Boolean).slice(0, 12);
  const img = localImg(b.img) || gallery[0] || null;
  await tx(async conn => {
    await conn.query("INSERT INTO products (id, category_id, brand, name, old_price, price, img, stock, is_new, active, part, tech, color, yield_info, spec, compat, description, gallery, meta_title, meta_desc, meta_keywords, edited) VALUES (?,?,?,?,0,0,?,0,1,0,?,?,?,?,?,?,?,?,?,?,?,1)",
      [id, cat, brand, name, img, text(b.part, 80), text(b.tech, 80), text(b.color, 60), text(b.yield, 80), text(b.spec, 200), text(b.compat, 500), sanitizeHtml(String(b.description || ''), SAN), JSON.stringify(gallery), text(b.metaTitle, 160), text(b.metaDesc, 320), text(b.metaKeywords, 500)]);
    const specs = (Array.isArray(b.specs) ? b.specs : []).map(s => [text(s.name, 80), text(s.value, 500)]).filter(s => s[0] && s[1]).slice(0, 40);
    for (const [i, [n, v]] of specs.entries()) await conn.query('INSERT INTO product_specs (product_id, position, name, value) VALUES (?,?,?,?)', [id, i, n, v]);
  });
  await assignSlug(pool, id);
  res.json({ id, brand, name, price: 0, stock: 0, img: img || '', lastCost: null });
}));
router.get('/stock', guard(VIEW), wrap(async (req, res) => {
  const filter = req.query.filter;
  const cond = [], args = [];
  addSearch(cond, args, ['name', 'brand', 'sku'], req.query.q);
  if (filter === 'low') cond.push(`stock BETWEEN 1 AND ${LOW}`);
  if (filter === 'out') cond.push('stock <= 0');
  if (filter === 'hidden') cond.push('active = 0');
  if (req.query.brand) { cond.push('brand = ?'); args.push(text(req.query.brand, 80)); }
  const where = whereOf(cond);
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 300, offset: 0 };
  const [rows] = await pool.query(`SELECT id, brand, name, price, stock, img, active, (SELECT unit_cost FROM stock_moves m WHERE m.product_id = products.id AND m.kind = 'Purchase' ORDER BY m.id DESC LIMIT 1) last_cost FROM products ${where} ORDER BY stock, name LIMIT ${size} OFFSET ${offset}`, args);
  const [[t]] = await pool.query(`SELECT COUNT(*) products, COALESCE(SUM(stock), 0) units, COALESCE(SUM(price * stock), 0) value, COALESCE(SUM(stock <= 0 AND active = 1), 0) out_n, COALESCE(SUM(stock BETWEEN 1 AND ${LOW} AND active = 1), 0) low_n FROM products`);
  const out = rows.map(r => ({ id: r.id, brand: r.brand, name: r.name, price: r.price, stock: r.stock, img: r.img, active: !!r.active, lastCost: r.last_cost }));
  const body = { low: LOW, items: out, totals: { products: Number(t.products), units: Number(t.units), value: Number(t.value), out: Number(t.out_n), lowCount: Number(t.low_n) } };
  if (!paged) return res.json(body);
  const [[c]] = await pool.query(`SELECT COUNT(*) n FROM products ${where}`, args);
  const [brands] = await pool.query("SELECT DISTINCT brand FROM products WHERE brand <> '' ORDER BY brand");
  res.json({ ...body, total: Number(c.n), rows: out, brands: brands.map(b => b.brand) });
}));
router.get('/stock/:id/moves', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, kind, qty, unit_cost, balance, ref, note, staff_name, created_at FROM stock_moves WHERE product_id = ? ORDER BY id DESC LIMIT 100', [req.params.id]);
  res.json({ items: rows.map(m => ({ id: m.id, kind: m.kind, qty: m.qty, unitCost: m.unit_cost, balance: m.balance, ref: m.ref, note: m.note, by: m.staff_name, at: m.created_at })) });
}));
router.post('/stock/adjust', guard(MANAGE), wrap(async (req, res) => {
  const productId = parseInt(req.body.productId, 10), counted = Math.round(Number(req.body.counted));
  const note = text(req.body.note, 300);
  if (!productId || !Number.isInteger(counted) || counted < 0) throw fail(400, 'Enter the quantity you counted');
  if (!note) throw fail(400, 'Write the reason for the correction');
  await tx(async conn => {
    const [[p]] = await conn.query('SELECT stock FROM products WHERE id = ? FOR UPDATE', [productId]);
    if (!p) throw fail(404, 'Product not found');
    if (counted !== p.stock) await move(conn, { productId, delta: counted - p.stock, kind: 'Adjust', note, by: req.staff.name });
  });
  res.json({ ok: true });
}));

// ---------- purchases (goods receipts) ----------
const billedOf = st => st === 'Approved' || st === 'Stocked';
const PAID = '(SELECT COALESCE(SUM(amount), 0) FROM vendor_payments p WHERE p.receipt_id = r.id)';
router.get('/receipts', guard(VIEW), wrap(async (req, res) => {
  const vendor = parseInt(req.query.vendor, 10);
  const cond = [], args = [];
  if (vendor) { cond.push('r.vendor_id = ?'); args.push(vendor); }
  addSearch(cond, args, ['r.id', 'r.invoice_no', 'r.reference_no', 'v.name', 'r.po_id'], req.query.q);
  addRange(cond, args, 'r.received_on', req);
  addAmount(cond, args, 'r.total', req);
  if (['Pending', 'Approved', 'Stocked', 'Rejected'].includes(req.query.stage)) { cond.push('r.status = ?'); args.push(req.query.stage); }
  if (req.query.status === 'due') cond.push(`r.${BILLED} AND r.total > ${PAID}`);
  if (req.query.status === 'paid') cond.push(`r.${BILLED} AND r.total <= ${PAID}`);
  const from = `FROM stock_receipts r JOIN field_vendors v ON v.id = r.vendor_id ${whereOf(cond)}`;
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 200, offset: 0 };
  const [rows] = await pool.query(`SELECT r.id, r.vendor_id, v.name vendor, r.po_id, r.invoice_no, r.reference_no, ${D('r.received_on')} d, r.total, r.staff_name, r.note, r.status,
    (SELECT COALESCE(SUM(qty), 0) FROM stock_receipt_items i WHERE i.receipt_id = r.id) pcs, ${PAID} paid
    ${from} ORDER BY r.received_on DESC, r.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(r => ({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, poId: r.po_id, invoiceNo: r.invoice_no, referenceNo: r.reference_no, date: r.d, total: r.total, pcs: Number(r.pcs), paid: Number(r.paid), due: billedOf(r.status) ? Math.max(0, r.total - Number(r.paid)) : 0, status: r.status, by: r.staff_name, note: r.note }));
  if (!paged) return res.json({ items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(r.total), 0) total, COALESCE(SUM(${PAID}), 0) paid, COALESCE(SUM(r.${BILLED} AND r.total > ${PAID}), 0) due_n, COALESCE(SUM(r.status = 'Pending'), 0) pend, COALESCE(SUM(r.status = 'Approved'), 0) appr ${from}`, args);
  res.json({ total: Number(t.n), rows: items, items, totals: { bills: Number(t.n), total: Number(t.total), paid: Number(t.paid), due: Math.max(0, Number(t.total) - Number(t.paid)), dueCount: Number(t.due_n), pending: Number(t.pend), approved: Number(t.appr) } });
}));
router.get('/next-invoice', guard(VIEW), wrap(async (req, res) => {
  res.json({ invoiceNo: await nextInvoiceNo(iso(req.query.date, today()).slice(2, 4), true) });
}));
router.get('/receipts/:id', guard(VIEW), wrap(async (req, res) => {
  const [[r]] = await pool.query(`SELECT r.*, ${D('r.received_on')} d, v.name vendor, v.code vendor_code FROM stock_receipts r JOIN field_vendors v ON v.id = r.vendor_id WHERE r.id = ?`, [req.params.id]);
  if (!r) throw fail(404, 'Purchase not found');
  const [lines] = await pool.query('SELECT i.product_id, i.name, i.qty, i.unit_cost, i.discount, i.sale_price, i.remarks, p.price cur_price, p.img FROM stock_receipt_items i LEFT JOIN products p ON p.id = i.product_id WHERE i.receipt_id = ? ORDER BY i.id', [r.id]);
  const [pays] = await pool.query(`SELECT id, ${D('paid_on')} d, method, reference, amount FROM vendor_payments WHERE receipt_id = ? ORDER BY paid_on`, [r.id]);
  const paid = pays.reduce((t, p) => t + p.amount, 0);
  res.json({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, vendorCode: r.vendor_code || '', poId: r.po_id, invoiceNo: r.invoice_no, referenceNo: r.reference_no, createdAt: r.created_at, date: r.d, note: r.note, total: r.total, paid, due: billedOf(r.status) ? Math.max(0, r.total - paid) : 0, by: r.staff_name,
    status: r.status, decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note, stockedBy: r.stocked_by, stockedAt: r.stocked_at,
    lines: lines.map(l => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCost: l.unit_cost, discount: l.discount, total: l.qty * l.unit_cost - l.discount, salePrice: l.sale_price, remarks: l.remarks, currentPrice: l.cur_price, img: l.img || '' })), payments: pays.map(p => ({ id: p.id, date: p.d, method: p.method, reference: p.reference, amount: p.amount })) });
}));
/** Approved purchase orders that have not been received yet, so stock can be received against them. */
router.get('/open-orders', guard(VIEW), wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT p.id, p.vendor_id, v.name vendor, p.grand_total, ${D('p.deliver_by')} deliver_by FROM field_purchase_orders p JOIN field_vendors v ON v.id = p.vendor_id
    WHERE p.status = 'Approved' AND NOT EXISTS (SELECT 1 FROM stock_receipts r WHERE r.po_id = p.id AND r.status <> 'Rejected') ORDER BY p.created_at DESC LIMIT 60`).catch(() => [[]]);
  res.json({ items: rows.map(p => ({ id: p.id, vendorId: p.vendor_id, vendor: p.vendor, total: p.grand_total, deliverBy: p.deliver_by })) });
}));
router.get('/open-orders/:id', guard(VIEW), wrap(async (req, res) => {
  const [lines] = await pool.query('SELECT i.product_id, i.name, i.qty, i.unit_price FROM field_purchase_order_items i WHERE i.po_id = ? AND i.product_id IS NOT NULL ORDER BY i.id', [req.params.id]);
  res.json({ lines: lines.map(l => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCost: l.unit_price })) });
}));
router.post('/receipts', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body, by = req.staff.name;
  const out = await tx(async conn => {
    const v = await vendorOf(conn, b.vendorId);
    const lines = await cleanLines(conn, b.lines);
    const poId = text(b.poId, 20) || null;
    if (poId) {
      const [[dup]] = await conn.query("SELECT id FROM stock_receipts WHERE po_id = ? AND status <> 'Rejected' LIMIT 1", [poId]);
      if (dup) throw fail(409, `${poId} was already received as ${dup.id}`);
    }
    const id = await nextSeq('stock_grn', 'stock_receipts', 'GRN-', 1000);
    const total = sum(lines);
    const buyDate = iso(b.date, today());
    const invoiceNo = await nextInvoiceNo(buyDate.slice(2, 4));
    await conn.query("INSERT INTO stock_receipts (id, vendor_id, po_id, invoice_no, reference_no, received_on, note, total, staff_name, status) VALUES (?,?,?,?,?,?,?,?,?,'Pending')", [id, v.id, poId, invoiceNo, text(b.referenceNo, 60), buyDate, text(b.note, 300), total, by]);
    for (const l of lines) await conn.query('INSERT INTO stock_receipt_items (receipt_id, product_id, name, qty, unit_cost, discount) VALUES (?,?,?,?,?,?)', [id, l.productId, l.name, l.qty, l.unitCost, l.discount]);
    return { id, total, status: 'Pending', invoiceNo };
  });
  res.json(out);
}));
/** Step 2: approval. Only holders of inventory.approve (Master Admin and Admin). Once approved the purchase is a bill on the vendor's account. */
router.post('/receipts/:id/approve', guard(APPROVE), wrap(async (req, res) => {
  await tx(async conn => {
    const [[r]] = await conn.query('SELECT id, status FROM stock_receipts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw fail(404, 'Purchase not found');
    if (r.status !== 'Pending') throw fail(409, 'Only a purchase that is waiting for approval can be approved');
    const [items] = await conn.query('SELECT id, product_id, name FROM stock_receipt_items WHERE receipt_id = ? ORDER BY id', [r.id]);
    const given = new Map((Array.isArray(req.body?.lines) ? req.body.lines : []).map(l => [parseInt(l.productId, 10), l]));
    // approving means deciding the selling price of every product, with a remark: both are required
    for (const it of items) {
      const g = given.get(it.product_id) || {};
      const sale = int(g.salePrice), remarks = text(g.remarks, 200);
      if (sale <= 0) throw fail(400, `Enter the selling price of "${it.name}"`);
      if (remarks.length < 2) throw fail(400, `Write the remarks for "${it.name}"`);
      await conn.query('UPDATE stock_receipt_items SET sale_price = ?, remarks = ? WHERE id = ?', [sale, remarks, it.id]);
    }
    await conn.query("UPDATE stock_receipts SET status = 'Approved', decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?", [req.staff.name, text(req.body?.note, 300), r.id]);
  });
  res.json({ ok: true });
}));
router.post('/receipts/:id/reject', guard(APPROVE), wrap(async (req, res) => {
  const note = text(req.body?.note, 300);
  if (!note) throw fail(400, 'Write the reason for rejecting this purchase');
  const [r] = await pool.query("UPDATE stock_receipts SET status = 'Rejected', decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ? AND status = 'Pending'", [req.staff.name, note, req.params.id]);
  if (!r.affectedRows) throw fail(409, 'Only a purchase that is waiting for approval can be rejected');
  res.json({ ok: true });
}));
/** Step 3: after approval, put the goods into stock. Every product gets its selling price (and optional remarks) now. */
router.post('/receipts/:id/stock-in', guard(MANAGE), wrap(async (req, res) => {
  const by = req.staff.name;
  const out = await tx(async conn => {
    const [[r]] = await conn.query('SELECT id, status, vendor_id FROM stock_receipts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw fail(404, 'Purchase not found');
    if (r.status !== 'Approved') throw fail(409, r.status === 'Stocked' ? 'This purchase is already in stock' : 'The purchase must be approved before it goes into stock');
    const [[v]] = await conn.query('SELECT name FROM field_vendors WHERE id = ?', [r.vendor_id]);
    const [items] = await conn.query('SELECT id, product_id, qty, unit_cost, discount, sale_price, remarks FROM stock_receipt_items WHERE receipt_id = ? ORDER BY id', [r.id]);
    const given = new Map((Array.isArray(req.body?.lines) ? req.body.lines : []).map(l => [parseInt(l.productId, 10), l]));
    for (const it of items) {
      const g = given.get(it.product_id) || {};
      const sale = int(g.salePrice) || Number(it.sale_price) || 0;
      if (sale <= 0) throw fail(400, 'Enter the selling price for every product');
      const remarks = text(g.remarks, 200) || it.remarks || '';
      await conn.query('UPDATE stock_receipt_items SET sale_price = ?, remarks = ? WHERE id = ?', [sale, remarks, it.id]);
      const [[seen]] = await conn.query("SELECT 1 n FROM stock_moves WHERE product_id = ? AND kind = 'Purchase' LIMIT 1", [it.product_id]);
      await move(conn, { productId: it.product_id, delta: it.qty, kind: 'Purchase', ref: r.id, cost: Math.round((it.qty * it.unit_cost - it.discount) / it.qty), note: [v?.name, remarks].filter(Boolean).join(' · '), by });
      // the first purchase of a product made here (see POST /products) puts it on the shop
      await conn.query('UPDATE products SET price = ?, active = IF(?, 1, active) WHERE id = ?', [sale, seen ? 0 : 1, it.product_id]);
    }
    await conn.query("UPDATE stock_receipts SET status = 'Stocked', stocked_by = ?, stocked_at = NOW() WHERE id = ?", [by, r.id]);
    return { id: r.id, status: 'Stocked' };
  });
  res.json(out);
}));
/** A purchase that was never approved (or was rejected) can be removed; nothing has touched stock or the vendor's account. */
router.delete('/receipts/:id', guard(MANAGE), wrap(async (req, res) => {
  await tx(async conn => {
    const [[r]] = await conn.query('SELECT status FROM stock_receipts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw fail(404, 'Purchase not found');
    if (r.status !== 'Pending' && r.status !== 'Rejected') throw fail(409, 'Only a purchase that is waiting or rejected can be deleted');
    await conn.query('DELETE FROM stock_receipt_items WHERE receipt_id = ?', [req.params.id]);
    await conn.query('DELETE FROM stock_receipts WHERE id = ?', [req.params.id]);
  });
  res.json({ ok: true });
}));


// ---------- damage ----------
router.get('/damages', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['d.id', 'd.name', 'd.reason', 'v.name', 'd.staff_name'], req.query.q);
  if (parseInt(req.query.vendor, 10)) { cond.push('d.vendor_id = ?'); args.push(parseInt(req.query.vendor, 10)); }
  addRange(cond, args, 'd.damaged_on', req);
  const from = `FROM stock_damages d LEFT JOIN field_vendors v ON v.id = d.vendor_id ${whereOf(cond)}`;
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 200, offset: 0 };
  const [rows] = await pool.query(`SELECT d.id, d.product_id, d.name, d.qty, d.unit_cost, d.reason, d.vendor_id, v.name vendor, ${D('d.damaged_on')} dt, d.staff_name ${from} ORDER BY d.damaged_on DESC, d.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(d => ({ id: d.id, productId: d.product_id, name: d.name, qty: d.qty, unitCost: d.unit_cost, loss: d.qty * d.unit_cost, reason: d.reason, vendorId: d.vendor_id, vendor: d.vendor, date: d.dt, by: d.staff_name }));
  if (!paged) return res.json({ items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(d.qty), 0) qty, COALESCE(SUM(d.qty * d.unit_cost), 0) loss ${from}`, args);
  res.json({ total: Number(t.n), rows: items, items, totals: { qty: Number(t.qty), loss: Number(t.loss) } });
}));
router.post('/damages', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body, by = req.staff.name;
  const qty = int(b.qty, 100000), productId = parseInt(b.productId, 10);
  if (!productId || qty <= 0) throw fail(400, 'Choose the product and how many were damaged');
  const reason = text(b.reason, 300);
  if (!reason) throw fail(400, 'Write what happened (broken in transit, expired, water damage…)');
  const id = await tx(async conn => {
    const [[p]] = await conn.query('SELECT id, name FROM products WHERE id = ?', [productId]);
    if (!p) throw fail(404, 'Product not found');
    const [[last]] = await conn.query("SELECT unit_cost FROM stock_moves WHERE product_id = ? AND kind = 'Purchase' ORDER BY id DESC LIMIT 1", [productId]);
    const cost = b.unitCost != null && b.unitCost !== '' ? int(b.unitCost) : (last?.unit_cost || 0);
    const vendor = b.vendorId ? (await vendorOf(conn, b.vendorId)).id : null;
    const id = await nextSeq('stock_dmg', 'stock_damages', 'DMG-', 1000);
    await move(conn, { productId, delta: -qty, kind: 'Damage', ref: id, cost, note: reason, by });
    await conn.query('INSERT INTO stock_damages (id, product_id, name, qty, unit_cost, reason, vendor_id, damaged_on, staff_name) VALUES (?,?,?,?,?,?,?,?,?)', [id, productId, p.name, qty, cost, reason, vendor, iso(b.date, today()), by]);
    return id;
  });
  res.json({ id });
}));

// ---------- returns to vendors ----------
router.get('/returns', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['t.id', 'v.name', 't.reason', 't.receipt_id'], req.query.q);
  if (parseInt(req.query.vendor, 10)) { cond.push('t.vendor_id = ?'); args.push(parseInt(req.query.vendor, 10)); }
  addRange(cond, args, 't.returned_on', req);
  addAmount(cond, args, 't.total', req);
  const from = `FROM vendor_returns t JOIN field_vendors v ON v.id = t.vendor_id ${whereOf(cond)}`;
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 200, offset: 0 };
  const [rows] = await pool.query(`SELECT t.id, t.vendor_id, v.name vendor, t.receipt_id, ${D('t.returned_on')} d, t.reason, t.total, t.staff_name,
    (SELECT COALESCE(SUM(qty), 0) FROM vendor_return_items i WHERE i.return_id = t.id) pcs ${from} ORDER BY t.returned_on DESC, t.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(t => ({ id: t.id, vendorId: t.vendor_id, vendor: t.vendor, receiptId: t.receipt_id, date: t.d, reason: t.reason, total: t.total, pcs: Number(t.pcs), by: t.staff_name }));
  if (!paged) return res.json({ items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(t.total), 0) total ${from}`, args);
  res.json({ total: Number(t.n), rows: items, items, totals: { total: Number(t.total) } });
}));
router.get('/returns/:id', guard(VIEW), wrap(async (req, res) => {
  const [lines] = await pool.query('SELECT product_id, name, qty, unit_cost FROM vendor_return_items WHERE return_id = ? ORDER BY id', [req.params.id]);
  res.json({ lines: lines.map(l => ({ productId: l.product_id, name: l.name, qty: l.qty, unitCost: l.unit_cost, total: l.qty * l.unit_cost })) });
}));
router.post('/returns', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body, by = req.staff.name;
  const reason = text(b.reason, 300);
  if (!reason) throw fail(400, 'Write why the goods are going back to the vendor');
  const out = await tx(async conn => {
    const v = await vendorOf(conn, b.vendorId);
    const lines = await cleanLines(conn, b.lines);
    const receiptId = text(b.receiptId, 20) || null;
    if (receiptId) {
      const [[rc]] = await conn.query('SELECT vendor_id FROM stock_receipts WHERE id = ?', [receiptId]);
      if (!rc || rc.vendor_id !== v.id) throw fail(400, 'That purchase does not belong to this vendor');
    }
    const id = await nextSeq('stock_vrt', 'vendor_returns', 'VRT-', 1000);
    const total = sum(lines);
    await conn.query('INSERT INTO vendor_returns (id, vendor_id, receipt_id, returned_on, reason, total, staff_name) VALUES (?,?,?,?,?,?,?)', [id, v.id, receiptId, iso(b.date, today()), reason, total, by]);
    for (const l of lines) {
      await conn.query('INSERT INTO vendor_return_items (return_id, product_id, name, qty, unit_cost) VALUES (?,?,?,?,?)', [id, l.productId, l.name, l.qty, l.unitCost]);
      await move(conn, { productId: l.productId, delta: -l.qty, kind: 'Return', ref: id, cost: l.unitCost, note: `${v.name}: ${reason}`, by });
    }
    return { id, total };
  });
  res.json(out);
}));

// ---------- payments ----------
async function addPayment(conn, { vendorId, receiptId = null, amount, method, reference, date, note, by }) {
  const id = await nextSeq('stock_vpy', 'vendor_payments', 'VPY-', 1000);
  await conn.query('INSERT INTO vendor_payments (id, vendor_id, receipt_id, amount, method, reference, paid_on, note, staff_name) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, vendorId, receiptId, amount, METHODS.includes(method) ? method : 'Cash', text(reference, 80), iso(date, today()), text(note, 300), by]);
  return { id, amount };
}
router.get('/payments', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['p.id', 'v.name', 'p.reference', 'p.receipt_id', 'p.note'], req.query.q);
  if (parseInt(req.query.vendor, 10)) { cond.push('p.vendor_id = ?'); args.push(parseInt(req.query.vendor, 10)); }
  if (METHODS.includes(req.query.method)) { cond.push('p.method = ?'); args.push(req.query.method); }
  addRange(cond, args, 'p.paid_on', req);
  addAmount(cond, args, 'p.amount', req);
  const from = `FROM vendor_payments p JOIN field_vendors v ON v.id = p.vendor_id ${whereOf(cond)}`;
  const paged = wantsPage(req);
  const { size, offset } = paged ? pageOf(req) : { size: 300, offset: 0 };
  const [rows] = await pool.query(`SELECT p.id, p.vendor_id, v.name vendor, p.receipt_id, p.amount, p.method, p.reference, ${D('p.paid_on')} d, p.note, p.staff_name ${from} ORDER BY p.paid_on DESC, p.created_at DESC LIMIT ${size} OFFSET ${offset}`, args);
  const items = rows.map(p => ({ id: p.id, vendorId: p.vendor_id, vendor: p.vendor, receiptId: p.receipt_id, amount: p.amount, method: p.method, reference: p.reference, date: p.d, note: p.note, by: p.staff_name }));
  if (!paged) return res.json({ methods: METHODS, items });
  const [[t]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(p.amount), 0) amount ${from}`, args);
  res.json({ methods: METHODS, total: Number(t.n), rows: items, items, totals: { amount: Number(t.amount) } });
}));
router.post('/payments', guard(MANAGE), wrap(async (req, res) => {
  const b = req.body;
  const amount = int(b.amount);
  if (amount <= 0) throw fail(400, 'Enter the amount paid');
  const out = await tx(async conn => {
    const v = await vendorOf(conn, b.vendorId);
    let receiptId = text(b.receiptId, 20) || null;
    if (receiptId) {
      const [[r]] = await conn.query('SELECT id, total, vendor_id, status, (SELECT COALESCE(SUM(amount), 0) FROM vendor_payments p WHERE p.receipt_id = stock_receipts.id) paid FROM stock_receipts WHERE id = ?', [receiptId]);
      if (!r || r.vendor_id !== v.id) throw fail(400, 'That purchase does not belong to this vendor');
      if (!billedOf(r.status)) throw fail(409, `${r.id} is not approved yet, so it cannot be paid`);
      if (amount > r.total - Number(r.paid)) throw fail(409, `Only ৳ ${(r.total - Number(r.paid)).toLocaleString('en-US')} is still due on ${r.id}`);
    }
    return addPayment(conn, { vendorId: v.id, receiptId, amount, method: b.method, reference: b.reference, date: b.date, note: b.note, by: req.staff.name });
  });
  res.json(out);
}));
router.delete('/payments/:id', guard(MANAGE), wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM vendor_payments WHERE id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)', [req.params.id]);
  if (!r.affectedRows) throw fail(409, 'This payment cannot be removed: it does not exist, or it was recorded more than 24 hours ago.');
  res.json({ ok: true });
}));

// ---------- overview numbers ----------
router.get('/summary', guard(VIEW), wrap(async (req, res) => {
  const [from, to] = monthBounds(today().slice(0, 7));
  const [[a]] = await pool.query(`SELECT COALESCE(SUM(${BAL}), 0) payable, COUNT(*) vendors, COALESCE(SUM(${BAL} > 0), 0) owed_n FROM field_vendors v WHERE v.active = 1`);
  const [[b]] = await pool.query(`SELECT COALESCE(SUM(total), 0) t, COUNT(*) n FROM stock_receipts WHERE ${BILLED} AND received_on >= ? AND received_on < ?`, [from, to]);
  const [[c]] = await pool.query("SELECT COALESCE(SUM(amount), 0) t FROM vendor_payments WHERE paid_on >= ? AND paid_on < ?", [from, to]);
  const [[d]] = await pool.query("SELECT COALESCE(SUM(qty * unit_cost), 0) t, COALESCE(SUM(qty), 0) q FROM stock_damages WHERE damaged_on >= ? AND damaged_on < ?", [from, to]);
  const [[e]] = await pool.query("SELECT COALESCE(SUM(total), 0) t FROM vendor_returns WHERE returned_on >= ? AND returned_on < ?", [from, to]);
  const [[pn]] = await pool.query("SELECT COUNT(*) n FROM stock_receipts WHERE status = 'Pending'");
  const [[sn]] = await pool.query("SELECT COUNT(*) n FROM stock_receipts WHERE status = 'Approved'");
  res.json({ pendingApproval: Number(pn.n), awaitingStock: Number(sn.n), payable: Number(a.payable), vendors: Number(a.vendors), owedCount: Number(a.owed_n), purchased: Number(b.t), purchases: Number(b.n), paid: Number(c.t), damageLoss: Number(d.t), damagePcs: Number(d.q), returned: Number(e.t) });
}));

export { router as invRouter };
