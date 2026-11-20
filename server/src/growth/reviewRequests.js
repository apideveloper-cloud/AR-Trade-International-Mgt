// Review requests after delivery: tables, settings, creation when an order is delivered, the 10-minute send/reminder/expire job, staff actions.
import { pool } from '../db.js';
import { fail } from '../util.js';
import { readGrowth, saveGrowth } from './siteFiles.js';
import { chooseChannel, dueExpiry, dueReminders, dueToSend, emailKey, mergeSettings, phoneKey, planDates } from './reviewRequestsCore.js';
import { deps, sendRequestMail } from './reviewRequestsMail.js';

export const ACTIVE = ['Queued', 'Sent', 'Opened'];

export async function ensureReviewRequests() {
  await pool.query(`CREATE TABLE IF NOT EXISTS review_optouts (
    id INT AUTO_INCREMENT PRIMARY KEY, contact_key VARCHAR(160) NOT NULL, kind VARCHAR(8) NOT NULL DEFAULT 'email',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_ro_key (contact_key))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS review_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(20) NOT NULL, user_id INT NULL, name VARCHAR(120) NOT NULL DEFAULT '',
    email VARCHAR(160) NOT NULL DEFAULT '', phone VARCHAR(40) NOT NULL DEFAULT '', channel VARCHAR(10) NOT NULL DEFAULT 'email',
    status VARCHAR(12) NOT NULL DEFAULT 'Queued', send_at DATETIME NOT NULL, sent_at DATETIME NULL, opened_at DATETIME NULL, reviewed_at DATETIME NULL,
    reminder_at DATETIME NULL, expires_at DATETIME NOT NULL, last_error VARCHAR(300) NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rr_order (order_id), KEY idx_rr_due (status, send_at), KEY idx_rr_expiry (status, expires_at))`);
}

export async function readSettings() { return mergeSettings((await readGrowth()).reviewRequests); }
export async function saveSettings(settings) { await saveGrowth({ reviewRequests: settings }); return settings; }

/** Creates the one request of a delivered order. Returns { created, reason? } (never throws on a normal skip). */
export async function createRequestForOrder(orderId, now = Date.now()) {
  const s = await readSettings();
  if (!s.enabled) return { created: false, reason: 'disabled' };
  const [[o]] = await pool.query('SELECT id, user_id, customer_name, customer_phone, customer_email, flow FROM orders WHERE id = ?', [orderId]);
  if (!o || o.flow !== 'Delivered') return { created: false, reason: 'not delivered' };
  const [items] = await pool.query('SELECT product_id FROM order_items WHERE order_id = ? LIMIT 1', [orderId]);
  if (!items.length) return { created: false, reason: 'no items' };
  const keys = [emailKey(o.customer_email), phoneKey(o.customer_phone)].filter(Boolean);
  if (keys.length) { const [x] = await pool.query('SELECT id FROM review_optouts WHERE contact_key IN (?) LIMIT 1', [keys]); if (x.length) return { created: false, reason: 'opted out' }; }
  const channel = chooseChannel({ email: o.customer_email, phone: o.customer_phone, mailOk: deps.mailReady() });
  if (!channel) return { created: false, reason: 'no contact' };
  const { sendAt, expiresAt } = planDates(s, now);
  const [r] = await pool.query('INSERT IGNORE INTO review_requests (order_id, user_id, name, email, phone, channel, status, send_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [o.id, o.user_id || null, String(o.customer_name || '').slice(0, 120), channel === 'email' ? String(o.customer_email).trim() : '', String(o.customer_phone || '').slice(0, 40), channel, 'Queued', sendAt, expiresAt]);
  return r.affectedRows ? { created: true, channel } : { created: false, reason: 'exists' };
}
/** Hook for applyFlow: fire and forget, never awaited by the caller and never throws. */
export function noteOrderDelivered(orderId) {
  try { return createRequestForOrder(orderId).catch(e => { console.error('review request:', e.message); }); } catch (e) { console.error('review request:', e.message); return Promise.resolve(); }
}

const done = (row, patch) => pool.query('UPDATE review_requests SET ' + Object.keys(patch).map(k => k + ' = ?').join(', ') + ' WHERE id = ?', [...Object.values(patch), row.id]);

/** The 10-minute job: expire, send due e-mails, send one reminder. A failing row records last_error and the loop goes on. */
export async function runReviewJob({ now = Date.now() } = {}) {
  const s = await readSettings();
  if (!s.enabled) return { skipped: true };
  const at = new Date(now), out = { expired: 0, sent: 0, reminded: 0, errors: 0 };
  const pick = async (where, p) => (await pool.query(`SELECT * FROM review_requests WHERE ${where} LIMIT 100`, p))[0];
  for (const r of dueExpiry(await pick("status IN ('Queued','Sent','Opened') AND expires_at <= ?", [at]), now)) {
    try { await done(r, { status: 'Expired' }); out.expired++; } catch { out.errors++; }
  }
  for (const r of dueToSend(await pick("status = 'Queued' AND channel = 'email' AND send_at <= ? AND expires_at > ?", [at, at]), now)) {
    try {
      const [c] = await pool.query("UPDATE review_requests SET status = 'Sent', sent_at = ? WHERE id = ? AND status = 'Queued'", [at, r.id]);
      if (!c.affectedRows) continue; // another run took it
      const m = await sendRequestMail(r, s);
      if (m.ok) { await done(r, { last_error: '' }); out.sent++; }
      else { await done(r, { status: m.retry ? 'Queued' : 'Failed', sent_at: null, last_error: m.error }); out.errors++; }
    } catch (e) { out.errors++; try { await done(r, { status: 'Failed', last_error: String(e.message).slice(0, 300) }); } catch { /* next row */ } }
  }
  for (const r of dueReminders(await pick("status IN ('Sent','Opened') AND channel = 'email' AND reminder_at IS NULL AND sent_at <= ? AND expires_at > ?", [new Date(now - s.reminderDays * 864e5), at]), s, now)) {
    try {
      const [c] = await pool.query('UPDATE review_requests SET reminder_at = ? WHERE id = ? AND reminder_at IS NULL', [at, r.id]);
      if (!c.affectedRows) continue;
      const m = await sendRequestMail(r, s, { reminder: true });
      if (m.ok) out.reminded++; else { await done(r, { last_error: m.error }); out.errors++; }
    } catch { out.errors++; }
  }
  return out;
}

// ---------- staff actions ----------
async function load(id) {
  const [[r]] = await pool.query('SELECT * FROM review_requests WHERE id = ?', [id]);
  if (!r) throw fail(404, 'Review request not found');
  return r;
}
export async function markSent(id, now = new Date()) {
  const r = await load(id);
  if (r.channel !== 'whatsapp') throw fail(400, 'Only WhatsApp requests are marked as sent by hand');
  if (r.status !== 'Queued') throw fail(409, 'This request is already ' + r.status.toLowerCase());
  await done(r, { status: 'Sent', sent_at: now, last_error: '' });
}
export async function cancelRequest(id) {
  const r = await load(id);
  if (!ACTIVE.includes(r.status) && r.status !== 'Failed') throw fail(409, 'This request is already ' + r.status.toLowerCase());
  await done(r, { status: 'Cancelled' });
}
/** Sends an e-mail request now (also after Failed or Expired: the link is extended). */
export async function resendNow(id, now = Date.now()) {
  const r = await load(id);
  if (r.channel !== 'email') throw fail(400, 'WhatsApp requests are sent by hand');
  if (['Reviewed', 'OptedOut', 'Cancelled'].includes(r.status)) throw fail(409, 'This request is already ' + r.status.toLowerCase());
  const s = await readSettings();
  if (new Date(r.expires_at).getTime() <= now + 864e5) r.expires_at = new Date(now + s.expireDays * 864e5);
  const m = await sendRequestMail(r, s);
  if (!m.ok) { await done(r, { last_error: m.error }); throw fail(m.retry ? 503 : 502, m.error); }
  await done(r, { status: r.status === 'Opened' ? 'Opened' : 'Sent', sent_at: new Date(now), expires_at: r.expires_at, last_error: '' });
}
/** Opt-out by a request: remembers the e-mail and phone, ends this request and every other open one for the same contact. */
export async function optOutRequest(row) {
  const keys = [[emailKey(row.email), 'email'], [phoneKey(row.phone), 'phone']].filter(k => k[0]);
  for (const [k, kind] of keys) await pool.query('INSERT IGNORE INTO review_optouts (contact_key, kind) VALUES (?,?)', [k, kind]);
  await pool.query("UPDATE review_requests SET status = 'OptedOut' WHERE status IN ('Queued','Sent','Opened','Failed') AND (id = ? OR (email <> '' AND LOWER(email) = ?) OR (phone <> '' AND phone = ?))", [row.id, emailKey(row.email) || '-', row.phone || '-']);
}
