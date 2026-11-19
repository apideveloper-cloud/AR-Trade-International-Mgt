// Purchase order reads: the list (with the optional web-console search / paging / summary) and one full order.
import { Router } from 'express';
import { pool, fail, wrap, guardRole } from '../common.js';
import { addRange, addSearch, pageOf, whereOf, wantsPage } from '../../listing.js';
import { STATUS_KEY, STATUS_FILTER } from './calc.js';
import { PO_SELECT, poOut, loadPo, seesAll } from './poOut.js';
import { buyerRoles } from './requests.js';

const router = Router();

router.get('/orders', guardRole(...buyerRoles), wrap(async (req, res) => {
  const where = [], args = [];
  if (!seesAll(req.staff) || req.query.mine === '1') { where.push('p.staff_id = ?'); args.push(req.staff.id); }
  // optional (web console): ?q= (PO no., vendor, buyer, note), ?from= &to= (created day), ?page= &size= -> also rows (= the page), total (= matches) and
  // summary { count, by: { status: { n, grand } } } over everything matching q / dates (but not the status filter). No page: the same latest 60 as always.
  addSearch(where, args, ['p.id', 'v.name', 's.name', 'p.note'], req.query.q);
  addRange(where, args, 'p.created_at', req);
  const base = [...where], baseArgs = [...args];
  const st = STATUS_FILTER[req.query.status];
  if (st) { where.push('p.status = ?'); args.push(st); }
  const paged = wantsPage(req);
  const pg = paged ? pageOf(req, { def: 25, max: 200 }) : null;
  const [rows] = await pool.query(`${PO_SELECT} ${whereOf(where)} ORDER BY p.created_at DESC, p.id DESC LIMIT ?${paged ? ' OFFSET ?' : ''}`, paged ? [...args, pg.size, pg.offset] : [...args, 60]);
  const items = [];
  for (const p of rows) items.push(await poOut(p, false, req.staff));
  if (!paged) return res.json({ items });
  const from = 'FROM field_purchase_orders p JOIN field_vendors v ON v.id = p.vendor_id JOIN staff s ON s.id = p.staff_id';
  const [[n]] = await pool.query(`SELECT COUNT(*) n ${from} ${whereOf(where)}`, args);
  const [groups] = await pool.query(`SELECT p.status, COUNT(*) n, COALESCE(SUM(p.grand_total), 0) grand ${from} ${whereOf(base)} GROUP BY p.status`, baseArgs);
  const by = {};
  for (const g of groups) by[STATUS_KEY[g.status]] = { n: g.n, grand: Number(g.grand) };
  res.json({ items, rows: items, total: n.n, summary: { count: groups.reduce((t, g) => t + g.n, 0), by } });
}));

router.get('/orders/:id', guardRole(...buyerRoles), wrap(async (req, res) => {
  const p = await loadPo(req.params.id);
  if (!seesAll(req.staff) && p.staff_id !== req.staff.id) throw fail(403, 'This purchase order belongs to someone else');
  res.json(await poOut(p, true, req.staff));
}));

export default router;
