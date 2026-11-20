// Pure helpers of review requests: signed token, channel choice, due selection, WhatsApp link, templates, settings validation. No database here.
import crypto from 'node:crypto';
import { bdMobile, digits, secret } from '../util.js';

export const SHOP = 'AR Trade International';
const DAY = 864e5;

// ---------- settings ----------
export const DEFAULT_TEMPLATES = {
  en: {
    subject: '{name}, how was your order? Tell us in one minute',
    body: 'Hi {name},\n\nThank you for shopping with {shop}. We hope you received your order ({products}) in good shape and that it works well for you.\n\nCould you spare a minute to tell us what you think? Your honest words help us improve and help other buyers choose with confidence:\n{link}\n\nThank you,\n{shop}\n\nIf you would rather not get review requests, use this link: {optout}'
  },
  bn: {
    subject: '{name}, আপনার অর্ডারটি কেমন লাগল? এক মিনিটে জানান',
    body: 'প্রিয় {name},\n\n{shop} থেকে কেনাকাটা করার জন্য আপনাকে ধন্যবাদ। আশা করি আপনি আপনার অর্ডার ({products}) ঠিকঠাক পেয়েছেন এবং পণ্যগুলো ভালো কাজ করছে।\n\nপণ্য সম্পর্কে আপনার মতামত দুই-এক লাইনে লিখলে আমরা নিজেদের আরও ভালো করতে পারব, আর অন্য ক্রেতারাও ভরসা নিয়ে কিনতে পারবেন। এতে এক মিনিটও লাগবে না:\n{link}\n\nধন্যবাদ,\n{shop}\n\nভবিষ্যতে রিভিউয়ের অনুরোধ না পেতে চাইলে এই লিংকে যান: {optout}'
  }
};
export const defaultSettings = () => ({
  enabled: false, delayDays: 3, reminder: true, reminderDays: 7, expireDays: 30, language: 'auto', autoApproveVerified: false,
  templates: { en: { ...DEFAULT_TEMPLATES.en }, bn: { ...DEFAULT_TEMPLATES.bn } }
});
/** Stored settings (may be partial or missing) over the defaults. */
export function mergeSettings(stored) {
  const d = defaultSettings(), s = stored && typeof stored === 'object' ? stored : {};
  const out = { ...d };
  for (const k of Object.keys(d)) if (k !== 'templates' && s[k] !== undefined) out[k] = s[k];
  for (const l of ['en', 'bn']) out.templates[l] = { subject: s.templates?.[l]?.subject || d.templates[l].subject, body: s.templates?.[l]?.body || d.templates[l].body };
  return out;
}
const whole = (v, lo, hi, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${label} must be a whole number from ${lo} to ${hi}`);
  return n;
};
/** Applies a partial update on top of `cur`. Returns { ok: true, settings } or { ok: false, error }. */
export function validateSettings(input, cur = defaultSettings()) {
  try {
    const b = input && typeof input === 'object' ? input : {}, n = mergeSettings(cur);
    for (const k of ['enabled', 'reminder', 'autoApproveVerified']) if (b[k] !== undefined) { if (typeof b[k] !== 'boolean') throw new Error(`${k} must be true or false`); n[k] = b[k]; }
    if (b.delayDays !== undefined) n.delayDays = whole(b.delayDays, 0, 60, 'Delay');
    if (b.reminderDays !== undefined) n.reminderDays = whole(b.reminderDays, 1, 60, 'Reminder delay');
    if (b.expireDays !== undefined) n.expireDays = whole(b.expireDays, 7, 180, 'Link lifetime');
    if (b.language !== undefined) { if (!['auto', 'en', 'bn'].includes(b.language)) throw new Error('Language must be auto, en or bn'); n.language = b.language; }
    for (const l of ['en', 'bn']) {
      const t = b.templates?.[l]; if (t === undefined) continue;
      const subject = String(t?.subject ?? n.templates[l].subject).trim(), body = String(t?.body ?? n.templates[l].body).trim();
      const name = l === 'en' ? 'English' : 'Bangla';
      if (!subject || subject.length > 150) throw new Error(`${name} subject must be 1 to 150 characters`);
      if (!body || body.length > 2000) throw new Error(`${name} message must be 1 to 2000 characters`);
      if (!body.includes('{link}')) throw new Error(`${name} message must contain {link}`);
      n.templates[l] = { subject, body };
    }
    if (n.reminderDays >= n.expireDays) throw new Error('The reminder must come before the link expires');
    return { ok: true, settings: n };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ---------- signed token (never stored; rebuilt from the request row) ----------
const mac = (p, key) => crypto.createHmac('sha256', key + ':review-request').update(p).digest('base64url');
export function signToken(rid, expMs, key = secret()) {
  const p = Buffer.from(JSON.stringify({ rid: Number(rid), exp: Math.floor(expMs / 1000) })).toString('base64url');
  return p + '.' + mac(p, key);
}
/** null for a forged or malformed token; otherwise { rid, exp (ms), expired }. */
export function verifyToken(token, now = Date.now(), key = secret()) {
  const [p, sig, extra] = String(token || '').split('.');
  if (!p || !sig || extra !== undefined) return null;
  const want = Buffer.from(mac(p, key)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const x = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!Number.isInteger(x.rid) || x.rid < 1 || !Number.isFinite(x.exp)) return null;
    return { rid: x.rid, exp: x.exp * 1000, expired: x.exp * 1000 <= now };
  } catch { return null; }
}

// ---------- contacts and channel ----------
export const realEmail = e => { const s = String(e || '').trim(); return s.length <= 160 && /^[^\s,;<>"()@]+@[^\s,;<>"()@]+\.[^\s,;<>"()@.]+$/.test(s) && !/\.invalid$/i.test(s); };
/** 8801XXXXXXXXX for a Bangladesh mobile; other numbers keep their digits when they look international (9 to 15 digits); '' otherwise. */
export function phoneKey(p) {
  const b = bdMobile(p); if (b) return '88' + b;
  const d = digits(p); return d.length >= 9 && d.length <= 15 && !d.startsWith('0') ? d : '';
}
export const emailKey = e => (realEmail(e) ? String(e).trim().toLowerCase() : '');
/** 'email' when the address is real and mail is set up, 'whatsapp' when there is a usable phone, '' when there is no way to ask. */
export function chooseChannel({ email, phone, mailOk }) {
  if (realEmail(email) && mailOk) return 'email';
  return phoneKey(phone) ? 'whatsapp' : '';
}
export const waUrl = (phone, text) => { const k = phoneKey(phone); return k ? `https://wa.me/${k}?text=${encodeURIComponent(text)}` : ''; };

// ---------- what is due ----------
const t = v => (v ? new Date(v).getTime() : 0);
export const dueToSend = (rows, now = Date.now()) => rows.filter(r => r.channel === 'email' && r.status === 'Queued' && t(r.send_at) <= now && (!r.expires_at || t(r.expires_at) > now));
export const dueReminders = (rows, s, now = Date.now()) => (!s.reminder ? [] : rows.filter(r => r.channel === 'email' && ['Sent', 'Opened'].includes(r.status) && !r.reminder_at && r.sent_at && t(r.sent_at) + s.reminderDays * DAY <= now && t(r.expires_at) > now));
export const dueExpiry = (rows, now = Date.now()) => rows.filter(r => ['Queued', 'Sent', 'Opened'].includes(r.status) && r.expires_at && t(r.expires_at) <= now);
export const planDates = (s, now = Date.now()) => { const sendAt = new Date(now + s.delayDays * DAY); return { sendAt, expiresAt: new Date(sendAt.getTime() + s.expireDays * DAY) }; };

// ---------- text ----------
const bnLetters = x => (String(x).match(/[ঀ-৿]/g) || []).length, letters = x => (String(x).match(/\p{L}/gu) || []).length;
export const pickLanguage = (setting, name) => (setting === 'en' || setting === 'bn' ? setting : letters(name) && bnLetters(name) / letters(name) > 0.5 ? 'bn' : 'en');
export const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'there';
/** "Rahim K." style name shown next to a review. */
export function displayName(n) { const p = String(n || '').trim().split(/\s+/).filter(Boolean); return !p.length ? 'Customer' : p.length === 1 ? p[0] : `${p[0]} ${[...p[p.length - 1]][0].toUpperCase()}.`; }
export const productsText = names => { const u = [...new Set(names.filter(Boolean))]; return u.length <= 3 ? u.join(', ') : u.slice(0, 3).join(', ') + ` +${u.length - 3}`; };
/** Replaces {name} {shop} {products} {link} {optout}; other braces stay. Values go in as they are: escape later when going into HTML. */
export const fill = (tpl, v) => String(tpl).replace(/\{(name|shop|products|link|optout)\}/g, (_, k) => String(v[k] ?? ''));
export function renderMessage(settings, lang, vars) {
  const tp = settings.templates[lang] || settings.templates.en;
  return { subject: fill(tp.subject, vars).replace(/\s+/g, ' ').trim(), body: fill(tp.body, vars) };
}
