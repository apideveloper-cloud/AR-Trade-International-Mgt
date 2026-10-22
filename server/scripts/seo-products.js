/** Generates the SEO title, description and keywords for every product (only where empty; --force rewrites them).
 *  npm run seo:products [-- --force]   Admin edits made in the product editor are never overwritten without --force. */
import sanitizeHtml from 'sanitize-html';
import { pool } from '../src/db.js';

const force = process.argv.includes('--force');
const plain = h => sanitizeHtml(String(h || ''), { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '').replace(/[\s,;:–-]+$/, ''));
// the scraped overview text starts with shop boilerplate (phone numbers, "Quick Overview") that makes a poor search snippet
const clean = h => plain(h)
  .replace(/Full set package deal/gi, ' ').replace(/Quick Overview/gi, ' ').replace(/Key Features/gi, ' ')
  .replace(/Call\s*\/?\s*WhatsApp[\s:]*[+\d][\d\s,+-]*/gi, ' ').replace(/Call:?\s*[+\d][\d\s,+-]*/gi, ' ').replace(/TNT\s*\+?[\d\s-]+/gi, ' ')
  .replace(/Call for price/gi, ' ').replace(/\b(Model|Brand)\s*:/gi, ' ').replace(/^[\s,.;:+\d-]+/, '').replace(/\s+/g, ' ').trim();
const sentence = (s, n) => { const t = cut(s, n); const i = Math.max(t.lastIndexOf('. '), t.endsWith('.') ? t.length - 1 : -1); return i > 40 ? t.slice(0, i + 1) : t; };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND = ' | AR Trade';

const [cats] = await pool.query('SELECT id, title FROM categories');
const catTitle = new Map(cats.map(c => [c.id, c.title]));
const [rows] = await pool.query('SELECT id, category_id, brand, name, part, sku, compat, short_desc, description, price, meta_title, meta_desc, meta_keywords FROM products WHERE active = 1');

let n = 0;
for (const p of rows) {
  const name = p.name.replace(/\s+/g, ' ').trim();
  const type = (catTitle.get(p.category_id) || '').replace(/&/g, 'and');

  const suffix = ' Price in Bangladesh' + BRAND;
  const title = name.length + suffix.length <= 62 ? name + suffix : cut(name, 62 - BRAND.length) + BRAND;

  let base = clean(p.short_desc);
  if (base.length < 40) base = clean(p.description);
  base = base.replace(new RegExp('^' + esc(name) + '[\\s.,:-]*', 'i'), '');
  const tail = p.price ? ' Buy online in Dhaka, Bangladesh. Genuine, fast delivery.' : ' Get a quote in Dhaka, Bangladesh. Genuine, fast delivery.';
  const head = cut(name, 158 - tail.length - 1) + '.';
  const room = 158 - head.length - tail.length - 1;
  const lead = room > 50 && base.length > 50 && !base.includes(':') && /[a-z]{3,} [a-z]{3,} [a-z]{3,}/i.test(base) ? sentence(base, room) : '';
  const desc = (head + (lead ? ' ' + lead : '') + tail).replace(/\s+/g, ' ');

  // model-like tokens (contain a digit) make the best long-tail keywords: "MX-312AT", "CF217A", "TN-2480"
  const models = [...new Set(name.match(/[A-Za-z]*[0-9][A-Za-z0-9-]*/g) || [])].filter(t => t.length >= 3).slice(0, 6);
  const compat = String(p.compat || '').split(/[,;/]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 40).slice(0, 5);
  const kw = [
    name, p.brand && `${p.brand} ${type}`.trim(), p.part, p.sku, ...models, ...models.map(m => `${p.brand || ''} ${m}`.trim()), ...compat,
    `${name} price in Bangladesh`, `${type} price in Bangladesh`, `buy ${type} online Dhaka`, 'AR Trade International'
  ].filter(Boolean).map(s => String(s).replace(/\s+/g, ' ').trim());
  let keywords = '';
  for (const k of [...new Set(kw.map(s => s.toLowerCase()))]) { if ((keywords + ', ' + k).length > 480) break; keywords += (keywords ? ', ' : '') + k; }

  const set = [], vals = [];
  if (force || !p.meta_title) { set.push('meta_title = ?'); vals.push(title); }
  if (force || !p.meta_desc) { set.push('meta_desc = ?'); vals.push(desc); }
  if (force || !p.meta_keywords) { set.push('meta_keywords = ?'); vals.push(keywords); }
  if (set.length) { await pool.query(`UPDATE products SET ${set.join(', ')} WHERE id = ?`, [...vals, p.id]); n++; }
}
console.log(`SEO fields written for ${n} of ${rows.length} products`);
await pool.end();
