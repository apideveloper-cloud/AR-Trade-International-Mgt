// Hub routes: the rider app (rider list, one rider's jobs, cash deposit) and returns.
import { pool } from '../db.js';
import { guard } from '../admin.js';
import { can } from '../permissions.js';
import { applyFlow, getBranches } from '../flow.js';
import { fail, parseJson, wrap } from '../util.js';
import { isCod, riderOut } from './helpers.js';
import { loadItems } from './store.js';

/** Adds the rider and returns routes to the hub router. */
export function registerRiderRoutes(hub) {
  hub.get('/riders', guard(['hub.dispatch', 'hub.deliver']), wrap(async (req, res) => {
    const [riders] = await pool.query('SELECT * FROM staff WHERE role = "Delivery rider" AND status = "Active" ORDER BY id');
    const [jobs] = await pool.query('SELECT rider_id, COUNT(*) n FROM orders WHERE rider_id IS NOT NULL AND flow IN ("Packed","Out for delivery") GROUP BY rider_id');
    const [cod] = await pool.query('SELECT rider_id, SUM(cod_collected) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL GROUP BY rider_id');
    const mine = !can(req.staff, 'hub.dispatch') ? riders.filter(r => r.id === req.staff.id) : riders;
    res.json(mine.map(r => ({ ...riderOut(r), jobs: jobs.find(j => j.rider_id === r.id)?.n || 0, cash: Number(cod.find(c => c.rider_id === r.id)?.s || 0) })));
  }));

  hub.get('/riders/:id', guard(['hub.dispatch', 'hub.deliver']), wrap(async (req, res) => {
    const id = !can(req.staff, 'hub.dispatch') ? req.staff.id : Number(req.params.id);
    const [[r]] = await pool.query('SELECT * FROM staff WHERE id = ? AND role = "Delivery rider"', [id]);
    if (!r) throw fail(404, 'Rider not found');
    const [orders] = await pool.query('SELECT * FROM orders WHERE rider_id = ? ORDER BY created_at DESC', [id]);
    const items = await loadItems(orders.map(o => o.id));
    const branches = await getBranches();
    const jobs = orders.filter(o => ['Packed', 'Out for delivery'].includes(o.flow)).map(o => ({
      id: o.id, flow: o.flow, name: o.customer_name, phone: o.customer_phone, address: o.address, itemsN: (items.get(o.id) || []).reduce((a, i) => a + i.qty, 0),
      branchName: branches.find(b => b.id === o.branch_id)?.name || 'Shantinagar HQ', total: o.total, cod: isCod(o), otp: o.flow === 'Out for delivery' ? o.otp : null, attempts: parseJson(o.attempts) || []
    }));
    const doneToday = orders.filter(o => o.flow === 'Delivered' && parseJson(o.pod)?.at > Date.now() - 864e5).length;
    const [[cash]] = await pool.query('SELECT COALESCE(SUM(cod_collected),0) s FROM orders WHERE rider_id = ? AND cod_collected > 0 AND cod_deposited_at IS NULL', [id]);
    res.json({ rider: riderOut(r), jobs, stats: { assigned: jobs.length, doneToday, cash: Number(cash.s) } });
  }));

  // only the office confirms that a rider handed the cash in (a rider cannot clear their own balance)
  hub.post('/riders/:id/deposit', guard('hub.cash'), wrap(async (req, res) => {
    const id = Number(req.params.id);
    await pool.query('UPDATE orders SET cod_deposited_at = NOW() WHERE rider_id = ? AND cod_collected > 0 AND cod_deposited_at IS NULL', [id]);
    res.json({ ok: true });
  }));

  hub.get('/returns', guard('hub.view'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT r.*, o.customer_name, o.total FROM order_returns r JOIN orders o ON o.id = r.order_id ORDER BY r.created_at DESC');
    res.json(rows.map(r => ({ id: r.order_id, name: r.customer_name, total: r.total, reason: r.reason, note: r.note, status: r.status, mode: r.mode, refund: r.refund, at: r.created_at })));
  }));

  hub.put('/returns/:orderId', guard('hub.dispatch'), wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT r.*, o.total FROM order_returns r JOIN orders o ON o.id = r.order_id WHERE r.order_id = ?', [req.params.orderId]);
    if (!r) throw fail(404, 'Return not found');
    if (r.status !== 'Requested') throw fail(400, 'This return is already resolved');
    const { action } = req.body;
    if (action === 'reject') {
      await pool.query('UPDATE order_returns SET status = "Rejected", done_at = NOW() WHERE id = ?', [r.id]);
    } else if (action === 'refund' || action === 'replace') {
      const mode = action === 'refund' ? 'Refund' : 'Replacement';
      await pool.query('UPDATE order_returns SET status = "Approved", mode = ?, refund = ?, done_at = NOW() WHERE id = ?', [mode, action === 'refund' ? r.total : 0, r.id]);
      await applyFlow(r.order_id, 'Returned', `${mode} · ${r.reason}`);
    } else throw fail(400, 'Choose refund, replace or reject');
    res.json({ ok: true });
  }));
}
