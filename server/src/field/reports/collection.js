// GET /collection
// ?period=day|week|month as before, or ?from= &to= (custom days). The web console may add ?q= (receipt, customer, invoice, reference, staff), ?method=, ?status=
// and ?page= &size=; the answer then also has rows (= the page), total (= receipts matching the filters) and collected (= the money the old `total` carried).
import { Router } from 'express';
import { pool, guard, wrap, UTC_TS } from '../common.js';
import { period, tsBetween, seesAll } from '../report_util.js';
import { addSearch, pageOf, wantsPage, whereOf } from '../../listing.js';
import { kind, sum, scopeOf, customWindow } from './shared.js';

const router = Router();

/** Outstanding dues [{ due, age }] split into 0-15, 16-30 and 30+ day buckets (whole taka). */
export function agingBuckets(inv) {
  const bucket = (lo, hi) => Math.round(sum(inv.filter(i => i.age >= lo && i.age <= hi), i => i.due));
  return [{ label: '0–15 days', amount: bucket(-9999, 15) }, { label: '16–30 days', amount: bucket(16, 30) }, { label: '30+ days', amount: bucket(31, 99999) }];
}

router.get('/collection', guard(), wrap(async (req, res) => {
  const win = customWindow(req) || period(kind(req.query.period || 'month'));
  const [sf, sa] = scopeOf(req, 'p.staff_id');
  const r = tsBetween('p.created_at', win.start, win.end);
  const [byMethod] = await pool.query(`SELECT p.method, p.status = 'Bounced' AS bounced, COUNT(*) n, COALESCE(SUM(p.amount), 0) amount FROM field_payments p WHERE ${r.sql}${sf} GROUP BY p.method, bounced`, [...r.args, ...sa]);
  const valid = byMethod.filter(g => !g.bounced);
  const total = sum(valid, g => g.amount), count = sum(byMethod, g => g.n);
  const methods = ['Cash', 'bKash', 'Cheque', 'Bank'].map(label => { const a = sum(valid.filter(g => g.method === label), g => g.amount); return { label, amount: Math.round(a), pct: total ? Math.round((a / total) * 100) : 0 }; });
  const cond = [r.sql + sf], args = [...r.args, ...sa];
  const method = String(req.query.method || ''), st = String(req.query.status || '');
  if (method) { cond.push('p.method = ?'); args.push(method); }
  if (st) { cond.push('p.status = ?'); args.push(st); }
  addSearch(cond, args, ['p.id', 'c.name', 'p.invoice_refs', 'p.reference', 's.name'], req.query.q);
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const from = `FROM field_payments p LEFT JOIN field_customers c ON c.id = p.customer_id LEFT JOIN staff s ON s.id = p.staff_id ${whereOf(cond)}`;
  const [rows] = await pool.query(
    `SELECT p.id, p.invoice_refs, p.method, p.amount, p.status, ${UTC_TS('p.created_at')} AS at_utc, c.name AS customer, s.name AS who ${from} ORDER BY p.created_at DESC, p.id DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...args, pg.size, pg.offset] : args);

  // outstanding dues by invoice age
  const own = seesAll(req.staff) ? '' : ' AND i.order_id IN (SELECT id FROM field_sales_orders WHERE staff_id = ?)';
  const [inv] = await pool.query(
    `SELECT i.total - i.paid AS due, DATEDIFF(UTC_DATE(), DATE(i.created_at)) AS age FROM field_invoices i WHERE i.total > i.paid${own}`,
    seesAll(req.staff) ? [] : [req.staff.id]);
  const items = rows.map(p => ({ id: p.id, date: p.at_utc, customer: p.customer || '—', invoices: p.invoice_refs, method: p.method, who: p.who || '', amount: Number(p.amount), status: p.status }));
  const out = { period: win.kind, label: win.label, total: Math.round(total), count, methods, dues: { total: Math.round(sum(inv, i => i.due)), aging: agingBuckets(inv) }, items };
  if (!paged) return res.json(out);
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from}`, args);
  res.json({ ...out, collected: out.total, rows: items, total: n.n });
}));

export default router;
