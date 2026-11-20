// Pure helpers for search-engine output (titles, descriptions, paging, structured data). No database, no request: easy to test.

export const NAME = 'AR Trade International';
export const SHORT = 'AR Trade';
/** Products per category page. Keep equal to PG in client/src/pages/Shop.jsx. */
export const PER_PAGE = 24;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENTITY = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&#x27;': "'" };
/** Plain one-line text from HTML: tags removed (also a tag whose closing > was saved as &gt;, or an attribute fragment left behind such as class=”x”&gt;), common entities decoded once, spaces collapsed. Callers escape it again for HTML. */
export const plain = h => String(h || '').replace(/<[a-z][^<>]*?&gt;/gi, ' ').replace(/\b(?:class|id|style)\s*=\s*[“”"'][^“”"'<>]*[“”"'](?:&gt;|>)/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|#39|#x27);/gi, m => ENTITY[m.toLowerCase()]).replace(/\s+/g, ' ').trim();
/** Cuts at a word boundary, never inside a word. */
export const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ''));
export const taka = n => '৳' + Math.round(Number(n) || 0).toLocaleString('en-US');
const oneLine = s => String(s || '').replace(/\s+/g, ' ').trim();

/** "{Name} – Price in BD | AR Trade" within 60 characters. A product without a price never claims one. */
export function productTitle(name, priced) {
  const n = oneLine(name);
  const options = priced ? [`${n} – Price in BD | ${SHORT}`, `${n} – Price in BD`, `${n} | ${SHORT}`] : [`${n} | ${SHORT}, Dhaka`, `${n} | ${SHORT}`];
  return options.find(t => t.length <= 60) || clip(n, 60);
}

/** Meta description of at most 155 characters: what it is, the price (when there is one), and the real benefits. */
export function productDescription({ name, price, cod = true }) {
  const n = oneLine(name), priced = Number(price) > 0;
  const tail = priced ? ` Genuine product, fast delivery in Dhaka${cod ? ' and cash on delivery' : ''}.` : ' Genuine product with fast delivery in Dhaka. Call or message us for the latest price.';
  const make = nm => (priced ? `Buy ${nm} at ${taka(price)} in Bangladesh.` : `${nm} from ${NAME}, Dhaka.`) + tail;
  let d = make(n);
  if (d.length > 155) d = make(clip(n, Math.max(10, n.length - (d.length - 155) - 1)));
  return d.length > 155 ? clip(d, 155) : d;
}

/** The catalogue import stored generated titles and descriptions; a value written by hand is kept, a generated one is replaced. */
export const isAutoTitle = t => !t || /\|\s*AR Trade( International)?\s*$/i.test(t);
export const isAutoDesc = d => !d || /Genuine, fast delivery\.\s*$/i.test(d);

// ---------- paging ----------
export const pagesOf = total => Math.max(1, Math.ceil(total / PER_PAGE));
/** `?page=` value -> { page, bad }. Anything that is not a positive whole number is "bad" (it is redirected to the plain address). */
export function parsePage(v) {
  if (v === undefined) return { page: 1, bad: false };
  const s = String(v);
  if (!/^\d{1,6}$/.test(s)) return { page: 1, bad: true };
  const n = Number(s);
  return { page: Math.max(1, n), bad: n < 1 };
}
export const pageUrl = (path, n) => (n > 1 ? `${path}?page=${n}` : path);
/** Page numbers to show: first, last, current and two either side, with '…' for gaps. */
export function pageWindow(page, pages) {
  const keep = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter(n => n >= 1 && n <= pages));
  const out = [];
  let last = 0;
  for (const n of [...keep].sort((a, b) => a - b)) { if (n - last > 1) out.push('…'); out.push(n); last = n; }
  return out;
}
/** Title of a list page: page 1 keeps the full title, later pages say which page it is. */
export function listTitle(page, mains, short) {
  if (page <= 1) return mains.find(t => t.length <= 60) || clip(mains[mains.length - 1], 60);
  const t = `${short} – Page ${page} | ${SHORT}`;
  return t.length <= 60 ? t : `${clip(short, 60 - ` – Page ${page} | ${SHORT}`.length)} – Page ${page} | ${SHORT}`;
}

// ---------- structured data ----------
export const breadcrumbLd = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }))
});
/** A category page: the page itself, its position in the site and the products listed on it. */
export function collectionLd({ name, url, description, total, offset, items }) {
  if (!items.length) return { '@context': 'https://schema.org', '@type': 'CollectionPage', name, url, description }; // an empty ItemList is a structured data error: leave it out
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name, url, description,
    mainEntity: {
      '@type': 'ItemList', numberOfItems: total,
      itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: offset + i + 1, url: it.url, name: it.name }))
    }
  };
}

// ---------- phase 1: settings, overrides, availability, brands (all pure) ----------
const hasText = v => v !== undefined && v !== null && String(v).trim() !== '';
/** First value that holds text (trimmed, one line); '' when none. */
export const pickText = (...vals) => { const v = vals.find(hasText); return v === undefined ? '' : oneLine(v); };
/** Same rule as brands.js: lower case, non-alphanumeric -> '-', no leading/trailing '-'. */
export const brandSlug = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/** Products of one brand (rows with .brand), same order. */
export const brandProducts = (rows, slug) => (slug ? (rows || []).filter(r => brandSlug(r.brand) === slug) : []);

/**
 * A template-made text, only when the settings template was changed from the built-in default (so an untouched site keeps the
 * built-in output exactly). `always` (brand pages, which have no older output) uses the template whenever it exists.
 * render / vars are injected (seoTemplate.js); any failure or empty result gives ''.
 */
export function customText({ templates, defaults, type, field, render, vars, max, always = false }) {
  try {
    const pick = t => (field === 'title' ? t?.title : (t?.description ?? t?.desc));
    const raw = pick(templates?.[type]);
    if (!hasText(raw) || typeof render !== 'function') return '';
    if (!always && String(raw) === String(pick(defaults?.[type]) ?? '')) return '';
    const out = render(String(raw), typeof vars === 'function' ? vars() : vars, { max });
    return hasText(out) ? oneLine(out) : '';
  } catch { return ''; }
}
/** Page 2+ of a listing: the title gets " – Page N" and still fits the limit. */
export const pagedTitle = (title, page, max = 60) => { if (page <= 1) return title; const s = ` – Page ${page}`; return clip(title, max - s.length) + s; };

/** https only; anything else is ignored. */
export function cleanCanonical(u) {
  const s = String(u ?? '').trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s)) return '';
  try { return new URL(s).protocol === 'https:' ? s : ''; } catch { return ''; }
}
const cleanImage = u => { const s = String(u ?? '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(s) || /^\/[^\s"'<>]*$/.test(s) ? s : ''; };
const flag = v => (v === undefined || v === null || v === '' ? undefined : !(v === 0 || v === '0' || v === false));

/** Applies a seo_meta row (hand-written values win) to a page's meta object. Missing / empty fields change nothing. */
export function applySeoMeta(m, meta, { forceNoindex = false } = {}) {
  const o = { ...m }, x = meta || {};
  if (hasText(x.meta_title)) o.title = oneLine(x.meta_title);
  if (hasText(x.meta_description)) o.desc = oneLine(x.meta_description);
  if (hasText(x.og_title)) o.ogTitle = oneLine(x.og_title);
  if (hasText(x.og_description)) o.ogDesc = oneLine(x.og_description);
  if (cleanImage(x.og_image)) o.ogImage = cleanImage(x.og_image);
  if (hasText(x.twitter_title)) o.twTitle = oneLine(x.twitter_title);
  if (hasText(x.twitter_description)) o.twDesc = oneLine(x.twitter_description);
  const c = cleanCanonical(x.canonical_url);
  if (c) o.canonical = c;
  const ri = flag(x.robots_index), rf = flag(x.robots_follow);
  if (ri === false || forceNoindex) { o.noindex = true; o.follow = rf !== false; }
  else if (rf === false) { o.nofollow = true; if (o.noindex) o.follow = false; }
  else if (rf === true && o.noindex) o.follow = true;
  return o;
}

// ---------- product schema ----------
const SCHEMA = 'https://schema.org/';
/** stock_status ('auto' | in_stock | out_of_stock | preorder | backorder) -> availability URL; auto = stock > 0 as before. */
export function availabilityOf(x) {
  const s = { in_stock: 'InStock', out_of_stock: 'OutOfStock', preorder: 'PreOrder', backorder: 'BackOrder' }[String(x?.stock_status || '').toLowerCase()];
  if (s) return SCHEMA + s;
  if (x?.preorder) return SCHEMA + 'PreOrder';
  return SCHEMA + (x?.stock > 0 ? 'InStock' : 'OutOfStock');
}
/** Plain-HTML stock sentence, equal to the availability above. */
export function stockText(x) {
  const a = availabilityOf(x).slice(SCHEMA.length);
  return { InStock: 'In stock.', OutOfStock: 'Currently out of stock.', PreOrder: 'Available for pre-order.', BackOrder: 'Available on backorder.' }[a];
}
export const conditionOf = c => SCHEMA + ({ refurbished: 'RefurbishedCondition', used: 'UsedCondition' }[String(c || '').toLowerCase()] || 'NewCondition');
const pad = n => String(n).padStart(2, '0');
/** A DATE column (Date or 'YYYY-MM-DD...') -> 'YYYY-MM-DD', '' when it is not a real date. */
export function dayOf(v) {
  let s = '';
  if (v instanceof Date) s = Number.isNaN(v.getTime()) ? '' : `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  else if (/^\d{4}-\d{2}-\d{2}/.test(String(v ?? ''))) s = String(v).slice(0, 10);
  if (!s) return '';
  const d = new Date(s + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? '' : s;
}
/** priceValidUntil: sale_ends when set and today or later, else the given fallback. */
export function validUntil(saleEnds, fallback, today = dayOf(new Date())) { const d = dayOf(saleEnds); return d && d >= today ? d : fallback; }

const OV_TEXT = v => { const s = plain(typeof v === 'object' && v ? v.name : v); return s && s.length <= 120 ? s : ''; };
/** schema_overrides JSON (object or string) -> only brand, mpn, gtin13, color, model, validated. Everything else is dropped. */
export function productOverrides(raw) {
  let o = raw;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { return {}; } }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out = {};
  for (const k of ['brand', 'mpn', 'color', 'model']) { const v = OV_TEXT(o[k]); if (v) out[k] = v; }
  if (/^\d{13}$/.test(String(o.gtin13 ?? '').trim())) out.gtin13 = String(o.gtin13).trim();
  return out;
}
/** Writes the validated overrides into a Product object. */
export function applyProductOverrides(prod, raw) {
  const ov = productOverrides(raw);
  if (ov.brand) prod.brand = { '@type': 'Brand', name: ov.brand };
  for (const k of ['mpn', 'color', 'model']) if (ov[k]) prod[k] = ov[k];
  if (ov.gtin13) { for (const k of ['gtin8', 'gtin12', 'gtin14']) delete prod[k]; prod.gtin13 = ov.gtin13; }
  return prod;
}
/** seo_meta.faq (JSON string or array of {q,a}) -> clean [{q,a}] (30 at most). */
export function parseFaq(raw) {
  let a = raw;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return []; } }
  return (Array.isArray(a) ? a : []).filter(f => f && hasText(f.q) && hasText(f.a)).slice(0, 30).map(f => ({ q: plain(f.q), a: plain(f.a) }));
}

// ---------- redirects (table seo_redirects, phase 2) ----------
const REDIRECT_CODES = [301, 302, 307, 308];
/** Follows source -> target while the target is itself a source (at most `hops` extra hops). `get(src)` returns {target, code} | undefined.
 *  null when there is no redirect, it points at itself, or it loops. */
export function followRedirect(source, get, hops = 3) {
  const first = get(source);
  if (!first || !first.target) return null;
  const seen = new Set([source]);
  let cur = { target: String(first.target), code: REDIRECT_CODES.includes(Number(first.code)) ? Number(first.code) : 301 };
  for (let i = 0; ; i++) {
    if (seen.has(cur.target)) return null; // self-target or loop
    if (i >= hops || !cur.target.startsWith('/')) return cur;
    seen.add(cur.target);
    const next = get(cur.target);
    if (!next || !next.target) return cur;
    cur = { target: String(next.target), code: REDIRECT_CODES.includes(Number(next.code)) ? Number(next.code) : cur.code };
  }
}
/** A 30 s memo in front of `fetch(source) -> {target, code} | null | undefined` (misses are remembered too). `clear()` empties it. */
export function makeRedirectLookup({ fetch, ttl = 30000, max = 5000, now = Date.now, hops = 3 }) {
  let map = new Map(), t = now();
  const get = async src => {
    if (now() - t >= ttl || map.size > max) { map = new Map(); t = now(); }
    if (!map.has(src)) map.set(src, (await fetch(src)) || null);
    return map.get(src);
  };
  return {
    async lookup(source) {
      const seen = new Map();
      let cur = source;
      for (let i = 0; i <= hops; i++) { // preload every hop, then resolve synchronously
        if (seen.has(cur)) break;
        const r = await get(cur);
        seen.set(cur, r || undefined);
        if (!r || !String(r.target || '').startsWith('/')) break;
        cur = r.target;
      }
      return followRedirect(source, s => seen.get(s), hops);
    },
    clear() { map = new Map(); t = now(); }
  };
}
/** A stored target as a Location value: absolute https kept, a path made safe for the header. */
export const redirectTarget = t => { const s = String(t || ''); return /^https:\/\//i.test(s) ? s : (() => { try { return encodeURI(decodeURI(s)); } catch { return encodeURI(s); } })(); };

// ---------- sitemap / feed cache (pure; the clock is injectable) ----------
/**
 * Keeps built documents ({ body, count, meta }) until markDirty() is called or ttlMs passes. A rebuild is lazy (on the next get) and one
 * in-flight build per key is shared by concurrent callers. A build that started before markDirty() is stored but stays stale.
 */
export function makeSitemapCache({ now = Date.now, ttlMs = 600000 } = {}) {
  let version = 0;
  const entries = new Map(), flight = new Map();
  const valid = e => !!e && e.version === version && now() - e.at < ttlMs;
  return {
    ttlMs,
    markDirty() { version++; },
    peek: key => entries.get(key),
    isValid: key => valid(entries.get(key)),
    get(key, build, force = false) {
      const e = entries.get(key);
      if (!force && valid(e)) return Promise.resolve(e);
      if (flight.has(key)) return flight.get(key);
      const v = version;
      const p = (async () => {
        const r = await build();
        const ent = { body: r.body, count: r.count ?? 0, meta: r.meta, at: now(), version: v };
        entries.set(key, ent);
        return ent;
      })().finally(() => flight.delete(key));
      flight.set(key, p);
      return p;
    }
  };
}
