// Pure helpers of the SEO change history (no database, unit-tested): comparable snapshots, diffs, stored entries, revert planning.
export const ACTIONS = ['save', 'slug', 'bulk', 'csv', 'settings', 'revert'];
export const SOURCES = ['editor', 'bulk', 'csv', 'settings', 'revert'];
export const REVERTABLE = ['save', 'slug', 'bulk', 'csv', 'settings'];
export const MANUAL_FIELDS = ['metaTitle', 'metaDescription', 'metaKeywords', 'focusKeyword', 'secondaryKeywords', 'canonicalUrl', 'robotsIndex', 'robotsFollow',
  'ogTitle', 'ogDescription', 'ogImage', 'twitterTitle', 'twitterDescription', 'faq'];
export const LABELS = {
  metaTitle: 'Meta title', metaDescription: 'Meta description', metaKeywords: 'Meta keywords', focusKeyword: 'Focus keyword', secondaryKeywords: 'Secondary keywords',
  canonicalUrl: 'Canonical URL', robotsIndex: 'Index', robotsFollow: 'Follow', ogTitle: 'Social title', ogDescription: 'Social description', ogImage: 'Social image',
  twitterTitle: 'Twitter title', twitterDescription: 'Twitter description', faq: 'FAQ', slug: 'Web address', imageAlts: 'Image alt text'
};

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
}

/** The comparable state of an item: the manual SEO fields present in `manual`, plus `slug` and `imageAlts` from `extra` when given. */
export function snapshot(type, manual, extra = {}) {
  const m = manual && typeof manual === 'object' ? manual : {};
  const out = {};
  for (const k of MANUAL_FIELDS) if (k in m) out[k] = m[k];
  if (extra.slug != null) out.slug = String(extra.slug);
  if (type === 'product' && Array.isArray(extra.imageAlts)) out.imageAlts = extra.imageAlts.map(i => ({ src: String(i.src ?? ''), alt: String(i.alt ?? '') }));
  return out;
}

/** [{ field, from, to }] for every field whose value differs (deep compare). A field missing on one side counts as different from a present one. */
export function diffSnapshots(before, after) {
  const b = before || {}, a = after || {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const out = [];
  for (const field of keys) if (!deepEqual(b[field], a[field])) out.push({ field, from: b[field], to: a[field] });
  return out;
}

const label = f => LABELS[f] || (f ? f[0].toUpperCase() + f.slice(1) : f);

/** Short text, at most 300 characters: 'Meta title, FAQ changed'. */
export function summaryOf(changes, action) {
  const names = (changes || []).map(c => label(c.field));
  const head = action === 'revert' ? 'Reverted: ' : action === 'slug' ? '' : '';
  if (!names.length) return head ? head.trim() : 'No change';
  let text = names.join(', ');
  const verb = action === 'revert' ? '' : ' changed';
  let s = head + text + verb;
  if (s.length > 300) {
    let kept = [];
    for (const n of names) { if ((head + [...kept, n].join(', ') + ` and ${names.length - kept.length - 1} more` + verb).length > 290) break; kept.push(n); }
    s = head + kept.join(', ') + ` and ${names.length - kept.length} more` + verb;
  }
  return s.slice(0, 300);
}

/** A row for seo_history with only the changed keys stored. Returns null when nothing changed. */
export function buildEntry({ type, id, action = 'save', source = 'editor', before, after, who = '' }) {
  const changes = diffSnapshots(before, after);
  if (!changes.length) return null;
  const b = {}, a = {};
  for (const c of changes) { if (c.from !== undefined) b[c.field] = c.from; if (c.to !== undefined) a[c.field] = c.to; }
  return {
    entity_type: String(type).slice(0, 20), entity_id: String(id).slice(0, 80), action: String(action).slice(0, 20), source: String(source).slice(0, 20),
    summary: summaryOf(changes, action), before_json: JSON.stringify(b), after_json: JSON.stringify(a), changed_by: String(who || '').slice(0, 80)
  };
}

/**
 * entry = { before, after } (parsed objects of the changed keys), current = the current snapshot.
 * A conflict is a field whose current value differs from the entry's `after` value. apply = the BEFORE values to write back.
 */
export function planRevert(entry, current) {
  const before = entry?.before || {}, after = entry?.after || {}, cur = current || {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const conflicts = [], apply = {};
  for (const field of fields) {
    if (!deepEqual(cur[field], after[field])) conflicts.push({ field, expected: after[field], current: cur[field] });
    if (before[field] !== undefined) apply[field] = before[field];
  }
  return { ok: conflicts.length === 0, conflicts, apply };
}

const SECRET_KEY = /token|secret|password/i;
const redact = v => (typeof v === 'string' && v ? `${v.slice(0, 4)}…[${v.length}]` : v);
export const isRedacted = v => typeof v === 'string' && /…\[\d+\]$/.test(v);

/** Copy of the seo settings that is safe to store: site verification tokens (and anything named token, secret, password) keep only their first 4 characters. */
export function redactSettings(obj) {
  const walk = (v, key) => {
    if (Array.isArray(v)) return v.map(x => walk(x, key));
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = (key === 'verification' && (k === 'google' || k === 'bing')) || SECRET_KEY.test(k) ? (typeof x === 'string' ? redact(x) : x) : walk(x, k);
      return o;
    }
    return v;
  };
  return walk(obj, '');
}

/** Puts the current real token back where a stored (redacted) value would be written: nothing secret can be restored from history. */
export function unredactSettings(value, current) {
  if (isRedacted(value)) return current;
  if (Array.isArray(value) || !value || typeof value !== 'object') return value;
  const o = {};
  for (const [k, x] of Object.entries(value)) o[k] = unredactSettings(x, current && typeof current === 'object' ? current[k] : undefined);
  return o;
}

/** A value as short text for the history list: strings as they are, everything else as JSON, cut to `max` characters. */
export function clipValue(v, max = 300) {
  if (v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export const safeParse = t => { try { const v = JSON.parse(t); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };

/** Response fields of one stored row: [{ field, from, to }] with clipped text. */
export function fieldsOf(row, max = 300) {
  const b = safeParse(row.before_json), a = safeParse(row.after_json);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].map(field => ({ field, from: clipValue(b[field], max), to: clipValue(a[field], max) }));
}
