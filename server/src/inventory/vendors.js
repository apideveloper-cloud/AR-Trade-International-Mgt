// Vendor routes: list with balances, create, update, delete.
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, fail, wrap } from '../util.js';
import { addSearch, pageOf, whereOf, wantsPage } from '../listing.js';
import { VIEW, MANAGE, BILLED, BAL } from './constants.js';
import { nextVendorCode, fillVendorCodes } from './numbering.js';
import { vOut, vendorBody } from './pure.js';

const router = Router();
const DUP_NAME = 'A vendor with this name already exists';

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
  const [[[t]], [rows]] = await Promise.all([pool.query(`SELECT COUNT(*) n, COALESCE(SUM(${BAL}), 0) payable, COALESCE(SUM(${BAL} > 0), 0) owing FROM field_vendors v ${where}`, args), pool.query(`${sel} LIMIT ${size} OFFSET ${offset}`, args)]);
  res.json({ total: Number(t.n), rows: rows.map(vOut), totals: { payable: Number(t.payable), owing: Number(t.owing) } });
}));

router.post('/vendors', guard(MANAGE), wrap(async (req, res) => {
  const v = vendorBody(req.body);
  if (!v.name) throw fail(400, 'Vendor name is required');
  try {
    const code = await nextVendorCode(String(new Date(Date.now() + 6 * 3600e3).getUTCFullYear()).slice(2));
    const [r] = await pool.query('INSERT INTO field_vendors (code, name, vtype, kind, contact, pic_desig, pic_phone, phone, email, address, note, opening, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [code, v.name, v.vtype, v.kind, v.contact, v.picDesig, v.picPhone, v.phone, v.email, v.address, v.note, v.opening, v.active]);
    res.json({ id: r.insertId, code });
  } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(409, DUP_NAME); throw e; }
}));

router.put('/vendors/:id', guard(MANAGE), wrap(async (req, res) => {
  const v = vendorBody(req.body);
  if (!v.name) throw fail(400, 'Vendor name is required');
  try { await pool.query('UPDATE field_vendors SET name=?, vtype=?, kind=?, contact=?, pic_desig=?, pic_phone=?, phone=?, email=?, address=?, note=?, opening=?, active=? WHERE id=?', [v.name, v.vtype, v.kind, v.contact, v.picDesig, v.picPhone, v.phone, v.email, v.address, v.note, v.opening, v.active, req.params.id]); } catch (e) { if (e.code === 'ER_DUP_ENTRY') throw fail(409, DUP_NAME); throw e; }
  res.json({ ok: true });
}));

router.delete('/vendors/:id', guard(MANAGE), wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [[u]] = await pool.query('SELECT (SELECT COUNT(*) FROM stock_receipts WHERE vendor_id = ?) + (SELECT COUNT(*) FROM vendor_payments WHERE vendor_id = ?) + (SELECT COUNT(*) FROM vendor_returns WHERE vendor_id = ?) + (SELECT COUNT(*) FROM field_purchase_orders WHERE vendor_id = ?) n', [id, id, id, id]).catch(() => [[{ n: 1 }]]);
  if (Number(u.n)) throw fail(409, 'This vendor has purchases or payments on record. Mark it inactive instead of deleting it.');
  await pool.query('DELETE FROM field_vendors WHERE id = ?', [id]);
  res.json({ ok: true });
}));

export default router;
