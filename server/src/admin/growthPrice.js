// Price & stock routes of the Search & Growth console. Reading needs seo.manage; anything that writes needs products.manage (Admin / Master).
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { CsvError } from './seoCsv.js';
import { noteCatalogChange } from '../growth/changeHooks.js';
import { historyOf, priceHistoryHealth } from '../growth/priceHistory.js';
import { applyUpdates, exportCsv, listPrices, loadProducts, planBulk, planCsv } from '../growth/priceBulk.js';

const needsConfirm = jumps => jumps.map(j => ({ id: j.id, name: j.name, from: j.from, to: j.to, pct: j.pct }));

export function mountGrowthPriceRoutes(router, guard) {
  const R = guard('seo.manage'), W = guard('products.manage');

  router.get('/growth/prices', R, wrap(async (req, res) => { res.json(await listPrices(req.query)); }));

  router.get('/growth/prices/health', R, wrap(async (req, res) => { const h = priceHistoryHealth(); res.json({ trigger: h.trigger, mode: h.trigger === false ? 'snapshot' : h.trigger ? 'trigger' : 'unknown', error: h.error }); }));

  router.get('/growth/prices/csv', R, wrap(async (req, res) => {
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="prices-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
    res.send(await exportCsv());
  }));

  router.post('/growth/prices/bulk', W, wrap(async (req, res) => {
    const changes = req.body?.changes;
    const ids = Array.isArray(changes) ? [...new Set(changes.map(c => parseInt(c?.id, 10)).filter(n => Number.isInteger(n) && n > 0))].slice(0, 500) : [];
    const plan = planBulk(changes, ids.length ? await loadProducts(ids) : new Map());
    if (plan.errors.length) return res.status(400).json({ error: 'Nothing was saved. ' + plan.errors[0].message, errors: plan.errors });
    if (plan.jumps.length && req.body?.confirmJump !== true) return res.status(409).json({ error: 'Some prices change by more than 50%. Confirm to continue.', needsConfirm: needsConfirm(plan.jumps) });
    const updated = await applyUpdates(plan.updates);
    if (updated) noteCatalogChange({ productIds: plan.updates.map(u => u.id), reason: 'bulk_price' });
    res.json({ updated });
  }));

  const planFromCsv = async csv => {
    try {
      // the file is parsed once to learn its size and shape; planCsv needs every product (SKU uniqueness is catalogue-wide)
      return planCsv(csv, await loadProducts());
    } catch (e) { if (e instanceof CsvError) throw fail(e.status, e.message); throw e; }
  };

  router.post('/growth/prices/csv/preview', W, wrap(async (req, res) => {
    const plan = await planFromCsv(req.body?.csv);
    res.json({ rows: plan.rows, summary: plan.summary });
  }));

  router.post('/growth/prices/csv/apply', W, wrap(async (req, res) => {
    const plan = await planFromCsv(req.body?.csv);
    if (plan.summary.errors) return res.status(400).json({ error: `Nothing was saved: ${plan.summary.errors} row(s) have problems. Preview the file to see them.`, summary: plan.summary });
    if (plan.jumps.length && req.body?.confirmJump !== true) return res.status(409).json({ error: 'Some prices change by more than 50%. Confirm to continue.', needsConfirm: needsConfirm(plan.jumps), summary: plan.summary });
    const updated = await applyUpdates(plan.updates);
    if (updated) noteCatalogChange({ productIds: plan.updates.map(u => u.id), reason: 'bulk_price' });
    res.json({ updated });
  }));

  router.get('/growth/prices/:id/history', R, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw fail(400, 'Bad product id');
    const [[p]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
    if (!p) throw fail(404, 'Product not found');
    res.json({ rows: await historyOf(id, req.query.limit), health: { trigger: priceHistoryHealth().trigger, mode: priceHistoryHealth().trigger === false ? 'snapshot' : 'trigger' } });
  }));
}
