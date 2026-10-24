// In-app notifications.
//   GET /api/field/notifications?cat=Approvals|Alerts|Updates&limit=   -> { items, counts: {all,Approvals,Alerts,Updates}, unread: {all,Approvals,Alerts,Updates} }
//   GET /api/field/notifications/:id
//   PUT /api/field/notifications/read-all
//   PUT /api/field/notifications/:id/read
import { Router } from 'express';
import { pool, fail, wrap, guard, parseJson, UTC_TS } from '../common.js';

const router = Router();
const CATS = ['Approvals', 'Alerts', 'Updates'];

const out = n => ({
  id: n.id, icon: n.icon, title: n.title, sub: n.sub, body: n.body || '', cat: n.cat, rows: parseJson(n.rows_json) || [],
  a1: n.a1, a1Icon: n.a1_icon, a2: n.a2, createdAt: n.created_at, read: !!n.read_at
});
const COLS = `id, icon, title, sub, body, cat, rows_json, a1, a1_icon, a2, ${UTC_TS('created_at')} created_at, read_at`;

router.get('/', guard(), wrap(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const cat = CATS.includes(req.query.cat) ? req.query.cat : null;
  const [rows] = await pool.query(`SELECT ${COLS} FROM field_notifications WHERE staff_id = ? ${cat ? 'AND cat = ?' : ''} ORDER BY id DESC LIMIT ?`,
    cat ? [req.staff.id, cat, limit] : [req.staff.id, limit]);
  const [agg] = await pool.query('SELECT cat, COUNT(*) n, SUM(read_at IS NULL) u FROM field_notifications WHERE staff_id = ? GROUP BY cat', [req.staff.id]);
  const counts = { all: 0, Approvals: 0, Alerts: 0, Updates: 0 }, unread = { all: 0, Approvals: 0, Alerts: 0, Updates: 0 };
  for (const a of agg) { counts[a.cat] = Number(a.n); unread[a.cat] = Number(a.u); counts.all += Number(a.n); unread.all += Number(a.u); }
  res.json({ items: rows.map(out), counts, unread });
}));

// must come before '/:id'
router.put('/read-all', guard(), wrap(async (req, res) => {
  await pool.query('UPDATE field_notifications SET read_at = NOW() WHERE staff_id = ? AND read_at IS NULL', [req.staff.id]);
  res.json({ ok: true });
}));

router.get('/:id', guard(), wrap(async (req, res) => {
  const [[n]] = await pool.query(`SELECT ${COLS} FROM field_notifications WHERE id = ? AND staff_id = ?`, [req.params.id, req.staff.id]);
  if (!n) throw fail(404, 'Notification not found');
  res.json(out(n));
}));

router.put('/:id/read', guard(), wrap(async (req, res) => {
  await pool.query('UPDATE field_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = ? AND staff_id = ?', [req.params.id, req.staff.id]);
  res.json({ ok: true });
}));

export default router;
