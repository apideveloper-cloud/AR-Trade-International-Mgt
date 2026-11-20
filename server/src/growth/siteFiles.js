// Search engine verification files, kept in the settings table (k = 'growth'): Google's google<token>.html and Bing's BingSiteAuth.xml.
// The two public routes sit before the SPA fallback, so a small in-memory cache (cleared on every save) keeps them from reading the
// database on every unknown address.
import { pool } from '../db.js';
import { parseJson } from '../util.js';

export const GOOGLE_NAME = /^google[a-z0-9]{8,}\.html$/;
export const GOOGLE_CONTENT = /^google-site-verification: google[a-z0-9]{8,}\.html$/;
export const BING_CODE = /^[A-F0-9]{16,64}$/i;
const TTL = 60000;
let cache = null; // { at, data }
export const clearSiteFilesCache = () => { cache = null; };

export async function readGrowth() {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  let data = {};
  try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['growth']); data = r.length ? parseJson(r[0].v) || {} : {}; } catch { data = {}; }
  cache = { at: Date.now(), data };
  return data;
}
/** Merges patch into the stored growth settings and clears the cache. */
export async function saveGrowth(patch) {
  clearSiteFilesCache();
  const next = { ...(await readGrowth()), ...patch };
  await pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', ['growth', JSON.stringify(next)]);
  clearSiteFilesCache();
  return next;
}
export const bingXml = code => `<?xml version="1.0"?><users><user>${code}</user></users>`;

export function mountGrowthPublic(app) {
  app.get(/^\/(google[a-z0-9]{8,}\.html)$/, async (req, res, next) => {
    try {
      const g = await readGrowth();
      if (g.googleFileName && GOOGLE_NAME.test(g.googleFileName) && req.params[0] === g.googleFileName && g.googleFileContent) return res.type('text/html').send(String(g.googleFileContent));
      next();
    } catch (e) { next(e); }
  });
  app.get('/BingSiteAuth.xml', async (req, res, next) => {
    try {
      const g = await readGrowth();
      if (g.bingAuthCode && BING_CODE.test(g.bingAuthCode)) return res.type('application/xml').send(bingXml(g.bingAuthCode));
      next();
    } catch (e) { next(e); }
  });
}
