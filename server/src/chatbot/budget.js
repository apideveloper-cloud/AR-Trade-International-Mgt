// Reads a price budget out of a customer message.
import { toEnDigits } from './text.js';

/** "5", "k" -> 5000; "2", "lakh" -> 200000; null when not a number. */
function parseNumber(raw, unit) {
  let n = parseFloat(toEnDigits(raw).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  if (/^(k|হাজার|thousand)/i.test(unit || '')) n *= 1000;
  if (/^(lakh|lac|লাখ|লক্ষ)/i.test(unit || '')) n *= 100000;
  return n;
}
const NUM = '([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(k|হাজার|thousand|lakh|lac|লাখ|লক্ষ)?';

/** Reads a budget out of the message: {min, max} in taka. Small bare numbers (12, 79) are model numbers, not prices. */
export function parseBudget(text) {
  const t = toEnDigits(text.toLowerCase());
  let m = t.match(new RegExp(`(?:between|from)?\\s*${NUM}\\s*(?:to|and|-|–|থেকে|এবং|-)\\s*${NUM}`));
  if (m) {
    const a = parseNumber(m[1], m[2] || m[4]), b = parseNumber(m[3], m[4]);
    if (a && b && Math.max(a, b) >= 500) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  m = t.match(new RegExp(`(?:under|below|within|less than|upto|up to|max(?:imum)?|not more than|cheaper than|budget(?: is| of)?)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`))
    || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)?(?:র|এর)?\\s*(?:মধ্যে|নিচে|কম|or less|or below|max)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: 0, max: n }; }
  m = t.match(new RegExp(`(?:above|over|more than|minimum|at least|starting|from)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`))
    || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)?(?:র|এর)?\\s*(?:উপরে|বেশি|or more|or above|plus)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n, max: Infinity }; }
  m = t.match(new RegExp(`(?:around|about|near|approx(?:imately)?|roughly|প্রায়)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n * 0.8, max: n * 1.2 }; }
  m = t.match(new RegExp(`(?:tk\\.?|taka|bdt|৳)\\s*${NUM}`)) || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n * 0.8, max: n * 1.2 }; }
  return null;
}
