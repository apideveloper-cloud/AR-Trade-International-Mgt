// Manager / accountant / admin dashboard of the field app.
//   GET /api/field/overview
import { Router } from 'express';
import { pool, guardRole, wrap, UTC_TS, roleKey } from '../common.js';
import { period, tsBetween, toSql, tkText, kfmt, bdDateStr } from '../report_util.js';

const router = Router();
const CLOCKERS = ['Field Officer', 'RM', 'Purchase Officer'];
const tryQuery = async (sql, args, fallback) => { try { return (await pool.query(sql, args))[0]; } catch { return fallback; } };

router.get('/', guardRole('manager', 'accountant'), wrap(async (req, res) => {
  const day = period('day');
  const t = tsBetween('created_at', day.start, day.end);

  const [[staff]] = await pool.query(
    `SELECT COUNT(*) total, COALESCE(SUM((SELECT a.type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.at DESC, a.id DESC LIMIT 1) = 'Clocked In'), 0) on_duty
     FROM staff s WHERE s.status = 'Active' AND s.role IN (?)`, [CLOCKERS]);
  // same rules as the Approvals screen (approvals.js): only what this person can decide, never their own requests
  const role = roleKey(req.staff.role);
  const decidesLeave = role === 'manager' || role === 'admin';
  const poStates = role === 'manager' ? ['Submitted'] : role === 'accountant' ? ['ManagerApproved'] : ['Submitted', 'ManagerApproved'];
  const [[ex]] = await pool.query("SELECT COUNT(*) n, COALESCE(SUM(amount), 0) amt FROM field_expenses WHERE status = 'Pending' AND staff_id <> ?", [req.staff.id]);
  const lv = decidesLeave ? (await pool.query("SELECT COUNT(*) n FROM field_leave_requests WHERE status = 'Open' AND staff_id <> ?", [req.staff.id]))[0][0] : { n: 0 };
  const po = (await tryQuery('SELECT COUNT(*) n FROM field_purchase_orders WHERE status IN (?) AND staff_id <> ?', [poStates, req.staff.id], [{ n: 0 }]))[0];
  const so = decidesLeave ? (await tryQuery("SELECT COUNT(*) n FROM field_sales_orders WHERE approval_status = 'Pending'", [], [{ n: 0 }]))[0] : { n: 0 };
  const [[sales]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(total), 0) amt FROM field_sales_orders WHERE ${t.sql}`, t.args);
  const [[coll]] = await pool.query(`SELECT COUNT(*) n, COALESCE(SUM(amount), 0) amt FROM field_payments WHERE status <> 'Bounced' AND ${t.sql}`, t.args);
  const [[dues]] = await pool.query(
    `SELECT COALESCE(SUM(total - paid), 0) amt, COALESCE(SUM(IF(DATEDIFF(UTC_DATE(), DATE(created_at)) > 30, total - paid, 0)), 0) overdue FROM field_invoices WHERE total > paid`);
  const low = await tryQuery('SELECT name, stock FROM products WHERE active = 1 AND stock <= 10 ORDER BY stock, name LIMIT 5', [], []);
  const [[lowN]] = await pool.query('SELECT COUNT(*) n FROM products WHERE active = 1 AND stock <= 10').catch(() => [[{ n: 0 }]]);
  const [alerts] = await pool.query(`SELECT icon, title, sub, ${UTC_TS('created_at')} at_utc FROM field_notifications WHERE staff_id = ? AND cat = 'Alerts' ORDER BY id DESC LIMIT 4`, [req.staff.id]);

  res.json({
    date: bdDateStr(new Date()),
    staff: { total: Number(staff.total), onDuty: Number(staff.on_duty) },
    approvals: { expenses: ex.n, expenseAmount: Math.round(ex.amt), leave: lv.n, purchase: Number(po?.n || 0), orders: Number(so?.n || 0), total: ex.n + lv.n + Number(po?.n || 0) + Number(so?.n || 0) },
    sales: { orders: sales.n, amount: Math.round(sales.amt), display: tkText(sales.amt) },
    collection: { receipts: coll.n, amount: Math.round(coll.amt), display: tkText(coll.amt) },
    dues: { total: Math.round(dues.amt), overdue: Math.round(dues.overdue), display: tkText(dues.amt), overdueDisplay: tkText(dues.overdue) },
    lowStock: { count: Number(lowN.n || 0), items: low.map(p => ({ name: p.name, stock: p.stock })) },
    alerts: alerts.map(a => ({ icon: a.icon, title: a.title, sub: a.sub, at: a.at_utc }))
  });
}));

export default router;
void toSql; void kfmt;
