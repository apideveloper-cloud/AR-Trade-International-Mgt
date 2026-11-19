// GET /expense?month=YYYY-MM&category=&status=
// The mobile app sends ?month= (and maybe category / status) and gets the whole list in `items`. The web console may also send
// ?from= &to= (instead of the month), ?q=, and ?page= &size=; the answer then also has rows (= the page), total (= claims matching the
// filters) and claimed (= the money the old `total` carried). The month figures (total, count, split, categories) never depend on q / category / status.
import { Router } from 'express';
import { pool, guard, wrap, UTC_TS } from '../common.js';
import { tsBetween, bdDateStr, seesAll, MON, BD } from '../report_util.js';
import { addSearch, pageOf, wantsPage, whereOf } from '../../listing.js';
import { sum, scopeOf, customWindow } from './shared.js';

const router = Router();

/** Month figures from grouped rows [{ status, category, n, amount }]: total, count, split by status and by category. */
export function expenseFigures(groups) {
  const part = (pick) => ({ amount: Math.round(sum(groups.filter(pick), g => g.amount)), count: sum(groups.filter(pick), g => g.n) });
  return {
    total: sum(groups, g => g.amount), count: sum(groups, g => g.n),
    split: ['Approved', 'Pending', 'Rejected'].map(label => ({ label, ...part(g => g.status === label) })),
    categories: [...new Set(groups.map(g => g.category))].map(name => ({ name, ...part(g => g.category === name) })).sort((a, b) => b.amount - a.amount)
  };
}

router.get('/expense', guard(), wrap(async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || '')) || /^(\d{4})-(\d{2})$/.exec(bdDateStr(new Date()).slice(0, 7));
  const y = +m[1], mo = +m[2] - 1;
  const custom = customWindow(req);
  const start = custom ? custom.start : new Date(Date.UTC(y, mo, 1) - BD), end = custom ? custom.end : new Date(Date.UTC(y, mo + 1, 1) - BD);
  const [sf, sa] = scopeOf(req, 'e.staff_id');
  const r = tsBetween('e.created_at', start, end);
  const [groups] = await pool.query(`SELECT e.status, e.category, COUNT(*) n, COALESCE(SUM(e.amount), 0) amount FROM field_expenses e WHERE ${r.sql}${sf} GROUP BY e.status, e.category`, [...r.args, ...sa]);
  const { total, count, split, categories } = expenseFigures(groups);

  const cond = [r.sql + sf], args = [...r.args, ...sa];
  const cat = String(req.query.category || ''), st = String(req.query.status || '').toLowerCase();
  if (cat) { cond.push('e.category = ?'); args.push(cat); }
  if (st) { cond.push('LOWER(e.status) = ?'); args.push(st); }
  addSearch(cond, args, ['e.title', 'e.category', 's.name'], req.query.q);
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const from = `FROM field_expenses e JOIN staff s ON s.id = e.staff_id ${whereOf(cond)}`;
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.category, e.amount, e.status, e.voucher IS NOT NULL AS has_voucher, ${UTC_TS('e.created_at')} AS at_utc, s.name ${from} ORDER BY e.created_at DESC, e.id DESC${paged ? ' LIMIT ? OFFSET ?' : ''}`,
    paged ? [...args, pg.size, pg.offset] : args);
  const items = rows.map(e => ({
    id: e.id, date: e.at_utc, title: e.title, who: e.name, category: e.category, amount: Math.round(Number(e.amount)), status: e.status.toLowerCase(), voucher: !!e.has_voucher
  }));
  const out = { month: custom ? custom.label : `${MON[mo]} ${y}`, key: custom ? '' : `${y}-${String(mo + 1).padStart(2, '0')}`, total: Math.round(total), count, split, categories, items, scope: seesAll(req.staff) ? 'team' : 'me' };
  if (!paged) return res.json(out);
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from}`, args);
  res.json({ ...out, claimed: out.total, rows: items, total: n.n });
}));

export default router;
