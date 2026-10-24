// Team live map and internal chat.
//   GET  /api/field/team                  every active staff member with status, last position, km today, visits n/m (managers / approvers)
//   (my own km / next stop / street name moved to /api/field/mytrack so every role can use the Tracking screen)
//   GET  /api/field/team/:id/route        today's GPS polyline (me, or any staff for approvers)
//   GET  /api/field/team/:id/messages     chat thread between me and :id (marks theirs as read)
//   POST /api/field/team/:id/messages     { body }
import { Router } from 'express';
import { pool, wrap, fail, guard, isApprover, roleKey, ROLE_LABELS, UTC, todayBD, notify } from '../common.js';
import { placeNow } from './mytrack.js';

const router = Router();

// Head office (Santinagar) and the allowed working radius around it; beyond it a clocked-in person shows as "Off route".
const OFFICE = { lat: Number(process.env.FIELD_OFFICE_LAT || 23.7465), lng: Number(process.env.FIELD_OFFICE_LNG || 90.4124) };
const ZONE_KM = Number(process.env.FIELD_ZONE_KM || 10);
const OFFICE_KM = 0.3;

const rad = d => (d * Math.PI) / 180;
const distKm = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const mysql = d => d.toISOString().slice(0, 19).replace('T', ' ');
/** Start of "today" in Bangladesh time, as a UTC Date. */
const dayStart = () => new Date(`${todayBD()}T00:00:00+06:00`);

function allowed(req, res, next) {
  if (isApprover(req.staff) || ['manager', 'admin'].includes(roleKey(req.staff.role))) return next();
  res.status(403).json({ error: 'Your role cannot do this' });
}

/** Today's visits per staff: { staffId: { done, total, live } }. Null when the visits table is not there. */
async function visitsToday() {
  try {
    const [rows] = await pool.query(
      `SELECT staff_id, COUNT(*) total, SUM(status = 'Done') done, SUM(status = 'InProgress') live
       FROM field_visits WHERE visit_date = ? GROUP BY staff_id`, [todayBD()]);
    return new Map(rows.map(r => [r.staff_id, { done: Number(r.done), total: Number(r.total), live: Number(r.live) }]));
  } catch { return null; }
}

function statusOf({ clocked, pos, atClient }) {
  if (!clocked) return 'Offline';
  if (atClient) return 'At client';
  if (!pos) return 'On duty';
  const d = distKm(pos, OFFICE);
  if (d <= OFFICE_KM) return 'In office';
  if (d > ZONE_KM) return 'Off route';
  return 'On duty';
}

function pathKm(points) {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += distKm(points[i - 1], points[i]);
  return Math.round(km * 10) / 10;
}

router.get('/', guard(), allowed, wrap(async (req, res) => {
  const from = mysql(dayStart());
  const [staff] = await pool.query('SELECT id, name, role, phone, email FROM staff WHERE status = "Active" ORDER BY name');
  const [last] = await pool.query(
    `SELECT a.staff_id, a.type FROM field_attendance a
     WHERE a.id = (SELECT b.id FROM field_attendance b WHERE b.staff_id = a.staff_id ORDER BY b.at DESC, b.id DESC LIMIT 1)`);
  const [firstIn] = await pool.query(`SELECT staff_id, ${UTC('MIN(at)')} at FROM field_attendance WHERE type = 'Clocked In' AND at >= ? GROUP BY staff_id`, [from]);
  const [pts] = await pool.query('SELECT staff_id, lat, lng, at FROM field_track WHERE at >= ? ORDER BY staff_id, at', [from]);
  const [latest] = await pool.query(
    `SELECT t.staff_id, t.lat, t.lng, ${UTC('t.at')} iso, TIMESTAMPDIFF(SECOND, t.at, UTC_TIMESTAMP()) age FROM field_track t
     JOIN (SELECT staff_id, MAX(at) at FROM field_track WHERE at >= UTC_TIMESTAMP() - INTERVAL 2 DAY GROUP BY staff_id) m ON m.staff_id = t.staff_id AND m.at = t.at`);
  const visits = await visitsToday();

  const clocked = new Map(last.map(r => [r.staff_id, r.type === 'Clocked In']));
  const firstMap = new Map(firstIn.map(r => [r.staff_id, r.at]));
  const latestMap = new Map(latest.map(r => [r.staff_id, r]));
  const byStaff = new Map();
  for (const p of pts) {
    if (!byStaff.has(p.staff_id)) byStaff.set(p.staff_id, []);
    byStaff.get(p.staff_id).push({ lat: Number(p.lat), lng: Number(p.lng) });
  }

  const members = staff.map(s => {
    const l = latestMap.get(s.id);
    const pos = l ? { lat: Number(l.lat), lng: Number(l.lng) } : null;
    const v = visits ? visits.get(s.id) : null;
    const on = !!clocked.get(s.id);
    return {
      id: s.id, name: s.name, role: roleKey(s.role), roleLabel: s.role, phone: s.phone, email: s.email,
      status: statusOf({ clocked: on, pos, atClient: !!v?.live }),
      online: on, lat: pos?.lat ?? null, lng: pos?.lng ?? null, place: on ? placeNow(pos) : null, ageSec: l ? Number(l.age) : null, seenAt: l?.iso ?? null,
      km: pathKm(byStaff.get(s.id) || []),
      visits: visits ? { done: v?.done || 0, total: v?.total || 0 } : null,
      clockIn: firstMap.get(s.id) || null,
      me: s.id === req.staff.id
    };
  });
  res.json({ updatedAt: new Date().toISOString(), office: OFFICE, members });
}));

router.get('/:id/route', guard(), wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id !== req.staff.id && !isApprover(req.staff) && !['manager', 'admin'].includes(roleKey(req.staff.role))) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(`SELECT lat, lng, ${UTC('at')} time FROM field_track WHERE staff_id = ? AND at >= ? ORDER BY at LIMIT 5000`, [id, mysql(dayStart())]);
  res.json(rows.map(r => ({ lat: Number(r.lat), lng: Number(r.lng), time: r.time })));
}));

router.get('/:id/messages', guard(), wrap(async (req, res) => {
  const other = parseInt(req.params.id, 10);
  const [[who]] = await pool.query('SELECT id, name, role FROM staff WHERE id = ?', [other]);
  if (!who) throw fail(404, 'Person not found');
  await pool.query('UPDATE field_chat SET read_at = NOW() WHERE from_staff = ? AND to_staff = ? AND read_at IS NULL', [other, req.staff.id]);
  const [rows] = await pool.query(
    `SELECT id, from_staff, body, ${UTC('CONVERT_TZ(created_at, @@session.time_zone, "+00:00")')} time, read_at IS NOT NULL AS seen
     FROM field_chat WHERE (from_staff = ? AND to_staff = ?) OR (from_staff = ? AND to_staff = ?) ORDER BY id DESC LIMIT 200`,
    [req.staff.id, other, other, req.staff.id]);
  res.json({ with: { id: who.id, name: who.name, role: roleKey(who.role), roleLabel: who.role },
    messages: rows.reverse().map(r => ({ id: r.id, mine: r.from_staff === req.staff.id, body: r.body, time: r.time, seen: !!r.seen })) });
}));

router.post('/:id/messages', guard(), wrap(async (req, res) => {
  const other = parseInt(req.params.id, 10);
  const body = String(req.body.body || '').trim().slice(0, 1000);
  if (!body) throw fail(400, 'Write a message first');
  if (other === req.staff.id) throw fail(400, 'You cannot message yourself');
  const [[who]] = await pool.query('SELECT id FROM staff WHERE id = ? AND status = "Active"', [other]);
  if (!who) throw fail(404, 'Person not found');
  const [r] = await pool.query('INSERT INTO field_chat (from_staff, to_staff, body) VALUES (?,?,?)', [req.staff.id, other, body]);
  notify(other, { icon: 'chat', cat: 'Updates', title: `Message from ${req.staff.name}`, sub: body.slice(0, 120), body, rows: [['From', `${req.staff.name} · ${ROLE_LABELS[roleKey(req.staff.role)]}`]] });
  res.json({ id: r.insertId, mine: true, body, time: new Date().toISOString(), seen: false });
}));

export default router;
