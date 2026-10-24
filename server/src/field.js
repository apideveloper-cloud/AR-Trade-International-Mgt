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
import { can } from './permissions.js';
import { pathToFileURL } from 'node:url';
import { ensureFieldSchema } from './field/migrate.js';
import { moduleGate, ensureModuleTable } from './field/gate.js';
import { staffOut, roleKey, ROLE_LABELS, notify, staffIdsByRole, todayBD, clientRefOf } from './field/common.js';

// REST API for the AR Trade mobile app: attendance, live GPS tracking and expenses.
const router = Router();
// the admin can switch whole areas off (see field/gate.js); the core areas are gated here, module files below
for (const area of ['attendance', 'track', 'expenses', 'vouchers']) router.use('/' + area, moduleGate(area));
const here = path.dirname(fileURLToPath(import.meta.url));
const VOUCHERS = path.resolve(here, '../uploads/vouchers');
fs.mkdirSync(VOUCHERS, { recursive: true });

const isApprover = s => can(s, 'field.approve');
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
  date: e.created_utc, voucher: e.voucher ? `/api/field/vouchers/${e.voucher}` : null, status: e.status.toLowerCase(), remarks: e.remarks || ''
});

// ---------- auth ----------
router.post('/login', wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  if (!id) throw fail(400, 'Enter your employee ID, mobile or email');
  const [[s]] = await pool.query('SELECT * FROM staff WHERE LOWER(employee_code) = ? OR email = ? OR (phone <> "" AND phone = ?)', [id, id, digits(id).slice(-11)]);
  if (!s || !(await bcrypt.compare(req.body.password || '', s.password_hash))) throw fail(401, 'Wrong employee ID / mobile / email or password.');
  if (s.status !== 'Active') throw fail(403, s.status === 'Pending' ? 'Your account is waiting for approval.' : 'This account is disabled.');
  // the sign-in screen lets people pick their role; it must match what the account really is
  const want = String(req.body.role || '');
  if (want && want !== roleKey(s.role)) throw fail(403, `This ID is registered as ${s.role}, not ${ROLE_LABELS[want] || want}. Pick your own role.`);
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
/** The phone's clock is only trusted within 5 minutes of the server's; otherwise the server clock (UTC) is used. */
const serverTime = t => { const now = Date.now(), v = t ? new Date(t).getTime() : NaN; return Number.isFinite(v) && Math.abs(v - now) <= 5 * 60000 ? v : now; };
router.post('/attendance', guard(), wrap(async (req, res) => {
  const type = req.body.type;
  if (!['Clocked In', 'Clocked Out'].includes(type)) throw fail(400, 'Invalid attendance type');
  // only today's (Bangladesh time) rows count: a forgotten clock-out from an earlier day must not block today's clock-in
  const bdStart = new Date(Date.now() + 6 * 3600e3); bdStart.setUTCHours(0, 0, 0, 0);
  const [[last]] = await pool.query('SELECT type FROM field_attendance WHERE staff_id = ? AND at >= ? ORDER BY at DESC, id DESC LIMIT 1', [req.staff.id, mysqlDate(new Date(bdStart.getTime() - 6 * 3600e3))]);
  if ((last?.type || 'Clocked Out') === type) throw fail(409, type === 'Clocked In' ? 'You are already clocked in.' : 'You are not clocked in.');
  const lat = req.body.lat == null ? null : coord(req.body.lat, 90);
  const lng = req.body.lng == null ? null : coord(req.body.lng, 180);
  await pool.query('INSERT INTO field_attendance (staff_id,type,at,lat,lng) VALUES (?,?,?,?,?)', [req.staff.id, type, mysqlDate(serverTime(req.body.time)), lat, lng]);
  res.json({ ok: true });
}));

// my entries in a time range (?from=&to= ISO instants), oldest first
router.get('/attendance', guard(), wrap(async (req, res) => {
  const [rows] = await pool.query(`SELECT type, ${UTC('at')} at, lat, lng FROM field_attendance WHERE staff_id = ? AND at >= ? AND at <= ? ORDER BY at, id`, [req.staff.id, ...range(req.query)]);
  res.json(rows.map(r => ({ type: r.type, time: r.at, lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng) })));
}));

// office view (approvers): everyone's attendance for one day in Bangladesh time, plus how many days each person clocked in this month
router.get('/attendance/report', guard('field.approve'), wrap(async (req, res) => {
  const today = todayBD();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) && !isNaN(Date.parse(req.query.date + 'T00:00:00Z')) ? String(req.query.date) : today;
  const dayStart = new Date(Date.parse(date + 'T00:00:00Z') - 6 * 3600e3); // 00:00 in Bangladesh is 18:00 UTC the evening before
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const monthStart = new Date(Date.parse(date.slice(0, 8) + '01T00:00:00Z') - 6 * 3600e3);
  const [staff] = await pool.query("SELECT id, name, role, phone FROM staff WHERE status = 'Active' ORDER BY name");
  const [rows] = await pool.query(`SELECT staff_id, type, ${UTC('at')} at FROM field_attendance WHERE at >= ? AND at < ? ORDER BY at, id`, [mysqlDate(dayStart), mysqlDate(dayEnd)]);
  const [leave] = await pool.query("SELECT DISTINCT staff_id FROM field_leave_requests WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?", [date, date]);
  const [month] = await pool.query("SELECT staff_id, COUNT(DISTINCT DATE(CONVERT_TZ(at, '+00:00', '+06:00'))) days FROM field_attendance WHERE type = 'Clocked In' AND at >= ? AND at < ? GROUP BY staff_id", [mysqlDate(monthStart), mysqlDate(dayEnd)]);
  const onLeave = new Set(leave.map(l => l.staff_id));
  const monthDays = new Map(month.map(m => [m.staff_id, Number(m.days)]));
  const weeklyOff = new Date(date + 'T00:00:00Z').getUTCDay() === 5; // Friday
  const future = date > today;
  const out = staff.map(s => {
    const mine = rows.filter(r => r.staff_id === s.id);
    const firstIn = mine.find(r => r.type === 'Clocked In')?.at || null;
    const lastOut = [...mine].reverse().find(r => r.type === 'Clocked Out' && firstIn && r.at > firstIn)?.at || null;
    let minutes = 0, open = null;
    for (const r of mine) {
      if (r.type === 'Clocked In') open = open || Date.parse(r.at);
      else if (open) { minutes += (Date.parse(r.at) - open) / 60000; open = null; }
    }
    const onDuty = open !== null && date === today;
    if (onDuty) minutes += (Date.now() - open) / 60000;
    const status = onLeave.has(s.id) ? 'On leave' : onDuty ? 'On duty' : firstIn ? 'Present' : future ? '—' : weeklyOff ? 'Weekly off' : 'Absent';
    return { id: s.id, name: s.name, role: roleKey(s.role), roleLabel: s.role, phone: s.phone, status, firstIn, lastOut, minutes: Math.round(minutes), monthDays: monthDays.get(s.id) || 0 };
  });
  res.json({ date, today, weeklyOff, rows: out });
}));

// ---------- live GPS tracking ----------
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
  const ref = clientRefOf(req.body);
  if (ref) { // retry of a claim this person already submitted: return it again
    const [[dup]] = await pool.query(`SELECT e.*, ${UTC('CONVERT_TZ(e.created_at, @@session.time_zone, "+00:00")')} created_utc, s.name FROM field_expenses e JOIN staff s ON s.id = e.staff_id WHERE e.staff_id = ? AND e.client_ref = ? LIMIT 1`, [req.staff.id, ref]);
    if (dup) return res.json(expenseOut(dup));
  }
  let file = null;
  if (req.body.voucher) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(req.body.voucher);
    if (!m) throw fail(400, 'Voucher must be a JPG, PNG or WebP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1048576) throw fail(400, 'Voucher must be under 4 MB');
    file = crypto.randomBytes(8).toString('hex') + { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[m[1]];
    fs.writeFileSync(path.join(VOUCHERS, file), buf);
  }
  const [r] = await pool.query('INSERT INTO field_expenses (staff_id,title,category,amount,voucher,client_ref) VALUES (?,?,?,?,?,?)', [req.staff.id, title, category, amount, file, ref]);
  const [[e]] = await pool.query(`SELECT e.*, ${UTC('CONVERT_TZ(e.created_at, @@session.time_zone, "+00:00")')} created_utc, s.name FROM field_expenses e JOIN staff s ON s.id = e.staff_id WHERE e.id = ?`, [r.insertId]);
  staffIdsByRole('manager', 'accountant', 'admin').then(ids => notify(ids.filter(i => i !== req.staff.id), {
    icon: 'receipt_long', cat: 'Approvals', title: 'Expense waiting for approval', sub: `${req.staff.name} · ${title} · ৳ ${amount.toLocaleString('en-IN')}`,
    body: `${req.staff.name} submitted an expense claim for approval.`, rows: [['Amount', '৳ ' + amount.toLocaleString('en-IN')], ['Category', category], ['Voucher', file ? 'Attached' : 'None']] }));
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

router.put('/expenses/:id/decision', guard('field.approve'), wrap(async (req, res) => {
  const status = { approved: 'Approved', rejected: 'Rejected' }[req.body.status];
  if (!status) throw fail(400, 'Status must be approved or rejected');
  const remarks = String(req.body.remarks || '').trim().slice(0, 255);
  if (status === 'Rejected' && !remarks) throw fail(400, 'Please write a reason for rejecting');
  const [[e]] = await pool.query('SELECT * FROM field_expenses WHERE id = ?', [req.params.id]);
  if (!e) throw fail(404, 'Expense not found');
  if (e.staff_id === req.staff.id) throw fail(403, 'You cannot approve your own expense');
  if (e.status !== 'Pending') throw fail(409, 'This expense was already decided');
  await pool.query('UPDATE field_expenses SET status = ?, decided_by = ?, decided_at = UTC_TIMESTAMP(), remarks = ? WHERE id = ?', [status, req.staff.id, remarks, e.id]);
  await notify(e.staff_id, {
    icon: status === 'Approved' ? 'fact_check' : 'cancel', cat: 'Approvals',
    title: status === 'Approved' ? 'Expense approved' : 'Expense rejected', sub: `${e.title} ৳ ${Number(e.amount).toLocaleString('en-IN')} ${status.toLowerCase()} by ${req.staff.name}`,
    body: `Your expense claim "${e.title}" was ${status.toLowerCase()}.` + (remarks ? ` Remarks: ${remarks}` : ''),
    rows: [['Amount', '৳ ' + Number(e.amount).toLocaleString('en-IN')], ['Category', e.category], [status === 'Approved' ? 'Approved by' : 'Rejected by', req.staff.name], ['Remarks', remarks || '—']]
  });
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

// ---------- feature modules: src/field/modules/*.js, each mounted at /api/field/<file name> ----------
// A module that fails to load is logged and skipped so one broken file can never take the whole API down.
await ensureFieldSchema();
await ensureModuleTable().catch(e => console.error('[field] module switches:', e.message));
const modulesDir = path.join(here, 'field', 'modules');
if (fs.existsSync(modulesDir)) {
  for (const f of fs.readdirSync(modulesDir).filter(f => f.endsWith('.js')).sort()) {
    try {
      const m = await import(pathToFileURL(path.join(modulesDir, f)).href);
      const name = f.replace(/\.js$/, '');
      router.use('/' + name, moduleGate(name), m.default);
    } catch (e) { console.error(`[field] module ${f} failed to load: ${e.message}`); }
  }
}

export default router;
