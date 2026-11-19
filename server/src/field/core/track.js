// Live GPS tracking: upload points, who is on duty now, one person's route.
import { Router } from 'express';
import { pool, guard, wrap, fail, isApprover, mysqlDate, UTC, range, coord } from '../common.js';

const router = Router();

router.post('/track', guard(), wrap(async (req, res) => {
  const pts = Array.isArray(req.body.points) ? req.body.points.slice(0, 500) : [];
  if (!pts.length) throw fail(400, 'No points');
  const rows = [];
  for (const p of pts) { // a malformed point is skipped, it never fails the batch
    try { rows.push([req.staff.id, coord(p?.lat, 90), coord(p?.lng, 180), mysqlDate(p?.time)]); } catch { /* skip */ }
  }
  if (rows.length) await pool.query('INSERT INTO field_track (staff_id,lat,lng,at) VALUES ?', [rows]);
  // `accepted` = how many points from the START of the sent list were taken in (at most 500 are read): the app drops exactly those; bad points among them are counted in `skipped`
  res.json({ ok: true, saved: rows.length, accepted: pts.length, skipped: pts.length - rows.length });
}));

// latest position of everyone who is on duty (office view)
router.get('/track/live', guard('field.approve'), wrap(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.id, s.name, s.role, t.lat, t.lng, ${UTC('t.at')} at
    FROM staff s
    JOIN (SELECT staff_id, MAX(at) at FROM field_track WHERE at >= UTC_TIMESTAMP() - INTERVAL 15 MINUTE GROUP BY staff_id) m ON m.staff_id = s.id
    JOIN field_track t ON t.staff_id = m.staff_id AND t.at = m.at
    WHERE (SELECT type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.at DESC, a.id DESC LIMIT 1) = 'Clocked In'
    GROUP BY s.id, s.name, s.role, t.lat, t.lng, t.at`);
  res.json(rows.map(r => ({ id: r.id, name: r.name, role: r.role, lat: Number(r.lat), lng: Number(r.lng), at: r.at })));
}));

// full route for one person in a time range (?from=&to=); employees may only read their own
router.get('/track/:staffId', guard(), wrap(async (req, res) => {
  const sid = parseInt(req.params.staffId, 10);
  if (!sid) throw fail(400, 'Invalid staff id');
  if (sid !== req.staff.id && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(`SELECT lat, lng, ${UTC('at')} at FROM field_track WHERE staff_id = ? AND at >= ? AND at <= ? ORDER BY at, id LIMIT 5000`, [sid, ...range(req.query)]);
  res.json(rows.map(r => ({ lat: Number(r.lat), lng: Number(r.lng), time: r.at })));
}));

export default router;
