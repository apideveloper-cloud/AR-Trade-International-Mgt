// The overview entry point and the single-product sales report.
import { can } from '../permissions.js';
import { fail } from '../util.js';
import { analyse } from './analyse.js';
import { collect } from './collect.js';
import { RANGES, addDays, isDay, pct, periodDays, sum } from './dates.js';

/** The whole dashboard for one signed-in person. `asOf` is an optional 'YYYY-MM-DD' reference day, `range` the period in days. */
export async function buildOverview(pool, staff, asOf, range) {
  const has = p => can(staff, p);
  const ref = isDay(asOf) ? asOf : undefined;
  const raw = await collect(pool, has, ref, Number(range) || 30);
  return { ...analyse(raw, has), person: { name: staff.name, role: staff.role } };
}

/** Zero-filled per-day units / revenue / orders for one product. */
function productDays(rows, ref, span) {
  const byDay = new Map(rows.map(r => [r.d, r]));
  const days = [];
  for (let i = span - 1; i >= 0; i--) { const d = addDays(ref, -i), r = byDay.get(d); days.push({ d, q: r ? Number(r.q) : 0, v: r ? Number(r.v) : 0, n: r ? Number(r.n) : 0 }); }
  return days;
}

/** One product's sales report for the chosen period: totals against the period before, daily units, rank, stock cover and the latest orders. */
export async function buildProductReport(pool, id, asOf, rangeDays) {
  const q = async (sql, p = []) => (await pool.query(sql, p))[0];
  const [p] = await q('SELECT p.id, p.name, p.brand, p.sku, p.price, p.old_price, p.stock, p.img, p.active, c.title cat FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?', [id]);
  if (!p) throw fail(404, 'Product not found');
  const ref = isDay(asOf) ? asOf : (await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') d"))[0].d;
  const N = periodDays(rangeDays);
  const span = Math.max(2 * N, 14), end = addDays(ref, 1), from = addDays(ref, -(N - 1)), fromAll = addDays(ref, -(span - 1));
  const live = "o.status <> 'Cancelled'";
  const rows = await q(`SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') d, SUM(i.qty) q, SUM(i.qty * i.price) v, COUNT(DISTINCT o.id) n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND ${live} AND o.created_at >= ? AND o.created_at < ? GROUP BY d`, [p.id, fromAll, end]);
  const days = productDays(rows, ref, span);
  const cur = days.slice(span - N), prev = days.slice(span - 2 * N, span - N);
  const units = sum(cur, x => x.q), revenue = sum(cur, x => x.v), orders = sum(cur, x => x.n);
  const prevUnits = sum(prev, x => x.q), prevRevenue = sum(prev, x => x.v);
  const per = await q(`SELECT i.product_id id, SUM(i.qty) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${live} AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id`, [from, end]);
  const mine = per.find(r => Number(r.id) === Number(p.id));
  const rank = mine ? { pos: 1 + per.filter(r => Number(r.q) > Number(mine.q)).length, of: per.length } : { pos: null, of: per.length };
  const sold30 = Number((await q(`SELECT COALESCE(SUM(i.qty), 0) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND ${live} AND o.created_at >= ? AND o.created_at < ?`, [p.id, addDays(ref, -29), end]))[0].q);
  const [all] = await q(`SELECT COALESCE(SUM(i.qty), 0) q, COALESCE(SUM(i.qty * i.price), 0) v, COUNT(DISTINCT o.id) n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND ${live}`, [p.id]);
  const recent = (await q('SELECT o.id, DATE_FORMAT(o.created_at, \'%Y-%m-%d\') d, o.customer_name name, o.status, o.pay_status pay, i.qty, i.price FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? ORDER BY o.created_at DESC LIMIT 8', [p.id])).map(r => ({ id: r.id, d: r.d, name: r.name, status: r.status, pay: r.pay, qty: Number(r.qty), price: Number(r.price) }));
  const perDay = sold30 / 30;
  return {
    asOf: ref, range: N, label: RANGES[N],
    product: { id: p.id, name: p.name, brand: p.brand, sku: p.sku || '', cat: p.cat || '', price: Number(p.price), oldPrice: Number(p.old_price), stock: Number(p.stock), img: p.img || '', active: !!p.active },
    period: { units, revenue, orders, prevUnits, prevRevenue, unitsDelta: pct(units, prevUnits), revDelta: pct(revenue, prevRevenue), avgPrice: units ? Math.round(revenue / units) : 0 },
    series: days.slice(span - Math.max(N, 14)), rank,
    cover: { sold30, days: perDay > 0 ? Math.round(Number(p.stock) / perDay) : null, tied: Number(p.stock) * Number(p.price) },
    allTime: { units: Number(all.q), revenue: Number(all.v), orders: Number(all.n) },
    recent
  };
}
