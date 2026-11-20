// Admin routes of Search & Growth Phase 6 (Business info, NAP check, Google Business Profile, weekly digest).
import { pool } from '../db.js';
import { fail, wrap, parseJson } from '../util.js';
import { mailReady, mailSetupHint } from '../mailer.js';
import { readGrowth, saveGrowth } from '../growth/siteFiles.js';
import { getBusiness, saveBusiness, getGbp, saveGbp, gbpCopyBlock, isEmail } from '../growth/business.js';
import { runNapCheck } from '../growth/napCheck.js';
import { buildGrowthDigest, sendGrowthDigest } from '../growth/digest.js';

export const NAP_GAP_MS = 30000;
let lastNap = 0; // manual NAP check: once per 30 seconds per process
export const _resetNapGap = () => { lastNap = 0; };

async function shopEmail() {
  try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['site']); return String((r.length ? parseJson(r[0].v) : null)?.email || '').trim(); } catch { return ''; }
}

export function mountGrowthBusinessRoutes(router, guard) {
  const R = guard('seo.manage');

  router.get('/growth/business', R, wrap(async (req, res) => {
    const [{ info }, gbp, g] = await Promise.all([getBusiness(), getGbp(), readGrowth()]);
    res.json({ info, gbp, copy: gbpCopyBlock(info), nap: g.napLast || { at: null, issues: 0, rows: [] } });
  }));

  router.post('/growth/business', guard('settings.manage'), wrap(async (req, res) => {
    res.json(await saveBusiness(req.body, req.staff?.name));
  }));

  router.post('/growth/business/gbp', R, wrap(async (req, res) => {
    res.json({ gbp: await saveGbp(req.body) });
  }));

  router.post('/growth/business/nap-check', R, wrap(async (req, res) => {
    if (Date.now() - lastNap < NAP_GAP_MS) throw fail(429, 'A check ran a moment ago. Wait half a minute and try again');
    lastNap = Date.now();
    const r = await runNapCheck();
    res.json({ at: r.at, issues: r.issues, rows: r.rows });
  }));

  router.get('/growth/digest', R, wrap(async (req, res) => {
    const d = (await readGrowth()).growthDigest || {}, ready = mailReady();
    res.json({ enabled: d.enabled === true, to: String(d.to || ''), shopEmail: await shopEmail(), mailReady: ready, hint: ready ? '' : mailSetupHint() });
  }));

  router.post('/growth/digest', R, wrap(async (req, res) => {
    const b = req.body || {}, enabled = b.enabled === true || b.enabled === 'true', to = String(b.to ?? '').trim();
    if (enabled && !isEmail(to)) throw fail(400, 'Enter the e-mail address that should receive the weekly digest');
    if (!enabled && to && !isEmail(to)) throw fail(400, 'That does not look like an e-mail address');
    await saveGrowth({ growthDigest: { enabled, to } });
    const ready = mailReady();
    res.json({ enabled, to, mailReady: ready, hint: ready ? '' : mailSetupHint() });
  }));

  router.post('/growth/digest/preview', R, wrap(async (req, res) => {
    const { subject, text, html } = await buildGrowthDigest();
    res.json({ subject, text, html });
  }));

  router.post('/growth/digest/test', R, wrap(async (req, res) => {
    const to = String(req.body?.to ?? '').trim();
    if (to && !isEmail(to)) throw fail(400, 'That does not look like an e-mail address');
    if (!mailReady()) return res.status(503).json({ error: mailSetupHint() });
    const r = await sendGrowthDigest({ force: true, to });
    if (r.sent) return res.json(r);
    if (r.reason === 'mail failed') return res.status(502).json({ error: 'The e-mail could not be sent. Check the mail settings', ...r });
    res.json(r);
  }));
}
