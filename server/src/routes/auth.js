// Storefront customer accounts: register, sign in (password or Google / Facebook), forgot / reset password and the profile.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { bdMobile, digits, fail, wrap, checkPassword, str, verifyPassword } from '../util.js';
import { limit } from '../middleware/security.js';
import { assignMemberCode } from '../memberCode.js';
import { auth, clearSessionCookie, sendAuth, userOut } from '../middleware/customerAuth.js';

export const AREAS = ['inside', 'suburb', 'outside'];

const HOUR = 3600000, MINUTE = 60000;
const getUser = async id => (await pool.query('SELECT * FROM users WHERE id = ?', [id]))[0][0];

// Needs credentials in server/.env: GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET. Without them the buttons report "not set up".
const SOCIAL = () => ({ google: process.env.GOOGLE_CLIENT_ID || null, facebook: process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET ? process.env.FACEBOOK_APP_ID : null });
const getJ = async url => { const r = await fetch(url); const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(401, 'Could not verify your sign-in. Please try again.'); return j; };

/** Checks the provider's token and returns the verified { email, name }. */
async function verifySocialToken(provider, token, cfg) {
  if (provider === 'google') {
    const j = await getJ('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    const ok = j.aud === cfg.google && (j.email_verified === 'true' || j.email_verified === true);
    return ok ? { email: j.email, name: j.name } : null;
  }
  const appToken = process.env.FACEBOOK_APP_ID + '|' + process.env.FACEBOOK_APP_SECRET;
  const d = await getJ(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`);
  if (!(d.data && d.data.is_valid && String(d.data.app_id) === String(cfg.facebook))) return null;
  const me = await getJ(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`);
  return { email: me.email, name: me.name };
}

const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no look-alike characters (0/O, 1/l/I)
export const genPassword = () => { for (;;) { const s = [...crypto.randomBytes(10)].map(x => PW_CHARS[x % PW_CHARS.length]).join(''); if (/[A-Za-z]/.test(s) && /\d/.test(s)) return s; } };

const DUP_MSG = 'An account already exists for this mobile or email. Please sign in (use Forgot password if needed).';

/** Canonical stored phone: 01XXXXXXXXX when it is a Bangladesh mobile, otherwise just the digits. */
export const normPhone = v => bdMobile(v) || digits(v);
export const PLACEHOLDER_DOMAIN = '@noemail.invalid';
export const placeholderEmail = phone => phone + PLACEHOLDER_DOMAIN;
export const isPlaceholderEmail = e => String(e ?? '').trim().toLowerCase().endsWith(PLACEHOLDER_DOMAIN);

// Failed quick-account attempts per order id: at most MAX_ATTEMPTS per hour (in memory, bounded).
export const MAX_ATTEMPTS = 5, ATTEMPT_WINDOW = HOUR, ATTEMPT_CAP = 5000;
const attempts = new Map(); // orderId -> { n, until }
export function attemptsExceeded(id, now = Date.now()) { const a = attempts.get(id); if (!a) return false; if (a.until <= now) { attempts.delete(id); return false; } return a.n >= MAX_ATTEMPTS; }
export function recordFailedAttempt(id, now = Date.now()) {
  const a = attempts.get(id);
  if (a && a.until > now) { a.n++; return; }
  if (attempts.size >= ATTEMPT_CAP) { for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k); if (attempts.size >= ATTEMPT_CAP) attempts.delete(attempts.keys().next().value); }
  attempts.set(id, { n: 1, until: now + ATTEMPT_WINDOW });
}
export const _resetAttempts = () => attempts.clear();

export function mountAuthRoutes(app) {
  /** After a guest order: make a customer account from it, sign the customer in and return the generated login (shown once on the order page).
   *  The order id plus its mobile number prove it is theirs; only a guest order less than 2 days old, and only when no account exists for that mobile or email. */
  app.post('/api/orders/:id/account', limit('autoacct', 8, HOUR), wrap(async (req, res) => {
    const phone = bdMobile(req.body.phone);
    if (!phone) throw fail(400, 'Enter the mobile number used for the order');
    const orderId = String(req.params.id || '').trim().toUpperCase(); // order ids are text such as AR-21339
    if (!/^[A-Z]{1,6}-?\d{1,10}$/.test(orderId)) throw fail(404, 'Order not found for this mobile number');
    if (attemptsExceeded(orderId)) throw fail(429, 'Too many attempts for this order. Please try again later.');
    const bad = (status, msg) => { recordFailedAttempt(orderId); return fail(status, msg); };
    const email = placeholderEmail(phone); // never the order's unverified email
    const password = genPassword();
    const hash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    let newId;
    try {
      await conn.beginTransaction();
      const [[o]] = await conn.query('SELECT id, user_id, customer_name, customer_phone, address, area, created_at FROM orders WHERE id = ? FOR UPDATE', [orderId]);
      if (!o || bdMobile(o.customer_phone) !== phone) throw bad(404, 'Order not found for this mobile number');
      if (o.user_id) throw fail(409, 'This order already belongs to an account. Please sign in.');
      if (Date.now() - new Date(o.created_at).getTime() > 2 * 24 * 3600000) throw bad(403, 'This order is too old for quick sign-up. Please register on the sign-in page.');
      const [ex] = await conn.query('SELECT id FROM users WHERE email = ? OR phone = ? FOR UPDATE', [email, phone]);
      if (ex.length) throw fail(409, DUP_MSG);
      const [r] = await conn.query('INSERT INTO users (name,email,phone,password_hash,address,area) VALUES (?,?,?,?,?,?)',
        [str(o.customer_name).slice(0, 120) || 'Customer', email, phone, hash, str(o.address).slice(0, 255), AREAS.includes(o.area) ? o.area : 'inside']);
      await assignMemberCode(conn, r.insertId);
      const [u] = await conn.query('UPDATE orders SET user_id = ? WHERE id = ? AND user_id IS NULL', [r.insertId, o.id]);
      if (u.affectedRows !== 1) throw fail(409, 'This order already belongs to an account. Please sign in.');
      await conn.commit();
      newId = r.insertId;
    } catch (e) {
      try { await conn.rollback(); } catch { /* connection already gone */ }
      if (e && e.code === 'ER_DUP_ENTRY') throw fail(409, DUP_MSG);
      throw e;
    } finally { conn.release(); }
    sendAuth(req, res, await getUser(newId), { login: { id: phone, password } });
  }));

  app.post('/api/auth/register', limit('register', 10, HOUR), wrap(async (req, res) => {
    const { phone, password, area } = req.body;
    const name = str(req.body.name).trim().slice(0, 120), email = str(req.body.email).trim().toLowerCase().slice(0, 160), address = str(req.body.address).slice(0, 500);
    if (!name || !email || !password) throw fail(400, 'Name, email and a password are required');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
    checkPassword(password);
    if (!/^01\d{9}$/.test(normPhone(phone))) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
    const [ex] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, normPhone(phone)]);
    if (ex.length) throw fail(409, 'An account with this email or mobile already exists');
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,address,area) VALUES (?,?,?,?,?,?)',
      [name, email, normPhone(phone), hash, address, AREAS.includes(area) ? area : 'inside']);
    await assignMemberCode(pool, r.insertId);
    sendAuth(req, res, await getUser(r.insertId));
  }));

  // Forgot password: there is no mail provider, so a request is queued for staff, who send the customer a one-time link
  // (e.g. on WhatsApp) from Admin > Customers. Answers are identical whether or not the account exists.
  app.post('/api/auth/forgot', limit('forgot', 6, 30 * MINUTE), wrap(async (req, res) => {
    const id = String(req.body.id || '').trim().toLowerCase();
    if (id.length < 5) throw fail(400, 'Enter your mobile number or email');
    const [[u]] = await pool.query('SELECT id FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, normPhone(id)]);
    if (u) {
      await pool.query('DELETE FROM password_resets WHERE user_id = ? AND requested = 1 AND used_at IS NULL', [u.id]);
      await pool.query('INSERT INTO password_resets (user_id, token, requested, expires_at) VALUES (?,?,1,DATE_ADD(NOW(), INTERVAL 3 DAY))', [u.id, crypto.randomBytes(24).toString('hex')]);
    }
    res.json({ ok: true });
  }));
  app.get('/api/auth/reset/:token', wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT u.name FROM password_resets r JOIN users u ON u.id = r.user_id WHERE r.token = ? AND r.used_at IS NULL AND r.expires_at > NOW() AND r.requested = 0', [req.params.token]);
    if (!r) throw fail(404, 'This reset link is invalid or has expired');
    res.json({ name: r.name });
  }));
  app.post('/api/auth/reset', limit('reset', 10, 30 * MINUTE), wrap(async (req, res) => {
    const pw = String(req.body.password || '');
    checkPassword(pw);
    const [[r]] = await pool.query('SELECT id, user_id FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > NOW() AND requested = 0', [String(req.body.token || '')]);
    if (!r) throw fail(400, 'This reset link is invalid or has expired');
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(pw, 10), r.user_id]);
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ?', [r.user_id]);
    sendAuth(req, res, await getUser(r.user_id));
  }));

  // ---------- social sign-in / registration (Google, Facebook) ----------
  app.post('/api/auth/logout', (req, res) => { res.append('Set-Cookie', clearSessionCookie); res.json({ ok: true }); });
  app.get('/api/auth/social/config', (req, res) => res.json(SOCIAL()));
  app.post('/api/auth/social', limit('social', 20, 10 * MINUTE), wrap(async (req, res) => {
    const { provider, token } = req.body;
    const cfg = SOCIAL();
    if (!['google', 'facebook'].includes(provider) || !cfg[provider]) throw fail(400, (provider === 'facebook' ? 'Facebook' : 'Google') + ' sign-in is not set up yet.');
    if (!token) throw fail(400, 'Missing sign-in token');
    const who = await verifySocialToken(provider, token, cfg);
    if (!who) throw fail(401, 'Could not verify your sign-in. Please try again.');
    if (!who.email) throw fail(400, 'Your ' + provider + ' account did not share an email address. Please register with your email instead.');
    const email = String(who.email).toLowerCase().slice(0, 160);
    if (isPlaceholderEmail(email)) throw fail(400, 'Please use a real email address.');
    // Never adopt quick-account placeholder accounts (their login is known to whoever placed the order).
    let [[u]] = await pool.query("SELECT * FROM users WHERE email = ? AND email NOT LIKE '%@noemail.invalid'", [email]);
    if (!u) {
      const locked = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
      const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,profile) VALUES (?,?,?,?,?)', [String(who.name || email.split('@')[0]).slice(0, 120), email, '', locked, JSON.stringify({ signup: provider })]);
      await assignMemberCode(pool, r.insertId);
      u = await getUser(r.insertId);
    }
    sendAuth(req, res, u, { created: !u.phone });
  }));

  app.post('/api/auth/login', limit('login', 12, 10 * MINUTE), wrap(async (req, res) => {
    const id = str(req.body.id || req.body.email).trim().toLowerCase();
    const [[u]] = await pool.query('SELECT * FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, normPhone(id)]);
    if (!(await verifyPassword(req.body.password, u?.password_hash)) || !u) throw fail(401, 'Wrong mobile/email or password.');
    sendAuth(req, res, u);
  }));

  app.get('/api/auth/me', auth(true), wrap(async (req, res) => {
    const u = await getUser(req.user.id);
    if (!u) throw fail(401, 'Please sign in');
    res.json({ user: userOut(u) });
  }));

  app.put('/api/auth/me', auth(true), wrap(async (req, res) => {
    const { name, phone, address, area } = req.body;
    if (phone != null && digits(phone)) {
      const [dup] = await pool.query('SELECT id FROM users WHERE phone = ? AND id <> ?', [normPhone(phone), req.user.id]);
      if (dup.length) throw fail(409, 'That mobile number is already used by another account');
    }
    await pool.query('UPDATE users SET name = COALESCE(?,name), phone = COALESCE(?,phone), address = COALESCE(?,address), area = COALESCE(?,area) WHERE id = ?',
      [typeof name === 'string' ? name.slice(0, 120) : null, digits(phone) ? normPhone(phone) : null, typeof address === 'string' ? address.slice(0, 500) : null, AREAS.includes(area) ? area : null, req.user.id]);
    res.json({ user: userOut(await getUser(req.user.id)) });
  }));
}
