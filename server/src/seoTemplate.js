// Pure SEO template engine. No database, no request.
// Grammar: {var}  [optional group: dropped when any {var} directly inside is empty]  {if var}..{else}..{/if}  \[ \] \{ \} literals.
import { clip, plain } from './seoHelpers.js';

export const TEMPLATE_VARS = [
  { key: 'product_name', label: 'Product name', example: 'HP 230A Black Toner Cartridge' },
  { key: 'brand', label: 'Brand', example: 'HP' },
  { key: 'category', label: 'Category', example: 'Toner Cartridges' },
  { key: 'price', label: 'Price (whole number)', example: '16,200' },
  { key: 'sale_price', label: 'Sale price (only when discounted)', example: '14,900' },
  { key: 'currency', label: 'Currency', example: 'BDT' },
  { key: 'sku', label: 'SKU', example: 'HP-230A-BK' },
  { key: 'mpn', label: 'Part number (MPN)', example: 'CF230A' },
  { key: 'model', label: 'Model', example: 'CF230A' },
  { key: 'stock_status', label: 'Stock status', example: 'In stock' },
  { key: 'site_name', label: 'Site name', example: 'AR Trade International' },
  { key: 'site_name_short', label: 'Short site name', example: 'AR Trade' },
  { key: 'site_name_full', label: 'Full site name', example: 'AR Trade International' },
  { key: 'sep', label: 'Separator', example: '|' },
  { key: 'year', label: 'Year', example: '2026' },
  { key: 'month', label: 'Month', example: 'November' },
  { key: 'short_description', label: 'Short description / excerpt', example: 'Genuine toner for HP LaserJet printers.' },
  { key: 'name', label: 'Name (category / brand / blog / page title)', example: 'Toner Cartridges' },
  { key: 'name_lower', label: 'Name in lower case', example: 'toner cartridges' },
  { key: 'description', label: 'Description (category)', example: 'Original toner for every printer.' }
];

/** Character limits the callers pass as `max`. */
export const TEMPLATE_LIMITS = { title: 60, description: 155, ogTitle: 90, ogDescription: 200 };

// Differences from today's output (all only when today's full text does not fit):
//  product title, priced:  today falls back "Name – Price in BD | AR Trade" -> "Name – Price in BD" -> "Name | AR Trade" -> clip.
//                          The template drops groups from the right: -> "Name – Price in BD" -> "Name" -> clip. ("Name | AR Trade" is not produced.)
//  product description:    today shortens the product name and keeps the tail; the template drops " and cash on delivery" first, then clips the whole text.
//  category title:         same as the priced product title ("Name Price in Bangladesh | AR Trade" -> "Name Price in Bangladesh" -> "Name").
//  category description:   the optional {description} is dropped before anything is cut (today the tail is cut).
export const DEFAULT_TEMPLATES = {
  product: {
    title: '{product_name}{if price}[ – Price in BD][ {sep} {site_name_short}]{else}[ {sep} {site_name_short}[, Dhaka]]{/if}',
    description: '{if price}Buy {product_name} at ৳{price} in Bangladesh. Genuine product, fast delivery in Dhaka[ and cash on delivery].{else}{product_name} from {site_name_full}, Dhaka. Genuine product with fast delivery in Dhaka. Call or message us for the latest price.{/if}',
    ogTitle: '{product_name}{if price}[ – Price in BD]{/if}',
    ogDescription: '{if price}Buy {product_name} at ৳{price} in Bangladesh. Genuine product, fast delivery in Dhaka[ and cash on delivery].{else}{product_name} from {site_name_full}, Dhaka. Genuine product with fast delivery in Dhaka. Call or message us for the latest price.{/if}'
  },
  category: {
    title: '{name}[ Price in Bangladesh][ {sep} {site_name_short}]',
    description: 'Buy genuine {name_lower} online in Bangladesh.[ {description}] Best prices and fast delivery in Dhaka.',
    ogTitle: '{name}[ Price in Bangladesh]',
    ogDescription: 'Buy genuine {name_lower} online in Bangladesh.[ {description}] Best prices and fast delivery in Dhaka.'
  },
  brand: {
    title: '{brand} Price in Bangladesh {sep} {site_name}',
    description: 'Buy genuine {brand} printers, toner and accessories in Bangladesh from {site_name_full}, Dhaka.',
    ogTitle: '{brand} Price in Bangladesh',
    ogDescription: 'Buy genuine {brand} printers, toner and accessories in Bangladesh from {site_name_full}, Dhaka.'
  },
  blog: {
    title: '{name} {sep} {site_name_full}',
    description: '{short_description}',
    ogTitle: '{name}',
    ogDescription: '{short_description}'
  },
  page: {
    title: '{name} {sep} {site_name_full}',
    description: '{short_description}',
    ogTitle: '{name}',
    ogDescription: '{short_description}'
  },
  home: {
    title: 'AR Trade International | Printers, Toner & Copiers in Dhaka',
    description: 'Buy genuine printer toner, ink, copiers, printers and computer accessories online in Bangladesh. Printer servicing and fast delivery in Dhaka.',
    ogTitle: 'AR Trade International | Printers, Toner & Copiers in Dhaka',
    ogDescription: 'Buy genuine printer toner, ink, copiers, printers and computer accessories online in Bangladesh. Printer servicing and fast delivery in Dhaka.'
  }
};

// ---------- parser ----------
function parse(src) {
  const s = String(src ?? '');
  let gid = 0;
  const root = { t: 'seq', kids: [] };
  const stack = [{ node: root, kids: root.kids, type: 'root' }];
  const top = () => stack[stack.length - 1];
  const text = ch => { const k = top().kids; const l = k[k.length - 1]; if (l && l.t === 'text') l.v += ch; else k.push({ t: 'text', v: ch }); };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && '[]{}'.includes(s[i + 1] || ' ')) { text(s[++i]); continue; }
    if (c === '[') {
      const g = { t: 'group', id: gid++, kids: [] };
      top().kids.push(g); stack.push({ node: g, kids: g.kids, type: 'group' });
      continue;
    }
    if (c === ']') {
      if (stack.some(f => f.type === 'group')) { while (top().type !== 'group') stack.pop(); stack.pop(); } else text(c);
      continue;
    }
    if (c === '{') {
      const end = s.indexOf('}', i);
      if (end < 0) { text(c); continue; }
      const tag = s.slice(i + 1, end).trim();
      let m;
      if ((m = tag.match(/^if\s+([A-Za-z_][A-Za-z0-9_]*)$/))) {
        const n = { t: 'if', cond: m[1], then: [], else: [] };
        top().kids.push(n); stack.push({ node: n, kids: n.then, type: 'if' });
      } else if (tag === 'else') {
        const f = top();
        if (f.type === 'if' && f.kids === f.node.then) f.kids = f.node.else;
        // inside a group within an if: close nothing, ignore
        else if (stack.some(x => x.type === 'if')) { while (top().type !== 'if') stack.pop(); const f2 = top(); if (f2.kids === f2.node.then) f2.kids = f2.node.else; }
      } else if (tag === '/if') {
        if (stack.some(x => x.type === 'if')) { while (top().type !== 'if') stack.pop(); stack.pop(); }
      } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tag)) {
        top().kids.push({ t: 'var', k: tag });
      } else { text(c); continue; }
      i = end;
      continue;
    }
    text(c);
  }
  return root;
}

const val = (vars, k) => { const v = vars && Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : ''; return v == null ? '' : String(v); };

function run(kids, vars, drop, kept, frame) {
  let out = '';
  for (const n of kids) {
    if (n.t === 'text') out += n.v;
    else if (n.t === 'var') { const v = val(vars, n.k); if (!v.trim()) frame.empty = true; out += v; }
    else if (n.t === 'if') out += run(val(vars, n.cond).trim() ? n.then : n.else, vars, drop, kept, frame);
    else if (n.t === 'group') {
      if (drop.has(n.id)) continue;
      const f = { empty: false };
      const inner = run(n.kids, vars, drop, kept, f);
      if (!f.empty) { out += inner; kept.push(n.id); }
    }
  }
  return out;
}

const SEP = '[|–·-]';
function tidy(s) {
  return String(s)
    .replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(new RegExp(`(\\s${SEP})(\\s*${SEP})+(?=\\s|$)`, 'g'), '$1') // "| |" -> "|"
    .replace(new RegExp(`^\\s*${SEP}\\s+`), '')
    .replace(new RegExp(`\\s+${SEP}\\s*$`), '')
    .replace(/\s+,/g, ',')
    .trim();
}

/**
 * Cuts at a word boundary, but when the cut falls inside the part after a separator (" | AR Trade Intern") the whole part is
 * dropped with its separator, so a title never ends in half a brand name ("... Price in Bangladesh | AR").
 */
function clipAtSeparator(text, limit) {
  const cut = clip(text, limit);
  if (cut.length >= text.length) return cut;
  const seps = [...cut.matchAll(new RegExp(`\\s${SEP}\\s`, 'g'))];
  const last = seps[seps.length - 1];
  return last && last.index >= 15 ? cut.slice(0, last.index) : cut;
}

/** Renders a template to plain text. Never throws; unknown variables are empty. */
export function renderTemplate(template, vars, { max } = {}) {
  let ast;
  try { ast = parse(template); } catch { return ''; }
  const drop = new Set();
  const render = () => { const kept = []; const out = tidy(run(ast.kids, vars || {}, drop, kept, { empty: false })); return { out, kept }; };
  let r = render();
  const limit = Number(max) > 0 ? Number(max) : 0;
  if (!limit) return r.out;
  while (r.out.length > limit && r.kept.length) { drop.add(Math.max(...r.kept)); r = render(); }
  if (r.out.length > limit) r = { out: tidy(clipAtSeparator(r.out, limit)) };
  return r.out;
}

// ---------- variables ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const oneLine = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const money = n => (Number(n) > 0 ? Math.round(Number(n)).toLocaleString('en-US') : '');

function stockStatus(x) {
  const raw = String(x.stock_status ?? x.availability ?? '').toLowerCase().replace(/[\s_-]/g, '');
  if (raw === 'preorder') return 'Pre-order';
  if (raw === 'backorder') return 'Back-order';
  if (raw === 'outofstock') return 'Out of stock';
  if (raw === 'instock') return 'In stock';
  if (x.stock === null || x.stock === undefined || x.stock === '') return '';
  return Number(x.stock) > 0 ? 'In stock' : 'Out of stock';
}

/** Variables for an entity row. settings = normalised seo settings. now = Date (tests). */
export function varsFor(kind, entity, settings, now = new Date()) {
  const e = entity || {}, g = (settings && settings.general) || {};
  const full = oneLine(g.siteNameFull) || 'AR Trade International';
  const v = {
    product_name: '', brand: '', category: '', price: '', sale_price: '', currency: 'BDT', sku: '', mpn: '', model: '', stock_status: '',
    site_name: oneLine(g.siteName) || full, site_name_short: oneLine(g.siteNameShort) || 'AR Trade', site_name_full: full,
    sep: oneLine(g.separator) || '|', year: String(now.getFullYear()), month: MONTHS[now.getMonth()], short_description: '', name: '', name_lower: '', description: ''
  };
  if (kind === 'product') {
    v.product_name = oneLine(e.name); v.name = v.product_name; v.name_lower = v.name.toLowerCase();
    v.brand = oneLine(e.brand); v.category = oneLine(typeof e.cat === 'object' && e.cat ? e.cat.title : e.cat ?? e.category);
    v.sku = oneLine(e.sku); v.mpn = oneLine(e.part ?? e.mpn); v.model = oneLine(e.model || e.part || e.mpn);
    v.price = money(e.price);
    if (Number(e.old_price) > Number(e.price) && Number(e.price) > 0) v.sale_price = money(e.price);
    v.stock_status = stockStatus(e);
    v.short_description = oneLine(plain(e.short_desc));
  } else if (kind === 'category') {
    v.name = oneLine(e.title ?? e.name); v.category = v.name; v.name_lower = v.name.toLowerCase();
    v.description = oneLine(plain(e.description)); v.short_description = v.description;
  } else if (kind === 'brand') {
    v.name = oneLine(e.name ?? e.title); v.brand = v.name; v.name_lower = v.name.toLowerCase();
  } else if (kind === 'blog' || kind === 'page') {
    v.name = oneLine(e.title ?? e.name); v.name_lower = v.name.toLowerCase();
    v.short_description = oneLine(plain(e.excerpt));
  }
  return v;
}

/** Example values for previews. */
export function sampleVars(kind) {
  const s = Object.fromEntries(TEMPLATE_VARS.map(t => [t.key, t.example]));
  s.site_name = 'AR Trade International';
  if (kind !== 'product') { s.product_name = ''; s.price = ''; s.sale_price = ''; s.sku = ''; s.mpn = ''; s.model = ''; s.stock_status = ''; }
  if (kind === 'brand') s.name = s.brand;
  else if (kind === 'blog') { s.name = 'How to choose a laser printer'; s.name_lower = s.name.toLowerCase(); s.short_description = 'A short guide to picking the right laser printer for your office.'; }
  else if (kind === 'page') { s.name = 'About us'; s.name_lower = 'about us'; s.short_description = 'Who we are and what we sell.'; }
  if (kind !== 'product' && kind !== 'category' && kind !== 'brand') { s.category = ''; if (kind !== 'blog' && kind !== 'page') s.name = ''; }
  if (kind === 'brand' || kind === 'blog' || kind === 'page') s.category = '';
  return s;
}
