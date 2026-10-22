/**
 * Some earlier imports saved an HTML error page under an image name (the source file 404'd). This finds those fake
 * images in server/uploads, removes the <img> tags / covers that point at them, and deletes the files.
 *   npm run images:clean
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const UP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const bad = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!['cv', 'vouchers'].includes(e.name)) walk(p); }
    else if (/\.(jpe?g|png|webp|gif)$/i.test(e.name) && /^\s*<(!doctype|html)/i.test(fs.readFileSync(p).subarray(0, 32).toString('latin1'))) bad.push(p);
  }
};
walk(UP);
const urls = bad.map(p => '/api/uploads/' + path.relative(UP, p).split(path.sep).join('/'));
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let removed = 0;
for (const [table, withCover] of [['blog_posts', true], ['site_pages', true], ['products', false]]) {
  const [rows] = await pool.query(`SELECT id, ${table === 'products' ? 'img, gallery' : table === 'blog_posts' ? 'body, cover' : 'body, cover'} FROM ${table}`);
  for (const r of rows) {
    if (table === 'products') {
      const g = typeof r.gallery === 'string' ? JSON.parse(r.gallery || '[]') : (r.gallery || []);
      const keep = g.filter(u => !urls.includes(u));
      const img = urls.includes(r.img) ? (keep[0] || null) : r.img;
      if (keep.length !== g.length || img !== r.img) { await pool.query('UPDATE products SET img = ?, gallery = ? WHERE id = ?', [img, JSON.stringify(keep), r.id]); removed++; }
      continue;
    }
    let body = r.body, cover = r.cover, ch = false;
    for (const u of urls) { const re = new RegExp(`<img[^>]*src="${esc(u)}"[^>]*>`, 'gi'); if (re.test(body)) { body = body.replace(re, ''); ch = true; removed++; } }
    if (withCover && urls.includes(cover)) { cover = ''; ch = true; removed++; }
    if (ch) await pool.query(`UPDATE ${table} SET body = ?, cover = ? WHERE id = ?`, [body, cover, r.id]);
  }
}
bad.forEach(p => fs.unlinkSync(p));
console.log(`${bad.length} fake image files deleted, ${removed} references cleaned`);
await pool.end();
