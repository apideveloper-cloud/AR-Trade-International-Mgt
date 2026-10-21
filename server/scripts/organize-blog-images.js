/**
 * One-off helper: moves the blog images from server/uploads/blog/<file> into server/uploads/blog/<category>/<file>
 * and rewrites the links (/api/media/<file> -> /api/uploads/blog/<category>/<file>) in the database and in src/blog.seed.json.
 * Safe to run again: files already moved are left alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const BLOG = path.resolve(here, '../uploads/blog');
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';

const dest = new Map(); // file name -> category folder
const claim = (file, cat) => { if (file && !dest.has(file)) dest.set(file, slug(cat)); };
const FILE = /\/api\/media\/([^"')\s]+)/g;
const scan = (cat, ...texts) => texts.forEach(t => { for (const m of String(t || '').matchAll(FILE)) claim(m[1], cat); });

const [rows] = await pool.query('SELECT id, category, cover, body FROM blog_posts');
rows.forEach(r => scan(r.category, r.cover, r.body));
const seedFile = path.resolve(here, '../src/blog.seed.json');
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
seed.forEach(p => scan(p.category, p.cover, p.body));

let moved = 0;
for (const [file, cat] of dest) {
  const from = path.join(BLOG, file), dir = path.join(BLOG, cat), to = path.join(dir, file);
  if (fs.existsSync(from)) { fs.mkdirSync(dir, { recursive: true }); fs.renameSync(from, to); moved++; }
}
const fix = t => String(t || '').replace(FILE, (all, f) => (dest.has(f) ? `/api/uploads/blog/${dest.get(f)}/${f}` : all));
for (const r of rows) await pool.query('UPDATE blog_posts SET cover = ?, body = ? WHERE id = ?', [fix(r.cover), fix(r.body), r.id]);
seed.forEach(p => { p.cover = fix(p.cover); p.body = fix(p.body); });
fs.writeFileSync(seedFile, JSON.stringify(seed));
console.log(`moved ${moved} files into ${[...new Set(dest.values())].length} category folders; ${rows.length} posts and the seed file updated`);
await pool.end();
