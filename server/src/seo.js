// Search-engine support: robots.txt, sitemap.xml and per-page <title>/meta/JSON-LD injected into the HTML shell,
// so crawlers (and link previews) see the real product data without having to run the React app.
import { hasPicture, published } from './productImages.js';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db.js';
import { mergeDelivery } from './delivery.js';
import { parseJson, wrap } from './util.js';
import { legacySlug, productIdOf, productPath, productSlug } from './slug.js';

import { NAME, PER_PAGE, SHORT, breadcrumbLd, clip, collectionLd, esc, isAutoDesc, isAutoTitle, listTitle, pageUrl, pagesOf, parsePage, plain, productDescription, productTitle } from './seoHelpers.js';
import { linkBlock, link, listFallback, pageFallback, productFallback, productLine, textBlock } from './seoFallback.js';
const baseUrl = req => (process.env.SITE_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const LOGO = '/api/uploads/site/artrade-logo.png';
const money = v => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? String(Number(v)) : null);
/** Offers stay valid to the end of the year (Google asks for priceValidUntil); in December the next year is used. */
const priceUntil = () => { const d = new Date(); return `${d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()}-12-31`; };
const abs = (base, u) => (!u ? '' : /^https?:\/\//.test(u) ? u : base + u);

/** Public content pages: their address is forced to lower case and no trailing slash. Tokens (reset, prefs) and the apps are not touched. */
const PUBLIC_PAGE = /^\/(shop|product|blog|services|about|contact|faq|offers|careers|policy)(\/|$)/i;
const dec = s => { try { return decodeURIComponent(s); } catch { return s; } }; // a malformed %-escape in the address must be a 404, not a 500
const search = req => { const q = req.originalUrl.indexOf('?'); return q < 0 ? '' : req.originalUrl.slice(q); };
const PRIVATE = /^\/(cart|checkout|success|account|login|track|wishlist|compare|reset|prefs|admin|hub|email|field)(\/|$)/;
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
let memo = { t: 0, cats: [], prods: [] };
async function catalog() {
  if (Date.now() - memo.t < 30000) return memo;
  const [cats] = await pool.query('SELECT id, title, description FROM categories WHERE hidden = 0 ORDER BY sort_order');
  const [rows] = await pool.query('SELECT id, category_id, name, slug, img, price, stock, popular, brand FROM products WHERE active = 1 ORDER BY popular DESC, id DESC');
  memo = { t: Date.now(), cats, prods: published(rows) };
  return memo;
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

function inject(html, base, m) {
  const url = base + m.path;
  m = { ...m, desc: clip(m.desc, 160) }; // Google shows about 160 characters
  const tags = [
    `<meta name="description" content="${esc(m.desc)}">`,
    m.keywords ? `<meta name="keywords" content="${esc(m.keywords)}">` : '',
    `<meta name="robots" content="${m.noindex ? (m.follow ? 'noindex, follow' : 'noindex, nofollow') : 'index, follow, max-image-preview:large'}">`,
    m.noindex ? '' : `<link rel="canonical" href="${esc(url)}">`,
    m.prev ? `<link rel="prev" href="${esc(m.prev)}">` : '', m.next ? `<link rel="next" href="${esc(m.next)}">` : '',
    m.preload ? `<link rel="preload" as="image" href="${esc(abs(base, m.preload))}" fetchpriority="high">` : '', // the product picture is a CSS background, so the browser would find it late
    `<meta property="og:site_name" content="${NAME}">`, `<meta property="og:type" content="${m.type || 'website'}">`,
    `<meta property="og:title" content="${esc(m.title)}">`, `<meta property="og:description" content="${esc(m.desc)}">`, `<meta property="og:url" content="${esc(url)}">`,
    m.image ? `<meta property="og:image" content="${esc(abs(base, m.image))}">` : '',
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">`, `<meta name="twitter:title" content="${esc(m.title)}">`, `<meta name="twitter:description" content="${esc(m.desc)}">`,
    m.image ? `<meta name="twitter:image" content="${esc(abs(base, m.image))}">` : '',
    m.fallback ? FB_CSS : '',
    ...(m.ld || []).map(ld)
  ].filter(Boolean).join('\n');
  // the shell carries a generic description: remove it, the page has its own (two descriptions make Google pick one)
  let out = html.replace(/<meta name="description"[^>]*>\s*/g, '').replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`).replace('</head>', tags + '\n</head>');
  if (m.fallback) out = out.replace('<div id="root"></div>', `<div id="root">${m.fallback}</div>`);
  return out;
}

export function mountSeo(app, dist) {
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /hub', 'Disallow: /email', 'Disallow: /field', 'Disallow: /api/', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /account', 'Disallow: /track', 'Disallow: /success/', '',
      'Allow: /api/uploads/', '', `Sitemap: ${baseUrl(req)}/sitemap.xml`, ''].join('\n'));
  });

  app.get('/sitemap.xml', wrap(async (req, res) => {
    const base = baseUrl(req);
    const [cats] = await pool.query('SELECT id FROM categories WHERE hidden = 0');
    const [allProds] = await pool.query('SELECT id, name, slug, img, DATE_FORMAT(updated_at, "%Y-%m-%d") lm FROM products WHERE active = 1 ORDER BY id DESC');
    const prods = published(allProds); // a product whose picture is missing is not published, so it is not offered to search engines either
    const [posts] = await pool.query('SELECT slug, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") d FROM blog_posts WHERE status = "Published" AND noindex = 0');
    const [pages] = await pool.query('SELECT slug FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0');
    const u = (loc, pri, extra = '', lm = '') => `<url><loc>${esc(base + loc)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}<priority>${pri}</priority>${extra}</url>`;
    const out = [
      ...Object.keys(STATIC).map(p => u(p, p === '/' ? '1.0' : '0.8')),
      ...cats.map(c => u('/shop/' + c.id, '0.8')),
      ...prods.map(p => u(productPath(p), '0.7', p.img ? `<image:image><image:loc>${esc(abs(base, p.img))}</image:loc></image:image>` : '', p.lm)),
      ...posts.map(p => u('/blog/' + p.slug, '0.6', '', p.d)),
      ...pages.map(p => u('/services/' + p.slug, '0.7'))
    ];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${out.join('\n')}\n</urlset>`);
  }));

  // the HTML shell for every non-API page, with the right meta for the URL
  app.get(/^(?!\/api).*/, wrap(async (req, res) => {
    const base = baseUrl(req);
    const p = req.path.replace(/\/+$/, '') || '/';
    let m = null, status = 200;
    const site = parseJson((await pool.query('SELECT v FROM settings WHERE k = "site"'))[0][0]?.v) || {};
    const { cats, prods } = await catalog();
    const org = {
      '@context': 'https://schema.org', '@type': 'Store', '@id': base + '/#store', name: NAME, url: base, logo: base + '/api/uploads/site/artrade-logo.png', image: base + '/api/uploads/site/artrade-logo.png',
      telephone: site.phone, email: site.email, address: { '@type': 'PostalAddress', streetAddress: site.address || '159 Santinagar', addressLocality: 'Dhaka', postalCode: '1217', addressCountry: 'BD' },
      priceRange: '৳', areaServed: 'BD'
    };

    if (p === '/') {
      // social profiles the owner entered in the admin; only real https links
      const c = parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {};
      const same = Object.values(c.social || {}).filter(u => /^https?:\/\//.test(u || ''));
      if (same.length) org.sameAs = same;
    }

    // one address per page: lower case, no trailing slash (a second spelling would be a duplicate page for search engines)
    const shown = dec(p);
    if (PUBLIC_PAGE.test(shown) && shown !== shown.toLowerCase()) return res.redirect(301, encodeURI(shown.toLowerCase()) + search(req));
    if (PUBLIC_PAGE.test(req.path) && req.path.length > 1 && req.path.endsWith('/')) return res.redirect(301, p + search(req));

    /** A category / all-products page: products of the requested page, canonical, prev/next, structured data and the plain-HTML copy. */
    const listing = cat => {
      const path = cat ? p : '/shop';
      const { page, bad } = parsePage(req.query.page);
      if ('page' in req.query && (bad || page === 1)) { // one address for page 1: the plain one
        const rest = new URLSearchParams(Object.entries(req.query).filter(([k]) => k !== 'page').flatMap(([k, v]) => [].concat(v).map(x => [k, String(x)]))).toString();
        return { redirect: p + (rest ? '?' + rest : '') };
      }
      const rows = cat ? prods.filter(x => x.category_id === cat.id) : prods;
      const pages = pagesOf(rows.length), offset = (page - 1) * PER_PAGE;
      if (page > pages) return { status: 404, m: { path: p, title: 'Page not found | ' + NAME, desc: STATIC['/'][1], noindex: true } };
      const slice = rows.slice(offset, offset + PER_PAGE);
      const search = !!(req.query.q || req.query.new); // search results are not pages to rank: noindex, but their links may be followed
      const heading = cat ? cat.title : 'All products';
      const title = listTitle(page, cat ? [`${cat.title} Price in Bangladesh | ${SHORT}`, `${cat.title} | ${SHORT}`] : [STATIC['/shop'][0], `Shop All Products | ${SHORT}`], cat ? cat.title : 'All Products');
      const intro = cat ? `Buy genuine ${cat.title.toLowerCase()} online in Bangladesh. ${cat.description || ''} Best prices and fast delivery in Dhaka.` : STATIC['/shop'][1];
      const desc = clip((page > 1 ? `Page ${page} of ${pages}. ` : '') + intro.replace(/\s+/g, ' ').trim(), 155);
      const url = base + pageUrl(path, page);
      const trail = cat ? [['Home', '/'], ['Shop', '/shop'], [cat.title]] : [['Home', '/'], ['Shop']];
      return { m: {
        path: pageUrl(path, page), title, desc, noindex: search, follow: search,
        prev: page > 1 ? base + pageUrl(path, page - 1) : undefined, next: page < pages ? base + pageUrl(path, page + 1) : undefined,
        ld: search ? undefined : [
          collectionLd({ name: heading, url, description: desc, total: rows.length, offset, items: slice.map(x => ({ name: x.name, url: base + productPath(x) })) }),
          breadcrumbLd(trail.map(([n, h]) => [n, base + (h || path)]))],
        fallback: listFallback({ title: heading, intro: cat?.description, trail, rows: slice, page, pages, path, cats, site })
      } };
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
      if (x && productPath(x) !== p) return res.redirect(301, encodeURI(productPath(x)) + search(req));
      if (!x && old) {
        // a product that was removed as a duplicate of another listing sends its old address to the one that stays
        // (merged_into names the kept listing when the two had different names; otherwise the same name finds it)
        const [[twin]] = await pool.query('SELECT k.id, k.name, k.slug FROM products k WHERE k.active = 1 AND (k.id = ? OR LOWER(TRIM(k.name)) = LOWER(TRIM(?))) ORDER BY k.id = ? DESC, k.price > 0 DESC, k.id LIMIT 1', [old.merged_into || 0, old.name, old.merged_into || 0]);
        if (twin) return res.redirect(301, encodeURI(productPath(twin)) + search(req));
      }
      if (!x) { status = 404; m = { path: p, title: 'Product not found | ' + NAME, desc: 'This product is no longer available.', noindex: true }; } else {
        const [gal] = await pool.query('SELECT path FROM product_images WHERE product_id = ? ORDER BY position LIMIT 6', [x.id]);
        const [[rv]] = await pool.query('SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE product_id = ? AND status = "Approved"', [x.id]);
        const [[cat]] = (await pool.query('SELECT title FROM categories WHERE id = ?', [x.category_id]));
        const imgs = (gal.length ? gal.map(g => g.path) : [x.img]).filter(Boolean).map(i => abs(base, i));
        const url = base + productPath(x);
        const prod = {
          '@context': 'https://schema.org', '@type': 'Product', name: x.name, image: imgs, sku: x.sku || String(x.id), mpn: x.part || undefined, category: cat?.title,
          description: clip(plain(x.short_desc) || plain(x.description) || x.meta_desc || x.name, 500), brand: x.brand ? { '@type': 'Brand', name: x.brand } : undefined, url
        };
        if (x.price > 0) {
          prod.offers = {
            '@type': 'Offer', url, priceCurrency: 'BDT', price: String(x.price), priceValidUntil: priceUntil(), itemCondition: 'https://schema.org/NewCondition',
            availability: x.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', seller: { '@type': 'Organization', name: NAME }
          };
          // delivery charges come from the site settings: Dhaka is free within freeKm of the office, then priced by distance (the cheapest tier is listed); the rest of Bangladesh is outsideFee; nothing is guessed when they are not set
          const dlv = mergeDelivery(site.delivery);
          const ship = [['Dhaka', Math.min(...dlv.tiers.map(t => t.fee).concat(dlv.maxFee))], [null, site.outsideFee]].filter(([, f]) => money(f) !== null).map(([region, f]) => ({
            '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: money(f), currency: 'BDT' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BD', addressRegion: region || undefined }
          }));
          if (ship.length) prod.offers.shippingDetails = ship;
        }
        if (rv.n > 0) prod.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(rv.a).toFixed(1), reviewCount: Number(rv.n) };
        const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }, { '@type': 'ListItem', position: 2, name: cat?.title || 'Shop', item: `${base}/shop/${x.category_id}` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] };
        // generated from the product data; a title or description written by hand in the admin is kept, the import's generated ones are replaced
        const priced = x.price > 0;
        const [[dn]] = await pool.query('SELECT COUNT(*) n FROM products WHERE active = 1 AND name = ? AND id <> ?', [x.name, x.id]);
        const label = Number(dn.n) > 0 ? `${x.name} (${x.sku || x.id})` : x.name; // the same item listed twice must not share a title
        const title = isAutoTitle(x.meta_title) ? productTitle(label, priced) : x.meta_title;
        const desc = isAutoDesc(x.meta_desc) ? productDescription({ name: label, price: x.price, cod: site.payments?.COD !== false }) : x.meta_desc;
        const related = prods.filter(q => q.category_id === x.category_id && q.id !== x.id).slice(0, 8);
        m = {
          path: p, type: 'product', title, desc, keywords: x.meta_keywords, image: imgs[0], preload: imgs[0], ld: [prod, crumbs],
          fallback: productFallback({ x, cat: cat ? { id: x.category_id, title: cat.title } : null, price: x.price, related, cats, site, desc: clip(plain(x.short_desc) || plain(x.description), 1500) })
        };
      }
    } else if ((r = p.match(/^\/blog\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT slug, title, excerpt, cover, author, body, meta_title, meta_desc, meta_keywords, noindex, DATE_FORMAT(published, "%Y-%m-%d") d, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") dm FROM blog_posts WHERE slug = ? AND status = "Published"', [dec(r[1])]);
      if (x) {
        const desc = x.meta_desc || x.excerpt || clip(plain(x.body), 155);
        m = { path: p, type: 'article', title: x.meta_title || `${x.title} | ${NAME}`, desc, keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover, ld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: clip(String(x.title || ''), 110), description: clip(plain(desc), 300) || undefined, image: abs(base, x.cover || LOGO), datePublished: x.d, dateModified: x.dm || x.d, author: { '@type': !x.author || x.author === NAME ? 'Organization' : 'Person', name: x.author || NAME }, publisher: { '@type': 'Organization', name: NAME, logo: { '@type': 'ImageObject', url: base + '/api/uploads/site/artrade-logo.png' } }, mainEntityOfPage: base + p }] };
        m.ld.push(breadcrumbLd([['Home', base + '/'], ['Blog', base + '/blog'], [x.title, base + p]]));
        m.fallback = pageFallback({ title: x.title, intro: clip(plain(x.excerpt), 300), blocks: [textBlock('', clip(plain(x.body), 4000)), linkBlock('More from the blog', [link('/blog', 'All articles')])], cats, site });
      }
    } else if ((r = p.match(/^\/services\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT title, excerpt, cover, body, meta_title, meta_desc, meta_keywords, noindex FROM site_pages WHERE slug = ? AND status = "Published"', [dec(r[1])]);
      if (x) m = { path: p, title: x.meta_title || `${x.title} | ${NAME}`, desc: x.meta_desc || x.excerpt || clip(plain(x.body), 155), keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover };
      if (x) m.fallback = pageFallback({ title: x.title, intro: clip(plain(x.excerpt), 300), blocks: [textBlock('', clip(plain(x.body), 4000)), linkBlock('Our servicing', [link('/services', 'Printer & photocopier servicing')])], cats, site });
    } else if ((r = p.match(/^\/shop\/([^/]+)$/)) && r[1] !== 'all') {
      const [[x]] = await pool.query('SELECT id, title, description FROM categories WHERE id = ?', [r[1]]);
      if (x) { const L = listing(x); if (L.redirect) return res.redirect(301, L.redirect); m = L.m; status = L.status || 200; }
    } else if (p === '/shop' || p === '/shop/all') {
      const L = listing(null);
      if (L.redirect) return res.redirect(301, L.redirect);
      m = L.m; status = L.status || 200;
    } else if (STATIC[p]) {
      let [t, d] = STATIC[p];
      let kw = '', hide = false;
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
      m = { path: p, title: t, desc: d, keywords: kw || undefined, noindex: hide, fallback: hide ? undefined : pageFallback({ title: p === '/' ? `${NAME}: genuine toner, printers and copiers in Bangladesh` : t.split(/ [|—] /)[0], intro: d, blocks, cats, site }), ld: p === '/' ? [org, { '@context': 'https://schema.org', '@type': 'WebSite', '@id': base + '/#website', name: NAME, url: base, publisher: { '@id': base + '/#store' }, potentialAction: { '@type': 'SearchAction', target: `${base}/shop/all?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }] : undefined };
    }
    if (!m) {
      // a page that does not exist must answer 404, not 200 (Google treats a 200 "not found" page as a soft 404)
      let exists = p === '/' || PRIVATE.test(p);
      if (!exists && (r = p.match(/^\/careers\/([^/]+)$/))) exists = !!(await pool.query('SELECT 1 FROM jobs WHERE id = ?', [dec(r[1])]))[0].length;
      if (!exists && (r = p.match(/^\/policy\/([^/]+)$/))) {
        const c = parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {};
        exists = (c.policies || []).some(x => x.k === dec(r[1]));
      }
      if (!exists) status = 404;
      m = { path: p, title: status === 404 ? 'Page not found | ' + NAME : NAME, desc: STATIC['/'][1], noindex: status === 404 || PRIVATE.test(p) || p !== '/' };
    } else if (PRIVATE.test(p)) m.noindex = true;

    res.status(status).type('html').send(inject(template(dist), base, m));
  }));
}
