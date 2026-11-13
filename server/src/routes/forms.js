// Public forms: service requests, the contact form and the double opt-in for offers by email.
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { fail, nextSeq, wrap } from '../util.js';
import { mailContact, mailReady, sendMail, siteUrl } from '../mailer.js';
import { onSubscribed } from '../mkt.js';
import { limit } from '../middleware/security.js';
import { getSettings } from './shared.js';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Double opt-in: the address is stored as Pending and a confirmation link is emailed; nothing is sent to an address that does not confirm. */
async function optIn(emailRaw, source, ip) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw fail(400, 'Enter a valid email');
  const [[ex]] = await pool.query('SELECT token, status FROM consents WHERE email = ? AND status <> "Unsubscribed" ORDER BY id DESC LIMIT 1', [email]);
  if (ex?.status === 'Confirmed') return { email, status: 'Confirmed' };
  const token = 'OPT-' + crypto.randomBytes(10).toString('hex').toUpperCase();
  await pool.query('INSERT INTO consents (email,source,token,ip) VALUES (?,?,?,?)', [email, String(source || '').slice(0, 120), token, ip || '']);
  // the token only ever travels by email, so nobody can subscribe an address they do not control (staff can still confirm by hand in Admin > Consents)
  if (mailReady() && siteUrl()) {
    const link = siteUrl() + '/prefs/' + token + '?confirm=1';
    sendMail({
      to: email, subject: 'Confirm your subscription to AR Trade International',
      text: 'Someone (hopefully you) asked to receive offers and updates from AR Trade International at this address.\n\nConfirm: ' + link + '\n\nIf this was not you, ignore this email and you will not be added.',
      html: '<p>Someone (hopefully you) asked to receive offers and updates from AR Trade International at this address.</p><p><a href="' + link + '" style="background:#0b1631;color:#fff;padding:12px 22px;border-radius:99px;text-decoration:none">Yes, subscribe me</a></p><p style="color:#777;font-size:12px">If this was not you, ignore this email and you will not be added.</p>'
    }).catch(e => console.error('opt-in mail failed:', e.message));
  }
  return { email, status: 'Pending' };
}

export function mountFormRoutes(app) {
  app.post('/api/services', limit('svcreq', 8, 1800000), wrap(async (req, res) => {
    const { type, name, phone, model, issue, date, mkt, mktEmail } = req.body;
    if (!type || !name || !phone) throw fail(400, 'Service type, name and phone are required');
    if (mkt && mktEmail && !EMAIL_RE.test(String(mktEmail))) throw fail(400, 'Enter a valid email');
    const id = await nextSeq('service', 'service_requests', 'SV-', 2091);
    await pool.query('INSERT INTO service_requests (id,type,name,phone,model,issue,preferred_date) VALUES (?,?,?,?,?,?,?)',
      [id, type, name, phone, model || '', issue || '', date || null]);
    if (mkt && mktEmail) await optIn(mktEmail, 'Service booking · ' + id, req.ip);
    res.json({ id });
  }));

  app.post('/api/contact', limit('contact', 8, 1800000), wrap(async (req, res) => {
    const { name, contact, company, msg, subject } = req.body;
    if (!name || !msg) throw fail(400, 'Name and message are required');
    if (String(name).length > 120 || String(contact || '').length > 160 || String(company || '').length > 160 || String(subject || '').length > 160 || String(msg).length > 5000) throw fail(400, 'One of the fields is too long');
    await pool.query('INSERT INTO messages (name,contact,company,subject,body) VALUES (?,?,?,?,?)', [name, contact || '', company || '', subject || '', msg]);
    // the message is already saved for the admin inbox; the email is a best-effort notification
    if (mailReady()) {
      const shop = (await getSettings()).site?.email;
      mailContact({ name, contact, company, msg, subject }, shop).catch(e => console.error('contact mail failed:', e.message));
    }
    res.json({ ok: true });
  }));

  app.post('/api/optin', limit('optin', 8, 1800000), wrap(async (req, res) => { res.json(await optIn(req.body.email, req.body.source, req.ip)); }));

  app.post('/api/optin/confirm', limit('optin-confirm', 30, 600000), wrap(async (req, res) => {
    const [[c]] = await pool.query('SELECT * FROM consents WHERE token = ?', [String(req.body.token || '')]);
    if (!c) throw fail(404, 'This confirmation link is not valid');
    await pool.query('UPDATE consents SET status = "Confirmed", confirmed_at = COALESCE(confirmed_at, NOW()) WHERE id = ?', [c.id]);
    await pool.query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [c.email]);
    await onSubscribed(c.email);
    res.json({ ok: true, email: c.email });
  }));
}
