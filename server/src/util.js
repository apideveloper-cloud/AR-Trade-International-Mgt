// Small helpers shared by the public and admin API routes
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

/** The one place the JWT secret is read. Production never falls back to the dev secret. */
export const secret = () => {
  const s = process.env.JWT_SECRET;
  if (s && (s.length >= 24 || process.env.NODE_ENV !== 'production')) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set to a long random value (24+ characters)');
  return 'dev-secret';
};
export const fail = (status, message) => Object.assign(new Error(message), { status });

/** Pictures are only ever our own uploaded files (server/uploads), kept in the database as a path. No outside web addresses, no inline data. */
const LOCAL_IMG = /^\/api\/(uploads|media)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,300}$/;
export const isLocalImg = u => typeof u === 'string' && LOCAL_IMG.test(u) && !u.includes('..') && !u.includes('//');
/** '' for no picture; the path itself when it is one of our uploads; otherwise a 400 telling the admin to upload. */
export const localImg = (v, message = 'Pictures must be uploaded here. Web addresses are not accepted.') => {
  const u = String(v ?? '').trim();
  if (!u) return '';
  if (!isLocalImg(u)) throw fail(400, message);
  return u;
};
export const digits = s => String(s || '').replace(/\D/g, '');

/** A Bangladesh mobile number as 01XXXXXXXXX (operators 013 to 019), read from forms like 01712-345678, +880 1712 345678 or 8801712345678.
 *  Returns '' when the text is not one (letters, wrong length, or an operator code that does not exist). */
export function bdMobile(v) {
  const raw = String(v ?? '');
  if (!raw || /[^\d\s+\-().]/.test(raw)) return '';
  let d = digits(raw);
  if (d.length === 13 && d.startsWith('880')) d = '0' + d.slice(3);
  else if (d.length === 10 && d[0] === '1') d = '0' + d;
  return /^01[3-9]\d{8}$/.test(d) ? d : '';
}
export const parseJson = v => (typeof v === 'string' ? JSON.parse(v) : v);

/** Wraps an async express handler so thrown errors become JSON responses. */
export const wrap = fn => (req, res) => fn(req, res).catch(e => {
  if (e.status) return res.status(e.status).json({ error: e.message });
  if (e.code === 'ER_DATA_TOO_LONG' || e.code === 'ER_WARN_DATA_OUT_OF_RANGE') return res.status(400).json({ error: 'One of the fields is too long or out of range' });
  console.error(e);
  res.status(500).json({ error: 'Server error' });
});

/** Password rule for customers and staff: at least 8 characters with a letter and a number. */
export const checkPassword = pw => {
  const s = typeof pw === 'string' ? pw : '';
  if (s.length < 8 || s.length > 128 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) throw fail(400, 'Password must be at least 8 characters and include a letter and a number');
};

/** Only real strings count as text (an object or array in a JSON body becomes ''; a number is kept as text), so .toLowerCase() / bcrypt never throw on hostile input. */
export const str = v => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);
/** bcrypt check that never throws and takes as long for an unknown account (hash missing) as for a known one. */
export const verifyPassword = (plain, hash) => bcrypt.compare(str(plain), hash || DUMMY_HASH).then(ok => !!hash && ok);

/** Reads one cookie from the request (no cookie-parser dependency). */
export const readCookie = (req, name) => {
  const m = String(req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};

/** True for URLs under the private upload folders, however they are spelled (%63v, //cv, /./cv, backslashes, case). */
export const isPrivateUploadPath = raw => {
  let p = String(raw || '');
  for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(p); if (d === p) break; p = d; } catch { return true; } }
  // eslint-disable-next-line no-control-regex -- removing NUL bytes from a path is the point
  p = p.replace(/[\\\u0000]/g, m => (m === '\\' ? '/' : ''));
  const segs = [];
  for (const s of p.split('/')) { if (s === '' || s === '.') continue; if (s === '..') segs.pop(); else segs.push(s.toLowerCase()); }
  return ['cv', 'vouchers'].includes(segs[0]);
};

export const sessionCookie = (req, u) => `ar_session=${signCustomer(u)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${req.secure ? '; Secure' : ''}`;

/** Customer sessions are bound to the current password, so a password change or reset signs every old session out. */
const pv = u => crypto.createHash('sha256').update(String(u.password_hash)).digest('hex').slice(0, 16);
export const signCustomer = u => jwt.sign({ id: u.id, role: u.role, pv: pv(u) }, secret(), { expiresIn: '30d' });
/** The signed-in storefront customer (full row) or null. */
export async function readCustomer(req, cookieName = 'ar_session') {
  let t;
  try { t = jwt.verify(readCookie(req, cookieName) || (req.headers.authorization || '').replace(/^Bearer /, ''), secret()); } catch { return null; }
  if (!t.id || !t.pv) return null;
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ?', [t.id]);
  return u && pv(u) === t.pv ? u : null;
}

/** Collision-free ids such as AR-10501: an atomic counter (seeded from the highest id already in `table`) instead of COUNT(*)+1. */
let countersReady;
export async function nextSeq(name, table, prefix, base) {
  countersReady ||= pool.query('CREATE TABLE IF NOT EXISTS counters (name VARCHAR(30) PRIMARY KEY, v BIGINT NOT NULL)');
  await countersReady;
  await pool.query(`INSERT IGNORE INTO counters (name, v) SELECT ?, GREATEST(?, COALESCE(MAX(CAST(SUBSTRING(id, ?) AS UNSIGNED)), 0)) FROM \`${table}\``, [name, base, prefix.length + 1]);
  const [r] = await pool.query('UPDATE counters SET v = LAST_INSERT_ID(v + 1) WHERE name = ?', [name]);
  return prefix + r.insertId;
}

// ---------- small helpers the purchasing, quotation and mail code all need (one copy, here) ----------
/** HTML-escapes text for the body or a double- or single-quoted attribute of an e-mail. */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** SQL for a DATE / DATETIME column as YYYY-MM-DD (so it never shifts with the server time zone). */
export const D = c => `DATE_FORMAT(${c}, '%Y-%m-%d')`;
/** A real calendar date as YYYY-MM-DD, or `fallback`. "2026-02-31" is rejected, not rolled over to March. */
export const iso = (s, fallback) => {
  const v = String(s || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallback;
  const d = new Date(v + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === v ? v : fallback;
};
/** ['2026-10-01', '2026-11-01'] for '2026-10': filter a date column with `col >= ? AND col < ?` so an index can be used (wrapping the column in DATE_FORMAT() or YEAR() cannot). */
export const monthBounds = ym => {
  const [y, m] = String(ym).split('-').map(Number);
  const next = m === 12 ? [y + 1, 1] : [y, m + 1];
  const f = (a, b) => `${a}-${String(b).padStart(2, '0')}-01`;
  return [f(y, m), f(...next)];
};
/** Today in Dhaka (UTC+6) as YYYY-MM-DD. */
export const today = () => new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
/** A whole, non-negative number between 0 and `max` (anything else becomes 0). */
export const int = (v, max = 100000000) => Math.min(max, Math.max(0, Math.round(Number(v) || 0)));
/** A taka amount for people to read: ৳ 12,500 (rounded to whole taka). */
export const money = n => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-US');
/** Trimmed text, cut to `n` characters. */
export const text = (v, n) => String(v ?? '').trim().slice(0, n);
/** Runs `fn(conn)` inside one transaction: commits when it finishes, rolls everything back when it throws. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const r = await fn(conn); await conn.commit(); return r; } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}
