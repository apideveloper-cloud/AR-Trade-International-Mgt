// Pure rules for the field core routes (no database): profile validation, phone clock, Bangladesh day windows, voucher images.
import { digits, fail } from '../../util.js';

/** Cleans and validates the own-profile form; returns { name, email, phone } or throws a 400. */
export function parseProfile(body) {
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  const phone = digits(body.phone).slice(-11);
  if (name.length < 2) throw fail(400, 'Enter your name');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail(400, 'Enter a valid email');
  if (!/^01[3-9]\d{8}$/.test(phone)) throw fail(400, 'Enter a valid 11-digit mobile number (01XXXXXXXXX)');
  return { name, email, phone };
}

/** A GPS point needs a latitude, a longitude and a time. null / '' would otherwise read as 0, 0 at 1970 (Number(null) = 0, new Date(null) = epoch). */
export const trackPointOk = p => !!p && [p.lat, p.lng, p.time].every(v => v != null && v !== '');

/** The phone's clock is only trusted within 5 minutes of the server's; otherwise the server clock (UTC) is used. */
export const serverTime = (t, now = Date.now()) => { const v = t ? new Date(t).getTime() : NaN; return Number.isFinite(v) && Math.abs(v - now) <= 5 * 60000 ? v : now; };

/** UTC instant of 00:00 Bangladesh time for the current Bangladesh day. */
export function bdDayStartUtc(now = Date.now()) {
  const bd = new Date(now + 6 * 3600e3); bd.setUTCHours(0, 0, 0, 0);
  return new Date(bd.getTime() - 6 * 3600e3);
}

/** [start, end) UTC instants of the Bangladesh day `date` (YYYY-MM-DD) and the UTC start of that day's month. */
export function bdDayWindow(date) {
  const start = new Date(Date.parse(date + 'T00:00:00Z') - 6 * 3600e3); // 00:00 in Bangladesh is 18:00 UTC the evening before
  return { start, end: new Date(start.getTime() + 864e5), monthStart: new Date(Date.parse(date.slice(0, 8) + '01T00:00:00Z') - 6 * 3600e3) };
}

/** Status and duty minutes of one person's punches for a day (rows oldest first, `at` ISO text). */
export function summariseDay(punches, { onLeave, date, today, weeklyOff, now = Date.now() }) {
  const firstIn = punches.find(r => r.type === 'Clocked In')?.at || null;
  const lastOut = [...punches].reverse().find(r => r.type === 'Clocked Out' && firstIn && r.at > firstIn)?.at || null;
  let minutes = 0, open = null;
  for (const r of punches) {
    if (r.type === 'Clocked In') open = open || Date.parse(r.at);
    else if (open) { minutes += (Date.parse(r.at) - open) / 60000; open = null; }
  }
  const onDuty = open !== null && date === today;
  if (onDuty) minutes += (now - open) / 60000;
  const future = date > today;
  const status = onLeave ? 'On leave' : onDuty ? 'On duty' : firstIn ? 'Present' : future ? '—' : weeklyOff ? 'Weekly off' : 'Absent';
  return { status, firstIn, lastOut, minutes: Math.round(minutes) };
}

const VOUCHER_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
/** Decodes a base64 data-URL voucher photo into { buf, ext } (JPG / PNG / WebP, at most 4 MB) or throws a 400. */
export function parseVoucher(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw fail(400, 'Voucher must be a JPG, PNG or WebP image');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 4 * 1048576) throw fail(400, 'Voucher must be under 4 MB');
  return { buf, ext: VOUCHER_EXT[m[1]] };
}

/** Validates an expense claim form; returns { title, category, amount } or throws a 400. */
export function parseExpense(body) {
  const title = String(body.title || '').trim().slice(0, 160);
  const category = String(body.category || '').trim().slice(0, 60);
  const amount = Math.round(Number(body.amount) * 100) / 100;
  if (!title || !category || !(amount > 0) || amount > 10000000) throw fail(400, 'Description, category and a valid amount are required');
  return { title, category, amount };
}
