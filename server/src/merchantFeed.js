// Google Merchant Center product feed (RSS 2.0 + g: namespace). Pure: no database, no request. Every value comes from the caller;
// anything missing is left out (a shipping rate, a GTIN ...), nothing is invented.
import { timingSafeEqual } from 'node:crypto';
import { productPath } from './slug.js';
import { NAME, clip, dayOf, esc, plain } from './seoHelpers.js';

export const FEED_CAP = 5000;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** Plain one-line text: tags removed, control characters stripped, spaces collapsed. */
const line = s => plain(String(s ?? '').replace(CTRL, ' '));
const x = s => esc(String(s ?? '').replace(CTRL, ''));
const abs = (base, u) => { const s = String(u || '').trim(); return !s ? '' : /^https?:\/\//i.test(s) ? s : base + (s.startsWith('/') ? '' : '/') + s; };
const money = n => `${Number(n).toFixed(2)} BDT`;
const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** The shared context of one feed run. */
export function feedContext({ base, site = {}, settings = {}, categories = [], now = new Date(), merchant }) {
  const m = merchant && typeof merchant === 'object' ? merchant : {};
  const catMap = new Map(Object.entries(m.categoryMap && typeof m.categoryMap === 'object' ? m.categoryMap : {}).map(([k, v]) => [String(k), line(v)]).filter(([, v]) => v));
  const minPx = Number(m.minImagePx) > 0 ? Number(m.minImagePx) : 800;
  const zone = (settings?.shipping?.zones || []).find(z => z && String(z.id).toLowerCase() === 'dhaka');
  const rate = zone ? num(zone.rate) : NaN;
  return {
    base: String(base || '').replace(/\/$/, ''), now,
    siteName: line(settings?.general?.siteName || site?.name) || NAME,
    cats: new Map((categories || []).map(c => [String(c.id), line(c.title)])),
    dhakaRate: Number.isFinite(rate) && rate >= 0 ? rate : null,
    catMap, excludedCats: new Set((Array.isArray(m.excludedCategories) ? m.excludedCategories : []).map(String)), skipSmall: m.skipSmallImages === true, minPx
  };
}

const AVAIL = { in_stock: 'in stock', out_of_stock: 'out of stock', preorder: 'preorder', backorder: 'backorder' };
export function availabilityText(p) {
  const s = AVAIL[String(p.stock_status || '').toLowerCase()];
  if (s) return s;
  if (p.preorder) return 'preorder';
  return Number(p.stock) > 0 ? 'in stock' : 'out of stock';
}

/** One product -> the feed item (plain object), or { skip: reason }. product.images: optional gallery paths. */
export function feedItem(p, ctx) {
  const c = ctx.cats instanceof Map ? ctx : feedContext(ctx);
  if (!p || Number(p.active) === 0 || p.active === false) return { skip: 'not active' };
  const name = line(p.name);
  if (!name) return { skip: 'name empty' };
  if (Number(p.noindex) === 1) return { skip: 'noindex' };
  const price = num(p.price);
  if (!(price > 0)) return { skip: 'no price' };
  if (p.merchant_exclude === true || Number(p.merchant_exclude) === 1) return { skip: 'excluded by owner' };
  if (c.excludedCats?.has(String(p.category_id))) return { skip: 'category excluded' };
  const minPx = c.minPx || 800;
  const w = Number(p.img_w) || 0, h = Number(p.img_h) || 0, short = w > 0 && h > 0 ? Math.min(w, h) : 0;
  const imgs = [...new Set([p.img, ...(Array.isArray(p.images) ? p.images : [])].map(i => abs(c.base, i)).filter(Boolean))];
  if (!imgs.length) return { skip: 'no image' };
  if (short && short < minPx && c.skipSmall === true) return { skip: 'image too small' };
  const warnings = [];
  if (!short) warnings.push('image size unknown'); else if (short < minPx) warnings.push(`image under ${minPx} px`);

  const it = {
    id: line(p.sku) || String(p.id),
    title: clip(name, 150),
    // the imported catalogue text often starts with "Short:" and is a long spec dump: drop the marker and keep the first 1,500 characters
    description: clip((line(p.description) || line(p.short_desc)).replace(/^Short:\s*/i, '') || `${name} from ${c.siteName}, Dhaka, Bangladesh.`, 1500),
    link: c.base + productPath(p),
    image_link: imgs[0],
    availability: availabilityText(p)
  };
  if (imgs.length > 1) it.additional_image_link = imgs.slice(1, 11);
  const old = num(p.old_price);
  if (old > price) {
    it.price = money(old); it.sale_price = money(price);
    const d = dayOf(p.sale_ends);
    if (d) { const end = new Date(d + 'T23:59:59+06:00'); if (end > c.now) it.sale_price_effective_date = `${c.now.toISOString()}/${end.toISOString()}`; }
  } else it.price = money(price);
  const brand = line(p.brand), gtin = String(p.gtin ?? '').trim(), mpn = line(p.part);
  if (brand) it.brand = brand;
  if (/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(gtin)) it.gtin = gtin;
  if (mpn) it.mpn = mpn;
  it.condition = { refurbished: 'refurbished', used: 'used' }[String(p.item_condition || '').toLowerCase()] || 'new';
  if (!it.gtin && !it.mpn) it.identifier_exists = 'no';
  const cat = c.cats.get(String(p.category_id));
  if (cat) it.product_type = cat;
  const gcat = line(p.google_category) || c.catMap?.get(String(p.category_id)) || '';
  if (gcat) it.google_product_category = clip(gcat, 250);
  const grp = line(p.item_group_id).slice(0, 50);
  if (grp) it.item_group_id = grp;
  if (c.dhakaRate !== null) it.shipping = { country: 'BD', service: 'Standard', price: money(c.dhakaRate) };
  Object.defineProperties(it, { pid: { value: p.id, enumerable: false }, warnings: { value: warnings, enumerable: false } });
  return it;
}

const tag = (n, v) => `<g:${n}>${x(v)}</g:${n}>`;
function itemXml(it) {
  const parts = ['id', 'title', 'description', 'link', 'image_link'].map(k => tag(k, it[k]));
  for (const u of it.additional_image_link || []) parts.push(tag('additional_image_link', u));
  for (const k of ['availability', 'price', 'sale_price', 'sale_price_effective_date', 'brand', 'gtin', 'mpn', 'condition', 'identifier_exists', 'product_type', 'google_product_category', 'item_group_id']) if (it[k] !== undefined) parts.push(tag(k, it[k]));
  if (it.shipping) parts.push(`<g:shipping>${tag('country', it.shipping.country)}${tag('service', it.shipping.service)}${tag('price', it.shipping.price)}</g:shipping>`);
  return `<item>${parts.join('')}</item>`;
}

/** { base, site, settings, products, categories, now, merchant } -> { xml, items, skipped:[{reason,count}], rows:[{pid,included,reason,warnings}], warnings:[{reason,count}] } */
export function buildFeed({ base, site = {}, settings = {}, products = [], categories = [], now = new Date(), merchant }) {
  const ctx = feedContext({ base, site, settings, categories, now, merchant });
  const items = [], skip = new Map(), warn = new Map(), rows = [];
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const p of products || []) {
    const r = feedItem(p, ctx);
    if (r.skip) { bump(skip, r.skip); rows.push({ pid: p?.id, included: false, reason: r.skip, warnings: [] }); continue; }
    if (items.length >= FEED_CAP) { bump(skip, 'over cap'); rows.push({ pid: p.id, included: false, reason: 'over cap', warnings: [] }); continue; }
    items.push(r);
    for (const w of r.warnings) bump(warn, w);
    rows.push({ pid: p.id, included: true, reason: '', warnings: [...r.warnings] });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${x(ctx.siteName)}</title>
<link>${x(ctx.base)}</link>
<description>${x(ctx.siteName + ' products')}</description>
${items.map(itemXml).join('\n')}
</channel>
</rss>`;
  const list = m => [...m].map(([reason, count]) => ({ reason, count }));
  return { xml, items, skipped: list(skip), rows, warnings: list(warn) };
}

const COLS = ['id', 'title', 'description', 'link', 'image_link', 'additional_image_link', 'availability', 'price', 'sale_price', 'sale_price_effective_date', 'brand', 'gtin', 'mpn', 'condition', 'identifier_exists', 'product_type', 'google_product_category', 'item_group_id', 'shipping'];
/** Items -> TSV (default) or CSV text for a Merchant Center file upload. Header row first; single-line values; UTF-8, no BOM; ends with a newline. */
export function buildFeedTable(items, delimiter = '\t') {
  const csv = delimiter === ',';
  const cell = v => {
    const s = String(v ?? '').replace(CTRL, ' ');
    if (!csv) return s.replace(/[\t\r\n]+/g, ' ');
    const t = s.replace(/[\r\n]+/g, ' ');
    return /[",\t]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const val = (it, k) => k === 'additional_image_link' ? (it[k] || []).join(',') : k === 'shipping' ? (it.shipping ? `${it.shipping.country}:${it.shipping.service}:${it.shipping.price}` : '') : it[k];
  const d = csv ? ',' : '\t';
  return [COLS, ...(items || []).map(it => COLS.map(k => val(it, k)))].map(r => r.map(cell).join(d)).join('\n') + '\n';
}

/** The token gate of the feed routes. settings: growth.merchant (may be undefined). -> 'off' (flag off) | 'denied' (token missing/wrong) | 'ok'. */
export function feedAccess(settings, flagOn, queryToken) {
  if (flagOn !== true) return 'off';
  const want = String(settings?.feedToken ?? '');
  if (!want) return 'ok';
  const got = Buffer.from(typeof queryToken === 'string' ? queryToken : ''), exp = Buffer.from(want);
  return got.length === exp.length && timingSafeEqual(got, exp) ? 'ok' : 'denied';
}
