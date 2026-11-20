// Spam controls for product reviews: pure checks + an in-memory IP limiter.
import crypto from 'node:crypto';

export const hashIp = ip => crypto.createHash('sha256').update('review-ip:' + String(ip || '')).digest('hex').slice(0, 32);

/** Hits per key in a sliding window: hit(key) returns how many hits that key has now (including this one). */
export function makeIpLimiter({ max = 5, windowMs = 3600e3, now = () => Date.now() } = {}) {
  const m = new Map();
  return {
    max,
    hit(key) { const t = now(), a = (m.get(key) || []).filter(x => t - x < windowMs); a.push(t); m.set(key, a); return a.length; },
    over(key) { return this.hit(key) > max; }
  };
}

export const MIN_WRITE_MS = 3000;
const URL_RE = /https?:\/\/|\bwww\./i;
const BARE_DOMAIN_RE = /\b[a-z0-9-]{2,}\.(?:com|net|org|info|biz|xyz|top|ru|cn|shop|site|online|click|link)\b/i;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;
const KEYWORD_RE = /\bseo\b|casino|\bloans?\b|crypto|bitcoin|viagra|click\s+here|whats\s?app\s+me|whatsapp\s+me/i;

/** Lower-case, collapse spaces and strip punctuation, so two copies of the same text compare equal. */
export const normalizeBody = s => String(s || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ' ').trim();
export const isDuplicateBody = (a, b) => { const x = normalizeBody(a), y = normalizeBody(b); return x.length >= 10 && x === y; };

function textFlag(text) {
  const t = String(text || '');
  if (URL_RE.test(t) || BARE_DOMAIN_RE.test(t) || EMAIL_RE.test(t)) return 'link';
  if (/(.)\1{7,}/su.test(t)) return 'repeat';
  const chars = t.replace(/\s/g, '');
  if (chars.length >= 10 && new Set(chars.toLowerCase()).size <= 3) return 'repeat';
  const letters = t.match(/[A-Za-z]/g) || []; // Bangla (and other scripts without case) never count as capitals
  if (letters.length > 30 && letters.filter(c => c >= 'A' && c <= 'Z').length / letters.length > 0.8) return 'caps';
  if (KEYWORD_RE.test(t)) return 'keyword';
  return '';
}

/** assessReview({ title, body, honeypot, renderedAt, now }) -> { status: 'Pending'|'Spam', reject: ''|'message shown to the writer', reason } */
export function assessReview({ title = '', body = '', honeypot = '', renderedAt, now = Date.now() } = {}) {
  if (String(honeypot || '').trim()) return { status: 'Pending', reject: 'Could not save your review.', reason: 'honeypot' };
  if (renderedAt !== undefined && renderedAt !== null && renderedAt !== '') {
    const t = typeof renderedAt === 'number' || /^\d+$/.test(String(renderedAt)) ? Number(renderedAt) : Date.parse(renderedAt);
    const n = now instanceof Date ? now.getTime() : Number(now);
    if (Number.isFinite(t) && Number.isFinite(n)) {
      const d = n - t;
      if (d >= 0 && d < MIN_WRITE_MS) return { status: 'Pending', reject: 'Please take a moment to write your review, then try again.', reason: 'too-fast' };
    }
  }
  const reason = textFlag(body) || textFlag(title);
  return reason ? { status: 'Spam', reject: '', reason } : { status: 'Pending', reject: '', reason: '' };
}
