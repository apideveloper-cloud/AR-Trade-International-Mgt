// SEO fields as CSV: build, parse, validate and plan an import. Pure (no database, no network): unit-tested offline.
import { createHash } from 'node:crypto';
import { cleanText, validateManual, manualFrom, urlFor } from './seoItemMap.js';
import { isAutoTitle, isAutoDesc } from '../seoHelpers.js';

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const FAQ_COUNT = 5;

const FAQ_COLS = Array.from({ length: FAQ_COUNT }, (_, i) => [`faq_${i + 1}_q`, `faq_${i + 1}_a`]).flat();
export const REF_COLS = ['id', 'sku', 'name', 'url'];
export const COLUMNS = [
  'id', 'sku', 'name', 'url', 'meta_title', 'meta_description', 'meta_keywords', 'focus_keyword', 'secondary_keywords', 'canonical_url',
  'robots_index', 'robots_follow', 'og_title', 'og_description', 'og_image', 'twitter_title', 'twitter_description', ...FAQ_COLS
];

// CSV column -> key of the editor's `manual` object
const TEXT = { meta_title: 'metaTitle', meta_description: 'metaDescription', meta_keywords: 'metaKeywords', focus_keyword: 'focusKeyword', canonical_url: 'canonicalUrl', og_title: 'ogTitle', og_description: 'ogDescription', og_image: 'ogImage', twitter_title: 'twitterTitle', twitter_description: 'twitterDescription' };
const FIELD_OF = { ...TEXT, secondary_keywords: 'secondaryKeywords', robots_index: 'robotsIndex', robots_follow: 'robotsFollow', faq: 'faq' };
const COLUMN_OF = Object.fromEntries(Object.entries(FIELD_OF).map(([c, k]) => [k, c]));

export class CsvError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

/** One cell, safe against formula injection (leading = + - @ tab CR gets an apostrophe) and quoted when needed. Same rule as field/report_util.js CSV(). */
export function cell(c) {
  let s = String(c ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** rows = [{column: value}] (or arrays in COLUMNS order). Header first, CRLF line ends, no BOM (the route adds it). */
export function buildCsv(rows, columns = COLUMNS) {
  const out = [columns.map(cell).join(',')];
  for (const r of rows || []) out.push(columns.map((c, i) => cell(Array.isArray(r) ? r[i] : r?.[c])).join(','));
  return out.join('\r\n') + '\r\n';
}

// manualFrom's JSON.parse(undefined) throws once per missing list: a cheap default avoids thousands of exceptions
const withLists = m => ({ ...(m || {}), secondary_keywords: m?.secondary_keywords ?? '[]', faq: m?.faq ?? '[]' });

/** One export row for a product: `row` = products row, `meta` = its seo_meta row. Meta title/description only when hand-written. */
export function exportRow(row, meta) {
  const m = manualFrom('product', row, withLists(meta), { isAutoTitle, isAutoDesc });
  const o = {
    id: row.id, sku: row.sku || '', name: row.name || '', url: urlFor('product', row),
    meta_title: m.metaTitle, meta_description: m.metaDescription, meta_keywords: m.metaKeywords || '', focus_keyword: m.focusKeyword,
    secondary_keywords: m.secondaryKeywords.join('|'), canonical_url: m.canonicalUrl, robots_index: m.robotsIndex ? 1 : 0, robots_follow: m.robotsFollow ? 1 : 0,
    og_title: m.ogTitle, og_description: m.ogDescription, og_image: m.ogImage, twitter_title: m.twitterTitle, twitter_description: m.twitterDescription
  };
  for (let i = 0; i < FAQ_COUNT; i++) { o[`faq_${i + 1}_q`] = m.faq[i]?.q || ''; o[`faq_${i + 1}_a`] = m.faq[i]?.a || ''; }
  return o;
}

/**
 * RFC 4180 parser: quoted fields, doubled quotes, CRLF/LF/CR, newlines inside quotes, BOM. Blank lines are skipped.
 * A leading apostrophe added by cell() against formula injection is removed again.
 * @returns {{ header: string[], records: string[][], lines: number[], warnings: string[] }} header names are trimmed, lower case, spaces/hyphens -> '_'
 */
export function parseCsv(text) {
  let s = String(text ?? '');
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  const rows = [], lines = [];
  let row = [], field = '', i = 0, line = 1, start = 1;
  const n = s.length;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0].trim() === '')) { rows.push(row); lines.push(start); }
    row = [];
  };
  while (i < n) {
    const ch = s[i];
    if (field === '' && ch === '"' && (i === 0 || s[i - 1] === ',' || s[i - 1] === '\n' || s[i - 1] === '\r')) { // quoted field
      i++;
      for (;;) {
        if (i >= n) throw new CsvError(`The file ends inside a quoted cell that started on line ${line}`);
        const c = s[i];
        if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } i++; break; }
        if (c === '\n') line++;
        field += c; i++;
      }
      // anything between the closing quote and the next delimiter is kept as is (lenient)
      while (i < n && s[i] !== ',' && s[i] !== '\n' && s[i] !== '\r') field += s[i++];
      continue;
    }
    if (ch === ',') { endField(); i++; continue; }
    if (ch === '\n' || ch === '\r') {
      endRow();
      if (ch === '\r' && s[i + 1] === '\n') i++;
      i++; line++; start = line;
      continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) endRow();
  const unescape = c => (/^'[=+\-@\t\r]/.test(c) ? c.slice(1) : c);
  const warnings = [];
  if (!rows.length) return { header: [], records: [], lines: [], warnings };
  const header = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const seen = new Set(), known = new Set(COLUMNS), unknown = [];
  header.forEach(h => {
    if (!h) return;
    if (seen.has(h)) warnings.push(`Column "${h}" appears twice: only the first one is used`);
    else seen.add(h);
    if (!known.has(h) && !unknown.includes(h)) unknown.push(h);
  });
  if (unknown.length) warnings.push(`Unknown columns ignored: ${unknown.join(', ')}`);
  const faqHave = FAQ_COLS.filter(c => seen.has(c));
  if (faqHave.length && faqHave.length < FAQ_COLS.length) warnings.push('FAQ columns are incomplete (all ten faq_N_q / faq_N_a are needed): FAQs are left unchanged');
  return { header, records: rows.slice(1).map(r => r.map(unescape)), lines: lines.slice(1), warnings };
}

/** Index of each column in the header (first occurrence wins). */
const idxCache = new WeakMap();
const indexOf = header => {
  let m = idxCache.get(header);
  if (!m) { m = new Map(); header.forEach((h, i) => { if (h && !m.has(h)) m.set(h, i); }); idxCache.set(header, m); }
  return m;
};

/** Value of a column in a record, or undefined when the column is not in the file. */
export function cellOf(record, header, name) {
  const i = indexOf(header).get(name);
  return i === undefined ? undefined : String(record[i] ?? '');
}

const BOOL = { 1: true, true: true, yes: true, y: true, 0: false, false: false, no: false, n: false };

/**
 * The `manual` object from a record, using only the SEO columns present in the file. Empty text cell = clear.
 * Empty robots cell = not touched. Validated with validateManual (same limits as the editor).
 * @returns {{ manual: object, errors: string[] }}
 */
export function rowToManual(record, header) {
  const idx = indexOf(header), errors = [], raw = {};
  const get = c => (idx.has(c) ? String(record[idx.get(c)] ?? '') : undefined);
  for (const [col, key] of Object.entries(TEXT)) { const v = get(col); if (v !== undefined) raw[key] = v; }
  const sk = get('secondary_keywords');
  if (sk !== undefined) raw.secondaryKeywords = sk.split('|').map(x => x.trim()).filter(Boolean);
  for (const col of ['robots_index', 'robots_follow']) {
    const v = get(col);
    if (v === undefined || v.trim() === '') continue;
    const b = BOOL[v.trim().toLowerCase()];
    if (b === undefined) errors.push(`${col} must be 1, 0, true, false, yes or no`); else raw[FIELD_OF[col]] = b;
  }
  if (FAQ_COLS.every(c => idx.has(c))) {
    const faq = [];
    let bad = false;
    for (let n = 1; n <= FAQ_COUNT; n++) {
      const q = clean(get(`faq_${n}_q`)), a = clean(get(`faq_${n}_a`));
      if (!q && !a) continue;
      if (!q || !a) { errors.push(`FAQ ${n} needs both a question and an answer`); bad = true; continue; }
      faq.push({ q, a });
    }
    if (!bad) raw.faq = faq;
  }
  const v = validateManual(raw);
  errors.push(...v.errors);
  return { manual: v.values, errors };
}

// cleanText with a fast path for plain printable ASCII (most cells), same result
const SIMPLE = /^[!-~](?:[ -~]*[!-~])?$/;
const clean = v => (typeof v === 'string' ? (v === '' || (SIMPLE.test(v) && !/[<>]|  /.test(v)) ? v : cleanText(v)) : cleanText(v));
const norm = (k, v) => (k === 'faq' ? (v || []).map(x => ({ q: clean(x.q), a: clean(x.a) })) : k === 'secondaryKeywords' ? (v || []).map(clean) : typeof v === 'string' ? clean(v) : v);
const show = (k, v) => {
  if (k === 'faq') return (v || []).map(x => `${x.q} => ${x.a}`).join(' || ');
  if (k === 'secondaryKeywords') return (v || []).join('|');
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v ?? '');
};

/** Fields of `next` (validated manual, only the touched keys) that differ from `current` (manualFrom): [{ field (CSV column), from, to, key }]. */
export function diffManual(current, next) {
  const out = [];
  for (const [k, v] of Object.entries(next || {})) {
    const a = norm(k, current?.[k]), b = norm(k, v);
    if (JSON.stringify(a ?? '') === JSON.stringify(b ?? '')) continue;
    out.push({ field: COLUMN_OF[k] || k, from: show(k, a), to: show(k, b), key: k });
  }
  return out;
}

export const tokenOf = csv => createHash('sha256').update(String(csv ?? ''), 'utf8').digest('hex');
export const tokenOk = (csv, token) => typeof csv === 'string' && typeof token === 'string' && /^[0-9a-f]{64}$/.test(token) && tokenOf(csv) === token;

/** Size and row limits; throws CsvError (413 too large, 400 too many rows or no id/sku column). Returns the parsed file. */
export function parseChecked(csv) {
  if (typeof csv !== 'string' || !csv.trim()) throw new CsvError('Send the CSV text in "csv"');
  if (Buffer.byteLength(csv, 'utf8') > MAX_BYTES) throw new CsvError('The file is larger than 2 MB. Split it into smaller files.', 413);
  const p = parseCsv(csv);
  if (!p.header.length) throw new CsvError('The file is empty');
  if (!p.header.includes('id') && !p.header.includes('sku')) throw new CsvError('The file needs an "id" or a "sku" column to find the products');
  if (p.records.length > MAX_ROWS) throw new CsvError(`The file has ${p.records.length} data rows; the limit is ${MAX_ROWS}. Split it into smaller files.`);
  return p;
}

/** The ids and skus a file refers to (for the batched lookups). */
export function keysOf(parsed) {
  const ids = new Set(), skus = new Set();
  for (const r of parsed.records) {
    const id = (cellOf(r, parsed.header, 'id') || '').trim(), sku = (cellOf(r, parsed.header, 'sku') || '').trim();
    if (/^\d{1,10}$/.test(id)) ids.add(id);
    if (sku) skus.add(sku);
  }
  return { ids: [...ids], skus: [...skus] };
}

/** Builds the lookup structure planImport needs from queried rows. */
export function makeLookup(products, metas) {
  const byId = new Map(), bySku = new Map(), meta = new Map();
  for (const p of products || []) {
    byId.set(String(p.id), p);
    const k = String(p.sku || '').trim().toLowerCase();
    if (k) bySku.set(k, [...(bySku.get(k) || []), p]);
  }
  for (const m of metas || []) meta.set(String(m.entity_id), m);
  return { byId, bySku, meta };
}

/**
 * Checks every row against the file's rules and the current values. Pure.
 * @returns {{ rows: {line, id, name, changes, errors, manual}[], counts }} manual = only the changed keys (what apply writes)
 */
export function planImport(parsed, lookup) {
  const { header, records, lines } = parsed;
  const rows = [], seen = new Map();
  records.forEach((rec, n) => {
    const line = lines[n] ?? n + 2;
    const errors = [];
    const idTxt = (cellOf(rec, header, 'id') || '').trim(), skuTxt = (cellOf(rec, header, 'sku') || '').trim();
    let product = null;
    if (/^\d{1,10}$/.test(idTxt)) product = lookup.byId.get(idTxt) || null;
    if (!product && skuTxt) {
      const hits = lookup.bySku.get(skuTxt.toLowerCase()) || [];
      if (hits.length > 1) errors.push('SKU matches more than one product: use the id');
      else product = hits[0] || null;
    }
    const out = { line, id: product ? product.id : idTxt, name: product ? String(product.name || '') : '', changes: [], errors, manual: {} };
    if (!errors.length && !product) errors.push('Product not found');
    if (header.length && rec.length !== header.length) errors.push(`The row has ${rec.length} cells but the header has ${header.length}`);
    if (product) {
      const key = String(product.id);
      if (seen.has(key)) errors.push(`Same product as line ${seen.get(key)}`); else seen.set(key, line);
    }
    if (!errors.length) {
      const { manual, errors: e } = rowToManual(rec, header);
      errors.push(...e);
      if (!errors.length) {
        const current = manualFrom('product', product, withLists(lookup.meta.get(String(product.id))), { isAutoTitle, isAutoDesc });
        const changes = diffManual(current, manual);
        out.changes = changes;
        for (const c of changes) out.manual[c.key] = manual[c.key];
      }
    }
    rows.push(out);
  });
  const invalid = rows.filter(r => r.errors.length).length;
  const changed = rows.filter(r => !r.errors.length && r.changes.length).length;
  return { rows, counts: { total: rows.length, valid: rows.length - invalid, invalid, changed, unchanged: rows.length - invalid - changed } };
}

/** The preview payload: all invalid rows and at most `maxChanged` changed rows. */
export function previewRows(plan, maxChanged = 200) {
  const shape = r => ({ line: r.line, id: r.id, name: r.name, changes: r.changes.map(({ field, from, to }) => ({ field, from, to })), errors: r.errors });
  const bad = plan.rows.filter(r => r.errors.length).map(shape);
  const all = plan.rows.filter(r => !r.errors.length && r.changes.length);
  return { rows: [...bad, ...all.slice(0, maxChanged).map(shape)].sort((a, b) => a.line - b.line), truncated: all.length > maxChanged ? `Showing the first ${maxChanged} of ${all.length} changed rows; all of them will be applied.` : '' };
}
