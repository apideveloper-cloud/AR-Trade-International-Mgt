// Read-only list routes: the paged list, customer picker and the default texts.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { D, wrap } from '../util.js';
import { addAmount, addRange, addSearch, pageOf, whereOf } from '../listing.js';
import { CUSTOMER_TYPES, DEFAULT_INTRO, DEFAULT_NOTES, MANAGE, STATUSES, VIEW } from './constants.js';
import { fieldCustomers, qOut } from './store.js';

/** Adds GET /, GET /customers and GET /defaults to the router. */
export function listRoutes(router) {
  router.get('/', guard(VIEW), wrap(async (req, res) => {
    const cond = [], args = [];
    addSearch(cond, args, ['q.id', 'q.to_name', 'q.subject', 'q.attend', 'q.mobile'], req.query.q);
    addRange(cond, args, 'q.quote_date', req);
    addAmount(cond, args, 'q.net', req);
    if (STATUSES.includes(req.query.status)) { cond.push('q.status = ?'); args.push(req.query.status); }
    if (CUSTOMER_TYPES.includes(req.query.ctype)) { cond.push('q.cust_type = ?'); args.push(req.query.ctype); }
    const where = whereOf(cond);
    const { size, offset } = pageOf(req);
    const [[rows], [[t]]] = await Promise.all([pool.query(`SELECT q.*, ${D('q.quote_date')} d, (SELECT COUNT(*) FROM quotation_items i WHERE i.quote_id = q.id) n FROM quotations q ${where} ORDER BY q.quote_date DESC, q.created_at DESC LIMIT ${size} OFFSET ${offset}`, args), pool.query(`SELECT COUNT(*) n, COALESCE(SUM(q.net), 0) net, COALESCE(SUM(q.status = 'Draft'), 0) draft, COALESCE(SUM(q.status = 'Sent'), 0) sent, COALESCE(SUM(q.status = 'Accepted'), 0) won, COALESCE(SUM(IF(q.status = 'Accepted', q.net, 0)), 0) won_net FROM quotations q ${where}`, args)]);
    const items = rows.map(r => ({ ...qOut(r), items: Number(r.n) }));
    res.json({ total: Number(t.n), rows: items, totals: { net: Number(t.net), draft: Number(t.draft), sent: Number(t.sent), accepted: Number(t.won), acceptedNet: Number(t.won_net) } });
  }));
  router.get('/customers', guard(MANAGE), wrap(async (req, res) => { res.json({ items: await fieldCustomers(req.query.type, req.query.q) }); }));
  router.get('/defaults', guard(MANAGE), wrap(async (req, res) => {
    res.json({ intro: DEFAULT_INTRO, notes: DEFAULT_NOTES });
  }));
}
