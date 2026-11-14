import nodemailer from 'nodemailer';

import { esc } from './util.js';

/** Public https URL of the shop (SITE_URL in .env); links inside emails are built from it, never from request headers. */
export const siteUrl = () => String(process.env.SITE_URL || '').replace(/\/$/, '');

// Mail is sent from named accounts, each set in .env. Without a working one nothing is sent.
//   channel 'quote'  -> SMTP_QUOTE_USER / SMTP_QUOTE_PASS  (quotations)
//   channel 'sales'  -> SMTP_SALES_USER / SMTP_SALES_PASS  (sales-order and invoice mails to customers)
//   no channel       -> SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE (everything else: marketing, contact form, security codes)
// A channel account defaults to Gmail (smtp.gmail.com, port 465); SMTP_<NAME>_HOST / _PORT / _SECURE / _FROM override that. A channel without its
// own account falls back to the general SMTP_* settings. Gmail needs an app password (no spaces needed; they are removed).
const CHANNELS = { quote: 'SMTP_QUOTE', sales: 'SMTP_SALES' };
function account(channel) {
  const pre = CHANNELS[channel];
  const env = process.env;
  if (pre && env[pre + '_USER'] && env[pre + '_PASS']) {
    const port = Number(env[pre + '_PORT'] || 465);
    const user = env[pre + '_USER'].trim();
    return { key: pre, host: env[pre + '_HOST'] || 'smtp.gmail.com', port, secure: env[pre + '_SECURE'] ? env[pre + '_SECURE'] === 'true' : port === 465, user, pass: String(env[pre + '_PASS']).replace(/\s+/g, ''), from: env[pre + '_FROM'] || `AR Trade International <${user}>` };
  }
  if (!env.SMTP_HOST) return null;
  const port = Number(env.SMTP_PORT || 587);
  return { key: 'SMTP', host: env.SMTP_HOST, port, secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465, user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.SMTP_FROM || env.SMTP_USER };
}
export const mailReady = channel => !!account(channel);
/** What to tell staff when a channel has no account yet. */
export const mailSetupHint = channel => (CHANNELS[channel] ? `Add ${CHANNELS[channel]}_USER and ${CHANNELS[channel]}_PASS (a Gmail app password)` : 'Add the SMTP settings (SMTP_HOST ...)') + ' to server/.env, or download the PDF and send it yourself.';

const transports = new Map();
function transport(a) {
  if (!transports.has(a.key)) {
    transports.set(a.key, nodemailer.createTransport({
      host: a.host, port: a.port, secure: a.secure, auth: a.user ? { user: a.user, pass: a.pass } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    }));
  }
  return transports.get(a.key);
}

export async function sendMail({ channel, to, cc, bcc, subject, html, text, replyTo, attachments }) {
  const a = account(channel);
  if (!a) return false;
  await transport(a).sendMail({ from: a.from, to, cc, bcc, subject, html, text, replyTo, attachments });
  return true;
}
/** Logs in to the account without sending anything: { ok, user } or { ok: false, error }. */
export async function verifyMail(channel) {
  const a = account(channel);
  if (!a) return { ok: false, error: 'not configured' };
  try { await transport(a).verify(); return { ok: true, user: a.user }; } catch (e) { return { ok: false, user: a.user, error: e.message }; }
}

// contact-form notification to the shop + a thank-you copy to the customer when they gave an email address
export async function mailContact({ name, contact, company, msg, subject }, shopEmail) {
  const to = process.env.CONTACT_TO || shopEmail;
  const isEmail = /^[^\s,;<>"()@]+@[^\s,;<>"()@]+\.[^\s,;<>"()@]+$/.test(contact || '') && String(contact).length <= 160; // one plain address: a list would turn the thank-you mail into a relay
  const rows = [['Name', name], ['Contact', contact], ['Company', company], ['Subject', subject]].filter(r => r[1]);
  const jobs = [];
  if (to) {
    jobs.push(sendMail({
      to, replyTo: isEmail ? contact : undefined, subject: `New website message from ${String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120)}`,
      text: rows.map(r => r.join(': ')).join('\n') + '\n\n' + msg,
      html: `<table cellpadding="6">${rows.map(r => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</table><p style="white-space:pre-wrap">${esc(msg)}</p>`
    }));
  }
  if (isEmail) {
    jobs.push(sendMail({
      to: contact, subject: 'We received your message — AR Trade International',
      text: `Hi ${name},\n\nThanks for contacting AR Trade International. We have your message and will reply within one business day.\n\nYour message:\n${msg}`,
      html: `<p>Hi ${esc(name)},</p><p>Thanks for contacting AR Trade International. We have your message and will reply within one business day.</p><p style="white-space:pre-wrap;color:#555">${esc(msg)}</p>`
    }));
  }
  const r = await Promise.allSettled(jobs);
  r.filter(x => x.status === 'rejected').forEach(x => console.error('contact mail failed:', x.reason?.message));
  return r.length > 0 && r.every(x => x.status === 'fulfilled');
}
