// Security middleware: response headers and the MySQL-backed rate limiter.
import { pool } from '../db.js';

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
}

/** Rate limiter kept in MySQL (per IP + route group), so limits survive restarts. If the database hiccups it lets the request through. */
pool.query('CREATE TABLE IF NOT EXISTS rate_hits (k VARCHAR(120) PRIMARY KEY, n INT NOT NULL, reset_at BIGINT NOT NULL)').catch(() => {});
setInterval(() => pool.query('DELETE FROM rate_hits WHERE reset_at < ?', [Date.now()]).catch(() => {}), 10 * 60000).unref();

export const limit = (name, max, windowMs) => async (req, res, next) => {
  try {
    const key = (name + '|' + req.ip).slice(0, 120), now = Date.now();
    await pool.query('INSERT INTO rate_hits (k, n, reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE n = IF(reset_at < ?, 1, n + 1), reset_at = IF(reset_at < ?, ?, reset_at)', [key, now + windowMs, now, now, now + windowMs]);
    const [[h]] = await pool.query('SELECT n, reset_at FROM rate_hits WHERE k = ?', [key]);
    if (h.n > max) { res.setHeader('Retry-After', Math.ceil((h.reset_at - now) / 1000)); return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' }); }
  } catch { /* fail open */ }
  next();
};

/** The rate limits that guard the staff, field-app and order-lookup sign-in endpoints (mounted before those routers). */
export function mountSignInLimits(app) {
  app.use(['/api/admin/login', '/api/admin/register'], limit('stafflogin', 15, 10 * 60000));
  app.use('/api/field/login', limit('fieldlogin', 15, 10 * 60000));
  app.use('/api/field/forgot', limit('fieldforgot', 20, 30 * 60000)); // security-code requests and guesses, per IP
  app.use('/api/live', limit('live', 40, 10 * 60000)); // order lookup / return by order id + mobile number
}
