// Review request e-mail (branded shell) and sending of one request. The mailer, origin and mail-ready check can be replaced in tests.
import { renderEmail } from '../emailTemplate.js';
import { sendMail as realSend, mailReady } from '../mailer.js';
import { pool } from '../db.js';
import { siteOrigin } from './site.js';
import { SHOP, firstName, fill, pickLanguage, productsText, renderMessage, signToken } from './reviewRequestsCore.js';

export const deps = { sendMail: realSend, origin: siteOrigin, mailReady: () => mailReady('sales') };
export const setDeps = d => Object.assign(deps, d);

export async function linksFor(row) {
  const base = await deps.origin();
  if (!base) throw Object.assign(new Error('Set the preferred domain (https://...) in SEO settings or SITE_URL first'), { retry: true });
  const link = `${base}/review/${signToken(row.id, new Date(row.expires_at).getTime())}`;
  return { link, optout: link + '?optout=1' };
}
export async function productNames(orderId) {
  const [r] = await pool.query('SELECT DISTINCT name FROM order_items WHERE order_id = ?', [orderId]);
  return r.map(x => x.name);
}
/** { lang, subject, text, html } for one message; vars = { name, products, link, optout }. Names are escaped by the e-mail shell. */
export function buildMail(settings, vars, { lang, reminder = false } = {}) {
  const l = lang || pickLanguage(settings.language, vars.name);
  const v = { shop: SHOP, ...vars, name: firstName(vars.name) };
  const m = renderMessage(settings, l, v);
  // in the HTML the button carries the link and the footer carries the opt-out: lines that only repeat them are dropped
  const lines = fill(settings.templates[l].body, { ...v, link: '\u0001', optout: '\u0002' }).split('\n').filter(x => !x.includes('\u0002')).map(x => (x.trim() === '\u0001' ? '' : x.replace('\u0001', v.link)));
  const subject = (reminder ? (l === 'bn' ? 'অনুস্মারক: ' : 'Reminder: ') : '') + m.subject;
  const { html, text } = renderEmail({
    subject, preheader: lines.find(x => x.trim()) || '', headline: l === 'bn' ? 'আপনার মতামত জানান' : 'How did we do?', body: lines.join('\n').replace(/\n{3,}/g, '\n\n'), hero: 'blue',
    cta: l === 'bn' ? 'রিভিউ লিখুন' : 'Write a review', ctaUrl: v.link, prefsUrl: v.optout, siteUrl: v.link.split('/review/')[0]
  });
  const f = l === 'bn' ? ['আপনি এই মেইল পেয়েছেন কারণ আপনি AR Trade International থেকে অর্ডার করেছেন।', 'রিভিউয়ের অনুরোধ আর চাই না'] : ['You are receiving this because you ordered from AR Trade International, Dhaka.', 'Do not send me review requests'];
  return {
    lang: l, subject,
    html: html.replace('You are receiving this because you subscribed to AR Trade International, Dhaka.', f[0]).replace('Unsubscribe or change what you receive', f[1]),
    text: text.replace('Unsubscribe or change what you receive', f[1])
  };
}
/** Sends the request e-mail. { ok: true } or { ok: false, error, retry } (retry: mail is simply not set up, keep the row queued). */
export async function sendRequestMail(row, settings, { reminder = false } = {}) {
  if (!deps.mailReady()) return { ok: false, error: 'Mail is not set up', retry: true };
  try {
    const { link, optout } = await linksFor(row);
    const m = buildMail(settings, { name: row.name, products: productsText(await productNames(row.order_id)), link, optout }, { reminder });
    const sent = await deps.sendMail({ channel: 'sales', to: row.email, subject: m.subject, html: m.html, text: m.text });
    return sent ? { ok: true } : { ok: false, error: 'Mail is not set up', retry: true };
  } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 300), retry: !!e.retry }; }
}
