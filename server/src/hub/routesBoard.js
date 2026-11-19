// Hub routes: the dispatch board and the branches / couriers overview.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { COURIERS, DONE, getBranches, routeBranch } from '../flow.js';
import { parseJson, wrap } from '../util.js';
import { isCod, riderOut } from './helpers.js';
import { loadItems } from './store.js';

/** Adds the board and branches routes to the hub router. */
export function registerBoardRoutes(hub) {
  hub.get('/board', guard('hub.view'), wrap(async (req, res) => {
    const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300');
    const items = await loadItems(orders.map(o => o.id));
    const branches = await getBranches();
    const [riders] = await pool.query('SELECT * FROM staff WHERE role = "Delivery rider" AND status = "Active" ORDER BY id');
    const rows = [];
    for (const o of orders) {
      const its = items.get(o.id) || [];
      const r = !DONE.includes(o.flow) ? await routeBranch(o, its, branches) : null;
      rows.push({
        id: o.id, date: o.created_at, name: o.company || o.customer_name, phone: o.customer_phone, address: o.address, total: o.total, payment: o.payment, payStatus: o.pay_status, cod: isCod(o),
        flow: o.flow, branch: o.branch_id || r?.pick.id || 'B1', fallback: !!r?.fallback, nearName: r?.near.name, pickName: r?.pick.name, held: !!o.hold, hasRider: !!o.rider_id, rider: o.rider_id, courier: o.courier, courierTn: o.courier_tn,
        attempts: (parseJson(o.attempts) || []).length
      });
    }
    const [cod] = await pool.query('SELECT COALESCE(SUM(cod_collected),0) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL');
    const [[ret]] = await pool.query('SELECT COUNT(*) n FROM order_returns WHERE status = "Requested"');
    res.json({ orders: rows, riders: riders.map(riderOut), couriers: COURIERS, branches, codWithRiders: Number(cod[0].s), returnsPending: ret.n });
  }));

  hub.get('/branches', guard('hub.view'), wrap(async (req, res) => {
    const branches = await getBranches();
    const [riders] = await pool.query('SELECT branch_id, COUNT(*) n FROM staff WHERE role = "Delivery rider" AND status = "Active" GROUP BY branch_id');
    const [active] = await pool.query('SELECT * FROM orders WHERE flow NOT IN ("Delivered","Cancelled","Returned") ORDER BY created_at DESC');
    const items = await loadItems(active.map(o => o.id));
    const routing = [];
    const counts = {};
    for (const o of active) {
      const r = await routeBranch(o, items.get(o.id) || [], branches);
      const b = o.branch_id || r.pick.id;
      counts[b] = (counts[b] || 0) + 1;
      if (routing.length < 12) routing.push({ id: o.id, address: o.address, pick: r.pick.name, fallback: r.fallback, stock: r.stock.map(x => ({ name: x.b.name.split(' ')[0], ok: x.ok, nearest: x.b === r.near })) });
    }
    const [used] = await pool.query('SELECT courier, COUNT(*) n FROM orders WHERE courier IS NOT NULL GROUP BY courier');
    res.json({
      branches: branches.map(b => ({ id: b.id, name: b.name, area: b.area, riders: riders.find(r => r.branch_id === b.id)?.n || 0, active: counts[b.id] || 0 })),
      routing, couriers: COURIERS.map(c => ({ ...c, used: used.find(u => u.courier === c.id)?.n || 0 }))
    });
  }));
}
