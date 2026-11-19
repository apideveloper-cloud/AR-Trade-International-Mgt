// Damaged stock: list and write-off.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, int, iso, nextSeq, text, today, tx, wrap } from '../util.js';
import { addRange, addSearch, whereOf } from '../listing.js';
import { VIEW, MANAGE } from './constants.js';
import { addVendorFilter, move, pagingFor, vendorOf } from './helpers.js';

const router = Router();

router.get('/damages', guard(VIEW), wrap(async (req, res) => {
  const cond = [], args = [];
  addSearch(cond, args, ['d.id', 'd.name', 'd.reason', 'v.name', 'd.staff_name'], req.query.q);
  addVendorFilter(cond, args, 'd.vendor_id', req);
  addRange(cond, args, 'd.damaged_on', req);
  const from = `FROM stock_damages d LEFT JOIN field_vendors v ON v.id = d.vendor_id ${whereOf(cond)}`;
  const { paged, size, offset } = pagingFor(req, 200);
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

export default router;
