import nodemailer from 'nodemailer';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tx;

// SMTP is configured in .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE). Without it nothing is sent.
export const mailReady = () => !!process.env.SMTP_HOST;

function transport() {
  if (!tx) {
    const port = Number(process.env.SMTP_PORT || 587);
    tx = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
  }
  return tx;
}

export async function sendMail({ to, subject, html, text, replyTo }) {
  if (!mailReady()) return false;
  await transport().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text, replyTo });
  return true;
}

// contact-form notification to the shop + a thank-you copy to the customer when they gave an email address
export async function mailContact({ name, contact, company, msg, subject }, shopEmail) {
  const to = process.env.CONTACT_TO || shopEmail;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact || '');
  const rows = [['Name', name], ['Contact', contact], ['Company', company], ['Subject', subject]].filter(r => r[1]);
  const jobs = [];
  if (to) {
    jobs.push(sendMail({
      to, replyTo: isEmail ? contact : undefined, subject: `New website message from ${name}`,
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
