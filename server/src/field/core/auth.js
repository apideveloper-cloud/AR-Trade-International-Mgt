// App sign-in (one phone per user: staff.app_session_id <-> JWT claim `sa`), who am I, own profile and password.
import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, guard, wrap, fail, digits, staffOut, roleKey, ROLE_LABELS } from '../common.js';
import { checkPassword, secret } from '../../util.js';
import { parseProfile } from './rules.js';

const router = Router();

router.post('/login', wrap(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  if (!id) throw fail(400, 'Enter your employee ID, mobile or email');
  const [[s]] = await pool.query('SELECT * FROM staff WHERE LOWER(employee_code) = ? OR email = ? OR (phone <> "" AND phone = ?)', [id, id, digits(id).slice(-11)]);
  if (!s || !s.password_hash || !(await bcrypt.compare(String(req.body.password || ''), s.password_hash))) throw fail(401, 'Wrong employee ID / mobile / email or password.');
  if (s.status !== 'Active') throw fail(403, s.status === 'Pending' ? 'Your account is waiting for approval.' : 'This account is disabled.');
  // the sign-in screen lets people pick their role; it must match what the account really is
  const want = String(req.body.role || '');
  if (want && want !== roleKey(s.role)) throw fail(403, `This ID is registered as ${s.role}, not ${ROLE_LABELS[want] || want}. Pick your own role.`);
  // one phone at a time: a new app sign-in ends this user's previous app session (the web console has its own, separate session)
  const sa = crypto.randomBytes(16).toString('hex');
  await pool.query('UPDATE staff SET app_session_id = ? WHERE id = ?', [sa, s.id]);
  const token = jwt.sign({ sid: s.id, srole: s.role, sa }, secret(), { expiresIn: '30d' });
  res.json({ token, staff: staffOut(s) });
}));

router.get('/me', guard(), wrap(async (req, res) => { res.json({ staff: staffOut(req.staff) }); }));

router.put('/profile', guard(), wrap(async (req, res) => {
  const { name, email, phone } = parseProfile(req.body);
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

export default router;
