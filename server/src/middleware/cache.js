// The kept /api/bootstrap response (JSON + gzip + ETag) and the middleware that throws it away when anything is written.
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const BOOT_TTL_MS = 30000;
let bootCache = null;

/** The kept response, or null when it is missing or older than 30 seconds. */
export const getBootCache = () => (bootCache && Date.now() - bootCache.at <= BOOT_TTL_MS ? bootCache : null);

/** Keeps `payload` (a JSON-serialisable object) as the bootstrap response and returns it. */
export function setBootCache(payload) {
  const json = Buffer.from(JSON.stringify(payload));
  bootCache = { at: Date.now(), json, gzip: zlib.gzipSync(json, { level: 6 }), etag: '"' + crypto.createHash('sha1').update(json).digest('hex').slice(0, 20) + '"' };
  return bootCache;
}

/** Any write (an order takes stock, staff change a price) throws the kept catalogue away; chat messages change nothing in it. */
export function invalidateBootCacheOnWrite(req, res, next) {
  if (req.method !== 'GET' && !req.path.startsWith('/chat')) bootCache = null;
  next();
}
