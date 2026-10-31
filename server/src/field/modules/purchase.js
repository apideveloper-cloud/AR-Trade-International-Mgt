// Purchase requisitions, vendor quotes and purchase orders.
//   GET  /api/field/purchase/requests                 open requisitions (+ stock warning)
//   GET  /api/field/purchase/requests/:id             one requisition with its vendor quotes and the approval / budget line
//   POST /api/field/purchase/requests                 { productId?, productName, qty, needBy?, stockNow?, stockMin?, quotes?: [{ vendorId, unitPrice, deliveryDays, rating }] }
//   POST /api/field/purchase/requests/:id/quotes      { vendorId, unitPrice, deliveryDays?, rating? }  add / update a quote
//   GET  /api/field/purchase/vendors                  vendors for the "Change vendor" picker
//   POST /api/field/purchase/orders                   { prId, quoteId } -> draft PO (PO-0884) from the chosen quote
//   GET  /api/field/purchase/orders?status=           purchase officers see their own, manager / accountant / admin all
//   GET  /api/field/purchase/orders/:id               full PO (lines, summary, budget, approval trail, what the caller may do)
//   PUT  /api/field/purchase/orders/:id               edit a Draft: { vendorId, lines: [{ productId?, name, sku?, qty, unitPrice }], deliverBy, paymentTerms, deliverTo, note }
//   POST /api/field/purchase/orders/:id/submit        Draft -> Submitted (managers are notified)
//   POST /api/field/purchase/orders/:id/reopen        Submitted (before anyone approved it) or Rejected -> Draft again, revision + 1
//   DELETE /api/field/purchase/orders/:id             delete a Draft
// The approval steps live in approvals.js (Manager: Submitted -> ManagerApproved, Accountant: -> Approved).
import { Router } from 'express';
import { pool, fail, wrap, guardRole, roleKey, nextSeq, notify, staffIdsByRole, clientRefOf } from '../common.js';
import { addRange, addSearch, pageOf, whereOf, wantsPage } from '../../listing.js';
import { iso } from '../../util.js';

const router = Router();

export const BUDGET = parseInt(process.env.PURCHASE_BUDGET || '420000', 10);
export const VAT_PCT = 5;
const FREIGHT = 1500;
const TERMS = ['Advance', '15 days', '30 days', 'On delivery'];
const TO = ['Head office · Santinagar', 'Warehouse · Tejgaon'];
const STATUS_KEY = { Draft: 'draft', Submitted: 'submitted', ManagerApproved: 'manager_approved', Approved: 'approved', Rejected: 'rejected' };
const buyerRoles = ['purchase', 'manager', 'accountant'];

const D = c => `DATE_FORMAT(${c}, '%Y-%m-%d')`;
const T = c => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%sZ')`;
const isoDate = s => iso(s, null);
const seesAll = staff => roleKey(staff.role) !== 'purchase';
export const numberId = (prefix, n) => prefix + String(n).replace(prefix, '').padStart(4, '0');

/** 'Lowest' = cheapest quote; 'Best value' = best rating for the price (rating x cheapest / price). */
function tagQuotes(quotes) {
  if (!quotes.length) return quotes;
  const min = Math.min(...quotes.map(q => q.unitPrice));
  const lowest = quotes.find(q => q.unitPrice === min);
  const score = q => q.rating * (min / q.unitPrice);
  const best = [...quotes].sort((a, b) => score(b) - score(a))[0];
  return quotes.map(q => ({ ...q, tag: q === lowest ? 'Lowest' : (q === best ? 'Best value' : '') }));
}

async function quotesOf(prId) {
  const [rows] = await pool.query(
    'SELECT q.id, q.vendor_id, v.name vendor, q.unit_price, q.delivery_days, q.rating FROM field_vendor_quotes q JOIN field_vendors v ON v.id = q.vendor_id WHERE q.pr_id = ? ORDER BY q.unit_price DESC', [prId]);
  return tagQuotes(rows.map(r => ({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, unitPrice: r.unit_price, deliveryDays: r.delivery_days, rating: Number(r.rating) })));
}

const prOut = (r, extra = {}) => ({
  id: r.id, productId: r.product_id, product: r.product_name, img: r.img || '', qty: r.qty, needBy: r.need_by, requestedBy: r.requested_by,
  requestedAt: r.created_at, status: r.status.toLowerCase(),
  stock: { now: r.stock_now, min: r.stock_min, low: r.stock_now < r.stock_min }, ...extra
});
const PR_SELECT = `SELECT (SELECT p.img FROM products p WHERE p.id = r.product_id) img, r.id, r.product_id, r.product_name, r.qty, ${D('r.need_by')} need_by, r.stock_now, r.stock_min, r.requested_by, r.status, ${T('r.created_at')} created_at FROM field_purchase_requests r`;

function totals(lines, freight = FREIGHT) {
  const subtotal = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const vat = Math.round(subtotal * VAT_PCT / 100);
  const fr = lines.length ? freight : 0;
  return { subtotal, vat, freight: fr, grand: subtotal + vat + fr, pcs: lines.reduce((t, l) => t + l.qty, 0) };
}
const budgetOf = grand => ({ budget: BUDGET, within: grand <= BUDGET, over: Math.max(0, grand - BUDGET) });

export const PO_SELECT = `SELECT p.*, ${D('p.deliver_by')} deliver_by_d, ${T('p.created_at')} created_utc, ${T('p.submitted_at')} submitted_utc,
  ${T('p.manager_at')} manager_utc, ${T('p.final_at')} final_utc, ${T('p.rejected_at')} rejected_utc,
  v.name vendor_name, v.email vendor_email, v.phone vendor_phone, s.name staff_name, mb.name manager_name, fb.name final_name, rb.name rejected_name,
  (SELECT COUNT(*) FROM field_purchase_order_items i WHERE i.po_id = p.id) line_count,
  (SELECT COALESCE(SUM(qty), 0) FROM field_purchase_order_items i WHERE i.po_id = p.id) pcs
  FROM field_purchase_orders p
  JOIN field_vendors v ON v.id = p.vendor_id JOIN staff s ON s.id = p.staff_id
  LEFT JOIN staff mb ON mb.id = p.manager_by LEFT JOIN staff fb ON fb.id = p.final_by LEFT JOIN staff rb ON rb.id = p.rejected_by`;

export async function poOut(p, withLines = true, staff = null) {
  const out = {
    id: p.id, prId: p.pr_id, vendorId: p.vendor_id, vendor: p.vendor_name, status: STATUS_KEY[p.status], statusLabel: p.status,
    by: p.staff_name, staffId: p.staff_id, rev: p.rev, grand: p.grand_total, subtotal: p.subtotal, vat: p.vat, freight: p.freight,
    pcs: Number(p.pcs), lineCount: Number(p.line_count), deliverBy: p.deliver_by_d, paymentTerms: p.payment_terms, deliverTo: p.deliver_to, note: p.note,
    createdAt: p.created_utc, submittedAt: p.submitted_utc, ...budgetOf(p.grand_total),
    trail: {
      manager: p.manager_by ? { by: p.manager_name, at: p.manager_utc, remarks: p.manager_remarks } : null,
      final: p.final_by ? { by: p.final_name, at: p.final_utc, remarks: p.final_remarks } : null,
      rejected: p.rejected_by ? { by: p.rejected_name, at: p.rejected_utc, remarks: p.reject_remarks } : null
    }
  };
  if (staff) {
    const own = p.staff_id === staff.id, admin = roleKey(staff.role) === 'admin';
    out.can = {
      edit: (own || admin) && p.status === 'Draft',
      submit: (own || admin) && p.status === 'Draft',
      reopen: (own || admin) && (p.status === 'Submitted' || p.status === 'Rejected'),
      delete: (own || admin) && p.status === 'Draft'
    };
  }
  if (withLines) {
    const [lines] = await pool.query('SELECT i.id, i.product_id, i.name, i.sku, i.qty, i.unit_price, (SELECT p.img FROM products p WHERE p.id = i.product_id) img FROM field_purchase_order_items i WHERE i.po_id = ? ORDER BY i.id', [p.id]);
    out.lines = lines.map(l => ({ id: l.id, productId: l.product_id, img: l.img || '', name: l.name, sku: l.sku, qty: l.qty, unitPrice: l.unit_price, total: l.qty * l.unit_price }));
  }
  return out;
}

async function loadPo(id) {
  const [[p]] = await pool.query(`${PO_SELECT} WHERE p.id = ?`, [id]);
  if (!p) throw fail(404, 'Purchase order not found');
  return p;
}
function mayTouch(staff, p) {
  if (p.staff_id !== staff.id && roleKey(staff.role) !== 'admin') throw fail(403, 'This purchase order belongs to someone else');
}

// ---------- requisitions ----------
router.get('/requests', guardRole(...buyerRoles), wrap(async (req, res) => {
  const [rows] = await pool.query(`${PR_SELECT} WHERE r.status <> 'Closed' ORDER BY (r.status = 'Open') DESC, r.created_at DESC LIMIT 50`);
  const items = [];
  for (const r of rows) {
    const q = await quotesOf(r.id);
    items.push(prOut(r, { quoteCount: q.length, lowest: q.length ? Math.min(...q.map(x => x.unitPrice)) : null }));
  }
  res.json({ items });
}));

router.get('/requests/:id', guardRole(...buyerRoles), wrap(async (req, res) => {
  const [[r]] = await pool.query(`${PR_SELECT} WHERE r.id = ?`, [req.params.id]);
  if (!r) throw fail(404, 'Requisition not found');
  const quotes = (await quotesOf(r.id)).map(q => ({ ...q, total: q.unitPrice * r.qty }));
  const best = quotes.find(q => q.tag === 'Best value') || quotes[0];
  const sample = best ? totals([{ qty: r.qty, unitPrice: best.unitPrice }]) : null;
  res.json({
    ...prOut(r), quotes, suggestedQuoteId: best ? best.id : null,
    approval: { chain: 'Manager → Accounts', budget: BUDGET, ...(sample ? budgetOf(sample.grand) : {}) }
  });
}));

router.post('/requests', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const name = String(req.body.productName || '').trim().slice(0, 255);
  const qty = parseInt(req.body.qty, 10);
  if (!name) throw fail(400, 'Choose the product to buy');
  if (!(qty >= 1 && qty <= 100000)) throw fail(400, 'Enter a valid quantity');
  const id = numberId('PR-', await nextSeq('field_pr', 'field_purchase_requests', 'PR-', 218));
  await pool.query('INSERT INTO field_purchase_requests (id, product_id, product_name, qty, need_by, stock_now, stock_min, requested_by, staff_id) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, parseInt(req.body.productId, 10) || null, name, qty, isoDate(req.body.needBy), Math.max(0, parseInt(req.body.stockNow, 10) || 0), Math.max(0, parseInt(req.body.stockMin, 10) || 0), req.staff.name, req.staff.id]);
  for (const q of Array.isArray(req.body.quotes) ? req.body.quotes.slice(0, 10) : []) await upsertQuote(id, q);
  res.json({ id });
}));

async function upsertQuote(prId, q) {
  const vendorId = parseInt(q.vendorId, 10), price = parseInt(q.unitPrice, 10);
  if (!vendorId || !(price > 0)) throw fail(400, 'A quote needs a vendor and a unit price');
  const [[v]] = await pool.query('SELECT id FROM field_vendors WHERE id = ?', [vendorId]);
  if (!v) throw fail(404, 'Vendor not found');
  await pool.query(
    'INSERT INTO field_vendor_quotes (pr_id, vendor_id, unit_price, delivery_days, rating) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price), delivery_days = VALUES(delivery_days), rating = VALUES(rating)',
    [prId, vendorId, price, Math.min(90, Math.max(1, parseInt(q.deliveryDays, 10) || 3)), Math.min(5, Math.max(1, Number(q.rating) || 4))]);
}

router.post('/requests/:id/quotes', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const [[r]] = await pool.query('SELECT id FROM field_purchase_requests WHERE id = ?', [req.params.id]);
  if (!r) throw fail(404, 'Requisition not found');
  await upsertQuote(r.id, req.body);
  res.json({ quotes: await quotesOf(r.id) });
}));

router.get('/vendors', guardRole(...buyerRoles), wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, kind, phone FROM field_vendors ORDER BY name');
  res.json({ items: rows.map(v => ({ id: v.id, name: v.name, kind: v.kind, phone: v.phone })) });
}));

// ---------- purchase orders ----------
router.post('/orders', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const ref = clientRefOf(req.body);
  if (ref) { // retry of a PO this person already created: return the existing one
    const [[dup]] = await pool.query('SELECT id FROM field_purchase_orders WHERE staff_id = ? AND client_ref = ? LIMIT 1', [req.staff.id, ref]);
    if (dup) return res.json(await poOut(await loadPo(dup.id), true, req.staff));
  }
  if (!req.body.prId) {
    // no requisition: start an empty draft for the chosen vendor
    const [[v]] = await pool.query('SELECT id FROM field_vendors WHERE id = ?', [parseInt(req.body.vendorId, 10)]);
    if (!v) throw fail(400, 'Choose a vendor first');
    const nid = numberId('PO-', await nextSeq('field_po', 'field_purchase_orders', 'PO-', 883));
    const due = new Date(Date.now() + 6 * 3600e3 + 6 * 864e5).toISOString().slice(0, 10);
    await pool.query("INSERT INTO field_purchase_orders (id, vendor_id, staff_id, status, deliver_by, payment_terms, deliver_to, client_ref) VALUES (?,?,?, 'Draft', ?, '15 days', ?, ?)", [nid, v.id, req.staff.id, due, TO[0], ref]);
    return res.json(await poOut(await loadPo(nid), true, req.staff));
  }
  const [[r]] = await pool.query(`${PR_SELECT} WHERE r.id = ?`, [req.body.prId]);
  if (!r) throw fail(404, 'Requisition not found');
  const [[q]] = await pool.query('SELECT * FROM field_vendor_quotes WHERE id = ? AND pr_id = ?', [req.body.quoteId, r.id]);
  if (!q) throw fail(400, 'Choose a vendor quote first');
  const id = numberId('PO-', await nextSeq('field_po', 'field_purchase_orders', 'PO-', 883));
  const lines = [{ qty: r.qty, unitPrice: q.unit_price }];
  const t = totals(lines);
  const due = new Date(Date.now() + 6 * 3600e3 + q.delivery_days * 864e5).toISOString().slice(0, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[lock]] = await conn.query('SELECT status FROM field_purchase_requests WHERE id = ? FOR UPDATE', [r.id]);
    if (lock.status !== 'Open') throw fail(409, `This requisition is already ${lock.status.toLowerCase()}, so a new purchase order cannot be created from it`);
    await conn.query(
      `INSERT INTO field_purchase_orders (id, pr_id, vendor_id, staff_id, status, subtotal, vat, freight, grand_total, deliver_by, payment_terms, deliver_to, client_ref)
       VALUES (?,?,?,?, 'Draft', ?,?,?,?,?, '15 days', ?, ?)`, [id, r.id, q.vendor_id, req.staff.id, t.subtotal, t.vat, t.freight, t.grand, due, TO[0], ref]);
    await conn.query('INSERT INTO field_purchase_order_items (po_id, product_id, name, sku, qty, unit_price) VALUES (?,?,?,?,?,?)',
      [id, r.product_id, r.product_name, (/\(([^)]+)\)/.exec(r.product_name) || [])[1] || '', r.qty, q.unit_price]);
    await conn.query("UPDATE field_purchase_requests SET status = 'Ordered' WHERE id = ?", [r.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json(await poOut(await loadPo(id), true, req.staff));
}));

router.get('/orders', guardRole(...buyerRoles), wrap(async (req, res) => {
  const where = [], args = [];
  if (!seesAll(req.staff) || req.query.mine === '1') { where.push('p.staff_id = ?'); args.push(req.staff.id); }
  // optional (web console): ?q= (PO no., vendor, buyer, note), ?from= &to= (created day), ?page= &size= -> also rows (= the page), total (= matches) and
  // summary { count, by: { status: { n, grand } } } over everything matching q / dates (but not the status filter). No page: the same latest 60 as always.
  addSearch(where, args, ['p.id', 'v.name', 's.name', 'p.note'], req.query.q);
  addRange(where, args, 'p.created_at', req);
  const base = [...where], baseArgs = [...args];
  const st = { draft: 'Draft', submitted: 'Submitted', manager_approved: 'ManagerApproved', approved: 'Approved', rejected: 'Rejected' }[req.query.status];
  if (st) { where.push('p.status = ?'); args.push(st); }
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const [rows] = await pool.query(`${PO_SELECT} ${whereOf(where)} ORDER BY p.created_at DESC, p.id DESC LIMIT ?${paged ? ' OFFSET ?' : ''}`, paged ? [...args, pg.size, pg.offset] : [...args, 60]);
  const items = [];
  for (const p of rows) items.push(await poOut(p, false, req.staff));
  if (!paged) return res.json({ items });
  const from = 'FROM field_purchase_orders p JOIN field_vendors v ON v.id = p.vendor_id JOIN staff s ON s.id = p.staff_id';
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from} ${whereOf(where)}`, args);
  const [groups] = await pool.query(`SELECT p.status, COUNT(*) n, COALESCE(SUM(p.grand_total), 0) grand ${from} ${whereOf(base)} GROUP BY p.status`, baseArgs);
  const by = {};
  for (const g of groups) by[STATUS_KEY[g.status]] = { n: g.n, grand: Number(g.grand) };
  res.json({ items, rows: items, total: n.n, summary: { count: groups.reduce((t, g) => t + g.n, 0), by } });
}));

router.get('/orders/:id', guardRole(...buyerRoles), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  if (!seesAll(req.staff) && p.staff_id !== req.staff.id) throw fail(403, 'This purchase order belongs to someone else');
  res.json(await poOut(p, true, req.staff));
}));

router.put('/orders/:id', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, 'Only a draft can be edited. Tap Edit PO to reopen it.');
  const lines = (Array.isArray(req.body.lines) ? req.body.lines : []).slice(0, 40).map(l => ({
    productId: parseInt(l.productId, 10) || null, name: String(l.name || '').trim().slice(0, 255), sku: String(l.sku || '').trim().slice(0, 80),
    qty: parseInt(l.qty, 10), unitPrice: parseInt(l.unitPrice, 10)
  }));
  for (const l of lines) {
    if (!l.name) throw fail(400, 'Every line needs a product');
    if (!(l.qty >= 1 && l.qty <= 100000)) throw fail(400, `Enter a valid quantity for ${l.name}`);
    if (!(l.unitPrice >= 0 && l.unitPrice <= 10000000)) throw fail(400, `Enter a valid price for ${l.name}`);
  }
  let vendorId = p.vendor_id;
  if (req.body.vendorId != null) {
    const [[v]] = await pool.query('SELECT id FROM field_vendors WHERE id = ?', [parseInt(req.body.vendorId, 10)]);
    if (!v) throw fail(404, 'Vendor not found');
    vendorId = v.id;
  }
  const terms = TERMS.includes(req.body.paymentTerms) ? req.body.paymentTerms : p.payment_terms;
  const to = TO.includes(req.body.deliverTo) ? req.body.deliverTo : p.deliver_to;
  const due = req.body.deliverBy == null ? p.deliver_by_d : isoDate(req.body.deliverBy);
  const note = req.body.note == null ? p.note : String(req.body.note).slice(0, 255);
  const t = totals(lines);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
    if (lines.length) await conn.query('INSERT INTO field_purchase_order_items (po_id, product_id, name, sku, qty, unit_price) VALUES ?', [lines.map(l => [p.id, l.productId, l.name, l.sku, l.qty, l.unitPrice])]);
    await conn.query('UPDATE field_purchase_orders SET vendor_id = ?, subtotal = ?, vat = ?, freight = ?, grand_total = ?, deliver_by = ?, payment_terms = ?, deliver_to = ?, note = ? WHERE id = ?',
      [vendorId, t.subtotal, t.vat, t.freight, t.grand, due, terms, to, note, p.id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  res.json(await poOut(await loadPo(p.id), true, req.staff));
}));

router.post('/orders/:id/submit', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, 'This purchase order was already submitted');
  const [lines] = await pool.query('SELECT qty, unit_price FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
  if (!lines.length) throw fail(400, 'Add at least one item before submitting');
  if (lines.some(l => !(l.unit_price > 0))) throw fail(400, 'Every item needs a unit price');
  await pool.query("UPDATE field_purchase_orders SET status = 'Submitted', submitted_at = UTC_TIMESTAMP(), manager_by = NULL, manager_remarks = '', manager_at = NULL, rejected_by = NULL, reject_remarks = '', rejected_at = NULL WHERE id = ?", [p.id]);
  const ids = (await staffIdsByRole('manager', 'admin')).filter(i => i !== req.staff.id);
  await notify(ids, {
    icon: 'shopping_cart_checkout', cat: 'Approvals', title: 'Purchase order waiting for approval', sub: `${p.id} · ${p.vendor_name} · ৳ ${p.grand_total.toLocaleString('en-IN')}`,
    body: `${req.staff.name} submitted purchase order ${p.id} for approval.`,
    rows: [['PO', p.id + (p.rev ? ` · Rev ${p.rev}` : '')], ['Vendor', p.vendor_name], ['Grand total', '৳ ' + p.grand_total.toLocaleString('en-IN')], ['Budget', p.grand_total <= BUDGET ? 'In budget' : 'Over budget']],
    a1: 'Review', a1Icon: 'fact_check'
  });
  res.json(await poOut(await loadPo(p.id), true, req.staff));
}));

router.post('/orders/:id/reopen', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (!['Submitted', 'Rejected'].includes(p.status)) throw fail(409, 'Only a submitted order that nobody has approved yet, or a rejected one, can be reopened');
  await pool.query("UPDATE field_purchase_orders SET status = 'Draft', rev = rev + 1 WHERE id = ?", [p.id]);
  if (p.pr_id) await pool.query("UPDATE field_purchase_requests SET status = 'Ordered' WHERE id = ?", [p.pr_id]);
  res.json(await poOut(await loadPo(p.id), true, req.staff));
}));

router.delete('/orders/:id', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, 'Only a draft can be deleted');
  await pool.query('DELETE FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
  await pool.query('DELETE FROM field_purchase_orders WHERE id = ?', [p.id]);
  if (p.pr_id) await pool.query("UPDATE field_purchase_requests SET status = 'Open' WHERE id = ? AND NOT EXISTS (SELECT 1 FROM field_purchase_orders WHERE pr_id = ? AND status <> 'Rejected')", [p.pr_id, p.pr_id]);
  res.json({ ok: true });
}));

export default router;
