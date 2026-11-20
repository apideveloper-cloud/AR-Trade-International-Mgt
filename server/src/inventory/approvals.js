// Purchase workflow after creation: approve / reject, put into stock, delete.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { fail, int, text, tx, wrap } from '../util.js';
import { MANAGE, APPROVE } from './constants.js';
import { move } from './helpers.js';
import { noteCatalogChange } from '../growth/changeHooks.js';
import { linesByProduct } from './pure.js';

const router = Router();

/** Step 2: approval. Only holders of inventory.approve (Master Admin and Admin). Once approved the purchase is a bill on the vendor's account. */
router.post('/receipts/:id/approve', guard(APPROVE), wrap(async (req, res) => {
  await tx(async conn => {
    const [[r]] = await conn.query('SELECT id, status FROM stock_receipts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw fail(404, 'Purchase not found');
    if (r.status !== 'Pending') throw fail(409, 'Only a purchase that is waiting for approval can be approved');
    const [items] = await conn.query('SELECT id, product_id, name FROM stock_receipt_items WHERE receipt_id = ? ORDER BY id', [r.id]);
    const given = linesByProduct(req.body);
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
  const changed = []; let firstSale = false;
  const out = await tx(async conn => {
    const [[r]] = await conn.query('SELECT id, status, vendor_id FROM stock_receipts WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!r) throw fail(404, 'Purchase not found');
    if (r.status !== 'Approved') throw fail(409, r.status === 'Stocked' ? 'This purchase is already in stock' : 'The purchase must be approved before it goes into stock');
    const [[v]] = await conn.query('SELECT name FROM field_vendors WHERE id = ?', [r.vendor_id]);
    const [items] = await conn.query('SELECT id, product_id, qty, unit_cost, discount, sale_price, remarks FROM stock_receipt_items WHERE receipt_id = ? ORDER BY id', [r.id]);
    const given = linesByProduct(req.body);
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
      changed.push(it.product_id); if (!seen) firstSale = true;
    }
    await conn.query("UPDATE stock_receipts SET status = 'Stocked', stocked_by = ?, stocked_at = NOW() WHERE id = ?", [by, r.id]);
    return { id: r.id, status: 'Stocked' };
  });
  noteCatalogChange({ productIds: changed, reason: firstSale ? 'product_added' : 'inventory' });
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

export default router;
