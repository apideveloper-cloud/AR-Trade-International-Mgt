// Forgot password for the field app: send a 6-digit code -> verify it -> choose a new password.
//   POST /api/field/forgot/send    { id, via: 'sms' | 'email' }       -> { to, via, resendIn, devCode? }
//   POST /api/field/forgot/verify  { id, code }                       -> { resetToken }
//   POST /api/field/forgot/reset   { resetToken, password }           -> { ok, name, employeeCode, changedAt }
// There is no SMS gateway wired up: outside production the code is returned as `devCode` (and printed in the API log) so the
// flow can be tested; in production SMS answers 503 until a gateway exists and staff use the email option.
import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, digits, fail, wrap, empCode, notify } from '../common.js';
import { checkPassword, secret } from '../../util.js';
import { sendMail, mailReady } from '../../mailer.js';

const router = Router();
const PROD = process.env.NODE_ENV === 'production';
const hash = (staffId, code) => crypto.createHash('sha256').update(`${staffId}:${code}:${secret()}`).digest('hex');

async function findStaff(raw) {
  const id = String(raw || '').trim().toLowerCase();
  if (!id) throw fail(400, 'Enter your employee ID, mobile or email');
  const [[s]] = await pool.query('SELECT * FROM staff WHERE LOWER(employee_code) = ? OR email = ? OR (phone <> "" AND phone = ?)', [id, id, digits(id).slice(-11)]);
  if (!s || s.status !== 'Active') throw fail(404, 'No active account found for that ID');
  return s;
}
const maskPhone = p => { const d = digits(p).slice(-11); return d.length === 11 ? `+880 ${d.slice(1, 3)}•• ••• ${d.slice(-3)}` : 'your mobile'; };
const maskEmail = e => { const [u, d] = String(e).split('@'); return `${u.slice(0, 1)}•••••@${d}`; };

router.post('/send', wrap(async (req, res) => {
  const s = await findStaff(req.body.id);
  const via = req.body.via === 'email' ? 'email' : 'sms';
  const [[recent]] = await pool.query('SELECT COUNT(*) n FROM field_reset_codes WHERE staff_id = ? AND created_at > (NOW() - INTERVAL 15 MINUTE)', [s.id]);
  if (recent.n >= 5) throw fail(429, 'Too many codes requested. Please wait a few minutes and try again.');
  if (via === 'sms' && PROD) throw fail(503, 'SMS codes are not available yet. Please use the email option.');
  if (via === 'email' && !mailReady() && PROD) throw fail(503, 'Email is not configured on the server.');

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await pool.query('INSERT INTO field_reset_codes (staff_id, code_hash, via, expires_at) VALUES (?,?,?, UTC_TIMESTAMP() + INTERVAL 10 MINUTE)', [s.id, hash(s.id, code), via]);
  if (via === 'email' && mailReady()) {
    await sendMail({ to: s.email, subject: 'Your AR Trade security code', text: `Your AR Trade security code is ${code}. It expires in 10 minutes. Never share it with anyone.` })
      .catch(e => { throw fail(502, 'Could not send the email: ' + e.message); });
  } else if (!PROD) console.log(`[field] reset code for ${empCode(s)} (${via}): ${code}`);
  res.json({ to: via === 'email' ? maskEmail(s.email) : maskPhone(s.phone), via, resendIn: 45, ...(PROD ? {} : { devCode: code }) });
}));

router.post('/verify', wrap(async (req, res) => {
  const s = await findStaff(req.body.id);
  const [[row]] = await pool.query('SELECT * FROM field_reset_codes WHERE staff_id = ? AND used = 0 AND expires_at > UTC_TIMESTAMP() ORDER BY id DESC LIMIT 1', [s.id]);
  if (!row) throw fail(400, 'This code has expired. Please request a new one.');
  if (row.attempts >= 5) throw fail(429, 'Too many wrong attempts. Please request a new code.');
  await pool.query('UPDATE field_reset_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
  const given = Buffer.from(hash(s.id, String(req.body.code || '').trim()));
  const real = Buffer.from(row.code_hash);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) throw fail(400, 'That code is not correct.');
  await pool.query('UPDATE field_reset_codes SET used = 1 WHERE id = ?', [row.id]);
  res.json({ resetToken: jwt.sign({ sid: s.id, purpose: 'field-reset' }, secret(), { expiresIn: '10m' }) });
}));

router.post('/reset', wrap(async (req, res) => {
  let t;
  try { t = jwt.verify(String(req.body.resetToken || ''), secret()); } catch { throw fail(400, 'This reset link has expired. Please start again.'); }
  if (t.purpose !== 'field-reset') throw fail(400, 'This reset link is not valid.');
  checkPassword(req.body.password);
  const [[s]] = await pool.query('SELECT * FROM staff WHERE id = ?', [t.sid]);
  if (!s) throw fail(404, 'Account not found');
  if (s.password_hash && await bcrypt.compare(String(req.body.password), s.password_hash)) throw fail(400, 'Choose a password you have not used before');
  await pool.query('UPDATE staff SET password_hash = ? WHERE id = ?', [await bcrypt.hash(String(req.body.password), 10), s.id]);
  await pool.query('UPDATE field_reset_codes SET used = 1 WHERE staff_id = ?', [s.id]);
  await notify(s.id, { icon: 'verified_user', title: 'Password changed', sub: 'Your password was reset from the app', cat: 'Alerts',
    body: 'Your password was changed using a security code. If this was not you, contact your manager immediately.' });
  res.json({ ok: true, name: s.name, employeeCode: empCode(s), changedAt: new Date().toISOString() });
}));

export default router;
