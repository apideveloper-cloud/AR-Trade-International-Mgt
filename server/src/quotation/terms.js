// Pure helpers for the terms (N.B.) scan and for e-mail address lists.
import { fail } from '../util.js';

/** Turns the raw text of a scan into one clean term per line: bullets and numbers like "01." or "2)" are dropped, wrapped lines are joined. */
export function termsFromText(raw) {
  const lines = String(raw || '').split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = [];
  for (const l of lines) {
    if (/^(n\.?\s?b\.?|note|terms( and conditions)?)\s*:?$/i.test(l)) continue;
    const m = l.match(/^(?:\(?\d{1,2}[.)]|[-•*●▪]|\d{1,2}\s*[-:])\s*(.+)$/);
    if (m) out.push(m[1].trim().replace(/^[1l]n\b/, 'In'));
    else if (out.length && !/[.!]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + l; // a wrapped line continues the term before it
    else out.push(l);
  }
  return out.filter(l => l.length > 2);
}

export const EMAIL_RE = /^[^\s,;<>"()]+@[^\s,;<>"()]+\.[^\s,;<>"()]+$/;

/** "a@x.com, b@y.com; c@z.com" -> ['a@x.com', 'b@y.com', 'c@z.com'] (lower case, no repeats); throws when one of them is not an address. */
export function addressList(v, label) {
  const list = [...new Set(String(v || '').split(/[;,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean))];
  if (list.length > 10) throw fail(400, `${label}: at most 10 addresses`);
  const bad = list.find(a => !EMAIL_RE.test(a) || a.length > 160);
  if (bad) throw fail(400, `${label}: "${bad}" is not a valid email address`);
  return list;
}
