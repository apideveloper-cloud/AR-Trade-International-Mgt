import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { digits, fail, wrap, checkPassword, secret } from './util.js';
import { guard } from './admin.js';

// REST API for the AR Trade mobile app: attendance, live GPS tracking and expenses.
const router = Router();
const here = path.dirname(fileURLToPath(import.meta.url));
const VOUCHERS = path.resolve(here, '../uploads/vouchers');
fs.mkdirSync(VOUCHERS, { recursive: true });

const APPROVERS = ['Super admin', 'Admin', 'Manager', 'Accounts'];
const isApprover = s => APPROVERS.includes(s.role);
const appRole = r => ({ 'Super admin': 'admin', Admin: 'admin', Manager: 'manager', Accounts: 'accounts' }[r] || 'employee');
const staffOut = s => ({ id: s.id, name: s.name, email: s.email, phone: s.phone, role: appRole(s.role), roleLabel: s.role });
const mysqlDate = v => { const d = new Date(v); if (isNaN(d)) throw fail(400, 'Invalid time'); return d.toISOString().slice(0, 19).replace('T', ' '); };
const UTC = c => `DATE_FORMAT(${c}, '%Y-%m-%dT%H:%i:%sZ')`; // times are stored in UTC
const range = q => { // client sends its local day as UTC instants; default = last 24h
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - 864e5);
  if (isNaN(from) || isNaN(to)) throw fail(400, 'Invalid range');
  return [mysqlDate(from), mysqlDate(to)];
};
const coord = (v, max) => { const n = Number(v); if (!Number.isFinite(n) || Math.abs(n) > max) throw fail(400, 'Invalid coordinates'); return n; };

const expenseOut = e => ({
  id: String(e.id), employeeName: e.name, title: e.title, category: e.category, amount: Number(e.amount),
  date: e.created_utc, voucher: e.voucher ? `/api/field/vouchers/${e.voucher}` : null, status: e.status.toLowerCase()
});

// ---------- auth ----------
router.post('/login', wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  const [[s]] = await pool.query('SELECT * FROM staff WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id).slice(-11)]);
  if (!s || !(await bcrypt.compare(req.body.password || '', s.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
  if (s.status !== 'Active') throw fail(403, s.status === 'Pending' ? 'Your account is waiting for approval.' : 'This account is disabled.');
  const token = jwt.sign({ sid: s.id, srole: s.role }, secret(), { expiresIn: '30d' });
  res.json({ token, staff: staffOut(s) });
}));

router.get('/me', guard(), wrap(async (req, res) => { res.json({ staff: staffOut(req.staff) }); }));

// ---------- own profile ----------
router.put('/profile', guard(), wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
  const phone = digits(req.body.phone).slice(-11);
  if (name.length < 2) throw fail(400, 'Enter your name');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  if (!/^01[3-9]\d{8}$/.test(phone)) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX)');
  const [dup] = await pool.query('SELECT id FROM staff WHERE (email = ? OR phone = ?) AND id <> ?', [email, phone, req.staff.id]);
  if (dup.length) throw fail(409, 'This email or mobile number is already used by another account');
  await pool.query('UPDATE staff SET name = ?, email = ?, phone = ? WHERE id = ?', [name, email, phone, req.staff.id]);
  const [[s]] = await pool.query('SELECT * FROM staff WHERE id = ?', [req.staff.id]);
  res.json({ staff: staffOut(s) });
}));

router.put('/password', guard(), wrap(async (req, res) => {
  const next = String(req.body.next || '');
  if (!(await bcrypt.compare(String(req.body.current || ''), req.staff.password_hash))) throw fail(400, 'Your current password is wrong');
  checkPassword(next);
  await pool.query('UPDATE staff SET password_hash = ? WHERE id = ?', [await bcrypt.hash(next, 10), req.staff.id]);
  res.json({ ok: true });
}));

// ---------- attendance ----------
router.post('/attendance', guard(), wrap(async (req, res) => {
  const type = req.body.type;
  if (!['Clocked In', 'Clocked Out'].includes(type)) throw fail(400, 'Invalid attendance type');
  const [[last]] = await pool.query('SELECT type FROM field_attendance WHERE staff_id = ? ORDER BY at DESC, id DESC LIMIT 1', [req.staff.id]);
  if ((last?.type || 'Clocked Out') === type) throw fail(409, type === 'Clocked In' ? 'You are already clocked in.' : 'You are not clocked in.');
  const lat = req.body.lat == null ? null : coord(req.body.lat, 90);
  const lng = req.body.lng == null ? null : coord(req.body.lng, 180);
  await pool.query('INSERT INTO field_attendance (staff_id,type,at,lat,lng) VALUES (?,?,?,?,?)', [req.staff.id, type, mysqlDate(req.body.time || Date.now()), lat, lng]);
  res.json({ ok: true });
}));

// my entries in a time range (?from=&to= ISO instants), oldest first
router.get('/attendance', guard(), wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT type, ${UTC('at')} at, lat, lng FROM field_attendance WHERE staff_id = ? AND at >= ? AND at <= ? ORDER BY at, id`, [req.staff.id, ...range(req.query)]);
  res.json(rows.map(r => ({ type: r.type, time: r.at, lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng) })));
}));

// ---------- live GPS tracking ----------
router.post('/track', guard(), wrap(async (req, res) => {
  const pts = Array.isArray(req.body.points) ? req.body.points.slice(0, 500) : [];
  if (!pts.length) throw fail(400, 'No points');
  const rows = pts.map(p => [req.staff.id, coord(p.lat, 90), coord(p.lng, 180), mysqlDate(p.time)]);
  await pool.query('INSERT INTO field_track (staff_id,lat,lng,at) VALUES ?', [rows]);
  res.json({ ok: true, saved: rows.length });
}));

// latest position of everyone who is on duty (office view)
router.get('/track/live', guard(APPROVERS), wrap(async (req, res) => {
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
  if (sid !== req.staff.id && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(`SELECT lat, lng, ${UTC('at')} at FROM field_track WHERE staff_id = ? AND at >= ? AND at <= ? ORDER BY at, id LIMIT 5000`, [sid, ...range(req.query)]);
  res.json(rows.map(r => ({ lat: Number(r.lat), lng: Number(r.lng), time: r.at })));
}));

// ---------- expenses ----------
router.post('/expenses', guard(), wrap(async (req, res) => {
  const title = String(req.body.title || '').trim().slice(0, 160);
  const category = String(req.body.category || '').trim().slice(0, 60);
  const amount = Number(req.body.amount);
  if (!title || !category || !(amount > 0) || amount > 10000000) throw fail(400, 'Description, category and a valid amount are required');
  let file = null;
  if (req.body.voucher) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(req.body.voucher);
    if (!m) throw fail(400, 'Voucher must be a JPG, PNG or WebP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1048576) throw fail(400, 'Voucher must be under 4 MB');
    file = crypto.randomBytes(8).toString('hex') + { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[m[1]];
    fs.writeFileSync(path.join(VOUCHERS, file), buf);
  }
  const [r] = await pool.query('INSERT INTO field_expenses (staff_id,title,category,amount,voucher) VALUES (?,?,?,?,?)', [req.staff.id, title, category, amount, file]);
  const [[e]] = await pool.query(`SELECT e.*, ${UTC('CONVERT_TZ(e.created_at, @@session.time_zone, "+00:00")')} created_utc, s.name FROM field_expenses e JOIN staff s ON s.id = e.staff_id WHERE e.id = ?`, [r.insertId]);
  res.json(expenseOut(e));
}));

// mine by default; approvers can pass ?scope=pending to review everyone's pending claims
router.get('/expenses', guard(), wrap(async (req, res) => {
  const all = req.query.scope === 'pending';
  if (all && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  const [rows] = await pool.query(
    `SELECT e.*, ${UTC('CONVERT_TZ(e.created_at, @@session.time_zone, "+00:00")')} created_utc, s.name FROM field_expenses e JOIN staff s ON s.id = e.staff_id WHERE ${all ? 'e.status = "Pending"' : 'e.staff_id = ?'} ORDER BY e.id DESC LIMIT 200`,
    all ? [] : [req.staff.id]);
  res.json(rows.map(expenseOut));
}));

router.put('/expenses/:id/decision', guard(APPROVERS), wrap(async (req, res) => {
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const [[e]] = await pool.query('SELECT * FROM field_expenses WHERE id = ?', [req.params.id]);
  if (!e) throw fail(404, 'Expense not found');
  if (e.staff_id === req.staff.id) throw fail(403, 'You cannot approve your own expense');
  if (e.status !== 'Pending') throw fail(409, 'This expense was already decided');
  await pool.query('UPDATE field_expenses SET status = ?, decided_by = ?, decided_at = UTC_TIMESTAMP() WHERE id = ?', [status, req.staff.id, e.id]);
  res.json({ ok: true });
}));

// voucher images are private: owner or an approver only
router.get('/vouchers/:file', guard(), wrap(async (req, res) => {
  const file = path.basename(req.params.file);
  const [[e]] = await pool.query('SELECT staff_id FROM field_expenses WHERE voucher = ?', [file]);
  if (!e) throw fail(404, 'Not found');
  if (e.staff_id !== req.staff.id && !isApprover(req.staff)) throw fail(403, 'Your role cannot do this');
  res.sendFile(path.join(VOUCHERS, file));
}));

export default router;
