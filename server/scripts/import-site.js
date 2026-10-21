/**
 * Imports the public catalogue of https://artradeinternational.com/ into this application:
 *   - products (WooCommerce Store API) + categories, with every product image downloaded into
 *     server/uploads/products/<category>/ and the rows stored in the `products` table,
 *   - the servicing pages and the corporate-clients / company pages into the `site_pages` table,
 *     with their images in server/uploads/services/<page>/ and server/uploads/clients/<page>/.
 * A JSON snapshot of everything fetched is kept in server/data/site/ so the import can be audited.
 * Only public website data is read: customer accounts and orders are private and are not touched.
 *
 *   npm run import:site                 full import (data + images)
 *   npm run import:site -- --no-images  data only, keep remote image links
 *   npm run import:site -- --only=pages | --only=products
 *   npm run import:site -- --limit=50   first 50 products only (smoke test)
 *
 * Re-running is safe: images already on disk are skipped, and rows an admin has edited (edited = 1) are never overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const UPLOADS = path.join(ROOT, 'uploads');
const DATA = path.join(ROOT, 'data', 'site');
const BASE = 'https://artradeinternational.com';
const UA = 'Mozilla/5.0 (AR Trade catalogue import)';
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const WITH_IMAGES = !args['no-images'];
const ONLY = args.only || '';
const LIMIT = parseInt(args.limit, 10) || 0;

fs.mkdirSync(DATA, { recursive: true });
const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unent = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;|&#8216;/g, "'").replace(/&#8211;/g, '–').replace(/&nbsp;/g, ' ').replace(/&#038;/g, '&');
const plain = h => unent(String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return { json: await r.json(), headers: r.headers }; } catch { /* retry */ }
    await sleep(800 * (i + 1));
  }
  throw new Error('Could not fetch ' + url);
}
async function getText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA } }); if (r.ok) return await r.text(); } catch { /* retry */ }
    await sleep(800 * (i + 1));
  }
  throw new Error('Could not fetch ' + url);
}

// ---------- images ----------
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
let imgOk = 0, imgSkip = 0, imgFail = 0;
/** Downloads one remote image into uploads/<folder>/ and returns its /api/uploads path (or null on failure). */
async function saveImage(url, folder, hint) {
  if (!url) return null;
  try {
    const u = new URL(url, BASE);
    let base = decodeURIComponent(path.basename(u.pathname));
    let ext = path.extname(base).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) ext = '.jpg';
    const stem = slug(base.replace(/\.[a-z0-9]+$/i, '')).slice(0, 60) || 'image';
    const name = `${hint ? hint + '-' : ''}${stem}${ext}`;
    const dir = path.join(UPLOADS, folder);
    const file = path.join(dir, name);
    const rel = `/api/uploads/${folder}/${name}`;
    if (fs.existsSync(file) && fs.statSync(file).size > 100) { imgSkip++; return rel; }
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(u.href, { headers: { 'user-agent': UA } });
        if (!r.ok) throw new Error(r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 100) throw new Error('empty');
        fs.writeFileSync(file, buf); imgOk++; return rel;
      } catch { await sleep(600 * (i + 1)); }
    }
  } catch { /* fall through */ }
  imgFail++; return null;
}
async function pool_(items, n, fn) {
  let i = 0, done = 0;
  const run = async () => { while (i < items.length) { const k = i++; await fn(items[k], k); done++; if (done % 100 === 0) log(`  … ${done}/${items.length}`); } };
  await Promise.all(Array.from({ length: n }, run));
}

// ---------- products ----------
// our storefront categories (see `categories` table) and how the website's category tree maps onto them
const RULES = [ // first match wins, tested against the product's website category slugs
  ['copier', /^(photocopier-machine-price-in-bangladesh|all-photocopier-in-bangladesh|toshiba-photocopier|canon-photocopier|sharp-photocopier|ricoh-photocopier|hp-photocopier-machine)$/],
  ['printer', /^(all-popular-printer-in-bangladesh|laser-printer-price-in-bangladesh|black|color|all-inkjet-printer-price-in-bangladesh|all-inkjet|dot-printer-in-bangladesh|all-dot|epson-dot-printer-in-bangladesh|hp-all-inkjet-printer-price-in-bangladesh|canon-all-inkjet-printer-price-in-bangladesh|brother-all-inkjet-printer-price-in-bangladesh)$/],
  ['camera', /^(security-camera|all-camera-accessories-bangladesh|ir-camera-bd|ip-camera-price|all-nvr-in-bangladesh|xvr-price-in-bangladesh|all-dvr-price-in-bd|wifi-cctv-camera)$/],
  ['scanner', /^(all-scanner-computer-accessories|all-scanner-bangladesh|hp-scanner|epson-scanner|canon-scanner)$/],
  ['parts', /^(spare-parts|printer-replacement-parts)$/],
  ['computer', /^(computer-price-in-bangladesh|best-monitor-price-in-bangladesh|all-desktop-in-bangladesh|laptop-bangladesh|all-table-in-dhaka|notebook-price-in-bangladesh|all-computer-accessories-bangladesh|all-computer-keyboard|all-computer-casing|all-dvd-rom-price|all-computer-hard-disk-in-bangladesh|all-computer-motherboard-bangladesh|all-computer-mouse-price|all-computer-processor|all-computer-ram-in-bangladesh)$/],
  ['copier-toner', /^(popular-photocopier-toner|all-photocopier-toner|photocopier-toner-campaign-price-in-bangladesh|toshiba-photocopier-toner-price-in-bangladesh|canon-photocopier-toner-price-in-bangladesh|sharp-photocopier-toner-price-in-bangladesh|ricoh-photocopier-toner-price-in-bangladesh|drum-unit|drum-canon|sharp-drum-unit|sharp-copier-toner|sharp-tone|kyocera-copier-toner)$/],
  ['ink', /^(ink-cartridge-in-bangladesh|all-cartridge|hp-ink-cartridge-in-bangladesh|canon-ink-cartridge-in-bangladesh|epson-ink-cartridge-in-bangladesh|brother-ink-cartridge-in-bangladesh|ink-bottle|hp-ink-bottle|epson-ink-bottle|canon-ink-bottle|brother-ink-bottle|ribbon-cartridge-price-in-bangladesh|epson-ribbon|hp-ink-bottle-2|epson-ink-bottle-2|canon-ink-bottle-2|hp-ink-cartridge)$/],
  ['toner', /^(toner-price-in-bangladesh|laser-toner-price-in-dhaka|all-laser-toner|laser-toner-campaign|china-toner-cartridge-price-in-bangladesh|uncategorized|kyocera-toner|kyocera|pantum|samsung-laser-toner-price-in-dhaka)$/]
];
const BRANDS = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Toshiba', 'Sharp', 'Ricoh', 'Pantum', 'Kyocera', 'Konica Minolta', 'Xerox', 'Lexmark', 'Laxmark', 'Panasonic', 'Dell', 'LG', 'Acer', 'Lenovo', 'Asus', 'Hikvision', 'Dahua', 'TP-Link', 'Fujitsu', 'Ricoh', 'Gestetner', 'Oki', 'Kodak', 'BenQ', 'AOC', 'Philips', 'Apple', 'Microsoft', 'Logitech', 'Transcend', 'Seagate', 'Kingston'];
const COLORS = [['CMYK', /\b(cmyk|full set)\b/i], ['Black', /\bblack\b/i], ['Cyan', /\bcyan\b/i], ['Magenta', /\bmagenta\b/i], ['Yellow', /\byellow\b/i], ['Color', /\bcolou?r\b/i]];

function pickCategory(wc, catMap) {
  const slugs = new Set();
  for (const c of wc.categories || []) { slugs.add(c.slug); let p = catMap.get(c.id); while (p && p.parent) { p = catMap.get(p.parent); if (p) slugs.add(p.slug); } }
  for (const [id, re] of RULES) for (const s of slugs) if (re.test(s)) return { id, slugs: [...slugs] };
  const n = (wc.name || '').toLowerCase();
  if (/printer/.test(n)) return { id: 'printer', slugs: [...slugs] };
  if (/camera|cctv|dvr|nvr/.test(n)) return { id: 'camera', slugs: [...slugs] };
  if (/monitor|laptop|desktop|keyboard|mouse/.test(n)) return { id: 'computer', slugs: [...slugs] };
  return { id: 'toner', slugs: [...slugs] };
}
function brandOf(name, wc) {
  const n = ' ' + name.toLowerCase() + ' ';
  for (const b of BRANDS) if (n.includes(' ' + b.toLowerCase() + ' ') || n.startsWith(' ' + b.toLowerCase())) return b === 'Laxmark' ? 'Lexmark' : b;
  for (const t of [...(wc.tags || []), ...(wc.categories || [])]) { const m = BRANDS.find(b => unent(t.name).toLowerCase() === b.toLowerCase()); if (m) return m; }
  return unent(name).split(/\s+/)[0].slice(0, 40) || 'Other';
}
const money = (v, minor) => Math.round((parseInt(v, 10) || 0) / Math.pow(10, minor ?? 2));

function mapProduct(wc, catMap) {
  const name = unent(wc.name).slice(0, 255);
  const cat = pickCategory(wc, catMap);
  const regular = money(wc.prices.regular_price, wc.prices.currency_minor_unit);
  const sale = money(wc.prices.price, wc.prices.currency_minor_unit);
  const text = plain(wc.short_description) + ' ' + plain(wc.description);
  const yieldM = /(\d[\d,]*)\s*(?:\+\s*)?pages?/i.exec(text) || /(?:yield|capacity)[^0-9]{0,20}(\d[\d,]*)/i.exec(text);
  const part = (/\(([A-Z0-9][A-Z0-9\-\/ ]{2,18})\)/.exec(name) || /\b([A-Z]{1,3}\d{2,5}[A-Z]{0,3}|\d{2,4}[A-Z])\b/.exec(name) || [])[1] || '';
  const color = (COLORS.find(([, re]) => re.test(name)) || [])[0] || '';
  const tech = /ink|bottle|inkjet/i.test(name + ' ' + cat.slugs.join(' ')) ? 'Inkjet' : /laser|toner/i.test(name + ' ' + cat.slugs.join(' ')) ? 'Laser' : '';
  const compat = ((/compatible (?:with|printers?|models?)[:\s]+([^.]{5,200})/i.exec(text) || [])[1] || '').trim().slice(0, 500);
  const yieldInfo = yieldM ? `~${yieldM[1]} pages` : '';
  const flagged = s => (wc.categories || []).some(c => c.slug === s);
  return {
    id: parseInt(wc.id, 10), cat: cat.id, siteCats: (wc.categories || []).map(c => unent(c.name)), brand: brandOf(name, wc), name,
    old: regular > sale ? regular : 0, price: sale || regular, stock: wc.is_in_stock ? 20 : 0,
    popular: flagged('popular-products') ? 1 : 0, isNew: flagged('new-collection') ? 1 : 0, featured: flagged('offer-products') ? 1 : 0,
    tech, color, yield: yieldInfo, part: part.trim(), compat, spec: [yieldInfo, color].filter(Boolean).join(' · ').slice(0, 255),
    description: sanitizeHtml(wc.description || wc.short_description || '', DESC_OPTS).trim(), url: wc.permalink || '',
    images: (wc.images || []).map(i => i.src).filter(Boolean)
  };
}
const DESC_OPTS = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'hr'],
  allowedAttributes: { a: ['href'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: { a: (t, a) => ({ tagName: 'a', attribs: { href: a.href || '', target: '_blank', rel: 'noopener' } }), h1: 'h2', h5: 'h4', h6: 'h4' }
};

async function importProducts() {
  log('\n== Products ==');
  const cats = [];
  for (let page = 1; page < 6; page++) {
    const { json } = await getJson(`${BASE}/wp-json/wc/store/v1/products/categories?per_page=100&page=${page}`);
    if (!json.length) break; cats.push(...json);
    if (json.length < 100) break;
  }
  const catMap = new Map(cats.map(c => [c.id, c]));
  fs.writeFileSync(path.join(DATA, 'categories.json'), JSON.stringify(cats.map(c => ({ id: c.id, name: unent(c.name), slug: c.slug, parent: c.parent, count: c.count })), null, 1));
  log(`website categories: ${cats.length}`);

  const raw = [];
  for (let page = 1; ; page++) {
    const { json, headers } = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    raw.push(...json);
    const pages = parseInt(headers.get('x-wp-totalpages'), 10) || 1;
    log(`fetched page ${page}/${pages} (${raw.length} products)`);
    if (page >= pages || (LIMIT && raw.length >= LIMIT)) break;
  }
  const list = (LIMIT ? raw.slice(0, LIMIT) : raw).map(w => mapProduct(w, catMap));
  const byCat = {};
  list.forEach(p => { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
  log('mapped to our categories:', JSON.stringify(byCat));

  if (WITH_IMAGES) {
    const jobs = list.flatMap(p => p.images.map((src, n) => ({ p, src, n })));
    log(`downloading ${jobs.length} images into uploads/products/<category>/ …`);
    await pool_(jobs, 10, async ({ p, src, n }) => { const rel = await saveImage(src, `products/${p.cat}`, String(p.id) + (n ? '-' + n : '')); (p.local ||= [])[n] = rel; });
    log(`images: ${imgOk} downloaded, ${imgSkip} already present, ${imgFail} failed`);
  }
  fs.writeFileSync(path.join(DATA, 'products.json'), JSON.stringify(list.map(({ local, ...p }) => ({ ...p, localImages: local || [] })), null, 1));

  // database
  const [have] = await pool.query('SELECT id, edited FROM products');
  const edited = new Set(have.filter(r => r.edited).map(r => r.id));
  let ins = 0, upd = 0, kept = 0;
  for (const p of list) {
    const imgs = WITH_IMAGES ? (p.local || []).filter(Boolean) : p.images;
    const img = imgs[0] || null;
    const gallery = JSON.stringify(imgs);
    if (edited.has(p.id)) { kept++; continue; }
    const [r] = await pool.query(
      `INSERT INTO products (id,category_id,brand,name,old_price,price,img,stock,popular,is_new,featured,active,tech,color,yield_info,part,compat,spec,extra,gallery,description,source_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,'[]',?,?,?)
       ON DUPLICATE KEY UPDATE category_id=VALUES(category_id), brand=VALUES(brand), name=VALUES(name), old_price=VALUES(old_price), price=VALUES(price), img=VALUES(img), stock=VALUES(stock),
         popular=VALUES(popular), is_new=VALUES(is_new), featured=VALUES(featured), active=1, tech=VALUES(tech), color=VALUES(color), yield_info=VALUES(yield_info), part=VALUES(part),
         compat=VALUES(compat), spec=VALUES(spec), gallery=VALUES(gallery), description=VALUES(description), source_url=VALUES(source_url)`,
      [p.id, p.cat, p.brand, p.name, p.old, p.price, img, p.stock, p.popular, p.isNew, p.featured, p.tech, p.color, p.yield, p.part, p.compat, p.spec, gallery, p.description, p.url]);
    if (r.affectedRows === 1) ins++; else upd++;
  }
  // the 47 hand-made demo products from the design file are superseded by the real catalogue
  const ids = list.map(p => p.id);
  const [hid] = await pool.query(`UPDATE products SET active = 0 WHERE source_url = '' AND edited = 0 ${ids.length ? 'AND id NOT IN (?)' : ''}`, ids.length ? [ids] : []);
  log(`database: ${ins} new, ${upd} updated, ${kept} skipped (edited by an admin), ${hid.affectedRows} demo products hidden`);
}

// ---------- pages (servicing + corporate clients + company) ----------
const PAGES = [
  { slug: 'printer-servicing', group: 'servicing', title: 'Printer servicing', sort: 1 },
  { slug: 'photocopier-servicing', group: 'servicing', title: 'Photocopier servicing', sort: 2 },
  { slug: 'computer-servicing', group: 'servicing', title: 'Computer servicing', sort: 3 },
  { slug: 'cctv-camera-servicing', group: 'servicing', title: 'CCTV camera servicing', sort: 4 },
  { slug: 'our-clients', group: 'clients', title: 'Our corporate clients', sort: 1 },
  { slug: 'company-profile', group: 'company', title: 'Company profile', sort: 1 },
  { slug: 'mission-vision', group: 'company', title: 'Mission and vision', sort: 2 }
];
const PAGE_OPTS = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: { a: (t, a) => ({ tagName: 'a', attribs: { href: a.href || '', target: '_blank', rel: 'noopener' } }), h1: 'h2', h5: 'h4', h6: 'h4', div: 'p',
    img: (t, a) => ({ tagName: 'img', attribs: { src: a['data-src'] || a.src || '', alt: a.alt || '', loading: 'lazy' } }) },
  exclusiveFilter: f => f.tag === 'img' && (!/\/wp-content\/uploads\//.test(f.attribs.src || '') || /(facebook|instagram|linkedin|youtube|twitter)\.(webp|png)/i.test(f.attribs.src || '') || /logo|icon/i.test(f.attribs.alt || ''))
};
/** Pulls the text of the page body (everything inside .page-content) out of the rendered website page. */
function pageBody(html) {
  const m = /<div class="page-content[^"]*"[^>]*>/.exec(html);
  if (!m) return '';
  let i = m.index + m[0].length, depth = 1;
  const re = /<(\/?)div\b[^>]*>/g; re.lastIndex = i;
  let x; while ((x = re.exec(html))) { depth += x[1] ? -1 : 1; if (!depth) break; }
  return html.slice(i, x ? x.index : i + 120000);
}

async function importPages() {
  log('\n== Pages (servicing, clients, company) ==');
  const out = [];
  for (const pg of PAGES) {
    let html;
    try { html = await getText(`${BASE}/${pg.slug}/`); } catch (e) { log('skip', pg.slug, e.message); continue; }
    let body = sanitizeHtml(pageBody(html), PAGE_OPTS)
      .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/g, '').replace(/(<br\s*\/?>\s*){3,}/g, '<br><br>');
    const imgs = [...body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
    const folder = `${pg.group === 'servicing' ? 'services' : pg.group === 'clients' ? 'clients' : 'company'}/${pg.slug}`;
    const local = {};
    if (WITH_IMAGES) {
      await pool_(imgs, 6, async src => { local[src] = await saveImage(src, folder); });
      body = body.replace(/<img src="([^"]+)"/g, (all, s) => `<img src="${local[s] || s}"`);
    }
    const cover = (WITH_IMAGES ? Object.values(local).find(Boolean) : imgs[0]) || '';
    const excerpt = plain(body).slice(0, 200);
    out.push({ ...pg, body, cover, excerpt, images: WITH_IMAGES ? Object.values(local).filter(Boolean) : imgs, source: `${BASE}/${pg.slug}/` });
    log(`${pg.slug}: ${plain(body).length} chars, ${imgs.length} images`);
  }
  fs.writeFileSync(path.join(DATA, 'pages.json'), JSON.stringify(out, null, 1));
  for (const p of out) {
    const [[ex]] = await pool.query('SELECT edited FROM site_pages WHERE slug = ?', [p.slug]);
    if (ex && ex.edited) { log('kept admin edits of', p.slug); continue; }
    await pool.query(`INSERT INTO site_pages (slug, grp, title, excerpt, body, cover, images, sort_order, source_url) VALUES (?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE title=VALUES(title), excerpt=VALUES(excerpt), body=VALUES(body), cover=VALUES(cover), images=VALUES(images), source_url=VALUES(source_url)`,
      [p.slug, p.group, p.title, p.excerpt, p.body, p.cover, JSON.stringify(p.images), p.sort, p.source]);
  }
  log(`database: ${out.length} pages stored`);
}

(async () => {
  const t0 = Date.now();
  try {
    if (!ONLY || ONLY === 'products') await importProducts();
    if (!ONLY || ONLY === 'pages') await importPages();
    log(`\nDone in ${Math.round((Date.now() - t0) / 1000)}s. Snapshot: ${path.relative(ROOT, DATA)}/  Images: ${path.relative(ROOT, UPLOADS)}/`);
  } catch (e) { console.error('Import failed:', e); process.exitCode = 1; }
  await pool.end();
})();
