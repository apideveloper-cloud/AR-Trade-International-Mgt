// Admin routes of review requests (Search & Growth, Phase 3). Reading and writing both need reviews.moderate.
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { mailReady, mailSetupHint } from '../mailer.js';
import { cancelRequest, markSent, readSettings, resendNow, saveSettings } from '../growth/reviewRequests.js';
import { listOptouts, listRequests, reviewStats } from '../growth/reviewRequestsAdmin.js';
import { realEmail, validateSettings } from '../growth/reviewRequestsCore.js';
import { buildMail, deps } from '../growth/reviewRequestsMail.js';

const SAMPLE = { name: 'Rahim Uddin', products: 'HP 12A Toner Cartridge, Canon PG-47 Ink', link: 'https://example.com/review/sample-link', optout: 'https://example.com/review/sample-link?optout=1' };
const id = req => { const n = parseInt(req.params.id, 10); if (!Number.isInteger(n) || n < 1) throw fail(400, 'Invalid id'); return n; };

export function mountGrowthReviewRoutes(router, guard) {
  const G = guard('reviews.moderate');

  router.get('/growth/review-requests/stats', G, wrap(async (req, res) => { res.json(await reviewStats()); }));
  router.get('/growth/review-requests', G, wrap(async (req, res) => { res.json(await listRequests(req.query)); }));
  router.post('/growth/review-requests/:id/mark-sent', G, wrap(async (req, res) => { await markSent(id(req)); res.json({ ok: true }); }));
  router.post('/growth/review-requests/:id/resend', G, wrap(async (req, res) => { await resendNow(id(req)); res.json({ ok: true }); }));
  router.post('/growth/review-requests/:id/cancel', G, wrap(async (req, res) => { await cancelRequest(id(req)); res.json({ ok: true }); }));

  router.get('/growth/review-settings', G, wrap(async (req, res) => { res.json(await readSettings()); }));
  router.post('/growth/review-settings', G, wrap(async (req, res) => {
    const v = validateSettings(req.body, await readSettings());
    if (!v.ok) throw fail(400, v.error);
    res.json(await saveSettings(v.settings));
  }));
  router.post('/growth/review-settings/preview', G, wrap(async (req, res) => {
    const lang = req.body?.lang === 'bn' ? 'bn' : 'en', s = await readSettings();
    const m = buildMail(req.body?.templates ? validateSettings({ templates: req.body.templates }, s).settings || s : s, SAMPLE, { lang });
    res.json({ subject: m.subject, body: m.text, html: m.html });
  }));
  router.post('/growth/review-settings/test', G, wrap(async (req, res) => {
    const to = String(req.body?.to ?? '').trim();
    if (!realEmail(to)) throw fail(400, 'Enter a valid e-mail address');
    if (!mailReady('sales')) return res.status(503).json({ error: mailSetupHint('sales') });
    const s = await readSettings(), m = buildMail(s, SAMPLE, { lang: req.body?.lang === 'bn' ? 'bn' : 'en' });
    try { await deps.sendMail({ channel: 'sales', to, subject: '[Test] ' + m.subject, html: m.html, text: m.text }); } catch (e) { throw fail(502, 'The mail server refused the message: ' + String(e.message).slice(0, 120)); }
    res.json({ ok: true });
  }));

  router.get('/growth/review-optouts', G, wrap(async (req, res) => { res.json(await listOptouts(req.query)); }));
  router.delete('/growth/review-optouts/:id', G, wrap(async (req, res) => {
    const [r] = await pool.query('DELETE FROM review_optouts WHERE id = ?', [id(req)]);
    if (!r.affectedRows) throw fail(404, 'Not found');
    res.json({ ok: true });
  }));
}
