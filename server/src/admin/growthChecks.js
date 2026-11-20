// Price consistency checker routes of the Search & Growth console (Phase 2): issue list, manual run, weekly digest settings.
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { mailReady, mailSetupHint } from '../mailer.js';
import { getProgress } from '../growth/progress.js';
import { readGrowth, saveGrowth } from '../growth/siteFiles.js';
import { CODES, looksLikeEmail, sendDigest, runCheck } from '../growth/priceCheck.js';

export const RUN_GAP_MS = 60000;
let lastRun = 0; // manual run: once per minute per process
export const _resetRunGap = () => { lastRun = 0; };
const iso = d => (d ? new Date(d).toISOString() : null);
const int = (v, d, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

async function shopEmail() {
  try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['site']); const s = r.length ? (typeof r[0].v === 'string' ? JSON.parse(r[0].v) : r[0].v) : null; return String(s?.email || '').trim(); } catch { return ''; }
}

export function mountGrowthCheckRoutes(router, guard, deps = {}) {
  const start = deps.start || runCheck;
  const R = guard('seo.manage');

  router.get('/growth/price-checks', R, wrap(async (req, res) => {
    const code = String(req.query.code || '');
    if (code && !CODES[code]) throw fail(400, 'Unknown issue type');
    const limit = int(req.query.limit, 15, 1, 100), reqPage = int(req.query.page, 1, 1, 1e6);
    const [run] = await pool.query('SELECT at, checked, issues, ms FROM growth_price_runs ORDER BY id DESC LIMIT 1');
    const [cs] = await pool.query('SELECT code, COUNT(*) AS n FROM growth_price_issues GROUP BY code');
    const counts = {}; for (const c of cs) counts[c.code] = Number(c.n);
    const total = code ? counts[code] || 0 : Object.values(counts).reduce((a, b) => a + b, 0);
    const pages = Math.max(1, Math.ceil(total / limit)), page = Math.min(reqPage, pages);
    const [rows] = await pool.query(`SELECT i.product_id, i.code, i.detail, i.found_at, p.name, p.sku FROM growth_price_issues i LEFT JOIN products p ON p.id = i.product_id ${code ? 'WHERE i.code = ?' : ''} ORDER BY i.found_at DESC, i.id DESC LIMIT ? OFFSET ?`,
      code ? [code, limit, (page - 1) * limit] : [limit, (page - 1) * limit]);
    res.json({
      lastRun: run.length ? { at: iso(run[0].at), checked: run[0].checked, issues: run[0].issues, ms: run[0].ms } : null, counts,
      rows: rows.map(r => ({ productId: r.product_id, name: r.name || '', sku: r.sku || '', code: r.code, detail: r.detail, foundAt: iso(r.found_at), label: CODES[r.code]?.label || r.code })),
      total, page, pages
    });
  }));

  router.post('/growth/price-checks/run', R, wrap(async (req, res) => {
    if (Date.now() - lastRun < RUN_GAP_MS) throw fail(429, 'A check was started a moment ago. Wait a minute and try again');
    lastRun = Date.now();
    // start now, in this process (not behind other background jobs): the progress bar then moves right away
    if (getProgress('price_check').running) return res.json({ queued: false, message: 'A check is already running' });
    start().catch(e => console.error('price check failed:', e.message));
    res.json({ queued: true, started: true });
  }));

  router.get('/growth/price-digest', R, wrap(async (req, res) => {
    const d = (await readGrowth()).priceDigest || {}, ready = mailReady();
    res.json({ enabled: d.enabled === true, to: String(d.to || ''), shopEmail: await shopEmail(), mailReady: ready, hint: ready ? '' : mailSetupHint() });
  }));

  router.post('/growth/price-digest', R, wrap(async (req, res) => {
    const b = req.body || {}, enabled = b.enabled === true || b.enabled === 'true', to = String(b.to ?? '').trim();
    if (enabled && !looksLikeEmail(to)) throw fail(400, 'Enter the e-mail address that should receive the weekly digest');
    if (!enabled && to && !looksLikeEmail(to)) throw fail(400, 'That does not look like an e-mail address');
    await saveGrowth({ priceDigest: { enabled, to } });
    const ready = mailReady();
    res.json({ enabled, to, mailReady: ready, hint: ready ? '' : mailSetupHint() });
  }));

  router.post('/growth/price-digest/test', R, wrap(async (req, res) => {
    if (!mailReady()) return res.status(503).json({ error: mailSetupHint() });
    const r = await sendDigest({ force: true });
    if (r.sent) return res.json(r);
    if (/send failed/.test(r.reason)) return res.status(502).json({ error: r.reason });
    res.json(r);
  }));
}
