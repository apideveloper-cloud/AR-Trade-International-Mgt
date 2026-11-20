// Admin routes of SEO automation (permission seo.manage): IndexNow status / key / test, sitemap rebuild, Merchant feed preview.
import { pool } from '../db.js';
import { fail, parseJson, wrap } from '../util.js';
import { mergeSeoSettings } from '../seoSettings.js';
import { generateIndexNowKey, getIndexNowState, getQueue, hostOf, pingIndexNow, submitAllBatches } from '../seoAutomation.js';

let lastSubmitAll = 0; // "submit all" may run once every 10 minutes (it sends the whole site)

const KEY = 'seo';
const seoLib = async () => { try { return await import('../seo.js'); } catch { return {}; } };
const call = async (name, ...args) => { const m = await seoLib(); if (typeof m[name] !== 'function') return null; try { return await m[name](...args); } catch (e) { console.error(`seo ${name} failed:`, e.message); return null; } };

async function readStored() {
  const [rows] = await pool.query('SELECT v FROM settings WHERE k = ?', [KEY]);
  let stored = null;
  try { stored = rows.length ? parseJson(rows[0].v) : null; } catch { stored = null; }
  return stored;
}
const save = value => pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [KEY, JSON.stringify(value)]);

export function mountSeoAutomationRoutes(router, guard) {
  const G = guard('seo.manage');

  router.get('/seo/automation', G, wrap(async (req, res) => {
    const s = mergeSeoSettings(await readStored());
    const host = hostOf(s), key = s.indexNow?.key || '';
    const enabled = !!s.flags?.indexNow, keySet = !!key;
    const st = getIndexNowState();
    const origin = host ? 'https://' + host : '';
    const [sm, fd] = [await call('sitemapStatus'), await call('feedStatus')];
    res.json({
      indexNow: { enabled, keySet, keyLocation: host && keySet ? `https://${host}/${key}.txt` : '', host, state: st, ready: enabled && keySet && !!host },
      feed: { enabled: fd?.enabled ?? !!s.flags?.merchantFeed, url: origin + '/feeds/google-merchant.xml', items: fd?.items ?? null, skipped: fd?.skipped ?? null, generatedAt: fd?.generatedAt ?? null },
      sitemap: { generatedAt: sm?.generatedAt ?? null, dirty: sm?.dirty ?? null, ttlMs: sm?.ttlMs ?? null, counts: sm?.counts ?? null, url: '/sitemap.xml' },
      analytics: { ga4: s.verification?.ga4 || '', gtm: s.verification?.gtm || '' },
      // what is still missing before search engines can find the site (the Overview checklist)
      visibility: {
        preferredDomain: s.general?.preferredDomain || '',
        bingVerified: !!s.verification?.bing,
        googleVerified: !!s.verification?.google,
        indexNowReady: enabled && keySet && !!host,
        submittedAt: st.lastPing || null,
        sitemapUrl: (origin || '') + '/sitemap.xml'
      }
    });
  }));

  // Sends every sitemap URL to IndexNow in one go (Bing and the other IndexNow engines then crawl them): the fast way to get a new site seen.
  router.post('/seo/automation/indexnow/submit-all', G, wrap(async (req, res) => {
    const s = mergeSeoSettings(await readStored());
    const host = hostOf(s), key = s.indexNow?.key || '';
    if (!s.flags?.indexNow) throw fail(400, 'IndexNow is switched off');
    if (!key) throw fail(400, 'Generate an IndexNow key first');
    if (!host) throw fail(400, 'No preferred domain set');
    const wait = lastSubmitAll + 10 * 60 * 1000 - Date.now();
    if (wait > 0) throw fail(429, `The whole site was sent a moment ago. Try again in ${Math.ceil(wait / 60000)} minute(s).`);
    const urls = await call('sitemapUrls');
    if (!Array.isArray(urls) || !urls.length) throw fail(503, 'The sitemap has no addresses to send');
    const { total, batches } = submitAllBatches(urls, host);
    lastSubmitAll = Date.now();
    let ok = 0, failed = 0, last = null;
    for (const b of batches) {
      const r = await pingIndexNow({ host, key, urls: b });
      getQueue().record(b.length, r);
      last = r;
      if (r.ok) ok += b.length; else failed += b.length;
    }
    res.json({ ok: failed === 0, submitted: ok, failed, total, batches: batches.length, status: last?.status ?? null, error: last?.error || '' });
  }));

  router.post('/seo/automation/indexnow/generate-key', G, wrap(async (req, res) => {
    const stored = await readStored();
    const cur = mergeSeoSettings(stored);
    if (cur.indexNow.key && req.body?.replace !== true) throw fail(400, 'An IndexNow key already exists. Send replace: true to replace it.');
    const key = generateIndexNowKey();
    await save({ ...cur, indexNow: { ...cur.indexNow, key } });
    await call('bustSeo');
    res.json({ ok: true, key });
  }));

  router.post('/seo/automation/indexnow/test', G, wrap(async (req, res) => {
    const s = mergeSeoSettings(await readStored());
    const host = hostOf(s), key = s.indexNow?.key || '';
    if (!s.flags?.indexNow) throw fail(400, 'IndexNow is switched off');
    if (!key) throw fail(400, 'Generate an IndexNow key first');
    if (!host) throw fail(400, 'No preferred domain set');
    const r = await pingIndexNow({ host, key, urls: [`https://${host}/`] });
    getQueue().record(1, r);
    res.json({ ok: r.ok, status: r.status, error: r.error });
  }));

  router.post('/seo/automation/sitemap/rebuild', G, wrap(async (req, res) => {
    const m = await seoLib();
    if (typeof m.rebuildSitemaps !== 'function') throw fail(503, 'Sitemap rebuild is not available');
    await m.rebuildSitemaps();
    res.json({ ok: true, status: await call('sitemapStatus') });
  }));

  router.get('/seo/feed/preview', G, wrap(async (req, res) => {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const rows = await call('feedPreview', limit);
    res.json({ rows: Array.isArray(rows) ? rows.slice(0, limit) : [] });
  }));
}
