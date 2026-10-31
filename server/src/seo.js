// Search-engine support: robots.txt, sitemap.xml and per-page <title>/meta/JSON-LD injected into the HTML shell,
// so crawlers (and link previews) see the real product data without having to run the React app.
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './db.js';
import { parseJson, wrap } from './util.js';

const NAME = 'AR Trade International';
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ''));
const baseUrl = req => (process.env.SITE_URL || `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const abs = (base, u) => (!u ? '' : /^https?:\/\//.test(u) ? u : base + u);

const PRIVATE = /^\/(cart|checkout|success|account|login|track|wishlist|compare|reset|prefs|admin|hub|email|field)(\/|$)/;
const STATIC = {
  '/': ['AR Trade International — Printers, Toner, Copiers & Office Equipment in Dhaka', 'Buy genuine printer toner, ink cartridges, copiers, printers and computer accessories online in Bangladesh. Printer servicing and fast delivery in Dhaka from AR Trade International.'],
  '/shop': ['Shop Toner, Ink, Printers & Copiers Online in Bangladesh | AR Trade', 'Browse genuine toner cartridges, ink, printers, photocopiers and parts with best prices in Bangladesh. Fast delivery in Dhaka.'],
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
    const [prods] = await pool.query('SELECT id, img FROM products WHERE active = 1 ORDER BY id DESC');
    const [posts] = await pool.query('SELECT slug, DATE_FORMAT(COALESCE(updated_at, published), "%Y-%m-%d") d FROM blog_posts WHERE status = "Published" AND noindex = 0');
    const [pages] = await pool.query('SELECT slug FROM site_pages WHERE status = "Published" AND grp = "servicing" AND noindex = 0');
    const u = (loc, pri, extra = '') => `<url><loc>${esc(base + loc)}</loc><priority>${pri}</priority>${extra}</url>`;
    const out = [
      ...Object.keys(STATIC).map(p => u(p, p === '/' ? '1.0' : '0.8')),
      ...cats.map(c => u('/shop/' + c.id, '0.8')),
      ...prods.map(p => u('/product/' + p.id, '0.7', p.img ? `<image:image><image:loc>${esc(abs(base, p.img))}</image:loc></image:image>` : '')),
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

    let r;
    if ((r = p.match(/^\/product\/(\d+)$/))) {
      const [[x]] = await pool.query('SELECT * FROM products WHERE id = ? AND active = 1', [r[1]]);
      if (!x) { status = 404; m = { path: p, title: 'Product not found | ' + NAME, desc: 'This product is no longer available.', noindex: true }; } else {
        const [gal] = await pool.query('SELECT path FROM product_images WHERE product_id = ? ORDER BY position LIMIT 6', [x.id]);
        const [[rv]] = await pool.query('SELECT COUNT(*) n, AVG(rating) a FROM reviews WHERE product_id = ? AND status = "Approved"', [x.id]);
        const [[cat]] = (await pool.query('SELECT title FROM categories WHERE id = ?', [x.category_id]));
        const imgs = (gal.length ? gal.map(g => g.path) : [x.img]).filter(Boolean).map(i => abs(base, i));
        const url = `${base}/product/${x.id}`;
        const prod = {
          '@context': 'https://schema.org', '@type': 'Product', name: x.name, image: imgs, sku: x.sku || String(x.id), mpn: x.part || undefined, category: cat?.title,
          description: clip(plain(x.short_desc) || plain(x.description) || x.meta_desc || x.name, 500), brand: x.brand ? { '@type': 'Brand', name: x.brand } : undefined, url
        };
        if (x.price > 0) {
          prod.offers = {
            '@type': 'Offer', url, priceCurrency: 'BDT', price: String(x.price), itemCondition: 'https://schema.org/NewCondition',
            availability: x.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', seller: { '@type': 'Organization', name: NAME }
          };
        }
        if (rv.n > 0) prod.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(rv.a).toFixed(1), reviewCount: Number(rv.n) };
        const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' }, { '@type': 'ListItem', position: 2, name: cat?.title || 'Shop', item: `${base}/shop/${x.category_id}` }, { '@type': 'ListItem', position: 3, name: x.name, item: url }] };
        m = { path: p, type: 'product', title: x.meta_title || `${x.name} | ${NAME}`, desc: x.meta_desc || clip(plain(x.description), 155) || x.name, keywords: x.meta_keywords, image: imgs[0], ld: [prod, crumbs] };
      }
    } else if ((r = p.match(/^\/blog\/([^/]+)$/))) {
      const [[x]] = await pool.query('SELECT slug, title, excerpt, cover, author, body, meta_title, meta_desc, meta_keywords, noindex, DATE_FORMAT(published, "%Y-%m-%d") d FROM blog_posts WHERE slug = ? AND status = "Published"', [decodeURIComponent(r[1])]);
      if (x) {
        const desc = x.meta_desc || x.excerpt || clip(plain(x.body), 155);
        m = { path: p, type: 'article', title: x.meta_title || `${x.title} | ${NAME}`, desc, keywords: x.meta_keywords, noindex: !!x.noindex, image: x.cover, ld: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: x.title, description: desc, image: x.cover ? abs(base, x.cover) : undefined, datePublished: x.d, author: { '@type': 'Person', name: x.author }, publisher: { '@type': 'Organization', name: NAME, logo: { '@type': 'ImageObject', url: base + '/api/uploads/site/artrade-logo.png' } }, mainEntityOfPage: base + p }] };
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
    if (!m) m = { path: p, title: NAME, desc: STATIC['/'][1], noindex: PRIVATE.test(p) || p !== '/' };
    else if (PRIVATE.test(p)) m.noindex = true;

    res.status(status).type('html').send(inject(template(dist), base, m));
  }));
}
