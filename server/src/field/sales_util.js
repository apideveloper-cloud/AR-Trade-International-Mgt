// Helpers shared by the Sales & collection modules (orders.js, deliveries.js, payments.js).
// Lives outside src/field/modules/ on purpose: every file in that folder is mounted as a router.
// Times: this module always writes created_at / delivered_at explicitly as UTC (UTC_TIMESTAMP()), never CURRENT_TIMESTAMP.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool, fail, roleKey } from './common.js';
import { sendMail, mailReady } from '../mailer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Private folder (never served by /api/uploads): delivery proof photos and signatures. */
export const PROOFS = path.resolve(here, '../../uploads/vouchers');
fs.mkdirSync(PROOFS, { recursive: true });

/** Managers, accountants and admins see everyone's sales; RMs see their own. */
export const seesAll = staff => ['manager', 'accountant', 'admin'].includes(roleKey(staff.role));

/** Start of today in Bangladesh time (UTC+6), as a UTC 'YYYY-MM-DD HH:MM:SS' string for comparing with the UTC columns. */
export const bdDayStartUtc = () => {
  const d = new Date(Date.now() + 6 * 3600e3);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 6 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
};

/** Customer row (id, name, contact_person, phone, address, area) or 404. */
export async function customerById(id) {
  const [[c]] = await pool.query('SELECT id, name, contact_person, phone, address, area FROM field_customers WHERE id = ?', [id]);
  if (!c) throw fail(404, 'Customer not found');
  return c;
}

/** Credit limit and open invoice balance of a customer. */
export async function creditOf(customerId) {
  const [[cr]] = await pool.query('SELECT credit_limit FROM field_customer_credit WHERE customer_id = ?', [customerId]);
  const [[d]] = await pool.query('SELECT COALESCE(SUM(total - paid), 0) due FROM field_invoices WHERE customer_id = ?', [customerId]);
  return { credit: cr ? cr.credit_limit : 300000, due: Number(d.due) };
}

export const customerOut = (c, extra = {}) => ({
  id: c.id, name: c.name, contact: c.contact_person || '', phone: c.phone || '', address: c.address || '', area: c.area || '', ...extra
});

/** Saves a base64 data URL image under the private folder and returns the file name. */
export function saveImage(dataUrl, prefix, { png = false, maxMb = 2.5 } = {}) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m || (png && m[1] !== 'image/png')) throw fail(400, png ? 'Signature must be a PNG image' : 'Photo must be a JPG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxMb * 1048576) throw fail(400, `Image must be under ${maxMb} MB`);
  const file = `${prefix}-${crypto.randomBytes(8).toString('hex')}${{ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[m[1]]}`;
  fs.writeFileSync(path.join(PROOFS, file), buf);
  return file;
}

export const removeFile = f => { if (f) fs.rm(path.join(PROOFS, f), { force: true }, () => {}); };

import { esc } from '../util.js';

/**
 * Mails the customer's e-mail address on file (confirmation / receipt). Returns true ONLY when a message was really handed to
 * the SMTP server; false when SMTP is not configured, the customer has no valid e-mail, or sending failed. Never throws and
 * never waits longer than 9 seconds, so the app can show the "mailed to customer" line honestly.
 */
export async function mailCustomer(customerId, subject, lines) {
  try {
    if (!mailReady('sales')) return false;
    const [[c]] = await pool.query('SELECT name, email FROM field_customers WHERE id = ?', [customerId]);
    if (!c || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '')) return false;
    const text = [`Dear ${c.name},`, '', ...lines, '', 'AR Trade International'].join('\n');
    const html = `<p>Dear ${esc(c.name)},</p>${lines.map(l => `<p style="margin:4px 0">${esc(l)}</p>`).join('')}<p>AR Trade International</p>`;
    const sent = await Promise.race([sendMail({ channel: 'sales', to: c.email, subject, text, html }), new Promise(r => setTimeout(() => r(false), 9000))]);
    return sent === true;
  } catch (e) { console.error('customer mail failed:', e.message); return false; }
}
