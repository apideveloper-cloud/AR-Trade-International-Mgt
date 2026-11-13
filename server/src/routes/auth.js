// Storefront customer accounts: register, sign in (password or Google / Facebook), forgot / reset password and the profile.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { digits, fail, wrap, checkPassword } from '../util.js';
import { limit } from '../middleware/security.js';
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

export function mountAuthRoutes(app) {
  app.post('/api/auth/register', limit('register', 10, HOUR), wrap(async (req, res) => {
    const { name, email, phone, password, address, area } = req.body;
    if (!name || !email || !password) throw fail(400, 'Name, email and a password are required');
    checkPassword(password);
    if (!/^01\d{9}$/.test(digits(phone))) throw fail(400, 'Enter a valid mobile number (01XXXXXXXXX)');
    const [ex] = await pool.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email.toLowerCase(), digits(phone)]);
    if (ex.length) throw fail(409, 'An account with this email or mobile already exists');
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,address,area) VALUES (?,?,?,?,?,?)',
      [name, email.toLowerCase(), digits(phone), hash, address || '', AREAS.includes(area) ? area : 'inside']);
    sendAuth(req, res, await getUser(r.insertId));
  }));

  // Forgot password: there is no mail provider, so a request is queued for staff, who send the customer a one-time link
  // (e.g. on WhatsApp) from Admin > Customers. Answers are identical whether or not the account exists.
  app.post('/api/auth/forgot', limit('forgot', 6, 30 * MINUTE), wrap(async (req, res) => {
    const id = String(req.body.id || '').trim().toLowerCase();
    if (id.length < 5) throw fail(400, 'Enter your mobile number or email');
    const [[u]] = await pool.query('SELECT id FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id).slice(-11)]);
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
    let [[u]] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!u) {
      const locked = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
      const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,profile) VALUES (?,?,?,?,?)', [String(who.name || email.split('@')[0]).slice(0, 120), email, '', locked, JSON.stringify({ signup: provider })]);
      u = await getUser(r.insertId);
    }
    sendAuth(req, res, u, { created: !u.phone });
  }));

  app.post('/api/auth/login', limit('login', 12, 10 * MINUTE), wrap(async (req, res) => {
    const id = String(req.body.id || req.body.email || '').trim().toLowerCase();
    const [[u]] = await pool.query('SELECT * FROM users WHERE email = ? OR (phone <> "" AND phone = ?)', [id, digits(id)]);
    if (!u || !(await bcrypt.compare(req.body.password || '', u.password_hash))) throw fail(401, 'Wrong mobile/email or password.');
    sendAuth(req, res, u);
  }));

  app.get('/api/auth/me', auth(true), wrap(async (req, res) => {
    const u = await getUser(req.user.id);
    if (!u) throw fail(401, 'Please sign in');
    res.json({ user: userOut(u) });
  }));

  app.put('/api/auth/me', auth(true), wrap(async (req, res) => {
    const { name, phone, address, area } = req.body;
    await pool.query('UPDATE users SET name = COALESCE(?,name), phone = COALESCE(?,phone), address = COALESCE(?,address), area = COALESCE(?,area) WHERE id = ?',
      [name != null ? String(name).slice(0, 120) : null, phone != null ? digits(phone) : null, address != null ? String(address).slice(0, 500) : null, AREAS.includes(area) ? area : null, req.user.id]);
    res.json({ user: userOut(await getUser(req.user.id)) });
  }));
}
