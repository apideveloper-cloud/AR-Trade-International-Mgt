// Admin routes of the Search & Growth console: Google Search Console and Bing Webmaster connections, verification files, sitemap
// submission, API call log and job queue. Reading and submitting needs seo.manage; credentials and connections need growth.integrations.
// The Google OAuth callback is a browser redirect (no bearer token), so it is mounted separately on the app (mountGrowthCallback).
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { hostOf } from '../seoAutomation.js';
import { GROWTH_INTEGRATIONS } from '../permissions.js';
import { deleteSecret, fallbackKey, getSecret, secretStatus, setSecret } from '../growth/vault.js';
import { getIntegration, setIntegration } from '../growth/http.js';
import { listJobs, retryJob } from '../growth/jobs.js';
import { readSeo, redirectUri, siteOrigin } from '../growth/site.js';
import { BING_CODE, GOOGLE_CONTENT, GOOGLE_NAME, readGrowth, saveGrowth } from '../growth/siteFiles.js';
import * as google from '../growth/google.js';
import * as bing from '../growth/bing.js';
import { submitSitemapAll } from '../growth/sitemapSubmit.js';

let lastSubmit = 0; // sitemap submission: once per minute per process
const iso = d => (d ? new Date(d).toISOString() : null);
const short = (v, n) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n);

export function mountGrowthRoutes(router, guard) {
  const R = guard('seo.manage'), C = guard(GROWTH_INTEGRATIONS);

  router.get('/growth/status', R, wrap(async (req, res) => {
    const [s, g, gi, bi, sec] = await Promise.all([readSeo(), readGrowth(), getIntegration('google'), getIntegration('bing'), secretStatus(['google.clientId', 'google.clientSecret', 'google.refreshToken', 'bing.apiKey'])]);
    const origin = await siteOrigin();
    const [jobs] = await pool.query("SELECT status, COUNT(*) AS n FROM growth_jobs WHERE status IN ('Queued','Running','Failed') GROUP BY status");
    const n = k => Number(jobs.find(j => j.status === k)?.n || 0);
    const key = s.indexNow?.key || '', enabled = !!s.flags?.indexNow, host = hostOf(s);
    res.json({
      vault: { fallbackKey: fallbackKey() },
      siteUrl: origin, sitemapUrl: origin ? origin + '/sitemap.xml' : '', redirectUri: await redirectUri(),
      google: {
        status: gi.status, account: gi.account, lastSync: iso(gi.last_sync), lastError: gi.last_error,
        clientIdSet: sec['google.clientId'].set, clientId: sec['google.clientId'].set ? await getSecret('google.clientId') : '',
        clientSecret: { set: sec['google.clientSecret'].set, last4: sec['google.clientSecret'].last4 }, refreshToken: { set: sec['google.refreshToken'].set },
        siteVerified: typeof gi.meta?.siteVerified === 'boolean' ? gi.meta.siteVerified : null, sitemapSubmittedAt: g.lastSubmit?.google || null
      },
      bing: { status: bi.status, account: bi.account, lastSync: iso(bi.last_sync), lastError: bi.last_error, apiKey: { set: sec['bing.apiKey'].set, last4: sec['bing.apiKey'].last4 }, sitemapSubmittedAt: g.lastSubmit?.bing || null },
      indexNow: { enabled, keySet: !!key, ready: enabled && !!key && !!host },
      verification: {
        googleFileName: g.googleFileName || '', googleFileUrl: g.googleFileName && origin ? `${origin}/${g.googleFileName}` : '',
        bingAuthCode: g.bingAuthCode || '', bingAuthUrl: g.bingAuthCode && origin ? origin + '/BingSiteAuth.xml' : '',
        googleTag: !!s.verification?.google, bingTag: !!s.verification?.bing
      },
      jobs: { queued: n('Queued'), failed: n('Failed'), running: n('Running') }
    });
  }));

  // ---- Google ----
  router.post('/growth/google/credentials', C, wrap(async (req, res) => {
    const id = short(req.body?.clientId, 300), secretIn = short(req.body?.clientSecret, 300);
    if (!id || /\s/.test(id)) throw fail(400, 'Enter the Google client ID');
    const old = await getSecret('google.clientId');
    if (!secretIn && !(await getSecret('google.clientSecret'))) throw fail(400, 'Enter the Google client secret');
    await setSecret('google.clientId', id, String(req.staff.id));
    if (secretIn) await setSecret('google.clientSecret', secretIn, String(req.staff.id));
    if ((old && old !== id) || secretIn) { // the saved connection belongs to the old credentials
      await deleteSecret('google.refreshToken'); google.clearTokenCache();
      await setIntegration('google', { status: 'not_connected', account: '', last_error: '', meta: {} });
    }
    res.json({ ok: true });
  }));

  router.get('/growth/google/connect', C, wrap(async (req, res) => {
    if (!(await getSecret('google.clientId')) || !(await getSecret('google.clientSecret'))) throw fail(400, 'Save the Google client ID and secret first');
    if (!(await siteOrigin())) throw fail(400, 'Set the preferred domain (https://...) in SEO settings first');
    const uri = await redirectUri();
    if (!uri) throw fail(400, 'Set the preferred domain (https://...) in SEO settings first');
    res.json({ url: await google.authUrl(google.signState(req.staff.id), uri) });
  }));

  router.post('/growth/google/disconnect', C, wrap(async (req, res) => {
    await deleteSecret('google.refreshToken'); google.clearTokenCache();
    await setIntegration('google', { status: 'not_connected', account: '', last_error: '', meta: {} });
    res.json({ ok: true });
  }));

  router.post('/growth/google/test', R, wrap(async (req, res) => {
    const r = await google.listSites();
    if (!r.ok) {
      if ((await getIntegration('google')).status !== 'not_connected') await setIntegration('google', { status: 'error', last_error: short(r.error, 300) });
      return res.json({ ok: false, sites: [], error: r.error });
    }
    const origin = await siteOrigin(), host = origin.replace('https://', '');
    const listed = r.sites.some(x => x.siteUrl === origin + '/' || x.siteUrl === 'sc-domain:' + host);
    await setIntegration('google', { status: 'connected', last_sync: new Date(), last_error: '', account: `Search Console: ${r.sites.length} site(s)` });
    res.json({ ok: true, sites: r.sites.map(x => ({ ...x, isThisSite: x.siteUrl === origin + '/' || x.siteUrl === 'sc-domain:' + host })), siteListed: listed, error: '' });
  }));

  // Gets the verification file from Google, publishes it on this site and asks Google to check it.
  router.post('/growth/google/verify', R, wrap(async (req, res) => {
    const origin = await siteOrigin();
    if (!origin) throw fail(400, 'Set the preferred domain (https://...) in SEO settings first');
    const siteUrl = origin + '/';
    const t = await google.siteVerificationToken(siteUrl);
    if (!t.ok) return res.json({ ok: false, error: t.error, fileUrl: '' });
    if (!GOOGLE_NAME.test(t.token)) return res.json({ ok: false, error: 'Google sent a verification file name this site cannot serve.', fileUrl: '' });
    await saveGrowth({ googleFileName: t.token, googleFileContent: 'google-site-verification: ' + t.token });
    const v = await google.verifySite(siteUrl);
    await setIntegration('google', { meta: { ...(await getIntegration('google')).meta, siteVerified: !!v.ok } });
    res.json({ ok: v.ok, error: v.error, fileUrl: `${origin}/${t.token}` });
  }));

  // ---- Bing ----
  router.post('/growth/bing/key', C, wrap(async (req, res) => {
    const k = short(req.body?.apiKey, 200);
    if (!/^[A-Za-z0-9]{16,100}$/.test(k)) throw fail(400, 'That does not look like a Bing Webmaster API key');
    await setSecret('bing.apiKey', k, String(req.staff.id));
    await setIntegration('bing', { status: 'not_connected', account: '', last_error: '' }); // becomes connected after a successful test
    res.json({ ok: true });
  }));
  router.post('/growth/bing/test', R, wrap(async (req, res) => {
    const r = await bing.getUserSites();
    if (!r.ok) {
      if (await getSecret('bing.apiKey')) await setIntegration('bing', { status: 'error', last_error: short(r.error, 300) });
      return res.json({ ok: false, sites: [], error: r.error });
    }
    await setIntegration('bing', { status: 'connected', last_sync: new Date(), last_error: '', account: `Bing Webmaster: ${r.sites.length} site(s)` });
    res.json({ ok: true, sites: r.sites, error: '' });
  }));
  router.post('/growth/bing/disconnect', C, wrap(async (req, res) => {
    await deleteSecret('bing.apiKey');
    await setIntegration('bing', { status: 'not_connected', account: '', last_error: '' });
    res.json({ ok: true });
  }));

  // ---- verification files entered by hand ----
  router.post('/growth/verification', R, wrap(async (req, res) => {
    const b = req.body || {}, patch = {};
    if (b.googleFileName !== undefined || b.googleFileContent !== undefined) {
      const name = short(b.googleFileName, 100);
      if (!name) { patch.googleFileName = ''; patch.googleFileContent = ''; }
      else {
        if (!GOOGLE_NAME.test(name)) throw fail(400, 'The Google file name looks like google1234abcd.html');
        const content = short(b.googleFileContent, 200) || 'google-site-verification: ' + name;
        if (!GOOGLE_CONTENT.test(content) || !content.endsWith(name)) throw fail(400, 'The Google file content must be: google-site-verification: ' + name);
        patch.googleFileName = name; patch.googleFileContent = content;
      }
    }
    if (b.bingAuthCode !== undefined) {
      const code = short(b.bingAuthCode, 100);
      if (code && !BING_CODE.test(code)) throw fail(400, 'The Bing code is 16 to 64 letters and numbers (0-9, A-F)');
      patch.bingAuthCode = code.toUpperCase();
    }
    await saveGrowth(patch);
    res.json({ ok: true });
  }));

  // ---- sitemap ----
  router.post('/growth/sitemap/submit', R, wrap(async (req, res) => {
    const wait = lastSubmit + 60000 - Date.now();
    if (wait > 0) throw fail(429, `The sitemap was sent a moment ago. Try again in ${Math.ceil(wait / 1000)} seconds.`);
    const engines = Array.isArray(req.body?.engines) ? req.body.engines.filter(e => e === 'google' || e === 'bing') : undefined;
    lastSubmit = Date.now();
    try { res.json({ results: await submitSitemapAll({ engines }) }); }
    catch (e) { lastSubmit = 0; throw fail(400, e.message); } // nothing was sent (for example no preferred domain), so no wait
  }));

  // ---- logs and jobs ----
  router.get('/growth/logs', R, wrap(async (req, res) => {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const where = [], args = [];
    const integ = short(req.query.integration, 30); if (integ) { where.push('integration = ?'); args.push(integ); }
    if (req.query.ok === '1' || req.query.ok === 'true') where.push('ok = 1'); else if (req.query.ok === '0' || req.query.ok === 'false') where.push('ok = 0');
    const [rows] = await pool.query(`SELECT id, at, integration, action, method, target, status, ok, ms, attempt, error FROM integration_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`, [...args, limit]);
    res.json({ rows });
  }));
  router.get('/growth/jobs', R, wrap(async (req, res) => res.json({ rows: await listJobs({ limit: 50 }) })));
  router.post('/growth/jobs/:id/retry', R, wrap(async (req, res) => {
    if (!(await retryJob(Number(req.params.id)))) throw fail(404, 'Only a failed job can be retried');
    res.json({ ok: true });
  }));
}

/** GET /api/admin/growth/google/callback: Google sends the browser here. The state (a short signed token) proves who started it. */
export function mountGrowthCallback(app) {
  app.get('/api/admin/growth/google/callback', async (req, res) => {
    const back = (ok, msg = '') => res.redirect(302, '/admin/growth?' + (ok ? 'google=ok' : 'google=error&msg=' + encodeURIComponent(String(msg).slice(0, 200))));
    try {
      if (req.query.error) return back(false, req.query.error === 'access_denied' ? 'Google access was not allowed.' : 'Google sign-in was cancelled.');
      if (!google.readState(req.query.state)) return back(false, 'This sign-in link has expired. Start again.');
      const code = short(req.query.code, 500);
      if (!code) return back(false, 'Google did not send a code.');
      const uri = await redirectUri();
      const x = await google.exchangeCode(code, uri);
      if (!x.ok) { await setIntegration('google', { status: 'error', last_error: short(x.error, 300) }).catch(() => {}); return back(false, x.error); }
      await setSecret('google.refreshToken', x.refreshToken, 'oauth');
      const r = await google.listSites();
      await setIntegration('google', { status: 'connected', last_sync: new Date(), last_error: '', account: r.ok ? `Search Console: ${r.sites.length} site(s)` : 'Connected', meta: {} });
      back(true);
    } catch (e) {
      console.error('google callback failed:', e.message);
      back(false, 'Could not finish connecting Google.');
    }
  });
}
