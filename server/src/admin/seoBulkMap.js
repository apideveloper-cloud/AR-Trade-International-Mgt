// Pure logic of the SEO product list, bulk actions and dashboard (no database, unit-tested).
import { isAutoTitle, isAutoDesc, plain, brandSlug } from '../seoHelpers.js';
import { renderTemplate, varsFor, DEFAULT_TEMPLATES } from '../seoTemplate.js';
import { scoreItem } from '../seoScore.js';
import { like } from '../adminHelpers.js';
import { manualFrom, autofillAlts, urlFor, jsonList } from './seoItemMap.js';

export const FILTERS = ['all', 'missing_title', 'missing_desc', 'low_score', 'missing_gtin', 'alt_missing', 'noindex', 'unscored'];
export const SORTS = ['id', 'name', 'score', 'updated'];
export const ACTIONS = ['reset_template', 'noindex', 'index', 'alt_autofill', 'recalculate'];
export const MAX_AFFECTED = 3000;
export const CHUNK = 200;
export const LOW_SCORE = 50;
export const MIN_BRAND_PRODUCTS = 3;

const bad = message => Object.assign(new Error(message), { status: 400 });

// ---------- SQL pieces (aliases: p = products, m = seo_meta row of the product, a = alt counts, c = category) ----------
export const FROM_SQL = "FROM products p LEFT JOIN seo_meta m ON m.entity_type = 'product' AND m.entity_id = CAST(p.id AS CHAR) COLLATE utf8mb4_unicode_ci LEFT JOIN categories c ON c.id = p.category_id "
  + "LEFT JOIN (SELECT product_id, COUNT(*) n, SUM(TRIM(alt) = '') missing FROM product_images GROUP BY product_id) a ON a.product_id = p.id";
/** A hand-written title: seo_meta value, or a products column value that is not generated ("... | AR Trade" counts as generated). Same rule as isAutoTitle. */
export const TITLE_SET_SQL = "(COALESCE(m.meta_title, '') <> '' OR (TRIM(p.meta_title) <> '' AND TRIM(p.meta_title) NOT REGEXP '[|][[:space:]]*AR Trade( International)?$'))";
/** A hand-written description: same rule as isAutoDesc ("... Genuine, fast delivery." counts as generated). */
export const DESC_SET_SQL = "(COALESCE(m.meta_description, '') <> '' OR (TRIM(p.meta_desc) <> '' AND TRIM(p.meta_desc) NOT REGEXP 'Genuine, fast delivery[.]$'))";
export const GTIN_SET_SQL = "(COALESCE(TRIM(p.gtin), '') <> '')";
/** The hand-written title / description text itself ('' when none), for duplicate detection. */
export const TITLE_TEXT_SQL = "CASE WHEN COALESCE(m.meta_title, '') <> '' THEN m.meta_title WHEN TRIM(p.meta_title) <> '' AND TRIM(p.meta_title) NOT REGEXP '[|][[:space:]]*AR Trade( International)?$' THEN p.meta_title ELSE '' END";
export const DESC_TEXT_SQL = "CASE WHEN COALESCE(m.meta_description, '') <> '' THEN m.meta_description WHEN TRIM(p.meta_desc) <> '' AND TRIM(p.meta_desc) NOT REGEXP 'Genuine, fast delivery[.]$' THEN p.meta_desc ELSE '' END";

const FILTER_SQL = {
  all: null,
  missing_title: `NOT ${TITLE_SET_SQL}`,
  missing_desc: `NOT ${DESC_SET_SQL}`,
  low_score: `m.seo_score < ${LOW_SCORE}`,
  missing_gtin: `NOT ${GTIN_SET_SQL}`,
  alt_missing: 'COALESCE(a.missing, 0) > 0',
  noindex: 'p.noindex = 1',
  unscored: 'm.seo_score IS NULL'
};
const SORT_SQL = { id: 'p.id', name: 'p.name', score: 'm.seo_score', updated: 'p.updated_at' };

/** { filter, q, cat } -> { where: 'WHERE ...' | '', params }. Throws a 400 for an unknown filter. */
export function whereFor({ filter = 'all', q = '', cat = '' } = {}) {
  const f = filter === undefined || filter === null || filter === '' ? 'all' : String(filter);
  if (!FILTERS.includes(f)) throw bad(`Unknown filter "${f.slice(0, 40)}"`);
  const conds = [], params = [];
  if (FILTER_SQL[f]) conds.push(FILTER_SQL[f]);
  const text = String(q ?? '').trim().slice(0, 100);
  if (text) { const l = like(text); conds.push("(p.name LIKE ? OR p.sku LIKE ? OR p.part LIKE ? OR p.brand LIKE ? OR CAST(p.id AS CHAR) LIKE ?)"); params.push(l, l, l, l, l); }
  const c = String(cat ?? '').trim().slice(0, 40);
  if (c) { conds.push('p.category_id = ?'); params.push(c); }
  return { where: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params };
}

/** ?sort= & ?dir= -> ORDER BY text from a whitelist. Score puts unscored products last in both directions. */
export function orderFor(sort = 'id', dir = 'desc') {
  const s = sort === undefined || sort === null || sort === '' ? 'id' : String(sort);
  if (!SORTS.includes(s)) throw bad(`Unknown sort "${s.slice(0, 40)}"`);
  const d = String(dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const lead = s === 'score' ? 'm.seo_score IS NULL ASC, ' : s === 'updated' ? 'p.updated_at IS NULL ASC, ' : '';
  return `${lead}${SORT_SQL[s]} ${d}, p.id ${d}`;
}

/** Query of the list route -> clean values (size 10..100, default 25). Throws 400 for an unknown filter / sort. */
export function parseListQuery(query) {
  const q = query || {};
  const filter = q.filter === undefined || q.filter === '' ? 'all' : String(q.filter);
  if (!FILTERS.includes(filter)) throw bad(`Unknown filter "${filter.slice(0, 40)}"`);
  const sort = q.sort === undefined || q.sort === '' ? 'id' : String(q.sort);
  if (!SORTS.includes(sort)) throw bad(`Unknown sort "${sort.slice(0, 40)}"`);
  const dir = String(q.dir || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const size = Math.min(100, Math.max(10, parseInt(q.size, 10) || 25));
  const page = Math.min(1000000, Math.max(1, parseInt(q.page, 10) || 1));
  return { q: String(q.q ?? '').trim().slice(0, 100), cat: String(q.cat ?? '').trim().slice(0, 40), filter, sort, dir, size, page, offset: (page - 1) * size };
}

/** Number of issues that are not 'pass' in a stored seo_issues value (JSON text or array); 0 when empty or broken. */
export const issueCount = v => jsonList(v).filter(i => i && i.level && i.level !== 'pass').length;

const nz = v => (v == null ? 0 : Number(v) || 0);
/** One list row for the client. `live` = the product is shown on the website (active and has a picture). */
export function rowOut(r, live) {
  const isLive = !!live;
  return {
    id: r.id, name: String(r.name || ''), sku: String(r.sku || ''), slug: String(r.slug || ''), url: urlFor('product', r), thumb: r.img || '',
    cat: r.category_id || '', catTitle: r.cat_title || '', brand: String(r.brand || ''), price: nz(r.price), live: isLive,
    score: r.seo_score == null ? null : Number(r.seo_score),
    titleSet: !!Number(r.title_set), descSet: !!Number(r.desc_set),
    indexStatus: !isLive ? 'hidden' : Number(r.noindex) ? 'noindex' : 'indexed',
    issues: r.seo_score == null ? 0 : issueCount(r.seo_issues),
    gtin: !!Number(r.gtin_set), altMissing: nz(r.alt_missing), imageCount: nz(r.image_count)
  };
}

export function summaryOut(r) {
  const x = r || {};
  return { total: nz(x.total), missingTitle: nz(x.missing_title), missingDesc: nz(x.missing_desc), lowScore: nz(x.low_score), missingGtin: nz(x.missing_gtin), altMissing: nz(x.alt_missing), noindex: nz(x.noindex), unscored: nz(x.unscored) };
}

// ---------- bulk request ----------
/** ids -> unique positive integers. Throws 400 for anything else or more than MAX_AFFECTED. */
export function cleanIds(ids) {
  if (!Array.isArray(ids)) throw bad('ids must be a list of product numbers');
  const out = [], seen = new Set();
  for (const v of ids) {
    const n = typeof v === 'string' && /^\d{1,10}$/.test(v.trim()) ? Number(v) : v;
    if (!Number.isSafeInteger(n) || n < 1 || n > 2147483647) throw bad('ids must be positive whole numbers');
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  if (!out.length) throw bad('Select at least one product');
  if (out.length > MAX_AFFECTED) throw capError(out.length);
  return out;
}
export const capError = n => bad(`Too many products selected (${n}). At most ${MAX_AFFECTED} can be changed in one go: narrow the filter or select fewer.`);

/** Body of POST /seo/bulk -> { action, ids: number[]|null, scope: {filter,q,cat}|null, dryRun }. Exactly one of ids / scope. */
export function parseBulkBody(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const action = typeof b.action === 'string' ? b.action : '';
  if (!ACTIONS.includes(action)) throw bad('Unknown action');
  const hasIds = b.ids !== undefined && b.ids !== null, hasScope = b.scope !== undefined && b.scope !== null;
  if (hasIds === hasScope) throw bad('Send either ids or scope, not both');
  if (b.dryRun !== undefined && typeof b.dryRun !== 'boolean') throw bad('dryRun must be true or false');
  let ids = null, scope = null;
  if (hasIds) ids = cleanIds(b.ids);
  else {
    const s = b.scope;
    if (typeof s !== 'object' || Array.isArray(s)) throw bad('scope must be an object');
    const filter = s.filter === undefined || s.filter === '' ? 'all' : String(s.filter);
    if (!FILTERS.includes(filter)) throw bad(`Unknown filter "${filter.slice(0, 40)}"`);
    scope = { filter, q: String(s.q ?? '').trim().slice(0, 100), cat: String(s.cat ?? '').trim().slice(0, 40) };
  }
  return { action, ids, scope, dryRun: b.dryRun === true };
}

export function chunk(list, size = CHUNK) {
  const n = Math.max(1, Math.floor(size) || CHUNK), out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

// ---------- which selected products an action changes ----------
/**
 * sel = one row per selected product: { id, name, noindex, ts (hand-written title), ds, kw (keywords), alt_missing }.
 * Returns { affected: rows that really change, skipped: count that do not }.
 */
export function pickAffected(action, sel) {
  const rows = Array.isArray(sel) ? sel : [];
  const test = {
    reset_template: r => !!Number(r.ts) || !!Number(r.ds) || !!Number(r.kw),
    noindex: r => !Number(r.noindex),
    index: r => !!Number(r.noindex),
    alt_autofill: r => nz(r.alt_missing) > 0,
    recalculate: () => true
  }[action];
  if (!test) throw bad('Unknown action');
  const affected = rows.filter(test);
  return { affected, skipped: rows.length - affected.length };
}

/** What one product's change looks like in a dry run. */
export function changeText(action, r) {
  if (action === 'reset_template') {
    const parts = [];
    if (Number(r.ts)) parts.push('title'); if (Number(r.ds)) parts.push('description'); if (Number(r.kw)) parts.push('keywords');
    return parts.length ? `Hand-written ${parts.join(', ')} cleared; the template will be used` : 'Stored meta text cleared; the template will be used';
  }
  if (action === 'noindex') return 'Set to noindex (hidden from search engines)';
  if (action === 'index') return 'Set to index (visible to search engines)';
  if (action === 'alt_autofill') { const n = nz(r.alt_missing); return `${n} empty image alt text${n === 1 ? '' : 's'} will be filled`; }
  return 'Score and issues will be recalculated';
}

/** Dry-run answer: { dryRun:true, affected, samples:[{id,name,change}] (8 at most) }. */
export function dryRunOut(action, sel) {
  const { affected } = pickAffected(action, sel);
  return { dryRun: true, affected: affected.length, samples: affected.slice(0, 8).map(r => ({ id: r.id, name: String(r.name || ''), change: changeText(action, r) })) };
}

/** Empty alts of one product's images -> [{ id, alt }] to write (only images whose alt is empty). images = [{id, alt}] in gallery order. */
export function planAltFills(images, name, brand) {
  const list = (images || []).map(i => ({ id: i.id, alt: i.alt == null ? '' : String(i.alt) }));
  const after = autofillAlts(list, name, brand);
  const out = [];
  after.forEach((a, i) => { if (a.alt !== list[i].alt && a.alt) out.push({ id: list[i].id, alt: a.alt }); });
  return out;
}

// ---------- scoring a product from batch-loaded data ----------
/** Resolved title / description of a product from its template (used when nothing is hand-written). */
export function autoTexts(row, settings) {
  const vars = varsFor('product', { ...row, category: row.category_title ?? row.category }, settings);
  const t = f => settings?.templates?.product?.[f] ?? DEFAULT_TEMPLATES?.product?.[f] ?? '';
  return { title: renderTemplate(t('title'), vars, { max: 60 }), description: renderTemplate(t('description'), vars, { max: 155 }) };
}

const dupKey = t => String(t ?? '').trim().toLowerCase();
/**
 * Score of a product with no database access.
 * row = products row (+ category_title); meta = seo_meta row or {}; images = [{path|src, alt, width, height}];
 * dup = { titles: Map(text -> products with that stored meta_title), descs: Map(...) } (counts include the product itself).
 */
export function scoreProductRow(row, meta, images, settings, dup = {}) {
  const m = meta || {};
  const manual = manualFrom('product', row, m, { isAutoTitle, isAutoDesc });
  const auto = autoTexts(row, settings);
  const title = manual.metaTitle || auto.title, description = manual.metaDescription || auto.description;
  const bodyText = plain(row.body || row.description);
  const count = (map, text, own) => (text && map ? Math.max(0, (map.get(dupKey(text)) || 0) - (dupKey(own) === dupKey(text) ? 1 : 0)) : 0);
  const imgs = (images || []).map(i => ({ src: i.src ?? i.path, alt: i.alt || '', width: i.width || 0, height: i.height || 0 }));
  return scoreItem('product', {
    title, description, slug: row.slug, focusKeyword: manual.focusKeyword || m.focus_keyword || '', h1: String(row.name || ''), bodyText,
    wordCount: bodyText ? bodyText.split(' ').length : 0, images: imgs, price: row.price, stock: row.stock, brand: row.brand, gtin: row.gtin, mpn: row.part, noindex: !manual.robotsIndex
  }, {
    duplicateTitles: count(dup.titles, manual.metaTitle, row.meta_title),
    duplicateDescriptions: count(dup.descs, manual.metaDescription, row.meta_desc)
  });
}

/** [{ t, n }] rows of GROUP BY meta text -> Map(lower-case text -> n). */
export function dupMap(rows) {
  const map = new Map();
  for (const r of rows || []) { const k = dupKey(r.t); if (k) map.set(k, (map.get(k) || 0) + nz(r.n)); }
  return map;
}

/** Groups rows by one key: Map(value -> rows), order kept (for example image rows by product_id). */
export function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows || []) { const k = r[key]; if (!map.has(k)) map.set(k, []); map.get(k).push(r); }
  return map;
}

// ---------- dashboard ----------
export const ISSUE_LABELS = {
  title_length: 'Title length', title_unique: 'Title is unique', desc_length: 'Description length', desc_unique: 'Description is unique',
  body_words: 'Enough body text', body_duplicate: 'Original description text', has_image: 'Has an image', image_alt: 'Image alt text', image_size: 'Main image size',
  price: 'Price is set', stock: 'Stock status is set', brand: 'Brand is set', gtin_mpn: 'GTIN or part number', noindex: 'Can be indexed',
  kw_title: 'Focus keyword in title', kw_h1: 'Focus keyword in heading', kw_slug: 'Focus keyword in address', kw_desc: 'Focus keyword in description', kw_body: 'Focus keyword in text'
};

/** rows = [{ seo_issues }] -> [{ id, label, level, count, warns, fails }] for issues that are warn or fail, biggest first. level = 'fail' when any product fails it. */
export function aggregateIssues(rows) {
  const acc = new Map();
  for (const r of rows || []) {
    for (const i of jsonList(r?.seo_issues)) {
      if (!i || !i.id || (i.level !== 'warn' && i.level !== 'fail')) continue;
      const a = acc.get(i.id) || { id: i.id, label: ISSUE_LABELS[i.id] || i.id, level: 'warn', count: 0, warns: 0, fails: 0 };
      a.count++;
      if (i.level === 'fail') { a.fails++; a.level = 'fail'; } else a.warns++;
      acc.set(i.id, a);
    }
  }
  return [...acc.values()].sort((x, y) => y.count - x.count || x.id.localeCompare(y.id));
}

/**
 * rows = [{ id, t, d }] (hand-written title t / description d, '' when none).
 * -> { titles: groups sharing a title, descriptions: groups sharing a description, samples: 5 biggest groups }.
 */
export function groupDuplicates(rows, maxSamples = 5, maxIds = 20) {
  const groups = { title: new Map(), description: new Map() };
  const add = (kind, text, id) => {
    const k = dupKey(text);
    if (!k) return;
    const g = groups[kind].get(k) || { kind, text: String(text).trim(), ids: [] };
    g.ids.push(id);
    groups[kind].set(k, g);
  };
  for (const r of rows || []) { add('title', r.t, r.id); add('description', r.d, r.id); }
  const dups = kind => [...groups[kind].values()].filter(g => g.ids.length > 1);
  const t = dups('title'), d = dups('description');
  const samples = [...t, ...d].sort((a, b) => b.ids.length - a.ids.length || a.text.localeCompare(b.text)).slice(0, maxSamples)
    .map(g => ({ kind: g.kind, text: g.text, ids: g.ids.slice(0, maxIds) }));
  return { titles: t.length, descriptions: d.length, samples };
}

/** Counts of the brands list rows (see buildBrandRows): { total, indexed, thin, hidden }. */
export function brandStats(rows, min = MIN_BRAND_PRODUCTS) {
  const list = rows || [];
  return { total: list.length, indexed: list.filter(b => b.indexable).length, thin: list.filter(b => !b.hidden && b.products < min).length, hidden: list.filter(b => b.hidden).length };
}

/** Products (active ones with a picture, as [{ brand }]) -> number of brands that reach the sitemap: not hidden, at least `min` products. */
export function sitemapBrandCount(brands, products, min = MIN_BRAND_PRODUCTS) {
  const per = new Map();
  for (const p of products || []) { const s = brandSlug(p.brand); if (s) per.set(s, (per.get(s) || 0) + 1); }
  return (brands || []).filter(b => b.slug && !b.hidden && (per.get(b.slug) || 0) >= min).length;
}
