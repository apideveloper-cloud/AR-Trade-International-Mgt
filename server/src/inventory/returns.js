// Returns of goods to vendors: list, detail and creation (takes the goods out of stock).
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, iso, nextSeq, text, today, tx, wrap } from '../util.js';
import { addAmount, addRange, addSearch, whereOf } from '../listing.js';
import { VIEW, MANAGE } from './constants.js';
import { addVendorFilter, cleanLines, move, pagingFor, vendorOf } from './helpers.js';
import { sum } from './pure.js';
import { noteCatalogChange } from '../growth/changeHooks.js';

const router = Router();

router.get('/returns', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['t.id', 'v.name', 't.reason', 't.receipt_id'], req.query.q);
  addVendorFilter(cond, args, 't.vendor_id', req);
  addRange(cond, args, 't.returned_on', req);
  addAmount(cond, args, 't.total', req);
  const from = `FROM vendor_returns t JOIN field_vendors v ON v.id = t.vendor_id ${whereOf(cond)}`;
  const { paged, size, offset } = pagingFor(req, 200);
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
    return { id, total, productIds: lines.map(l => l.productId) };
  });
  noteCatalogChange({ productIds: out.productIds, reason: 'inventory' });
  res.json({ id: out.id, total: out.total });
}));

export default router;
