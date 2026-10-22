/**
 * Shrinks the images in server/uploads without changing names or formats (so no link or database row changes):
 * resizes to a sensible maximum and re-compresses; a file is replaced only if the result is smaller.
 *   npm run images:optimize            optimise everything
 *   npm run images:optimize -- --dry   report the savings only
 * Originals should be backed up first (the release script keeps uploads.original/).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

sharp.cache(false);
const UP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const DRY = process.argv.includes('--dry');
const MAX = { products: 1000, blog: 1400, services: 1400, clients: 600, company: 1400, site: 1600 };
const SKIP = new Set(['cv', 'vouchers']);

const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p); } else if (/\.(jpe?g|png|webp)$/i.test(e.name)) files.push(p); } };
walk(UP);

let before = 0, after = 0, changed = 0, kept = 0, failed = 0;
const bySection = {};
const queue = [...files];
async function worker() {
  while (queue.length) {
    const f = queue.pop();
    const section = path.relative(UP, f).split(path.sep)[0];
    const max = MAX[section] || 1400;
    const size = fs.statSync(f).size; before += size;
    try {
      const ext = path.extname(f).toLowerCase();
      let img = sharp(fs.readFileSync(f), { failOn: 'none' }).rotate(); // read into memory first: no file handle stays open (Windows locks)
      const meta = await img.metadata();
      if (Math.max(meta.width || 0, meta.height || 0) > max) img = img.resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true });
      const buf = ext === '.png' ? await img.png({ compressionLevel: 9, palette: !meta.hasAlpha, quality: 82, effort: 8 }).toBuffer()
        : ext === '.webp' ? await img.webp({ quality: 80, effort: 5 }).toBuffer()
          : await img.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      const s = bySection[section] || (bySection[section] = { before: 0, after: 0, n: 0 });
      s.before += size; s.n++;
      if (buf.length < size * 0.95) { if (!DRY) fs.writeFileSync(f, buf); after += buf.length; s.after += buf.length; changed++; } else { after += size; s.after += size; kept++; }
    } catch (e) { after += size; failed++; console.log('skip', path.relative(UP, f), e.message); }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
const mb = n => (n / 1e6).toFixed(1) + ' MB';
console.log(`${DRY ? '[dry run] ' : ''}${files.length} images: ${changed} ${DRY ? 'would be ' : ''}optimised, ${kept} already small, ${failed} skipped`);
for (const [k, v] of Object.entries(bySection)) console.log(`  ${k.padEnd(10)} ${mb(v.before).padStart(9)} -> ${mb(v.after).padStart(9)}  (${v.n} files)`);
console.log(`total ${mb(before)} -> ${mb(after)}  saved ${mb(before - after)} (${Math.round((1 - after / before) * 100)}%)`);
