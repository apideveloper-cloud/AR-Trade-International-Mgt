// Admin routes of Search & Growth Phase 6 (Links): backlink and citation tracker with a link checker. Needs seo.manage for reading and writing.
import { fail, wrap } from '../util.js';
import { enqueue } from '../growth/jobs.js';
import { siteOrigin } from '../growth/site.js';
import { addFromStarter, createBacklink, deleteBacklink, getBacklink, listBacklinks, rowOut, updateBacklink, validateLink } from '../growth/backlinks.js';
import { checkAndSave, isEligible } from '../growth/linkCheck.js';

const hostOfOrigin = o => { try { return new URL(o).hostname; } catch { return ''; } };
export const SINGLE_LIMIT = 30, SINGLE_WINDOW_MS = 10 * 60 * 1000;

export function mountGrowthLinksRoutes(router, guard, deps = {}) {
  const A = guard('seo.manage'), recent = [], lastManual = { t: 0 };
  const origin = () => (deps.siteOrigin || siteOrigin)();
  const idOf = req => { const id = parseInt(req.params.id, 10); if (!Number.isInteger(id) || id <= 0) throw fail(400, 'Bad id'); return id; };

  router.get('/growth/backlinks', A, wrap(async (req, res) => { res.json(await listBacklinks(req.query)); }));

  router.post('/growth/backlinks/starter', A, wrap(async (req, res) => { res.json({ row: rowOut(await addFromStarter(req.body?.name)) }); }));

  router.post('/growth/backlinks/check', A, wrap(async (req, res) => {
    const raw = req.body?.id;
    if (raw === undefined || raw === null || raw === '') {
      if (Date.now() - lastManual.t < 60000) return res.status(429).json({ error: 'Wait a minute before starting this again' });
      lastManual.t = Date.now();
      return res.json({ queued: (await (deps.enqueue || enqueue)('link_check', {}, { dedupeKey: 'link_check_manual' })) !== null });
    }
    const id = parseInt(raw, 10);
    if (!Number.isInteger(id) || id <= 0) throw fail(400, 'Bad id');
    const row = await getBacklink(id);
    if (!row) throw fail(404, 'Entry not found');
    if (!isEligible(row)) throw fail(400, row.status === 'Rejected' ? 'Rejected entries are not checked' : 'Add the page address first');
    const now = Date.now();
    while (recent.length && now - recent[0] > SINGLE_WINDOW_MS) recent.shift();
    if (recent.length >= SINGLE_LIMIT) return res.status(429).json({ error: 'Too many checks. Try again in a few minutes.' });
    recent.push(now);
    const { result } = await checkAndSave(row, { ...(deps.checkDeps || {}), origin: await origin() });
    res.json({ row: rowOut(await getBacklink(id)), result: { ok: result.ok, httpStatus: result.httpStatus, linkFound: result.linkFound, rel: result.rel, note: result.note } });
  }));

  router.post('/growth/backlinks', A, wrap(async (req, res) => {
    const input = validateLink(req.body, { host: hostOfOrigin(await origin()) });
    res.json({ row: rowOut(await createBacklink(input)) });
  }));

  router.put('/growth/backlinks/:id', A, wrap(async (req, res) => {
    const id = idOf(req);
    const input = validateLink(req.body, { partial: true, host: hostOfOrigin(await origin()) });
    res.json({ row: rowOut(await updateBacklink(id, input)) });
  }));

  router.delete('/growth/backlinks/:id', A, wrap(async (req, res) => { await deleteBacklink(idOf(req)); res.json({ ok: true }); }));
}
