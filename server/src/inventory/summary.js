// Overview numbers for the inventory dashboard (this month).
import { Router } from 'express';
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { monthBounds, today, wrap } from '../util.js';
import { VIEW, BILLED, BAL } from './constants.js';

const router = Router();

router.get('/summary', guard(VIEW), wrap(async (req, res) => {
  const [from, to] = monthBounds(today().slice(0, 7));
  const [[[a]], [[b]], [[c]], [[d]], [[e]], [[pn]], [[sn]]] = await Promise.all([pool.query(`SELECT COALESCE(SUM(${BAL}), 0) payable, COUNT(*) vendors, COALESCE(SUM(${BAL} > 0), 0) owed_n FROM field_vendors v WHERE v.active = 1`), pool.query(`SELECT COALESCE(SUM(total), 0) t, COUNT(*) n FROM stock_receipts WHERE ${BILLED} AND received_on >= ? AND received_on < ?`, [from, to]), pool.query("SELECT COALESCE(SUM(amount), 0) t FROM vendor_payments WHERE paid_on >= ? AND paid_on < ?", [from, to]), pool.query("SELECT COALESCE(SUM(qty * unit_cost), 0) t, COALESCE(SUM(qty), 0) q FROM stock_damages WHERE damaged_on >= ? AND damaged_on < ?", [from, to]), pool.query("SELECT COALESCE(SUM(total), 0) t FROM vendor_returns WHERE returned_on >= ? AND returned_on < ?", [from, to]), pool.query("SELECT COUNT(*) n FROM stock_receipts WHERE status = 'Pending'"), pool.query("SELECT COUNT(*) n FROM stock_receipts WHERE status = 'Approved'")]);
  res.json({ pendingApproval: Number(pn.n), awaitingStock: Number(sn.n), payable: Number(a.payable), vendors: Number(a.vendors), owedCount: Number(a.owed_n), purchased: Number(b.t), purchases: Number(b.n), paid: Number(c.t), damageLoss: Number(d.t), damagePcs: Number(d.q), returned: Number(e.t) });
}));

export default router;
