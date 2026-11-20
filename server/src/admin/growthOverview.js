// Admin route of Search & Growth Phase 5 (Overview): setup state, health of every part and the list of things to do.
import { wrap } from '../util.js';
import { loadOverview } from '../growth/overview.js';

export function mountGrowthOverviewRoutes(router, guard, deps) {
  const R = guard('seo.manage');
  router.get('/growth/overview', R, wrap(async (req, res) => { res.json(await loadOverview(deps)); }));
}
