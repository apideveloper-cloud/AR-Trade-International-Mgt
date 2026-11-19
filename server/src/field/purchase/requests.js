// Purchase requisitions, vendor quotes and the vendor picker.
import { Router } from 'express';
import { pool, fail, wrap, guardRole, nextSeq } from '../common.js';
import { iso } from '../../util.js';
import { BUDGET, numberId, tagQuotes, totals, budgetOf } from './calc.js';
import { PR_SELECT } from './poOut.js';

export const buyerRoles = ['purchase', 'manager', 'accountant'];
const router = Router();

/** The requisition as the app sees it. */
const prOut = (r, extra = {}) => ({
  id: r.id, productId: r.product_id, product: r.product_name, img: r.img || '', qty: r.qty, needBy: r.need_by, requestedBy: r.requested_by,
  requestedAt: r.created_at, status: r.status.toLowerCase(),
  stock: { now: r.stock_now, min: r.stock_min, low: r.stock_now < r.stock_min }, ...extra
});

/** All vendor quotes of a requisition, tagged Lowest / Best value. */
async function quotesOf(prId) {
  const [rows] = await pool.query(
    'SELECT q.id, q.vendor_id, v.name vendor, q.unit_price, q.delivery_days, q.rating FROM field_vendor_quotes q JOIN field_vendors v ON v.id = q.vendor_id WHERE q.pr_id = ? ORDER BY q.unit_price DESC', [prId]);
  return tagQuotes(rows.map(r => ({ id: r.id, vendorId: r.vendor_id, vendor: r.vendor, unitPrice: r.unit_price, deliveryDays: r.delivery_days, rating: Number(r.rating) })));
}

/** Adds or updates one vendor's quote on a requisition. */
async function upsertQuote(prId, q) {
  const vendorId = parseInt(q.vendorId, 10), price = parseInt(q.unitPrice, 10);
  if (!vendorId || !(price > 0)) throw fail(400, 'A quote needs a vendor and a unit price');
  const [[v]] = await pool.query('SELECT id FROM field_vendors WHERE id = ?', [vendorId]);
  if (!v) throw fail(404, 'Vendor not found');
  await pool.query(
    'INSERT INTO field_vendor_quotes (pr_id, vendor_id, unit_price, delivery_days, rating) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price), delivery_days = VALUES(delivery_days), rating = VALUES(rating)',
    [prId, vendorId, price, Math.min(90, Math.max(1, parseInt(q.deliveryDays, 10) || 3)), Math.min(5, Math.max(1, Number(q.rating) || 4))]);
}

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
    [id, parseInt(req.body.productId, 10) || null, name, qty, iso(req.body.needBy, null), Math.max(0, parseInt(req.body.stockNow, 10) || 0), Math.max(0, parseInt(req.body.stockMin, 10) || 0), req.staff.name, req.staff.id]);
  for (const q of Array.isArray(req.body.quotes) ? req.body.quotes.slice(0, 10) : []) await upsertQuote(id, q);
  res.json({ id });
}));

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

export default router;
