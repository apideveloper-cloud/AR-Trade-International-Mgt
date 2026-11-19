// Reads what the signed-in person's role needs from the database (read-only queries).
import { RANGES, addDays } from './dates.js';

/** Orders per day, cancellations and pending counts. */
async function collectOrders(q, raw, ctx) {
  const { ref, fromS, fromP, end } = ctx;
  raw.days = await q("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d, COUNT(*) n, COALESCE(SUM(total), 0) v FROM orders WHERE status <> 'Cancelled' AND created_at >= ? AND created_at < ? GROUP BY d", [fromS, end]);
  raw.cancelled30 = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Cancelled' AND created_at >= ? AND created_at < ?", [fromP, end]))[0].n;
  raw.pendingOrders = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Pending'"))[0].n;
  raw.pendingOldOrders = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Pending' AND created_at < ?", [addDays(ref, -1)]))[0].n;
}

/** Status counts, top sellers, payment mix and lowest sellers for the period. */
async function collectSales(q, raw, ctx) {
  const { fromP, end } = ctx;
  raw.status = Object.fromEntries((await q('SELECT status, COUNT(*) n FROM orders GROUP BY status')).map(r => [r.status, r.n]));
  raw.top = (await q("SELECT i.product_id id, MAX(i.name) name, MAX(p.img) img, SUM(i.qty) q, SUM(i.qty * i.price) v FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id ORDER BY q DESC, v DESC LIMIT 6", [fromP, end])).map(r => ({ id: r.id, name: r.name, img: r.img || '', q: Number(r.q), v: Number(r.v) }));
  raw.pay = (await q("SELECT SUBSTRING_INDEX(payment, ' ·', 1) p, COUNT(*) n, COALESCE(SUM(total), 0) v FROM orders WHERE status <> 'Cancelled' AND created_at >= ? AND created_at < ? GROUP BY p ORDER BY v DESC", [fromP, end])).map(r => ({ p: r.p || 'Other', n: Number(r.n), v: Number(r.v) }));
  // lowest sellers: live, priced products with the fewest units sold in the period (unsold ones first, the most stock tied up first)
  raw.low = (await q("SELECT p.id, p.name, p.img, p.stock, COALESCE(s.q, 0) q, COALESCE(s.v, 0) v FROM products p LEFT JOIN (SELECT i.product_id, SUM(i.qty) q, SUM(i.qty * i.price) v FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id) s ON s.product_id = p.id WHERE p.active = 1 AND p.price > 0 ORDER BY q ASC, p.stock DESC, p.name LIMIT 6", [fromP, end])).map(r => ({ id: r.id, name: r.name, img: r.img || '', stock: Number(r.stock), q: Number(r.q), v: Number(r.v) }));
}

async function collectStock(q, raw, ctx) {
  const { from30, end } = ctx;
  const rows = await q("SELECT p.id, p.name, p.img, p.stock, COALESCE(s.q, 0) sold30 FROM products p LEFT JOIN (SELECT i.product_id, SUM(i.qty) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id) s ON s.product_id = p.id WHERE p.active = 1 AND p.price > 0 AND (p.stock <= 5 OR s.q > 0)", [from30, end]);
  const a = (await q("SELECT SUM(active = 1) live, SUM(active = 1 AND price > 0 AND stock <= 0) outn, SUM(active = 1 AND price > 0 AND stock BETWEEN 1 AND 5) low, SUM(active = 1 AND (img IS NULL OR img = '')) noImg, SUM(active = 1 AND price = 0) quote, COALESCE(SUM(CASE WHEN active = 1 THEN price * stock END), 0) stockval FROM products"))[0];
  raw.stock = { rows: rows.map(r => ({ ...r, stock: Number(r.stock), sold30: Number(r.sold30) })), out: Number(a.outn), low: Number(a.low), noImg: Number(a.noImg), quote: Number(a.quote), live: Number(a.live), value: Number(a.stockval) };
}

async function collectCustomers(q, raw, ctx) {
  const { ref, fromP, end } = ctx;
  const b = (await q("SELECT COUNT(*) buyers, COALESCE(SUM(n >= 2), 0) repeats FROM (SELECT RIGHT(customer_phone, 10) k, COUNT(*) n FROM orders WHERE status <> 'Cancelled' GROUP BY k) t"))[0];
  const weeks = await q("SELECT FLOOR(DATEDIFF(?, DATE(created_at)) / 7) w, COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY w", [ref, addDays(ref, -55), end]);
  const newByWeek = Array.from({ length: 8 }, (_, i) => Number(weeks.find(r => Number(r.w) === 7 - i)?.n || 0));
  const top = (await q("SELECT MAX(customer_name) name, COUNT(*) n, SUM(total) v FROM orders WHERE status <> 'Cancelled' GROUP BY RIGHT(customer_phone, 10) ORDER BY v DESC LIMIT 5")).map(r => ({ name: r.name, n: Number(r.n), v: Number(r.v) }));
  raw.cust = { buyers: Number(b.buyers), repeat: Number(b.repeats), accounts: Number((await q('SELECT COUNT(*) n FROM users'))[0].n), newAccounts30: Number((await q('SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?', [fromP, end]))[0].n), newByWeek, top };
}

async function collectDelivery(q, raw) {
  const flow = Object.fromEntries((await q("SELECT flow, COUNT(*) n FROM orders WHERE flow NOT IN ('Delivered','Cancelled','Returned') GROUP BY flow")).map(r => [r.flow, r.n]));
  raw.delivery = { flow, codWith: Number((await q('SELECT COALESCE(SUM(cod_collected), 0) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL'))[0].s), returnsPending: Number((await q("SELECT COUNT(*) n FROM order_returns WHERE status = 'Requested'"))[0].n) };
}

async function collectFinance(q, raw, ctx, has) {
  const week = addDays(ctx.ref, -7);
  const u = (await q("SELECT COUNT(*) n, COALESCE(SUM(total), 0) v, COALESCE(SUM(created_at < ?), 0) oldn, COALESCE(SUM(CASE WHEN created_at < ? THEN total END), 0) oldv FROM orders WHERE status NOT IN ('Cancelled') AND pay_status = 'Unpaid' AND NOT (status = 'Pending' AND created_at >= ?)", [week, week, week]))[0];
  const x = has('field.approve') ? (await q("SELECT COUNT(*) n, COALESCE(SUM(amount), 0) v FROM field_expenses WHERE status = 'Pending'"))[0] : { n: 0, v: 0 };
  raw.finance = { unpaidN: Number(u.n), unpaidV: Number(u.v), unpaidOldN: Number(u.oldn), unpaidOldV: Number(u.oldv), expN: Number(x.n), expV: Number(x.v) };
}

async function collectEngage(q, raw, ctx, has) {
  const count = async (perm, sql, p) => (has(perm) ? Number((await q(sql, p))[0].n) : 0);
  raw.engage = {
    services: await count('services.manage', "SELECT COUNT(*) n FROM service_requests WHERE status = 'New'"),
    reviews: await count('reviews.moderate', "SELECT COUNT(*) n FROM reviews WHERE status = 'Pending'"),
    messages: await count('messages.manage', 'SELECT COUNT(*) n FROM messages WHERE created_at >= ?', [addDays(ctx.ref, -2)]),
    apps: await count('careers.manage', "SELECT COUNT(*) n FROM applications WHERE stage = 'New'"),
    team: await count('team.manage', "SELECT COUNT(*) n FROM staff WHERE status = 'Pending'")
  };
}

/** Reads what the signed-in person's role needs from the database. `ref` is the reference day (today unless the caller asks for another). */
export async function collect(pool, has, refOverride, rangeDays) {
  const q = async (sql, p = []) => (await pool.query(sql, p))[0];
  const ref = refOverride || (await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') d"))[0].d;
  const N = RANGES[rangeDays] ? Number(rangeDays) : 30;
  const ctx = { ref, fromS: addDays(ref, -(Math.max(60, 2 * N) - 1)), fromP: addDays(ref, -(N - 1)), from30: addDays(ref, -29), end: addDays(ref, 1) };
  const raw = { ref, range: N };
  const sales = has('orders.view') && has('dashboard.view');

  if (sales || has('orders.view')) await collectOrders(q, raw, ctx);
  if (sales) await collectSales(q, raw, ctx);
  if (has('products.view')) await collectStock(q, raw, ctx);
  if (has('customers.view')) await collectCustomers(q, raw, ctx);
  if (has('hub.view') || has('hub.cash')) await collectDelivery(q, raw);
  if (has('hub.cash') || has('field.approve') || has('orders.status')) await collectFinance(q, raw, ctx, has);
  await collectEngage(q, raw, ctx, has);
  return raw;
}
