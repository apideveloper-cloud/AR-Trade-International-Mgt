// Admin dashboards: the role-aware overview and the classic dashboard figures.
import { pool } from '../db.js';
import { wrap } from '../util.js';
import { buildOverview } from '../overview.js';

export function mountDashboardRoutes(router, guard) {
  // role-aware dashboard: figures, charts, a 7-day forecast and the auto-generated guide (?asOf=YYYY-MM-DD shows the picture as of another day)
  router.get('/overview', guard('dashboard.view'), wrap(async (req, res) => { res.json(await buildOverview(pool, req.staff, req.query.asOf, req.query.range)); }));

  router.get('/dashboard', guard('dashboard.view'), wrap(async (req, res) => {
    const [[w]] = await pool.query('SELECT COUNT(*) n, COALESCE(SUM(total),0) rev FROM orders WHERE status <> "Cancelled" AND created_at >= NOW() - INTERVAL 7 DAY');
    const [[a]] = await pool.query('SELECT COUNT(*) n, COALESCE(AVG(total),0) avg FROM orders WHERE status <> "Cancelled"');
    const [[p]] = await pool.query('SELECT COUNT(*) n FROM orders WHERE status = "Pending"');
    const [[sv]] = await pool.query('SELECT SUM(status <> "Completed") open, SUM(status = "New") fresh FROM service_requests');
    const [days] = await pool.query(`SELECT DATE(created_at) d, SUM(total) v FROM orders WHERE status <> 'Cancelled' AND created_at >= CURDATE() - INTERVAL 6 DAY GROUP BY DATE(created_at)`);
    const chart = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
      const key = d.toLocaleDateString('en-CA');
      const hit = days.find(x => new Date(x.d).toLocaleDateString('en-CA') === key);
      return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), value: hit ? Number(hit.v) : 0 };
    });
    const [low] = await pool.query('SELECT id,name,img,stock FROM products WHERE price > 0 AND stock <= 5 AND active = 1 ORDER BY stock LIMIT 6');
    const [st] = await pool.query('SELECT status, COUNT(*) n FROM orders GROUP BY status');
    const [recent] = await pool.query('SELECT id,customer_name,total,status,created_at FROM orders ORDER BY created_at DESC LIMIT 6');
    res.json({
      kpis: { weekRevenue: Number(w.rev), weekOrders: w.n, pending: p.n, avgOrder: Math.round(a.avg), openServices: Number(sv.open || 0), newServices: Number(sv.fresh || 0) },
      chart, statuses: Object.fromEntries(st.map(x => [x.status, x.n])), lowStock: low, recent: recent.map(o => ({ id: o.id, customer: o.customer_name, total: o.total, status: o.status, at: o.created_at }))
    });
  }));
}
