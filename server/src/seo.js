// Search-engine support: robots.txt, sitemap.xml and per-page <title>/meta/JSON-LD injected into the HTML shell,
// so crawlers (and link previews) see the real product data without having to run the React app.
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db.js';
import { parseJson, wrap } from './util.js';
import { legacySlug, productIdOf, productPath, productSlug } from './slug.js';

const NAME = 'AR Trade International';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ''));
const baseUrl = req => (process.env.SITE_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const LOGO = '/api/uploads/site/artrade-logo.png';
const money = v => (v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v)) ? String(Number(v)) : null);
/** Offers stay valid to the end of the year (Google asks for priceValidUntil); in December the next year is used. */
const priceUntil = () => { const d = new Date(); return `${d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()}-12-31`; };
const abs = (base, u) => (!u ? '' : /^https?:\/\//.test(u) ? u : base + u);

/** Public content pages: their address is forced to lower case and no trailing slash. Tokens (reset, prefs) and the apps are not touched. */
const PUBLIC_PAGE = /^\/(shop|product|blog|services|about|contact|faq|offers|careers|policy)(\/|$)/i;
const search = req => { const q = req.originalUrl.indexOf('?'); return q < 0 ? '' : req.originalUrl.slice(q); };
const PRIVATE = /^\/(cart|checkout|success|account|login|track|wishlist|compare|reset|prefs|admin|hub|email|field)(\/|$)/;
const STATIC = {
  '/': ['AR Trade International | Printers, Toner & Copiers in Dhaka', 'Buy genuine printer toner, ink, copiers, printers and computer accessories online in Bangladesh. Printer servicing and fast delivery in Dhaka.'],
  '/shop': ['Toner, Ink, Printers & Copiers in Bangladesh | AR Trade', 'Browse genuine toner cartridges, ink, printers, photocopiers and parts with best prices in Bangladesh. Fast delivery in Dhaka.'],
  '/services': ['Printer & Photocopier Servicing in Dhaka | AR Trade International', 'Printer, photocopier and office-machine repair, servicing and maintenance contracts in Dhaka, Bangladesh.'],
  '/about': ['About AR Trade International — Since 2011, Dhaka', 'AR Trade International supplies genuine toner, printers, copiers and office equipment and offers servicing in Dhaka, Bangladesh since 2011.'],
  '/contact': ['Contact AR Trade International — Santinagar, Dhaka', 'Call, WhatsApp, email or visit AR Trade International at 159 Santinagar, Dhaka-1217 for quotes, orders and printer servicing.'],
  '/faq': ['Frequently Asked Questions | AR Trade International', 'Answers about ordering, delivery, payment, warranty and servicing at AR Trade International.'],
  '/offers': ['Offers & Deals on Toner and Printers | AR Trade International', 'Current offers and discounts on genuine toner, ink, printers and copiers in Bangladesh.'],
  '/blog': ['Blog — Printer, Toner & Office Tips | AR Trade International', 'Guides and articles on printers, toner cartridges, copiers and office equipment from AR Trade International.'],
  '/careers': ['Careers at AR Trade International', 'Open positions and internships at AR Trade International, Dhaka.']
};

let shell = { t: 0, html: '' };
function template(dist) {
  const f = path.join(dist, 'index.html');
  const t = fs.statSync(f).mtimeMs;
  if (t !== shell.t) shell = { t, html: fs.readFileSync(f, 'utf8') };
  return shell.html;
}

const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

function inject(html, base, m) {
  const url = base + m.path;
  m = { ...m, desc: clip(m.desc, 160) }; // Google shows about 160 characters
  const tags = [
    `<meta name="description" content="${esc(m.desc)}">`,
    m.keywords ? `<meta name="keywords" content="${esc(m.keywords)}">` : '',
    `<meta name="robots" content="${m.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
    m.noindex ? '' : `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:site_name" content="${NAME}">`, `<meta property="og:type" content="${m.type || 'website'}">`,
    `<meta property="og:title" content="${esc(m.title)}">`, `<meta property="og:description" content="${esc(m.desc)}">`, `<meta property="og:url" content="${esc(url)}">`,
    m.image ? `<meta property="og:image" content="${esc(abs(base, m.image))}">` : '',
    `<meta name="twitter:card" content="${m.image ? 'summary_large_image' : 'summary'}">`, `<meta name="twitter:title" content="${esc(m.title)}">`, `<meta name="twitter:description" content="${esc(m.desc)}">`,
    m.image ? `<meta name="twitter:image" content="${esc(abs(base, m.image))}">` : '',
    ...(m.ld || []).map(ld)
  ].filter(Boolean).join('\n');
  return html.replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`).replace('</head>', tags + '\n</head>');
}

export function mountSeo(app, dist) {
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /hub', 'Disallow: /email', 'Disallow: /field', 'Disallow: /api/', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /account', 'Disallow: /track', 'Disallow: /success/', '',
      'Allow: /api/uploads/', '', `Sitemap: ${baseUrl(req)}/sitemap.xml`, ''].join('\n'));
  });

  app.get('/sitemap.xml', wrap(async (req, res) => {
    const base = baseUrl(req);
    const [cats] = await pool.query('SELECT id FROM categories WHERE hidden = 0');
    const [prods] = await pool.query('SELECT id, name, slug, img FROM products WHERE active = 1 ORDER BY id DESC');
    const [posts] = await pool.query('SELECT slug, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") d FROM blog_posts WHERE status = "Published" AND noindex = 0');
    const [pages] = await pool.query('SELECT slug FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0');
    const u = (loc, pri, extra = '') => `<url><loc>${esc(base + loc)}</loc><priority>${pri}</priority>${extra}</url>`;
    const out = [
      ...Object.keys(STATIC).map(p => u(p, p === '/' ? '1.0' : '0.8')),
      ...cats.map(c => u('/shop/' + c.id, '0.8')),
      ...prods.map(p => u(productPath(p), '0.7', p.img ? `<image:image><image:loc>${esc(abs(base, p.img))}</image:loc></image:image>` : '')),
      ...posts.map(p => u('/blog/' + p.slug, '0.6', `<lastmod>${p.d}</lastmod>`)),
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
    const org = {
      '@context': 'https://schema.org', '@type': 'Store', name: NAME, url: base, logo: base + '/api/uploads/site/artrade-logo.png', image: base + '/api/uploads/site/artrade-logo.png',
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
    const shown = (() => { try { return decodeURIComponent(p); } catch { return p; } })();
    if (PUBLIC_PAGE.test(shown) && shown !== shown.toLowerCase()) return res.redirect(301, encodeURI(shown.toLowerCase()) + search(req));
    if (PUBLIC_PAGE.test(req.path) && req.path.length > 1 && req.path.endsWith('/')) return res.redirect(301, p + search(req));

    let r;
    if ((r = p.match(/^\/product\/([^/]+)$/))) {
      // the stored words-only address; the old ones (/product/21554, /product/hp-230a-toner-21554) are looked up by their id and sent to it
      let [[x]] = await pool.query('SELECT * FROM products WHERE slug = ? AND active = 1', [r[1]]);
      let old = null;
      if (!x && productIdOf(r[1])) {
        [[old]] = await pool.query('SELECT * FROM products WHERE id = ?', [productIdOf(r[1])]);
        // only an address that really was this product's: the bare id, its old keyword form, or one starting with the same first word (the name was edited since)
        if (old && !(r[1] === String(old.id) || r[1] === legacySlug(old) || r[1].split('-')[0] === productSlug(old.name).split('-')[0])) old = null;
        if (old?.active) x = old;
      }
      if (x && productPath(x) !== p) return res.redirect(301, encodeURI(productPath(x)) + search(req));
      if (!x && old) {
        // a product that was removed as a duplicate of another listing sends its old address to the one that stays
        const [[twin]] = await pool.query('SELECT k.id, k.name, k.slug FROM products k WHERE k.active = 1 AND LOWER(TRIM(k.name)) = LOWER(TRIM(?)) ORDER BY k.price > 0 DESC, k.id LIMIT 1', [old.name]);
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
          // delivery charges come from the site settings (Dhaka / rest of Bangladesh); nothing is guessed when they are not set
          const ship = [['Dhaka', site.insideFee], [null, site.outsideFee]].filter(([, f]) => money(f) !== null).map(([region, f]) => ({
            '@type': 'OfferShippingDetails', shippingRate: { '@type': 'MonetaryAmount', value: money(f), currency: 'BDT' },
            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BD', addressRegion: region || undefined }
          }));
          if (ship.length) prod.offers.shippingDetails = ship;
        }
        if (rv.n > 0) prod.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(rv.a).toFixed(1), reviewCount: Number(rv.n) };
        const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }, { '@type': 'ListItem', position: 2, name: cat?.title || 'Shop', item: `${base}/shop/${x.category_id}` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] };
        // two products must not share a title or description: fall back to the full name, then add the SKU (the same item can be listed twice)
        let title = x.meta_title || `${x.name} | ${NAME}`, desc = x.meta_desc || clip(plain(x.description), 155) || x.name;
        const [[dup]] = await pool.query('SELECT SUM(COALESCE(NULLIF(meta_title, ""), CONCAT(name, " | ", ?)) = ?) t, SUM(name = ?) n FROM products WHERE active = 1 AND id <> ?', [NAME, title, x.name, x.id]);
        if (Number(dup.t) > 0) title = `${x.name} | AR Trade`;
        if (Number(dup.t) > 0 && Number(dup.n) > 0) { title = `${x.name} (${x.sku || x.id}) | AR Trade`; desc = clip(desc, 140) + ` (${x.sku || x.id})`; }
        m = { path: p, type: 'product', title, desc, keywords: x.meta_keywords, image: imgs[0], ld: [prod, crumbs] };
      }
    } else if ((r = p.match(/^\/blog\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT slug, title, excerpt, cover, author, body, meta_title, meta_desc, meta_keywords, noindex, DATE_FORMAT(published, "%Y-%m-%d") d, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") dm FROM blog_posts WHERE slug = ? AND status = "Published"', [decodeURIComponent(r[1])]);
      if (x) {
        const desc = x.meta_desc || x.excerpt || clip(plain(x.body), 155);
        m = { path: p, type: 'article', title: x.meta_title || `${x.title} | ${NAME}`, desc, keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover, ld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: clip(String(x.title || ''), 110), description: clip(plain(desc), 300) || undefined, image: abs(base, x.cover || LOGO), datePublished: x.d, dateModified: x.dm || x.d, author: { '@type': !x.author || x.author === NAME ? 'Organization' : 'Person', name: x.author || NAME }, publisher: { '@type': 'Organization', name: NAME, logo: { '@type': 'ImageObject', url: base + '/api/uploads/site/artrade-logo.png' } }, mainEntityOfPage: base + p }] };
      }
    } else if ((r = p.match(/^\/services\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT title, excerpt, cover, body, meta_title, meta_desc, meta_keywords, noindex FROM site_pages WHERE slug = ? AND status = "Published"', [decodeURIComponent(r[1])]);
      if (x) m = { path: p, title: x.meta_title || `${x.title} | ${NAME}`, desc: x.meta_desc || x.excerpt || clip(plain(x.body), 155), keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover };
    } else if ((r = p.match(/^\/shop\/([^/]+)$/)) && r[1] !== 'all') {
      const [[x]] = await pool.query('SELECT title, description FROM categories WHERE id = ?', [r[1]]);
      if (x) m = { path: p, title: `${x.title} Price in Bangladesh | ${NAME}`, desc: `Buy genuine ${x.title.toLowerCase()} online in Bangladesh. ${x.description || ''} Best prices and fast delivery in Dhaka.`.replace(/\s+/g, ' ').trim() };
    } else if (STATIC[p] || p === '/shop/all') {
      let [t, d] = STATIC[p === '/shop/all' ? '/shop' : p];
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
      m = { path: p === '/shop/all' ? '/shop' : p, title: t, desc: d, keywords: kw || undefined, noindex: hide, ld: p === '/' ? [org, { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: base, potentialAction: { '@type': 'SearchAction', target: `${base}/shop/all?q={search_term_string}`, 'query-input': 'required name=search_term_string' } }] : undefined };
    }
    if (!m) {
      // a page that does not exist must answer 404, not 200 (Google treats a 200 "not found" page as a soft 404)
      let exists = p === '/' || PRIVATE.test(p);
      if (!exists && (r = p.match(/^\/careers\/([^/]+)$/))) exists = !!(await pool.query('SELECT 1 FROM jobs WHERE id = ?', [decodeURIComponent(r[1])]))[0].length;
      if (!exists && (r = p.match(/^\/policy\/([^/]+)$/))) {
        const c = parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {};
        exists = (c.policies || []).some(x => x.k === decodeURIComponent(r[1]));
      }
      if (!exists) status = 404;
      m = { path: p, title: status === 404 ? 'Page not found | ' + NAME : NAME, desc: STATIC['/'][1], noindex: status === 404 || PRIVATE.test(p) || p !== '/' };
    } else if (PRIVATE.test(p)) m.noindex = true;

    res.status(status).type('html').send(inject(template(dist), base, m));
  }));
}
