// Staff accounts as seen in the app's Admin console (admin role only).
//   GET /api/field/users                  every staff member with role, status, clock state
//   PUT /api/field/users/:id/status       { status: 'Active' | 'Disabled' }
// Profile extras for every signed-in staff member (not admin only):
//   GET    /api/field/users/me/extra      { photoUrl, passwordChangedAt, memberSince }
//   PUT    /api/field/users/me/extra      { area }   working area shown on the profile
//   POST   /api/field/users/me/photo      { photo: 'data:image/jpeg;base64,...' }  (max 1.5 MB) -> { photoUrl }
//   DELETE /api/field/users/me/photo
//   GET    /api/field/users/:id/photo     the picture (authenticated, any signed-in staff may see it)
// The picture is a file in uploads/profile. The last password change is learned by fingerprinting the stored hash: whenever the hash
// differs from the one last seen, the change time is stamped (the app reloads this right after a change, so it is accurate).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { pool, guard, guardRole, wrap, fail, roleKey, empCode, UTC, addColumn } from '../common.js';

const router = Router();
const admin = guardRole('admin');
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../uploads/profile');
fs.mkdirSync(DIR, { recursive: true });
const ready = pool.query(`CREATE TABLE IF NOT EXISTS field_staff_extra (
  staff_id INT PRIMARY KEY,
  photo VARCHAR(80) NULL,
  photo_v INT NOT NULL DEFAULT 0,
  pw_fp CHAR(16) NOT NULL DEFAULT '',
  pw_changed_at DATETIME NULL
)`)
  .then(() => addColumn('field_staff_extra', 'area', "VARCHAR(120) NOT NULL DEFAULT ''"))
  .catch(e => console.error('[field] staff extra table:', e.message));
const fp = hash => crypto.createHash('sha256').update(String(hash || '')).digest('hex').slice(0, 16);
const photoUrl = (id, r) => (r?.photo ? `/api/field/users/${id}/photo?v=${r.photo_v}` : null);

router.get('/me/extra', guard(), wrap(async (req, res) => {
  await ready;
  const id = req.staff.id, now = fp(req.staff.password_hash);
  let [[r]] = await pool.query('SELECT * FROM field_staff_extra WHERE staff_id = ?', [id]);
  if (!r) {
    await pool.query('INSERT IGNORE INTO field_staff_extra (staff_id, pw_fp) VALUES (?, ?)', [id, now]);
    [[r]] = await pool.query('SELECT * FROM field_staff_extra WHERE staff_id = ?', [id]);
  } else if (r.pw_fp !== now) {
    await pool.query('UPDATE field_staff_extra SET pw_fp = ?, pw_changed_at = UTC_TIMESTAMP() WHERE staff_id = ?', [now, id]);
    [[r]] = await pool.query('SELECT * FROM field_staff_extra WHERE staff_id = ?', [id]);
  }
  const [[c]] = await pool.query(`SELECT ${UTC('pw_changed_at')} changed FROM field_staff_extra WHERE staff_id = ?`, [id]);
  const [[m]] = await pool.query(`SELECT ${UTC('CONVERT_TZ(created_at, @@session.time_zone, "+00:00")')} since FROM staff WHERE id = ?`, [id]);
  res.json({ photoUrl: photoUrl(id, r), area: r.area || '', passwordChangedAt: c?.changed || null, memberSince: m?.since || null });
}));

router.put('/me/extra', guard(), wrap(async (req, res) => {
  await ready;
  const area = String(req.body.area || '').trim().slice(0, 120);
  await pool.query('INSERT INTO field_staff_extra (staff_id, area, pw_fp) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE area = VALUES(area)', [req.staff.id, area, fp(req.staff.password_hash)]);
  res.json({ area });
}));

router.post('/me/photo', guard(), wrap(async (req, res) => {
  await ready;
  const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(String(req.body.photo || ''));
  if (!m) throw fail(400, 'The picture must be a JPG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 1.5 * 1048576) throw fail(400, 'The picture must be under 1.5 MB');
  const file = `u${req.staff.id}-${crypto.randomBytes(5).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(DIR, file), buf);
  const [[old]] = await pool.query('SELECT photo FROM field_staff_extra WHERE staff_id = ?', [req.staff.id]);
  await pool.query(
    'INSERT INTO field_staff_extra (staff_id, photo, photo_v, pw_fp) VALUES (?, ?, 1, ?) ON DUPLICATE KEY UPDATE photo = VALUES(photo), photo_v = photo_v + 1',
    [req.staff.id, file, fp(req.staff.password_hash)]);
  if (old?.photo) fs.rm(path.join(DIR, path.basename(old.photo)), () => {});
  const [[r]] = await pool.query('SELECT * FROM field_staff_extra WHERE staff_id = ?', [req.staff.id]);
  res.json({ photoUrl: photoUrl(req.staff.id, r) });
}));

router.delete('/me/photo', guard(), wrap(async (req, res) => {
  await ready;
  const [[old]] = await pool.query('SELECT photo FROM field_staff_extra WHERE staff_id = ?', [req.staff.id]);
  await pool.query('UPDATE field_staff_extra SET photo = NULL, photo_v = photo_v + 1 WHERE staff_id = ?', [req.staff.id]);
  if (old?.photo) fs.rm(path.join(DIR, path.basename(old.photo)), () => {});
  res.json({ photoUrl: null });
}));

router.get('/:id/photo', guard(), wrap(async (req, res) => {
  await ready;
  const [[r]] = await pool.query('SELECT photo FROM field_staff_extra WHERE staff_id = ?', [req.params.id]);
  if (!r?.photo) throw fail(404, 'No picture');
  const file = path.join(DIR, path.basename(r.photo));
  if (!fs.existsSync(file)) throw fail(404, 'No picture');
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(file);
}));

router.get('/', admin, wrap(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, (SELECT e.photo_v FROM field_staff_extra e WHERE e.staff_id = s.id AND e.photo IS NOT NULL) photo_v,
            (SELECT a.type FROM field_attendance a WHERE a.staff_id = s.id ORDER BY a.at DESC, a.id DESC LIMIT 1) AS last_type,
            (SELECT ${UTC('MAX(a.at)')} FROM field_attendance a WHERE a.staff_id = s.id) AS last_seen
     FROM staff s ORDER BY FIELD(s.status, 'Active', 'Pending', 'Disabled'), s.name`);
  res.json({
    items: rows.map(s => ({
      id: s.id, name: s.name, email: s.email, phone: s.phone, employeeCode: empCode(s), role: roleKey(s.role), roleLabel: s.role,
      status: s.status, photoUrl: s.photo_v == null ? null : `/api/field/users/${s.id}/photo?v=${s.photo_v}`, onDuty: s.last_type === 'Clocked In', lastSeen: s.last_seen, protected: s.role === 'Master Admin' || s.id === req.staff.id
    })),
    counts: { total: rows.length, active: rows.filter(s => s.status === 'Active').length, disabled: rows.filter(s => s.status === 'Disabled').length, pending: rows.filter(s => s.status === 'Pending').length }
  });
}));

router.put('/:id/status', admin, wrap(async (req, res) => {
  const status = ['Active', 'Disabled'].includes(req.body.status) ? req.body.status : null;
  if (!status) throw fail(400, 'Status must be Active or Disabled');
  const [[s]] = await pool.query('SELECT id, role, status FROM staff WHERE id = ?', [req.params.id]);
  if (!s) throw fail(404, 'Staff member not found');
  if (s.id === req.staff.id) throw fail(403, 'You cannot change your own account here');
  if (s.role === 'Master Admin') throw fail(403, 'The Master Admin account cannot be disabled');
  await pool.query('UPDATE staff SET status = ? WHERE id = ?', [status, s.id]);
  res.json({ id: s.id, status });
}));

export default router;
