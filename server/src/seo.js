// Search-engine support: robots.txt, sitemap.xml and per-page <title>/meta/JSON-LD injected into the HTML shell,
// so crawlers (and link previews) see the real product data without having to run the React app.
import { hasPicture, published } from './productImages.js';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db.js';
import { mergeDelivery } from './delivery.js';
import { logNotFound, startNotFoundFlush } from './notFoundLog.js';
import { parseJson, wrap } from './util.js';
import { legacySlug, productIdOf, productPath, productSlug } from './slug.js';

import { makeSitemapCache, makeRedirectLookup, redirectTarget, NAME, PER_PAGE, SHORT, applyProductOverrides, applySeoMeta, availabilityOf, brandProducts, brandSlug, breadcrumbLd, conditionOf, customText, pagedTitle, parseFaq, pickText, validUntil, clip, collectionLd, esc, isAutoDesc, isAutoTitle, listTitle, pageUrl, pagesOf, parsePage, plain, productDescription, productTitle } from './seoHelpers.js';
import { faqDl, faqBlock, linkBlock, link, listFallback, notFoundFallback, pageFallback, policyBlocks, productFallback, productLine, textBlock } from './seoFallback.js';
import { buildFeed } from './merchantFeed.js';
import { mergeSeoSettings, validateRobotsTxt } from './seoSettings.js';
import { DEFAULT_TEMPLATES, renderTemplate, varsFor } from './seoTemplate.js';
import { indexNowKeyOf, analyticsSnippet, NO_ANALYTICS, imageEntry, imageLd, CHILD_SITEMAPS, robotsFor, verifyTags, aggregateLd, faqLd, heroImage, isVariantQuery, latestDay, offerExtras, policyMeta, productExtras, reviewsLd, robotsTxt, sameAsOf, serviceLd, sitemapIndex, storeLd, urlEntry, urlset } from './seoSchema.js';
const baseUrl = req => (process.env.SITE_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const LOGO = '/api/uploads/site/artrade-logo.png';
const money = v => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? String(Number(v)) : null);
/** Offers stay valid to the end of the year (Google asks for priceValidUntil); in December the next year is used. */
const priceUntil = () => { const d = new Date(); return `${d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()}-12-31`; };
const abs = (base, u) => (!u ? '' : /^https?:\/\//.test(u) ? u : base + u);

/** Public content pages: their address is forced to lower case and no trailing slash. Tokens (reset, prefs) and the apps are not touched. */
const PUBLIC_PAGE = /^\/(shop|brand|product|blog|services|about|contact|faq|offers|careers|policy)(\/|$)/i;
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } }; // a malformed %-escape in the address must be a 404, not a 500
const search = req => { const q = req.originalUrl.indexOf('?'); return q < 0 ? '' : req.originalUrl.slice(q); };
const PRIVATE = /^\/(cart|checkout|success|account|login|track|wishlist|compare|reset|prefs|review|admin|hub|email|field)(\/|$)/;
const STATIC = {
  '/': ['AR Trade International | Printers, Toner & Copiers in Dhaka', 'Buy genuine printer toner, ink, copiers, printers and computer accessories online in Bangladesh. Printer servicing and fast delivery in Dhaka.'],
  '/shop': ['Toner, Ink, Printers & Copiers in Bangladesh | AR Trade', 'Browse genuine toner cartridges, ink, printers, photocopiers and parts with best prices in Bangladesh. Fast delivery in Dhaka.'],
  '/services': ['Printer & Photocopier Servicing in Dhaka | AR Trade', 'Printer, photocopier and office-machine repair, servicing and maintenance contracts in Dhaka, Bangladesh.'],
  '/about': ['About AR Trade International — Since 2011, Dhaka', 'AR Trade International supplies genuine toner, printers, copiers and office equipment and offers servicing in Dhaka, Bangladesh since 2011.'],
  '/contact': ['Contact AR Trade International — Santinagar, Dhaka', 'Call, WhatsApp, email or visit AR Trade International at 159 Santinagar, Dhaka-1217 for quotes, orders and printer servicing.'],
  '/faq': ['Frequently Asked Questions | AR Trade International', 'Answers about ordering, delivery, payment, warranty and servicing at AR Trade International.'],
  '/offers': ['Offers & Deals on Toner and Printers | AR Trade International', 'Current offers and discounts on genuine toner, ink, printers and copiers in Bangladesh.'],
  '/blog': ['Blog — Printer, Toner & Office Tips | AR Trade', 'Guides and articles on printers, toner cartridges, copiers and office equipment from AR Trade International.'],
  '/careers': ['Careers at AR Trade International', 'Open positions and internships at AR Trade International, Dhaka.']
};

/** Categories and published products for the plain-HTML pages. Kept for 30 seconds: crawlers ask for many pages in a row. */
let memo = { t: 0, cats: [], prods: [], S: {} };
let metaMissing = 0;
/** A brand page with fewer products than this is thin content: noindex,follow and left out of the sitemap (the data has stray model names in the brand field). */
const MIN_BRAND_PRODUCTS = 3;

/** Admin routes call this after saving SEO settings, brands or products: the next request reads everything again. */
export function bustSeo() { markSitemapDirty(); memo = { t: 0, cats: [], prods: [], S: {} }; metaMissing = 0; redirectMissing = 0; redirects.clear(); }
let redirectMissing = 0;
/** One seo_redirects row for a source path ({target, code}); null when none, or when the table does not exist (yet). */
async function redirectRow(source) {
  if (Date.now() < redirectMissing) return null;
  try { const [[r]] = await pool.query('SELECT target, code FROM seo_redirects WHERE source = ? LIMIT 1', [source]); return r || null; }
  catch (e) { if (e?.code === 'ER_NO_SUCH_TABLE') redirectMissing = Date.now() + 30000; return null; }
}
const redirects = makeRedirectLookup({ fetch: redirectRow });
/** One seo_meta row ({} when none, or when the table does not exist yet). */
async function seoMeta(type, id) {
  if (Date.now() < metaMissing) return {};
  try { const [[r]] = await pool.query('SELECT * FROM seo_meta WHERE entity_type = ? AND entity_id = ? LIMIT 1', [type, String(id)]); return r || {}; }
  catch (e) { if (e?.code === 'ER_NO_SUCH_TABLE') metaMissing = Date.now() + 30000; return {}; }
}
/** settings k='seo' merged with the defaults; {} when missing or broken. */
async function loadSeoSettings() {
  try { return mergeSeoSettings(parseJson((await pool.query('SELECT v FROM settings WHERE k = "seo"'))[0][0]?.v) || {}) || {}; } catch { return {}; }
}
async function catalog() {
  if (Date.now() - memo.t < 30000) return memo;
  const [cats] = await pool.query('SELECT id, title, description FROM categories WHERE hidden = 0 ORDER BY sort_order');
  const [rows] = await pool.query('SELECT id, category_id, name, slug, img, price, stock, popular, brand FROM products WHERE active = 1 ORDER BY popular DESC, id DESC');
  memo = { t: Date.now(), cats, prods: published(rows), S: await loadSeoSettings() };
  return memo;
}

// ---------- sitemap / feed cache ----------
const cache = makeSitemapCache();
let lastBase = '';
const defaultBase = () => (process.env.SITE_URL || lastBase || 'https://artradeinternational.com').replace(/\/$/, '');
/** The catalogue changed: the next sitemap / feed request rebuilds. bustSeo() calls it. */
export function markSitemapDirty() { cache.markDirty(); }

const policiesOf = async () => (parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {}).policies || [];
/** The entries of each child sitemap; lastmod is given only where a real date exists. */
const KIDS = {
  '/sitemap-products.xml': async base => {
    const [allProds] = await pool.query('SELECT id, name, slug, img, DATE_FORMAT(updated_at, "%Y-%m-%d") lm FROM products WHERE active = 1 ORDER BY id DESC');
    const prods = published(allProds); // a product whose picture is missing is not published, so it is not offered to search engines either
    const alts = new Map(); // alt text of each product's first gallery picture
    try { for (const r of (await pool.query('SELECT product_id, alt FROM product_images ORDER BY product_id, position'))[0]) if (!alts.has(r.product_id)) alts.set(r.product_id, r.alt); } catch { /* no alt column yet */ }
    return prods.map(p => urlEntry(base + productPath(p), '0.7', p.img ? imageEntry(abs(base, p.img), alts.get(p.id)) : '', p.lm));
  },
  '/sitemap-brands.xml': async base => {
    const count = new Map();
    for (const p of (await catalog()).prods) { const s = brandSlug(p.brand); if (s) count.set(s, (count.get(s) || 0) + 1); }
    let rows = [];
    try { [rows] = await pool.query('SELECT slug FROM brands WHERE hidden = 0'); } catch { rows = []; }
    return rows.filter(b => b.slug && (count.get(b.slug) || 0) >= MIN_BRAND_PRODUCTS).map(b => urlEntry(base + '/brand/' + b.slug, '0.6')); // a brand with only one or two products is a thin page: not offered to search engines
  },
  '/sitemap-categories.xml': async base => (await pool.query('SELECT id FROM categories WHERE hidden = 0'))[0].map(c => urlEntry(base + '/shop/' + c.id, '0.8')),
  '/sitemap-blog.xml': async base => (await pool.query('SELECT slug, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") d FROM blog_posts WHERE status = "Published" AND noindex = 0'))[0].map(p => urlEntry(base + '/blog/' + p.slug, '0.6', '', p.d)),
  '/sitemap-pages.xml': async base => {
    const [pages] = await pool.query('SELECT slug, DATE_FORMAT(updated_at, "%Y-%m-%d") d FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0');
    return [
      ...Object.keys(STATIC).map(p => urlEntry(base + p, p === '/' ? '1.0' : '0.8')),
      ...pages.map(p => urlEntry(base + '/services/' + p.slug, '0.7', '', p.d)),
      ...(await policiesOf()).filter(x => x.k && x.t).map(x => urlEntry(base + '/policy/' + x.k, '0.4'))
    ];
  }
};
async function buildIndex(base) {
  const [[pm]] = await pool.query('SELECT DATE_FORMAT(MAX(updated_at), "%Y-%m-%d") d FROM products WHERE active = 1');
  const [[bm]] = await pool.query('SELECT DATE_FORMAT(MAX(COALESCE(updated_at, published)), "%Y-%m-%d") d FROM blog_posts WHERE status = "Published" AND noindex = 0');
  const [[gm]] = await pool.query('SELECT DATE_FORMAT(MAX(updated_at), "%Y-%m-%d") d FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0');
  const lm = { '/sitemap-products.xml': pm?.d, '/sitemap-blog.xml': bm?.d, '/sitemap-pages.xml': latestDay([gm?.d || '']) };
  return { body: sitemapIndex(base, CHILD_SITEMAPS.map(path => ({ path, lm: lm[path] || '' }))), count: CHILD_SITEMAPS.length };
}
/** One cached sitemap document ({ body, count, at }); path '/sitemap.xml' is the index. */
function sitemapDoc(base, path, force = false) {
  return cache.get(base + path, async () => {
    if (path === '/sitemap.xml') return buildIndex(base);
    const entries = await KIDS[path](base);
    return { body: urlset(entries), count: entries.length };
  }, force);
}
const COUNT_KEY = { products: '/sitemap-products.xml', categories: '/sitemap-categories.xml', blog: '/sitemap-blog.xml', pages: '/sitemap-pages.xml', brands: '/sitemap-brands.xml' };
const SITEMAP_PATHS = ['/sitemap.xml', ...CHILD_SITEMAPS];
/** Forces a rebuild of the index and every child sitemap; returns the status. */
export async function rebuildSitemaps() {
  const base = defaultBase();
  await Promise.all(SITEMAP_PATHS.map(p => sitemapDoc(base, p, true)));
  return sitemapStatus();
}
/** Every public page address listed in the child sitemaps (absolute, unique, no image entries): what IndexNow "submit all" sends. */
export async function sitemapUrls() {
  const base = defaultBase();
  const docs = await Promise.all(CHILD_SITEMAPS.map(p => sitemapDoc(base, p)));
  const out = new Set();
  for (const d of docs) for (const m of String(d.body || '').matchAll(/<loc>([^<]+)<\/loc>/g)) out.add(m[1].replace(/&amp;/g, '&'));
  return [...out];
}
/** { generatedAt (ISO | null), dirty, ttlMs, counts }. Builds once when nothing was built yet so the counts are real. */
export async function sitemapStatus() {
  const base = defaultBase();
  const missing = SITEMAP_PATHS.filter(p => !cache.peek(base + p)); // never built since the server started: build it once so the counts are real (a dirty one keeps its last known count)
  if (missing.length) await Promise.all(missing.map(p => sitemapDoc(base, p)));
  const es = SITEMAP_PATHS.map(p => cache.peek(base + p));
  const at = Math.max(0, ...es.map(e => e?.at || 0));
  const counts = {};
  for (const [k, p] of Object.entries(COUNT_KEY)) counts[k] = cache.peek(base + p)?.count || 0;
  return { generatedAt: at ? new Date(at).toISOString() : null, dirty: SITEMAP_PATHS.some(p => !cache.isValid(base + p)), ttlMs: cache.ttlMs, counts };
}

// ---------- Merchant Center feed ----------
/** The feed built from the live catalogue: { xml, items, skipped }. A picture file that is missing counts as no image (the product is skipped). */
async function loadFeed(base) {
  const [rows] = await pool.query('SELECT * FROM products WHERE active = 1 ORDER BY id');
  const gal = new Map();
  try { for (const r of (await pool.query('SELECT product_id, path FROM product_images ORDER BY product_id, position'))[0]) { const a = gal.get(r.product_id) || []; if (a.length < 10 && r.path && hasPicture(r.path)) { a.push(r.path); gal.set(r.product_id, a); } } } catch { /* no gallery table */ }
  const products = rows.map(r => ({ ...r, img: hasPicture(r.img) ? r.img : '', images: gal.get(r.id) || [] }));
  const [categories] = await pool.query('SELECT id, title FROM categories WHERE hidden = 0');
  const site = parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
  const { S } = await catalog();
  return buildFeed({ base, site, settings: S, products, categories, now: new Date() });
}
const feedBase = (S, base) => String(S?.general?.preferredDomain || base).replace(/\/$/, '');
function feedDoc(base, force = false) {
  return catalog().then(({ S }) => { const b = feedBase(S, base); return cache.get(b + '|feed', async () => { const r = await loadFeed(b); return { body: r.xml, count: r.items.length, meta: { items: r.items, skipped: r.skipped } }; }, force); });
}
/** { enabled, items, skipped:[{reason,count}], generatedAt } of the (cached) feed. */
export async function feedStatus() {
  const { S } = await catalog();
  const e = await feedDoc(defaultBase());
  return { enabled: S.flags?.merchantFeed === true, items: e.count, skipped: e.meta.skipped, generatedAt: new Date(e.at).toISOString() };
}
/** The first `limit` feed items as plain objects. */
export async function feedPreview(limit = 20) {
  const e = await feedDoc(defaultBase());
  return e.meta.items.slice(0, Math.max(0, Math.floor(Number(limit)) || 0));
}

let shell = { t: 0, html: '' };
function template(dist) {
  const f = path.join(dist, 'index.html');
  const t = fs.statSync(f).mtimeMs;
  if (t !== shell.t) shell = { t, html: fs.readFileSync(f, 'utf8') };
  return shell.html;
}

const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// the plain-HTML copy is invisible to people (React replaces it at start-up) but readable by crawlers that do not run JavaScript
const FB_CSS = '<style>#root>.seo-fb{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}</style>';

/** The head values of a page (what inject writes), resolved the same way for a real request and for previewMeta. */
export function headFields(base, m) {
  const url = base + m.path, desc = clip(m.desc, 160); // Google shows about 160 characters
  const ogT = m.ogTitle || m.title, ogD = m.ogDesc ? clip(m.ogDesc, 200) : desc, ogI = m.ogImage || m.image;
  return {
    title: m.title, description: desc,
    canonical: m.noindex && !m.canonical ? '' : m.canonical || url,
    robots: m.noindex ? (m.follow ? 'noindex, follow' : 'noindex, nofollow') : m.nofollow ? 'index, nofollow, max-image-preview:large' : 'index, follow, max-image-preview:large',
    og: { title: ogT, description: ogD, image: ogI ? abs(base, ogI) : '' },
    twitter: { title: m.twTitle || ogT, description: m.twDesc ? clip(m.twDesc, 200) : ogD }
  };
}

/** The analytics loader (GA4 / GTM) for a page: only an indexable, public, existing page gets one; '' otherwise. */
export function analyticsFor(m, status = 200) {
  if (status !== 200 || m.noindex || NO_ANALYTICS.test(m.path || '')) return '';
  return analyticsSnippet(m.verification);
}

export function inject(html, base, m, status = 200) {
  const url = base + m.path;
  const h = headFields(base, m);
  m = { ...m, desc: h.description };
  const ogT = h.og.title, ogD = h.og.description, ogI = m.ogImage || m.image;
  const tags = [
    `<meta name="description" content="${esc(m.desc)}">`,
    m.keywords ? `<meta name="keywords" content="${esc(m.keywords)}">` : '',
    `<meta name="robots" content="${h.robots}">`,
    ...verifyTags(m.verification),
    h.canonical ? `<link rel="canonical" href="${esc(h.canonical)}">` : '',
    m.prev ? `<link rel="prev" href="${esc(m.prev)}">` : '', m.next ? `<link rel="next" href="${esc(m.next)}">` : '',
    m.preload ? `<link rel="preload" as="image" href="${esc(abs(base, m.preload))}" fetchpriority="high">` : '', // the product picture is a CSS background, so the browser would find it late
    `<meta property="og:site_name" content="${NAME}">`, `<meta property="og:type" content="${m.type || 'website'}">`,
    `<meta property="og:title" content="${esc(ogT)}">`, `<meta property="og:description" content="${esc(ogD)}">`, `<meta property="og:url" content="${esc(url)}">`,
    ogI ? `<meta property="og:image" content="${esc(abs(base, ogI))}">` : '',
    ogI && m.imageAlt && !m.ogImage ? `<meta property="og:image:alt" content="${esc(m.imageAlt)}">` : '', // only the page's own picture: its alt text does not describe a hand-picked share image
    `<meta name="twitter:card" content="${ogI ? 'summary_large_image' : 'summary'}">`, `<meta name="twitter:title" content="${esc(h.twitter.title)}">`, `<meta name="twitter:description" content="${esc(h.twitter.description)}">`,
    ogI ? `<meta name="twitter:image" content="${esc(abs(base, ogI))}">` : '',
    m.fallback ? FB_CSS : '',
    ...(m.ld || []).map(ld),
    analyticsFor(m, status)
  ].filter(Boolean).join('\n');
  // the shell carries a generic description: remove it, the page has its own (two descriptions make Google pick one)
  let out = html.replace(/<meta name="description"[^>]*>\s*/g, '').replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`).replace('</head>', tags + '\n</head>');
  if (m.fallback) out = out.replace('<div id="root"></div>', `<div id="root">${m.fallback}</div>`);
  return out;
}

export function mountSeo(app, dist) {
  app.get('/robots.txt', wrap(async (req, res) => { const { S } = await catalog().catch(() => ({ S: {} })); res.type('text/plain').send(robotsFor(baseUrl(req), S.robots, validateRobotsTxt)); }));

  // /sitemap.xml is an index of the child sitemaps; every document is cached (see makeSitemapCache) until markSitemapDirty() or 10 minutes
  const sendCached = (res, ent, type) => res.set('Last-Modified', new Date(ent.at).toUTCString()).set('Cache-Control', 'public, max-age=300').type(type).send(ent.body);
  app.get('/sitemap.xml', wrap(async (req, res) => { const base = baseUrl(req); lastBase = base; sendCached(res, await sitemapDoc(base, '/sitemap.xml'), 'application/xml'); }));
  for (const path of CHILD_SITEMAPS) app.get(path, wrap(async (req, res) => { const base = baseUrl(req); lastBase = base; sendCached(res, await sitemapDoc(base, path), 'application/xml'); }));

  // Google Merchant Center feed: 404 (normal not-found handling) until the merchantFeed flag is switched on
  app.get('/feeds/google-merchant.xml', async (req, res, next) => {
    try {
      const { S } = await catalog();
      if (S.flags?.merchantFeed !== true) return next();
      const base = baseUrl(req); lastBase = base;
      sendCached(res, await feedDoc(base), 'application/xml; charset=utf-8');
    } catch (e) { next(e); }
  });

  // IndexNow key file: /<key>.txt answers with exactly the key; any other .txt path falls through
  app.get(/^\/([a-f0-9]{32})\.txt$/, async (req, res, next) => {
    try {
      const k = indexNowKeyOf((await catalog().catch(() => ({ S: {} }))).S);
      if (k && req.params[0] === k) return res.type('text/plain').send(k);
      next();
    } catch (e) { next(e); }
  });
  // the HTML shell for every non-API page, with the right meta for the URL
  app.get(/^(?!\/api).*/, wrap(async (req, res) => {
    const base = baseUrl(req);
    const p = req.path.replace(/\/+$/, '') || '/';
    // one address per page: lower case, no trailing slash (a second spelling would be a duplicate page for search engines)
    const shown = dec(p);
    if (PUBLIC_PAGE.test(shown) && shown !== shown.toLowerCase()) return res.redirect(301, encodeURI(shown.toLowerCase()) + search(req));
    if (PUBLIC_PAGE.test(req.path) && req.path.length > 1 && req.path.endsWith('/')) return res.redirect(301, p + search(req));
    // admin-managed redirects (old product / blog / page addresses); any failure means "no redirect"
    const hit = await redirects.lookup(shown).catch(() => null);
    if (hit) {
      pool.query('UPDATE seo_redirects SET hits = hits + 1, last_hit = NOW() WHERE source = ?', [shown]).catch(() => {}); // not awaited, errors ignored
      return res.redirect(hit.code, redirectTarget(hit.target));
    }
    const R = await resolveMeta({ base, p, query: req.query, qs: search(req) });
    if (R.redirect) return res.redirect(301, R.redirect);
    if (R.status === 404 && req.method === 'GET') { logNotFound(req.path, req.get('referer')); startNotFoundFlush(pool); } // 404 monitor (admin > SEO > 404s); the flusher starts on the first 404
    res.status(R.status).type('html').send(inject(template(dist), base, R.m, R.status));
  }));
}

/** Everything the page head needs for one URL (shared by the request handler and previewMeta). Writes nothing.
 *  Returns { m, status } or { redirect } (a 301 target the handler follows). */
async function resolveMeta({ base, p, query, qs }) {
    let m = null, status = 200;
    const site = parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
    const { cats, prods, S } = await catalog();
    // storefront content (FAQs, policies, social links, hero slides) and the Store block that home and contact both carry
    const c = parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {};
    const org = storeLd({ base, site, sameAs: sameAsOf(c.social) });
    // a text made from a template the owner changed in the SEO settings (an untouched default gives '' so the built-in text is used)
    const tpl = (type, field, entity, max, always) => customText({ templates: S.templates, defaults: DEFAULT_TEMPLATES, type, field, render: renderTemplate, vars: () => varsFor(type, entity, S), max, always });
    const faqOf = meta => { const f = parseFaq(meta?.faq); return { f, ld: f.length ? faqLd(f) : null, html: faqDl(f) }; };

    /** A category / brand / all-products page: products of the requested page, canonical, prev/next, structured data and the plain-HTML copy. */
    const listing = (cat, brand, meta = {}) => {
      const path = cat || brand ? p : '/shop';
      const { page, bad } = parsePage(query.page);
      if ('page' in query && (bad || page === 1)) { // one address for page 1: the plain one
        const rest = new URLSearchParams(Object.entries(query).filter(([k]) => k !== 'page').flatMap(([k, v]) => [].concat(v).map(x => [k, String(x)]))).toString();
        return { redirect: p + (rest ? '?' + rest : '') };
      }
      const rows = brand ? brandProducts(prods, brand.slug) : cat ? prods.filter(x => x.category_id === cat.id) : prods;
      const pages = pagesOf(rows.length), offset = (page - 1) * PER_PAGE;
      if (page > pages) return { status: 404, m: { path: p, title: 'Page not found | ' + NAME, desc: STATIC['/'][1], noindex: true } };
      const slice = rows.slice(offset, offset + PER_PAGE);
      const search = (!!(query.q || query.new) && S.robots?.noindexSearch !== false) || (isVariantQuery(query) && S.robots?.noindexFilters !== false); // search results and ?sort= ?view= ?order= variants are not pages to rank: noindex, but their links may be followed; canonical stays the clean URL
      const ent = brand || cat, type = brand ? 'brand' : 'category';
      const heading = brand ? brand.name : cat ? cat.title : 'All products';
      const builtTitle = listTitle(page, brand ? [`${brand.name} Price in Bangladesh | ${SHORT}`, `${brand.name} | ${SHORT}`] : cat ? [`${cat.title} Price in Bangladesh | ${SHORT}`, `${cat.title} | ${SHORT}`] : [STATIC['/shop'][0], `Shop All Products | ${SHORT}`], heading === 'All products' ? 'All Products' : heading);
      const customTitle = ent ? tpl(type, 'title', ent, 60, !!brand) : '';
      const title = customTitle ? pagedTitle(customTitle, page) : builtTitle;
      const intro = brand ? `Buy genuine ${brand.name} products online in Bangladesh. ${brand.description || ''} Best prices and fast delivery in Dhaka.` : cat ? `Buy genuine ${cat.title.toLowerCase()} online in Bangladesh. ${cat.description || ''} Best prices and fast delivery in Dhaka.` : STATIC['/shop'][1];
      const customDesc = ent ? tpl(type, 'description', ent, 155, !!brand) : '';
      const desc = clip((page > 1 ? `Page ${page} of ${pages}. ` : '') + (customDesc || intro).replace(/\s+/g, ' ').trim(), 155);
      const url = base + pageUrl(path, page);
      const trail = brand ? [['Home', '/'], [brand.name]] : cat ? [['Home', '/'], ['Shop', '/shop'], [cat.title]] : [['Home', '/'], ['Shop']];
      const fq = page === 1 && !search ? faqOf(meta) : faqOf({});
      const use = page > 1 ? { ...meta, meta_title: null, meta_description: null } : meta; // a hand-written title / description is for the first page only
      return { m: applySeoMeta({
        path: pageUrl(path, page), title, desc, noindex: search || (!!brand && rows.length < MIN_BRAND_PRODUCTS), follow: search || (!!brand && rows.length < MIN_BRAND_PRODUCTS), canonical: search ? url : undefined, preload: slice[0]?.img || undefined, image: brand?.logo || undefined,
        prev: page > 1 ? base + pageUrl(path, page - 1) : undefined, next: page < pages ? base + pageUrl(path, page + 1) : undefined,
        ld: search ? undefined : [
          collectionLd({ name: heading, url, description: desc, total: rows.length, offset, items: slice.map(x => ({ name: x.name, url: base + productPath(x) })) }),
          breadcrumbLd(trail.map(([n, h]) => [n, base + (h || path)])), ...(fq.ld ? [fq.ld] : [])],
        fallback: listFallback({ title: heading, intro: brand ? brand.description : cat?.description, trail, rows: slice, page, pages, path, cats, site, extra: fq.html })
      }, use) };
    };

    let r;
    if ((r = p.match(/^\/product\/([^/]+)$/))) {
      // the stored words-only address; the old ones (/product/21554, /product/hp-230a-toner-21554) are looked up by their id and sent to it
      let [[x]] = await pool.query('SELECT * FROM products WHERE slug = ? AND active = 1', [r[1]]);
      if (x && !hasPicture(x.img)) x = undefined; // not published without a picture: the page is a 404 until one is added
      let old = null;
      if (!x && productIdOf(r[1])) {
        [[old]] = await pool.query('SELECT * FROM products WHERE id = ?', [productIdOf(r[1])]);
        // only an address that really was this product's: the bare id, its old keyword form, or one starting with the same first word (the name was edited since)
        if (old && !(r[1] === String(old.id) || r[1] === legacySlug(old) || r[1].split('-')[0] === productSlug(old.name).split('-')[0])) old = null;
        if (old?.active) x = old;
      }
      if (!x && !old) [[old]] = await pool.query('SELECT * FROM products WHERE slug = ? AND active = 0', [r[1]]); // a removed duplicate's own words-only address
      if (x && productPath(x) !== p) return { redirect: encodeURI(productPath(x)) + qs };
      if (!x && old) {
        // a product that was removed as a duplicate of another listing sends its old address to the one that stays
        // (merged_into names the kept listing when the two had different names; otherwise the same name finds it)
        const [[twin]] = await pool.query('SELECT k.id, k.name, k.slug FROM products k WHERE k.active = 1 AND (k.id = ? OR LOWER(TRIM(k.name)) = LOWER(TRIM(?))) ORDER BY k.id = ? DESC, k.price > 0 DESC, k.id LIMIT 1', [old.merged_into || 0, old.name, old.merged_into || 0]);
        if (twin) return { redirect: encodeURI(productPath(twin)) + qs };
      }
      if (!x) { status = 404; m = { path: p, title: 'Product not found | ' + NAME, desc: 'This product is no longer available.', noindex: true }; } else {
        let gal;
        try { [gal] = await pool.query('SELECT path, alt FROM product_images WHERE product_id = ? ORDER BY position LIMIT 6', [x.id]); }
        catch { [gal] = await pool.query('SELECT path FROM product_images WHERE product_id = ? ORDER BY position LIMIT 6', [x.id]); } // no alt column yet
        const [[rv]] = await pool.query('SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE product_id = ? AND status = "Approved"', [x.id]);
        const [[cat]] = (await pool.query('SELECT title FROM categories WHERE id = ?', [x.category_id]));
        const meta = await seoMeta('product', x.id);
        const fq = faqOf(meta);
        const items = (gal.length ? gal : [{ path: x.img }]).filter(g => g.path);
        const imgs = items.map(g => abs(base, g.path));
        const imgAlt = String(items[0]?.alt || '').trim();
        const url = base + productPath(x);
        const prod = {
          '@context': 'https://schema.org', '@type': 'Product', name: x.name, image: imageLd(base, items), sku: x.sku || String(x.id), mpn: x.part || undefined, ...productExtras(x), category: cat?.title,
          description: clip(plain(x.short_desc) || plain(x.description) || x.meta_desc || x.name, 500), brand: x.brand ? { '@type': 'Brand', name: x.brand } : undefined, url
        };
        if (x.price > 0) {
          prod.offers = {
            '@type': 'Offer', url, priceCurrency: 'BDT', price: String(x.price), priceValidUntil: validUntil(x.sale_ends, priceUntil()), itemCondition: conditionOf(x.item_condition),
            availability: availabilityOf(x), seller: { '@type': 'Organization', name: NAME }
          };
          Object.assign(prod.offers, offerExtras(x, x.price, { vatShown: true })); // the product page shows "Prices include VAT"
          // delivery charges come from the site settings: Dhaka is free within freeKm of the office, then priced by distance (the cheapest tier is listed); the rest of Bangladesh is outsideFee; nothing is guessed when they are not set
          const dlv = mergeDelivery(site.delivery);
          const ship = [['Dhaka', Math.min(...dlv.tiers.map(t => t.fee).concat(dlv.maxFee))], [null, site.outsideFee]].filter(([, f]) => money(f) !== null).map(([region, f]) => ({
            '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: money(f), currency: 'BDT' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BD', addressRegion: region || undefined }
          }));
          if (ship.length) prod.offers.shippingDetails = ship;
        }
        if (rv.n > 0) {
          prod.aggregateRating = aggregateLd(rv.n, rv.a);
          const [rvs] = await pool.query('SELECT name, rating, title, body, created_at FROM reviews WHERE product_id = ? AND status = "Approved" ORDER BY created_at DESC, id DESC LIMIT 10', [x.id]);
          const list = reviewsLd(rvs, 10);
          if (list.length) prod.review = list;
        }
        applyProductOverrides(prod, meta.schema_overrides); // only brand, mpn, gtin13, color, model, validated
        const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }, { '@type': 'ListItem', position: 2, name: cat?.title || 'Shop', item: `${base}/shop/${x.category_id}` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] };
        // generated from the product data; a title or description written by hand in the admin is kept, the import's generated ones are replaced
        const priced = x.price > 0;
        const [[dn]] = await pool.query('SELECT COUNT(*) n FROM products WHERE active = 1 AND name = ? AND id <> ?', [x.name, x.id]);
        const label = Number(dn.n) > 0 ? `${x.name} (${x.sku || x.id})` : x.name; // the same item listed twice must not share a title
        // order: hand-written value, then a changed template, then the built-in text
        const pv = { ...x, name: label, label, priced, category: cat?.title };
        const title = (isAutoTitle(x.meta_title) ? '' : x.meta_title) || tpl('product', 'title', pv, 60) || productTitle(label, priced);
        const desc = (isAutoDesc(x.meta_desc) ? '' : x.meta_desc) || tpl('product', 'description', pv, 155) || productDescription({ name: label, price: x.price, cod: site.payments?.COD !== false });
        const related = prods.filter(q => q.category_id === x.category_id && q.id !== x.id).slice(0, 8);
        m = {
          path: p, type: 'product', title, desc, keywords: x.meta_keywords, image: imgs[0], imageAlt: imgAlt || undefined, preload: imgs[0], ld: [prod, crumbs, ...(fq.ld ? [fq.ld] : [])],
          fallback: productFallback({ x, cat: cat ? { id: x.category_id, title: cat.title } : null, price: x.price, related, cats, site, desc: clip(plain(x.short_desc) || plain(x.description), 1500), extra: fq.html })
        };
        m = applySeoMeta(m, meta, { forceNoindex: Number(x.noindex) === 1 });
      }
    } else if ((r = p.match(/^\/blog\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT slug, title, excerpt, cover, author, body, meta_title, meta_desc, meta_keywords, noindex, DATE_FORMAT(published, "%Y-%m-%d") d, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") dm FROM blog_posts WHERE slug = ? AND status = "Published"', [dec(r[1])]);
      if (x) {
        const meta = await seoMeta('blog', x.slug), fq = faqOf(meta);
        const desc = x.meta_desc || tpl('blog', 'description', x, 155) || x.excerpt || clip(plain(x.body), 155);
        m = { path: p, type: 'article', title: x.meta_title || tpl('blog', 'title', x, 60) || `${x.title} | ${NAME}`, desc, keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover, ld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: clip(String(x.title || ''), 110), description: clip(plain(desc), 300) || undefined, image: abs(base, x.cover || LOGO), datePublished: x.d, dateModified: x.dm || x.d, author: { '@type': !x.author || x.author === NAME ? 'Organization' : 'Person', name: x.author || NAME }, publisher: { '@type': 'Organization', name: NAME, logo: { '@type': 'ImageObject', url: base + '/api/uploads/site/artrade-logo.png' } }, mainEntityOfPage: base + p }] };
        m.ld.push(breadcrumbLd([['Home', base + '/'], ['Blog', base + '/blog'], [x.title, base + p]]));
        m.fallback = pageFallback({ title: x.title, intro: clip(plain(x.excerpt), 300), blocks: [textBlock('', clip(plain(x.body), 4000)), linkBlock('More from the blog', [link('/blog', 'All articles')]), fq.html], cats, site });
        if (fq.ld) m.ld.push(fq.ld);
        m = applySeoMeta(m, meta);
      }
    } else if ((r = p.match(/^\/services\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT title, excerpt, cover, body, meta_title, meta_desc, meta_keywords, noindex FROM site_pages WHERE slug = ? AND status = "Published"', [dec(r[1])]);
      const meta = x ? await seoMeta('page', r[1] && dec(r[1])) : {}, fq = faqOf(meta);
      if (x) m = { path: p, title: x.meta_title || tpl('page', 'title', x, 60) || `${x.title} | ${NAME}`, desc: x.meta_desc || tpl('page', 'description', x, 155) || x.excerpt || clip(plain(x.body), 155), keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover };
      if (x) {
        m.fallback = pageFallback({ title: x.title, intro: clip(plain(x.excerpt), 300), blocks: [textBlock('', clip(plain(x.body), 4000)), linkBlock('Our servicing', [link('/services', 'Printer & photocopier servicing')]), fq.html], cats, site });
        m.ld = [serviceLd({ name: x.title, description: plain(x.excerpt) || plain(x.body), url: base + p, storeId: base + '/#store' }), breadcrumbLd([['Home', base + '/'], ['Services', base + '/services'], [x.title, base + p]]), ...(fq.ld ? [fq.ld] : [])];
        m = applySeoMeta(m, meta);
      }
    } else if ((r = p.match(/^\/shop\/([^/]+)$/)) && r[1] !== 'all') {
      const [[x]] = await pool.query('SELECT id, title, description FROM categories WHERE id = ?', [r[1]]);
      if (x) { const L = listing(x, null, await seoMeta('category', x.id)); if (L.redirect) return { redirect: L.redirect }; m = L.m; status = L.status || 200; }
    } else if ((r = p.match(/^\/brand\/([^/]+)$/))) {
      let b;
      try { [[b]] = await pool.query('SELECT slug, name, description, logo, hidden FROM brands WHERE slug = ?', [dec(r[1])]); } catch { b = undefined; } // no brands table yet: no brand pages
      if (b && !b.hidden && b.slug) { const L = listing(null, b, await seoMeta('brand', b.slug)); if (L.redirect) return { redirect: L.redirect }; m = L.m; status = L.status || 200; }
    } else if (p === '/shop' || p === '/shop/all') {
      const L = listing(null, null, await seoMeta('static', 'shop'));
      if (L.redirect) return { redirect: L.redirect };
      m = L.m; status = L.status || 200;
    } else if (STATIC[p]) {
      let [t, d] = STATIC[p];
      let kw = '', hide = false;
      const meta = p === '/shop' ? {} : await seoMeta(p === '/' ? 'home' : 'static', p === '/' ? 'home' : p.slice(1));
      const fq = p === '/faq' ? faqOf({}) : faqOf(meta);
      if (p === '/about') {
        // the About page is built from three admin pages; the Company profile leads, the keywords of all three are merged
        const [ap] = await pool.query("SELECT slug, meta_title, meta_desc, meta_keywords, noindex FROM site_pages WHERE slug IN ('company-profile', 'mission-vision', 'our-clients') AND status = 'Published'");
        const lead = ap.find(a => a.slug === 'company-profile');
        if (lead?.meta_title) t = lead.meta_title;
        if (lead?.meta_desc) d = lead.meta_desc;
        hide = !!lead?.noindex;
        kw = [...new Set(ap.flatMap(a => String(a.meta_keywords || '').split(',')).map(k => k.trim()).filter(Boolean))].join(', ');
      }
      // plain-HTML copy: the heading, the text and real links (categories, popular products, articles, servicing pages)
      const blocks = [];
      if (p === '/') blocks.push(linkBlock('Shop by category', cats.map(c => link('/shop/' + c.id, c.title))), linkBlock('Popular products', prods.slice(0, 24).map(productLine)));
      if (p === '/blog') blocks.push(linkBlock('Articles', (await pool.query('SELECT slug, title FROM blog_posts WHERE status = "Published" AND noindex = 0 ORDER BY published DESC LIMIT 40'))[0].map(x => link('/blog/' + x.slug, x.title))));
      if (p === '/services') blocks.push(linkBlock('Servicing', (await pool.query('SELECT slug, title FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0'))[0].map(x => link('/services/' + x.slug, x.title))));
      if (p === '/faq') blocks.push(faqBlock(c.faqs));
      blocks.push(fq.html);
      const faq = p === '/faq' ? faqLd(c.faqs) : null;
      m = { path: p, title: t, desc: d, keywords: kw || undefined, noindex: hide, preload: p === '/' ? heroImage(c.slides) : undefined, fallback: hide ? undefined : pageFallback({ title: p === '/' ? `${NAME}: genuine toner, printers and copiers in Bangladesh` : t.split(/ [|—] /)[0], intro: d, blocks, cats, site }), ld: p === '/' ? [org, { '@context': 'https://schema.org', '@type': 'WebSite', '@id': base + '/#website', name: NAME, url: base, publisher: { '@id': base + '/#store' }, potentialAction: { '@type': 'SearchAction', target: `${base}/shop/all?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }] : p === '/contact' ? [org, breadcrumbLd([['Home', base + '/'], ['Contact', base + '/contact']])] : p === '/faq' ? [faq, breadcrumbLd([['Home', base + '/'], ['FAQ', base + '/faq']])].filter(Boolean) : p === '/services' ? [breadcrumbLd([['Home', base + '/'], ['Services', base + '/services']])] : undefined };
      if (fq.ld) m.ld = [...(m.ld || []), fq.ld];
      m = applySeoMeta(m, meta);
    }
    if (!m && (r = p.match(/^\/policy\/([^/]+)$/))) {
      const pol = (c.policies || []).find(x => x.k === dec(r[1]));
      if (pol) {
        const pm = policyMeta(pol);
        m = { path: p, title: pm.title, desc: pm.desc, ld: [breadcrumbLd([['Home', base + '/'], [pol.t, base + p]])], fallback: pageFallback({ title: pol.t, blocks: policyBlocks(pol), cats, site }) };
      }
    }
    if (!m) {
      // a page that does not exist must answer 404, not 200 (Google treats a 200 "not found" page as a soft 404)
      let exists = p === '/' || PRIVATE.test(p);
      if (!exists && (r = p.match(/^\/careers\/([^/]+)$/))) exists = !!(await pool.query('SELECT 1 FROM jobs WHERE id = ?', [dec(r[1])]))[0].length;
      if (!exists) status = 404;
      m = { path: p, title: status === 404 ? 'Page not found | ' + NAME : NAME, desc: STATIC['/'][1], noindex: status === 404 || PRIVATE.test(p) || p !== '/' };
    } else if (PRIVATE.test(p)) m.noindex = true;
    if (status === 404 && !m.fallback) { m.fallback = notFoundFallback({ cats, site }); m.noindex = true; m.follow = false; } // keep 404 + noindex,nofollow, but give crawlers and people real links

    m.verification = S.verification;
    return { m, status };
}

/** What the live handler would put in the head for a URL (admin "preview"). Same resolution as a real request; writes nothing,
 *  counts no hit and follows no redirect (a URL that would be redirected by the page rules answers status 301 plus `redirect`). */
export async function previewMeta(pathname, query = {}) {
  const base = (process.env.SITE_URL || '').replace(/\/$/, '');
  const p = String(pathname || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const qs = new URLSearchParams(Object.entries(query || {}).flatMap(([k, v]) => [].concat(v).map(x => [k, String(x)]))).toString();
  const R = await resolveMeta({ base, p, query: query || {}, qs: qs ? '?' + qs : '' });
  if (R.redirect) return { status: 301, redirect: R.redirect, title: '', description: '', canonical: '', robots: '', og: { title: '', description: '', image: '' }, twitter: { title: '', description: '' }, ld: [] };
  return { status: R.status, ...headFields(base, R.m) , ld: R.m.ld || [] };
}
