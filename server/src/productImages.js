// A product is published on the website only when its picture can be found: an address on the web, or a file that really exists in server/uploads.
// Staff are alerted in the admin console about active products that are held back for this reason (they go live by themselves once a picture is added).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UPLOADS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads');
const seen = new Map(); // relative path -> { ok, at }: a stat per picture, remembered for a minute
const TTL = 60000;

export function hasPicture(img) {
  const i = String(img || '').trim();
  if (!i) return false;
  if (/^https?:\/\//i.test(i)) return true;
  let rel;
  try { rel = decodeURIComponent(i.split('?')[0].replace(/^\/?api\/uploads\//, '').replace(/^\/?uploads\//, '')); } catch { return false; }
  if (rel.includes('..')) return false;
  const hit = seen.get(rel), now = Date.now();
  if (hit && now - hit.at < TTL) return hit.ok;
  const ok = fs.existsSync(path.join(UPLOADS, rel));
  seen.set(rel, { ok, at: now });
  return ok;
}

/** Keeps only the products that may be shown to customers. */
export const published = rows => rows.filter(r => hasPicture(r.img));

/** Active products held back because their picture is missing: [{id, name}] (for the admin alert). */
export async function unpublishedProducts(pool) {
  const [rows] = await pool.query('SELECT id, name, img FROM products WHERE active = 1');
  return rows.filter(r => !hasPicture(r.img)).map(r => ({ id: r.id, name: r.name }));
}
