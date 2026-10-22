/**
 * Makes the app independent of the old website: downloads every image still hot-linked from
 * https://artradeinternational.com/wp-content/uploads/ (logo, payment/shipping strips, hero and brand pictures) into
 * client/public/site/ and rewrites the links to /site/<file> in the client source, the design seed and the settings table.
 *   npm run assets:localize        (then rebuild the client)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const OUT = path.join(ROOT, 'client/public/site');
const RE = /https:\/\/artradeinternational\.com\/wp-content\/uploads\/[^'"`\\\s)<>]+/g;
const FILES = ['client/src/components/Footer.jsx', 'client/src/components/Header.jsx', 'client/src/data.js', 'client/src/pages/Home.jsx', 'server/ar-data.source.js'];
fs.mkdirSync(OUT, { recursive: true });

const map = new Map(); // url -> /site/name
const used = new Set();
const nameFor = u => {
  const base = decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
  let n = base, i = 1;
  while (used.has(n) && map.get(u) !== '/site/' + n) n = `${i++}-${base}`;
  used.add(n);
  return n;
};
async function fetchOne(u) {
  const name = nameFor(u);
  const file = path.join(OUT, name);
  if (!(fs.existsSync(file) && fs.statSync(file).size > 100)) {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error(r.status);
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
        break;
      } catch { if (i === 2) return null; await new Promise(r => setTimeout(r, 700)); }
    }
  }
  return '/site/' + name;
}

const texts = FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
const [settings] = await pool.query('SELECT k, v FROM settings');
const urls = new Set();
texts.forEach(([, t]) => (t.match(RE) || []).forEach(u => urls.add(u)));
settings.forEach(s => (String(typeof s.v === 'string' ? s.v : JSON.stringify(s.v)).match(RE) || []).forEach(u => urls.add(u)));
console.log(`${urls.size} external image links found`);

let failed = 0;
for (const u of urls) { const local = await fetchOne(u); if (local) map.set(u, local); else { failed++; console.log('could not download', u); } }
const swap = t => t.replace(RE, u => map.get(u) || u);
for (const [f, t] of texts) { const n = swap(t); if (n !== t) fs.writeFileSync(path.join(ROOT, f), n); }
for (const s of settings) {
  const raw = typeof s.v === 'string' ? s.v : JSON.stringify(s.v), n = swap(raw);
  if (n !== raw) await pool.query('UPDATE settings SET v = ? WHERE k = ?', [n, s.k]);
}
const size = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`${map.size} downloaded into client/public/site (${(size / 1e6).toFixed(1)} MB), ${failed} failed. Rebuild the client to use them.`);
await pool.end();
