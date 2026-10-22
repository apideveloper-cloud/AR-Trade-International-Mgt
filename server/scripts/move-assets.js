/**
 * Puts every site image under server/uploads/site/ and serves it through /api/uploads/site/<file>, the same way
 * product, blog and servicing images are served. One-off migration; safe to run again.
 *   - moves client/public/* images (logo, hero banner, how-to-order pictures, brand/client logos, payment strips) into uploads/site
 *   - downloads the 4 stock photos the category fallbacks used into uploads/site
 *   - rewrites the links in the client source, design seed and the settings table
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const PUB = path.join(ROOT, 'client/public');
const OUT = path.join(ROOT, 'server/uploads/site');
fs.mkdirSync(OUT, { recursive: true });

// 1. move files
let moved = 0;
const mv = (from, name) => { if (fs.existsSync(from)) { fs.renameSync(from, path.join(OUT, name)); moved++; } };
const siteDir = path.join(PUB, 'site');
if (fs.existsSync(siteDir)) for (const f of fs.readdirSync(siteDir)) mv(path.join(siteDir, f), f);
for (const f of fs.readdirSync(PUB)) if (/\.(png|jpe?g|webp|gif|svg)$/i.test(f)) mv(path.join(PUB, f), f);
try { fs.rmdirSync(siteDir); } catch { /* not empty or already gone */ }

// 2. stock photos used by the category fallbacks (data.js)
const STOCK = {
  'photo-1587831990711-23ca6441447b': 'category-computer.jpg',
  'photo-1612815154858-60aa4c59eaa6': 'category-scanner.jpg',
  'photo-1606904825846-647eb07f5be2': 'category-network.jpg',
  'photo-1518770660439-4636190af475': 'category-parts.jpg'
};
for (const [id, name] of Object.entries(STOCK)) {
  const file = path.join(OUT, name);
  if (fs.existsSync(file) && fs.statSync(file).size > 100) continue;
  try {
    const r = await fetch(`https://images.unsplash.com/${id}?w=600&q=70&auto=format&fit=crop`);
    if (r.ok) fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); else console.log('could not download', name, r.status);
  } catch (e) { console.log('could not download', name, e.message); }
}

// 3. rewrite links
const UP = '/api/uploads/site/';
const rewrite = t => {
  let s = t;
  for (const [id, name] of Object.entries(STOCK)) s = s.replace(new RegExp(`https://images\\.unsplash\\.com/${id}[^'"\`\\s)]*`, 'g'), UP + name);
  s = s.replace(/(?<![\w])\.?\/assets\/(ar-icon-round\.png|cashback-banner-crop\.png)/g, UP + '$1');
  s = s.replace(/(?<![\w])\/site\//g, UP);
  s = s.replace(/(?<![\w\/.])\/(ar-icon-round\.png|cashback-banner-crop\.png|how-step-\d\.png|how-to-order\.jpg)/g, UP + '$1');
  return s;
};
const files = [];
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['node_modules', 'dist'].includes(f.name)) walk(p); } else if (/\.(jsx?|css|html)$/.test(f.name)) files.push(p); } };
walk(path.join(ROOT, 'client/src')); files.push(path.join(ROOT, 'client/index.html'), path.join(ROOT, 'server/ar-data.source.js'));
let edited = 0;
for (const f of files) { const t = fs.readFileSync(f, 'utf8'), n = rewrite(t); if (n !== t) { fs.writeFileSync(f, n); edited++; } }
const [rows] = await pool.query('SELECT k, v FROM settings');
for (const r of rows) {
  const raw = typeof r.v === 'string' ? r.v : JSON.stringify(r.v), n = rewrite(raw);
  if (n !== raw) { await pool.query('UPDATE settings SET v = ? WHERE k = ?', [n, r.k]); edited++; }
}
// blog / page bodies may still point at the old uploads folder names
console.log(`${moved} files moved to server/uploads/site, ${edited} files/settings rows rewritten, ${fs.readdirSync(OUT).length} images in uploads/site`);
await pool.end();
