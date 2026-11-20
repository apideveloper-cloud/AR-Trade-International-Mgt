// Google Merchant Center product feed (RSS 2.0 + g: namespace). Pure: no database, no request. Every value comes from the caller;
// anything missing is left out (a shipping rate, a GTIN ...), nothing is invented.
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
export function feedContext({ base, site = {}, settings = {}, categories = [], now = new Date() }) {
  const zone = (settings?.shipping?.zones || []).find(z => z && String(z.id).toLowerCase() === 'dhaka');
  const rate = zone ? num(zone.rate) : NaN;
  return {
    base: String(base || '').replace(/\/$/, ''), now,
    siteName: line(settings?.general?.siteName || site?.name) || NAME,
    cats: new Map((categories || []).map(c => [String(c.id), line(c.title)])),
    dhakaRate: Number.isFinite(rate) && rate >= 0 ? rate : null
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
  const imgs = [...new Set([p.img, ...(Array.isArray(p.images) ? p.images : [])].map(i => abs(c.base, i)).filter(Boolean))];
  if (!imgs.length) return { skip: 'no image' };

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
  if (c.dhakaRate !== null) it.shipping = { country: 'BD', service: 'Standard', price: money(c.dhakaRate) };
  return it;
}

const tag = (n, v) => `<g:${n}>${x(v)}</g:${n}>`;
function itemXml(it) {
  const parts = ['id', 'title', 'description', 'link', 'image_link'].map(k => tag(k, it[k]));
  for (const u of it.additional_image_link || []) parts.push(tag('additional_image_link', u));
  for (const k of ['availability', 'price', 'sale_price', 'sale_price_effective_date', 'brand', 'gtin', 'mpn', 'condition', 'identifier_exists', 'product_type']) if (it[k] !== undefined) parts.push(tag(k, it[k]));
  if (it.shipping) parts.push(`<g:shipping>${tag('country', it.shipping.country)}${tag('service', it.shipping.service)}${tag('price', it.shipping.price)}</g:shipping>`);
  return `<item>${parts.join('')}</item>`;
}

/** { base, site, settings, products, categories, now } -> { xml, items, skipped:[{reason,count}] } */
export function buildFeed({ base, site = {}, settings = {}, products = [], categories = [], now = new Date() }) {
  const ctx = feedContext({ base, site, settings, categories, now });
  const items = [], skip = new Map();
  for (const p of products || []) {
    const r = feedItem(p, ctx);
    if (r.skip) { skip.set(r.skip, (skip.get(r.skip) || 0) + 1); continue; }
    if (items.length >= FEED_CAP) { skip.set('over cap', (skip.get('over cap') || 0) + 1); continue; }
    items.push(r);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n<title>${x(ctx.siteName)}</title>\n<link>${x(ctx.base)}</link>\n<description>${x(ctx.siteName + ' products')}</description>\n${items.map(itemXml).join('\n')}\n</channel>\n</rss>`;
  return { xml, items, skipped: [...skip].map(([reason, count]) => ({ reason, count })) };
}
