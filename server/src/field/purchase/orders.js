// Purchase order writes: create (empty or from a vendor quote), edit a draft, submit, reopen, delete.
import { Router } from 'express';
import { pool, fail, wrap, guardRole, nextSeq, notify, staffIdsByRole, clientRefOf } from '../common.js';
import { iso, tx } from '../../util.js';
import { BUDGET, TERMS, DELIVER_TO, numberId, totals, dueDateBD, cleanLine } from './calc.js';
import { PR_SELECT, poOut, loadPo, mayTouch } from './poOut.js';

const router = Router();
const NOT_DRAFT_EDIT = 'Only a draft can be edited. Tap Edit PO to reopen it.';
const ITEM_COLS = 'po_id, product_id, name, sku, qty, unit_price';

/** Checks the edit form's lines (count, names, quantities, prices) and returns them cleaned. */
function readLines(body) {
  const lines = (Array.isArray(body.lines) ? body.lines : []).slice(0, 40).map(cleanLine);
  for (const l of lines) {
    if (!l.name) throw fail(400, 'Every line needs a product');
    if (!(l.qty >= 1 && l.qty <= 100000)) throw fail(400, `Enter a valid quantity for ${l.name}`);
    if (!(l.unitPrice >= 0 && l.unitPrice <= 10000000)) throw fail(400, `Enter a valid price for ${l.name}`);
  }
  return lines;
}

/** Creates the draft for a requisition from the chosen quote, locking the requisition so two orders cannot come from it. */
async function createFromQuote(r, q, staffId, ref) {
  const id = numberId('PO-', await nextSeq('field_po', 'field_purchase_orders', 'PO-', 883));
  const t = totals([{ qty: r.qty, unitPrice: q.unit_price }]);
  await tx(async conn => {
    const [[lock]] = await conn.query('SELECT status FROM field_purchase_requests WHERE id = ? FOR UPDATE', [r.id]);
    if (!lock) throw fail(404, 'Requisition not found');
    if (lock.status !== 'Open') throw fail(409, `This requisition is already ${lock.status.toLowerCase()}, so a new purchase order cannot be created from it`);
    await conn.query(
      `INSERT INTO field_purchase_orders (id, pr_id, vendor_id, staff_id, status, subtotal, vat, freight, grand_total, deliver_by, payment_terms, deliver_to, client_ref)
       VALUES (?,?,?,?, 'Draft', ?,?,?,?,?, '15 days', ?, ?)`, [id, r.id, q.vendor_id, staffId, t.subtotal, t.vat, t.freight, t.grand, dueDateBD(q.delivery_days), DELIVER_TO[0], ref]);
    await conn.query('INSERT INTO field_purchase_order_items (po_id, product_id, name, sku, qty, unit_price) VALUES (?,?,?,?,?,?)',
      [id, r.product_id, r.product_name, (/\(([^)]+)\)/.exec(r.product_name) || [])[1] || '', r.qty, q.unit_price]);
    await conn.query("UPDATE field_purchase_requests SET status = 'Ordered' WHERE id = ?", [r.id]);
  });
  return id;
}

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
    await pool.query("INSERT INTO field_purchase_orders (id, vendor_id, staff_id, status, deliver_by, payment_terms, deliver_to, client_ref) VALUES (?,?,?, 'Draft', ?, '15 days', ?, ?)", [nid, v.id, req.staff.id, dueDateBD(6), DELIVER_TO[0], ref]);
    return res.json(await poOut(await loadPo(nid), true, req.staff));
  }
  const [[r]] = await pool.query(`${PR_SELECT} WHERE r.id = ?`, [req.body.prId]);
  if (!r) throw fail(404, 'Requisition not found');
  const [[q]] = await pool.query('SELECT * FROM field_vendor_quotes WHERE id = ? AND pr_id = ?', [req.body.quoteId, r.id]);
  if (!q) throw fail(400, 'Choose a vendor quote first');
  const id = await createFromQuote(r, q, req.staff.id, ref);
  res.json(await poOut(await loadPo(id), true, req.staff));
}));

router.put('/orders/:id', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, NOT_DRAFT_EDIT);
  const lines = readLines(req.body);
  let vendorId = p.vendor_id;
  if (req.body.vendorId != null) {
    const [[v]] = await pool.query('SELECT id FROM field_vendors WHERE id = ?', [parseInt(req.body.vendorId, 10)]);
    if (!v) throw fail(404, 'Vendor not found');
    vendorId = v.id;
  }
  const terms = TERMS.includes(req.body.paymentTerms) ? req.body.paymentTerms : p.payment_terms;
  const to = DELIVER_TO.includes(req.body.deliverTo) ? req.body.deliverTo : p.deliver_to;
  const due = req.body.deliverBy == null ? p.deliver_by_d : iso(req.body.deliverBy, null);
  const note = req.body.note == null ? p.note : String(req.body.note).slice(0, 255);
  const t = totals(lines);
  if (!(t.grand <= 2000000000)) throw fail(400, 'The order total is too large');
  await tx(async conn => {
    const [[cur]] = await conn.query('SELECT status FROM field_purchase_orders WHERE id = ? FOR UPDATE', [p.id]); // a submit may have just happened
    if (!cur || cur.status !== 'Draft') throw fail(409, NOT_DRAFT_EDIT);
    await conn.query('DELETE FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
    if (lines.length) await conn.query(`INSERT INTO field_purchase_order_items (${ITEM_COLS}) VALUES ?`, [lines.map(l => [p.id, l.productId, l.name, l.sku, l.qty, l.unitPrice])]);
    await conn.query('UPDATE field_purchase_orders SET vendor_id = ?, subtotal = ?, vat = ?, freight = ?, grand_total = ?, deliver_by = ?, payment_terms = ?, deliver_to = ?, note = ? WHERE id = ?',
      [vendorId, t.subtotal, t.vat, t.freight, t.grand, due, terms, to, note, p.id]);
  });
  res.json(await poOut(await loadPo(p.id), true, req.staff));
}));

router.post('/orders/:id/submit', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, 'This purchase order was already submitted');
  const [lines] = await pool.query('SELECT qty, unit_price FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
  if (!lines.length) throw fail(400, 'Add at least one item before submitting');
  if (lines.some(l => !(l.unit_price > 0))) throw fail(400, 'Every item needs a unit price');
  const [sb] = await pool.query("UPDATE field_purchase_orders SET status = 'Submitted', submitted_at = UTC_TIMESTAMP(), manager_by = NULL, manager_remarks = '', manager_at = NULL, rejected_by = NULL, reject_remarks = '', rejected_at = NULL WHERE id = ? AND status = 'Draft'", [p.id]);
  if (!sb.affectedRows) throw fail(409, 'This purchase order was already submitted');
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
  const [rr] = await pool.query("UPDATE field_purchase_orders SET status = 'Draft', rev = rev + 1 WHERE id = ? AND status IN ('Submitted', 'Rejected')", [p.id]);
  if (!rr.affectedRows) throw fail(409, 'This purchase order was just decided, so it cannot be reopened');
  if (p.pr_id) await pool.query("UPDATE field_purchase_requests SET status = 'Ordered' WHERE id = ?", [p.pr_id]);
  res.json(await poOut(await loadPo(p.id), true, req.staff));
}));

router.delete('/orders/:id', guardRole('purchase', 'manager'), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  mayTouch(req.staff, p);
  if (p.status !== 'Draft') throw fail(409, 'Only a draft can be deleted');
  await tx(async conn => { // all three steps or none: a half-deleted order must not leave orphan lines or a stuck requisition
    const [dr] = await conn.query("DELETE FROM field_purchase_orders WHERE id = ? AND status = 'Draft'", [p.id]);
    if (!dr.affectedRows) throw fail(409, 'Only a draft can be deleted');
    await conn.query('DELETE FROM field_purchase_order_items WHERE po_id = ?', [p.id]);
    if (p.pr_id) await conn.query("UPDATE field_purchase_requests SET status = 'Open' WHERE id = ? AND NOT EXISTS (SELECT 1 FROM field_purchase_orders WHERE pr_id = ? AND status <> 'Rejected')", [p.pr_id, p.pr_id]);
  });
  res.json({ ok: true });
}));

export default router;
