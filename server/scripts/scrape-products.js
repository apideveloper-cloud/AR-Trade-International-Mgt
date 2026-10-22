/**
 * Full product scrape of https://artradeinternational.com/ into this application's database and uploads folder.
 *
 * For every product it stores:
 *   products        name, brand, SKU, prices, stock, short + full description, tags, source link
 *   product_images  every picture (position, alt, original link, local file, size)  -> files in uploads/products/<category>/
 *   product_specs   specifications (website attributes + "Name: value" lines and tables found in the descriptions)
 *
 * Pictures are checked to be real images (never an HTML error page), resized to at most 1000 px and compressed.
 * If a product has no usable picture in the store feed, its web page is searched (gallery, og:image).
 * Products an admin has edited (products.edited = 1) keep their text, prices and main picture; only missing pictures/specs are added.
 *
 *   npm run scrape:products                  everything
 *   npm run scrape:products -- --limit=50    first 50 products (test)
 *   npm run scrape:products -- --only-missing   only products that have no picture yet
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import sanitizeHtml from 'sanitize-html';
import { pool } from '../src/db.js';

sharp.cache(false);
const BASE = 'https://artradeinternational.com';
const UA = 'Mozilla/5.0 (AR Trade catalogue scrape)';
const UP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const LIMIT = parseInt(args.limit, 10) || 0;
const ONLY_MISSING = !!args['only-missing'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unent = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;/g, "'").replace(/&#8211;/g, '–').replace(/&nbsp;/g, ' ').replace(/&#038;/g, '&');
const plain = h => unent(String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
const log = (...a) => console.log(...a);

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } }); if (r.ok) return { json: await r.json(), headers: r.headers }; } catch { /* retry */ }
    await sleep(700 * (i + 1));
  }
  throw new Error('Could not fetch ' + url);
}
async function getBuf(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'user-agent': UA } }); if (r.ok) return Buffer.from(await r.arrayBuffer()); if (r.status === 404) return null; } catch { /* retry */ }
    await sleep(600 * (i + 1));
  }
  return null;
}
const isImage = b => b && b.length > 400 && ((b[0] === 0xff && b[1] === 0xd8) || (b[0] === 0x89 && b[1] === 0x50) || (b[0] === 0x47 && b[1] === 0x49) || (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP'));

/** Downloads one picture, validates it, shrinks it and stores it under uploads/products/<cat>/. Returns { path, w, h } or null. */
async function savePicture(url, cat, id, n) {
  const buf = await getBuf(url);
  if (!isImage(buf)) return null;
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata();
    const ext = meta.format === 'png' ? 'png' : meta.format === 'webp' ? 'webp' : 'jpg';
    const base = slug(decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.[a-z0-9]+$/i, ''));
    const name = `${id}${n ? '-' + n : ''}-${base}.${ext}`;
    const rel = `products/${cat}/${name}`;
    const file = path.join(UP, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let img = sharp(buf, { failOn: 'none' }).rotate();
    if (Math.max(meta.width || 0, meta.height || 0) > 1000) img = img.resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true });
    const out = ext === 'png' ? await img.png({ compressionLevel: 9, palette: !meta.hasAlpha, quality: 82 }).toBuffer() : ext === 'webp' ? await img.webp({ quality: 80 }).toBuffer() : await img.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
    fs.writeFileSync(file, out.length < buf.length ? out : buf);
    const m2 = await sharp(fs.readFileSync(file)).metadata();
    return { path: '/api/uploads/' + rel, w: m2.width || 0, h: m2.height || 0 };
  } catch { return null; }
}

/** Pictures from the product web page when the store feed has none: gallery images, og:image, main image. */
async function pagePictures(link) {
  try {
    const r = await fetch(link, { headers: { 'user-agent': UA } });
    if (!r.ok) return [];
    const h = await r.text();
    const found = new Set();
    for (const m of h.matchAll(/(?:data-large_image|data-src|href|content)="(https?:\/\/[^"]+\/wp-content\/uploads\/[^"]+\.(?:jpe?g|png|webp))"/gi)) found.add(m[1].replace(/-\d+x\d+(\.[a-z]+)$/i, '$1'));
    const main = (h.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
    return [...new Set([main, ...found].filter(Boolean))].slice(0, 6);
  } catch { return []; }
}

/** "Name: value" lines and two-column tables found in the product descriptions -> specification rows. */
function parseSpecs(...htmls) {
  const rows = [];
  const add = (k, v) => { k = plain(k).replace(/[:：]+$/, '').slice(0, 80); v = plain(v).slice(0, 500); if (k && v && k.length < 60 && !/^(note|warranty note)$/i.test(k)) rows.push([k, v]); };
  for (const h of htmls) {
    for (const t of String(h || '').matchAll(/<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)) add(t[1], t[2]);
    for (const li of String(h || '').matchAll(/<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi)) {
      const m = /^\s*(?:<[^>]+>\s*)*([A-Za-z][A-Za-z0-9 /&().+-]{1,40}?)\s*(?:<\/[^>]+>\s*)*[:：]\s*([\s\S]{1,300})$/.exec(li[1]);
      if (m) add(m[1], m[2]);
    }
  }
  const seen = new Set();
  // drop table header rows such as "Color | Part Number" and repeated names
  return rows.filter(([k, v]) => { const key = k.toLowerCase(); if (seen.has(key) || /^(part number|part no\.?|model|specification|description|value)$/i.test(v)) return false; seen.add(key); return true; }).slice(0, 25);
}

const DESC = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'hr'],
  allowedAttributes: { a: ['href'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: { a: (t, a) => ({ tagName: 'a', attribs: { href: a.href || '', target: '_blank', rel: 'noopener' } }), h1: 'h2', h5: 'h4', h6: 'h4' }
};

// ---- storefront category mapping (same rules as import-site) ----
const RULES = [
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

async function main() {
  log('Reading the store feed…');
  const cats = [];
  for (let p = 1; p < 6; p++) { const { json } = await getJson(`${BASE}/wp-json/wc/store/v1/products/categories?per_page=100&page=${p}`); if (!json.length) break; cats.push(...json); if (json.length < 100) break; }
  const catMap = new Map(cats.map(c => [c.id, c]));
  const raw = [];
  for (let page = 1; ; page++) {
    const { json, headers } = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    raw.push(...json);
    const pages = parseInt(headers.get('x-wp-totalpages'), 10) || 1;
    log(`  page ${page}/${pages}  (${raw.length} products)`);
    if (page >= pages || (LIMIT && raw.length >= LIMIT)) break;
  }
  const list = LIMIT ? raw.slice(0, LIMIT) : raw;

  const [have] = await pool.query('SELECT id, category_id, img, edited, (SELECT COUNT(*) FROM product_images i WHERE i.product_id = p.id) imgs FROM products p');
  const known = new Map(have.map(r => [r.id, r]));
  let nImg = 0, nSpec = 0, nNew = 0, nNoPic = 0, nFromPage = 0, done = 0;
  const queue = list.filter(w => !ONLY_MISSING || !(known.get(parseInt(w.id, 10)) || {}).imgs);

  async function work(w) {
    const id = parseInt(w.id, 10);
    const cur = known.get(id);
    const slugs = new Set();
    for (const c of w.categories || []) { slugs.add(c.slug); let p = catMap.get(c.id); while (p && p.parent) { p = catMap.get(p.parent); if (p) slugs.add(p.slug); } }
    let cat = cur ? cur.category_id : null;
    if (!cat) { for (const [cid, re] of RULES) { if ([...slugs].some(s => re.test(s))) { cat = cid; break; } } cat = cat || 'toner'; }
    const name = unent(w.name).slice(0, 255);
    const shortHtml = sanitizeHtml(w.short_description || '', DESC).trim();
    const fullHtml = sanitizeHtml(w.description || '', DESC).trim();
    const tags = (w.tags || []).map(t => unent(t.name)).slice(0, 20);
    const minor = w.prices && w.prices.currency_minor_unit != null ? w.prices.currency_minor_unit : 2;
    const money = v => Math.round((parseInt(v, 10) || 0) / Math.pow(10, minor));
    const reg = money(w.prices && w.prices.regular_price), sale = money(w.prices && w.prices.price);

    // pictures: feed first, then the web page
    let urls = (w.images || []).map(i => i.src).filter(Boolean);
    const alts = new Map((w.images || []).map(i => [i.src, i.alt || '']));
    const saved = [];
    for (const u of urls.slice(0, 8)) { const s = await savePicture(u, cat, id, saved.length); if (s) saved.push({ ...s, src: u, alt: alts.get(u) || name }); }
    if (!saved.length) {
      for (const u of await pagePictures(w.permalink)) { const s = await savePicture(u, cat, id, saved.length); if (s) { saved.push({ ...s, src: u, alt: name }); nFromPage++; } if (saved.length >= 4) break; }
    }
    if (!saved.length) nNoPic++;

    const specs = [];
    for (const a of w.attributes || []) { const v = (a.terms || []).map(t => unent(t.name)).join(', '); if (a.name && v) specs.push([unent(a.name), v]); }
    for (const r of parseSpecs(w.short_description, w.description)) if (!specs.some(s => s[0].toLowerCase() === r[0].toLowerCase())) specs.push(r);

    if (!cur) {
      await pool.query(`INSERT INTO products (id,category_id,brand,name,old_price,price,img,stock,active,gallery,description,source_url,sku,short_desc,tags) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,?)`,
        [id, cat, unent((w.categories || [])[0] && (w.categories || [])[0].name).slice(0, 80) || 'Other', name, reg > sale ? reg : 0, sale || reg, (saved[0] || {}).path || null, w.is_in_stock ? 20 : 0, JSON.stringify(saved.map(s => s.path)), fullHtml, w.permalink || '', String(w.sku || '').slice(0, 80), shortHtml, JSON.stringify(tags)]);
      nNew++;
    } else if (!cur.edited) {
      await pool.query('UPDATE products SET name = ?, old_price = ?, price = ?, description = ?, source_url = ?, sku = ?, short_desc = ?, tags = ? WHERE id = ?',
        [name, reg > sale ? reg : 0, sale || reg, fullHtml, w.permalink || '', String(w.sku || '').slice(0, 80), shortHtml, JSON.stringify(tags), id]);
    }
    if (saved.length && (!cur || !cur.edited || !cur.img)) {
      await pool.query('UPDATE products SET img = ?, gallery = ? WHERE id = ?', [saved[0].path, JSON.stringify(saved.map(s => s.path)), id]);
    }
    if (saved.length) {
      await pool.query('DELETE FROM product_images WHERE product_id = ?', [id]);
      for (const [i, s] of saved.entries()) await pool.query('INSERT INTO product_images (product_id, position, src_url, path, alt, width, height) VALUES (?,?,?,?,?,?,?)', [id, i, s.src.slice(0, 500), s.path, String(s.alt).slice(0, 255), s.w, s.h]);
      nImg += saved.length;
    }
    if (specs.length && !(cur && cur.edited)) {
      await pool.query('DELETE FROM product_specs WHERE product_id = ?', [id]);
      for (const [i, [k, v]] of specs.entries()) await pool.query('INSERT INTO product_specs (product_id, position, name, value) VALUES (?,?,?,?)', [id, i, k.slice(0, 80), v.slice(0, 500)]);
      nSpec += specs.length;
    }
    if (++done % 100 === 0) log(`  … ${done}/${queue.length} products, ${nImg} pictures`);
  }
  const q = [...queue];
  await Promise.all(Array.from({ length: 4 }, async () => { while (q.length) { const w = q.pop(); try { await work(w); } catch (e) { log('  skipped', w.id, e.message.slice(0, 80)); } await sleep(120); } }));
  log(`\nDone: ${done} products processed (${nNew} new), ${nImg} pictures stored (${nFromPage} found on the web pages), ${nSpec} specification rows, ${nNoPic} products with no picture anywhere.`);
  await pool.end();
}
main().catch(e => { console.error('Scrape failed:', e); process.exit(1); });
