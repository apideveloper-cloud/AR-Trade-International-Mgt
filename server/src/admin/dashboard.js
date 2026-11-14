// Admin dashboard: the role-aware overview.
import { pool } from '../db.js';
import { wrap } from '../util.js';
import { buildOverview } from '../overview.js';

export function mountDashboardRoutes(router, guard) {
  // role-aware dashboard: figures, charts, a 7-day forecast and the auto-generated guide (?asOf=YYYY-MM-DD shows the picture as of another day)
  router.get('/overview', guard('dashboard.view'), wrap(async (req, res) => { res.json(await buildOverview(pool, req.staff, req.query.asOf, req.query.range)); }));
}
