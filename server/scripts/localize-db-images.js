/**
 * Finds images in the database that still point at another website (products, servicing/company pages, blog) and
 * downloads them into server/uploads/<section>/<category>/, rewriting the rows.   npm run images:localize
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const UP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const EXT = /https?:\/\/[^\s'"<>)]+?\.(?:png|jpe?g|gif|webp)(?:\?[^\s'"<>)]*)?/gi;
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
let ok = 0, fail = 0;
async function grab(url, folder, hint) {
  try {
    const u = new URL(url);
    const base = decodeURIComponent(path.basename(u.pathname));
    const ext = (path.extname(base).toLowerCase().match(/^\.(png|jpe?g|gif|webp)$/) || ['.jpg'])[0];
    const name = `${hint ? hint + '-' : ''}${slug(base.replace(/\.[a-z0-9]+$/i, ''))}${ext}`;
    const file = path.join(UP, folder, name);
    if (!(fs.existsSync(file) && fs.statSync(file).size > 100)) {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error(r.status);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    }
    ok++; return `/api/uploads/${folder}/${name}`;
  } catch (e) { fail++; console.log('  failed', url.slice(0, 90), e.message); return null; }
}
const swap = async (text, folder, hint) => { let out = String(text || ''); for (const u of new Set(out.match(EXT) || [])) { const l = await grab(u, folder, hint); if (l) out = out.split(u).join(l); } return out; };

const [prods] = await pool.query("SELECT id, category_id, img, gallery FROM products WHERE img LIKE 'http%' OR gallery LIKE '%http%'");
for (const p of prods) {
  const folder = `products/${p.category_id}`;
  const img = await swap(p.img, folder, String(p.id));
  const gal = await swap(typeof p.gallery === 'string' ? p.gallery : JSON.stringify(p.gallery || []), folder, String(p.id));
  await pool.query('UPDATE products SET img = ?, gallery = ? WHERE id = ?', [img || null, gal, p.id]);
}
const [pages] = await pool.query("SELECT id, slug, grp, body, cover, images FROM site_pages");
for (const g of pages) {
  const folder = `${g.grp === 'servicing' ? 'services' : g.grp}/${g.slug}`;
  const body = await swap(g.body, folder), cover = await swap(g.cover, folder), images = await swap(typeof g.images === 'string' ? g.images : JSON.stringify(g.images || []), folder);
  if (body !== g.body || cover !== g.cover) await pool.query('UPDATE site_pages SET body = ?, cover = ?, images = ? WHERE id = ?', [body, cover, images, g.id]);
}
const [posts] = await pool.query("SELECT id, category, body, cover FROM blog_posts WHERE body LIKE '%http%' OR cover LIKE 'http%'");
for (const b of posts) {
  const folder = 'blog/' + slug(b.category);
  const body = await swap(b.body, folder), cover = await swap(b.cover, folder);
  if (body !== b.body || cover !== b.cover) await pool.query('UPDATE blog_posts SET body = ?, cover = ? WHERE id = ?', [body, cover, b.id]);
}
console.log(`${ok} images localised, ${fail} failed`);
await pool.end();
