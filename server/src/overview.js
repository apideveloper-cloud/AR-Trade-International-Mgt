// Role-aware dashboard: figures, chart series, a 7-day forecast and the auto-generated "smart guide".
// Everything is computed from the application's own transactions (orders, items, stock, customers, expenses). Nothing is invented:
// the forecast is the average of each weekday over the last 8 weeks, scaled by the recent trend, and every guide line says what it is based on.
import { can } from './permissions.js';
import { fail } from './util.js';

const DAY = 864e5;
/** Periods the dashboard can be sorted by: days -> wording used in the text. */
export const RANGES = { 1: 'day', 7: '7 days', 15: '15 days', 30: '30 days', 90: '3 months', 180: '6 months', 365: '12 months' };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = s => new Date(s + 'T00:00:00Z');
const addDays = (s, n) => ymd(new Date(parse(s).getTime() + n * DAY));
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const money = n => '৳ ' + Math.round(Number(n) || 0).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
const sum = (a, f = x => x) => a.reduce((t, x) => t + f(x), 0);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Pure analysis of the collected figures. `raw` is what collect() returns; `perms(name)` says what the signed-in person may see. */
export function analyse(raw, has) {
  const out = { asOf: raw.ref, sections: [], todo: [], insights: [] };
  const sales = has('orders.view') && has('dashboard.view');
  const followsMoney = has('hub.cash') || has('field.approve') || has('orders.status'); // roles that follow up payments
  // what this person's dashboard leads with: buyers start from stock, everyone else from sales
  out.focus = has('products.manage') && !has('orders.status') && has('products.view') ? 'stock' : 'sales';

  // ---------- daily series (zero-filled, up to and including the reference day; long enough for the chosen period and its previous twin) ----------
  const N = RANGES[raw.range] ? Number(raw.range) : 30, S = Math.max(60, 2 * N), lab = RANGES[N];
  const perTxt = N === 1 ? 'today' : 'in the last ' + lab, prevTxt = N === 1 ? 'yesterday' : 'the previous ' + lab;
  const byDay = new Map((raw.days || []).map(r => [r.d, r]));
  const full = [];
  for (let i = S - 1; i >= 0; i--) {
    const d = addDays(raw.ref, -i);
    const r = byDay.get(d);
    full.push({ d, wd: parse(d).getUTCDay(), v: r ? Number(r.v) : 0, n: r ? Number(r.n) : 0 });
  }
  const series = full.slice(-60); // the forecast always works from the last 60 days
  const last = (n, k) => series.slice(60 - n, 60).map(x => x[k]);
  const rev30 = sum(full.slice(S - N), x => x.v), revPrev30 = sum(full.slice(S - 2 * N, S - N), x => x.v); // "30" = the chosen period
  const ord30 = sum(full.slice(S - N), x => x.n), ordPrev30 = sum(full.slice(S - 2 * N, S - N), x => x.n);
  const rev7 = sum(last(7, 'v')), revPrev7 = sum(series.slice(46, 53), x => x.v);
  const today = series[59];

  // ---------- forecast: weekday profile of the last 8 weeks x recent trend ----------
  const prof = Array.from({ length: 7 }, () => ({ v: 0, n: 0, days: 0 }));
  series.slice(4).forEach(x => { prof[x.wd].v += x.v; prof[x.wd].n += x.n; prof[x.wd].days++; });
  const profile = prof.map(p => ({ v: p.days ? p.v / p.days : 0, n: p.days ? p.n / p.days : 0 }));
  const recent = sum(last(14, 'v')), before = sum(series.slice(32, 46), x => x.v);
  const trend = before > 0 ? clamp(recent / before, 0.6, 1.6) : 1;
  const orders56 = sum(series.slice(4), x => x.n);
  const confidence = orders56 >= 60 ? 'good' : orders56 >= 15 ? 'fair' : 'low';
  const spread = confidence === 'good' ? 0.2 : confidence === 'fair' ? 0.35 : 0.55;
  const forecast = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(raw.ref, i), wd = parse(d).getUTCDay();
    const v = profile[wd].v * trend;
    forecast.push({ d, wd, v: Math.round(v), n: Math.round(profile[wd].n * trend * 10) / 10, lo: Math.round(v * (1 - spread)), hi: Math.round(v * (1 + spread)) });
  }
  const fcTotal = sum(forecast, x => x.v), fcOrders = Math.round(sum(forecast, x => x.n));
  const bestWd = profile.map((p, i) => [i, p.v]).sort((a, b) => b[1] - a[1])[0];
  const slowWd = profile.map((p, i) => [i, p.v]).sort((a, b) => a[1] - b[1])[0];

  if (sales) {
    out.sections.push('sales');
    out.sales = {
      kpis: { rev30, revPrev30, revDelta: pct(rev30, revPrev30), ord30, ordPrev30, ordDelta: pct(ord30, ordPrev30), avg: ord30 ? Math.round(rev30 / ord30) : 0, today: today.v, todayN: today.n, rev7, revPrev7, rev7Delta: pct(rev7, revPrev7) },
      series: full.slice(-Math.max(60, N)), range: N, label: lab, low: raw.low || [], forecast, fcTotal, fcOrders, confidence, trend: Math.round(trend * 100) / 100, profile: profile.map((p, i) => ({ wd: WD[i], v: Math.round(p.v), n: Math.round(p.n * 10) / 10 })),
      status: raw.status || {}, top: raw.top || [], pay: raw.pay || []
    };
  }

  // ---------- catalog / stock ----------
  if (has('products.view')) {
    out.sections.push('stock');
    const rows = (raw.stock?.rows || []).map(r => {
      const perDay = r.sold30 / 30;
      return { id: r.id, name: r.name, img: r.img, stock: r.stock, sold30: r.sold30, days: perDay > 0 ? Math.round(r.stock / perDay) : null };
    });
    const risk = rows.filter(r => r.stock <= 0 || (r.days !== null && r.days <= 21)).sort((a, b) => (a.days ?? -1) - (b.days ?? -1)).slice(0, 8);
    out.stock = { risk, out: raw.stock?.out || 0, low: raw.stock?.low || 0, noImg: raw.stock?.noImg || 0, quote: raw.stock?.quote || 0, live: raw.stock?.live || 0, value: raw.stock?.value || 0 };
  }

  // ---------- customers ----------
  if (has('customers.view')) {
    out.sections.push('customers');
    const c = raw.cust || {};
    out.customers = { buyers: c.buyers || 0, repeat: c.repeat || 0, repeatRate: c.buyers ? Math.round(c.repeat / c.buyers * 100) : 0, accounts: c.accounts || 0, newAccounts30: c.newAccounts30 || 0, newByWeek: c.newByWeek || [], top: c.top || [] };
  }

  // ---------- delivery ----------
  if (has('hub.view') || has('hub.cash')) {
    out.sections.push('delivery');
    const d = raw.delivery || {};
    out.delivery = { flow: d.flow || {}, open: sum(Object.values(d.flow || {})), codWith: d.codWith || 0, returnsPending: d.returnsPending || 0, pendingOld: d.pendingOld || 0 };
  }

  // ---------- money ----------
  if (followsMoney) {
    const f = raw.finance || {};
    out.sections.push('finance');
    out.finance = { unpaidN: f.unpaidN || 0, unpaidV: f.unpaidV || 0, unpaidOldN: f.unpaidOldN || 0, unpaidOldV: f.unpaidOldV || 0, expN: f.expN || 0, expV: f.expV || 0, cancelled30: raw.cancelled30 || 0 };
  }

  // ---------- to do today (only things this person can act on) ----------
  const e = raw.engage || {};
  const todo = [];
  const add = (perm, n, label, page, tone = 'amber') => { if (can_(has, perm) && n > 0) todo.push({ n, label, page, tone }); };
  add('orders.status', raw.pendingOrders || 0, 'orders waiting for a confirmation call', 'orders', 'red');
  add('services.manage', e.services, 'new service requests', 'services');
  add('reviews.moderate', e.reviews, 'reviews waiting for approval', 'reviews');
  add('messages.manage', e.messages, 'messages in the last 2 days', 'inbox', 'blue');
  add('careers.manage', e.apps, 'new job applications', 'careers', 'blue');
  add('team.manage', e.team, 'staff accounts to approve', 'team', 'red');
  add('hub.view', raw.delivery?.returnsPending, 'return requests', 'deliveries', 'red');
  add('field.approve', raw.finance?.expN, 'expense claims to approve', 'dashboard', 'amber');
  out.todo = todo;

  // ---------- smart guide: plain-language lines generated from the numbers above ----------
  const g = [];
  const tip = (tone, icon, title, text, page) => g.push({ tone, icon, title, text, page });
  const s = out.sales;
  if (s) {
    const days = series.filter(x => x.n > 0).length;
    if (orders56 === 0) {
      tip('warn', '📉', 'No orders in the last 8 weeks', 'The forecast cannot be built until orders come in. Check that the storefront, payment methods and the promo banner are switched on.', 'settings');
    } else {
      tip(trend >= 1.05 ? 'good' : trend <= 0.95 ? 'warn' : 'tip', '🔮', `Next 7 days: about ${money(fcTotal)} from ~${fcOrders} order${fcOrders === 1 ? '' : 's'}`,
        `Worked out from your last 8 weeks (${orders56} orders on ${days} days): the average of each weekday, ${trend >= 1.05 ? 'raised' : trend <= 0.95 ? 'lowered' : 'kept'} by the recent trend (${trend >= 1 ? '+' : ''}${Math.round((trend - 1) * 100)}%). Confidence: ${confidence}${confidence === 'low' ? ', because there are few orders, so treat it as a rough range' : ''}.`, 'orders');
    }
    if (s.kpis.revDelta !== null && revPrev30 > 0) {
      if (s.kpis.revDelta <= -15) tip('warn', '⚠️', `Revenue is down ${Math.abs(s.kpis.revDelta)}% compared with ${prevTxt}`, `${money(rev30)} against ${money(revPrev30)}. Look at the top products and stock below, and consider a campaign or coupon.`, 'marketing');
      else if (s.kpis.revDelta >= 15) tip('good', '🚀', `Revenue is up ${s.kpis.revDelta}% compared with ${prevTxt}`, `${money(rev30)} against ${money(revPrev30)}. Make sure the best sellers stay in stock.`, 'products');
    }
    if (bestWd[1] > 0 && slowWd[0] !== bestWd[0]) tip('tip', '📅', `${WD_LONG[bestWd[0]]} is your strongest day, ${WD_LONG[slowWd[0]]} the weakest`, `${WD_LONG[bestWd[0]]} averages ${money(bestWd[1])} against ${money(slowWd[1])} on ${WD_LONG[slowWd[0]]}. Schedule offers and email campaigns for the slow day, and have staff ready on the busy one.`, 'marketing');
    const top = (s.top || [])[0];
    if (top && rev30 > 0 && top.v / rev30 >= 0.4) tip('tip', '🎯', `One product brings ${Math.round(top.v / rev30 * 100)}% of the revenue`, `"${top.name}" is doing the heavy lifting. Keep it well stocked and promote similar products so sales do not depend on a single item.`, 'products');
    const cancelRate = ord30 + (raw.cancelled30 || 0) > 0 ? Math.round((raw.cancelled30 || 0) / (ord30 + (raw.cancelled30 || 0)) * 100) : 0;
    if (cancelRate >= 20 && (raw.cancelled30 || 0) >= 3) tip('warn', '🚫', `${cancelRate}% of orders ${perTxt} were cancelled`, 'Find the common reason (stock, delivery time, price) and fix it at the source. Check the order history of the cancelled orders.', 'orders');
  }
  if (out.stock) {
    const soon = out.stock.risk.filter(r => r.days !== null && r.days <= 14 && r.stock > 0);
    if (out.stock.risk.some(r => r.stock <= 0 && r.sold30 > 0)) tip('warn', '📦', `${out.stock.risk.filter(r => r.stock <= 0 && r.sold30 > 0).length} selling product(s) are out of stock`, `Customers were buying these in the last 30 days: ${out.stock.risk.filter(r => r.stock <= 0 && r.sold30 > 0).slice(0, 3).map(r => r.name).join(', ')}. Reorder first.`, 'products');
    if (soon.length) tip('warn', '⏳', `${soon.length} product${soon.length === 1 ? '' : 's'} will run out within 2 weeks`, `At the current sales speed: ${soon.slice(0, 3).map(r => `${r.name} (${r.days} day${r.days === 1 ? '' : 's'})`).join(', ')}${soon.length > 3 ? ' and more' : ''}. Reorder now so the shelf never goes empty.`, 'products');
    if (out.stock.noImg > 0) tip('tip', '🖼️', `${out.stock.noImg} live product${out.stock.noImg === 1 ? ' has' : 's have'} no photo`, 'Products with a photo get more clicks. Add pictures to the live ones first.', 'products');
  }
  if (out.finance && (has('orders.status') || has('hub.cash'))) {
    if (out.finance.unpaidOldN > 0) tip('warn', '💸', `${money(out.finance.unpaidOldV)} unpaid for more than 7 days`, `${out.finance.unpaidOldN} order${out.finance.unpaidOldN === 1 ? '' : 's'} not marked paid after a week. Call the customers or check whether the rider's cash was deposited.`, 'orders');
    if (raw.pendingOldOrders > 0 && has('orders.status')) tip('warn', '📞', `${raw.pendingOldOrders} order${raw.pendingOldOrders === 1 ? ' is' : 's are'} still pending after 24 hours`, 'Orders confirmed quickly are cancelled less. Call these customers today.', 'orders');
  }
  if (out.delivery) {
    if (out.delivery.codWith > 0 && has('hub.cash')) tip('tip', '💵', `${money(out.delivery.codWith)} cash is still with riders`, 'Ask the riders to hand it in and mark it deposited so the books match the cash drawer.', 'deliveries');
    if (out.delivery.returnsPending > 0) tip('warn', '↩️', `${out.delivery.returnsPending} return request${out.delivery.returnsPending === 1 ? '' : 's'} to decide`, 'Open the Delivery Hub and approve a refund, a replacement or reject with a reason.', 'deliveries');
  }
  if (out.customers) {
    if (out.customers.buyers >= 10 && out.customers.repeatRate < 25) tip('tip', '🔁', `Only ${out.customers.repeatRate}% of customers ordered more than once`, 'Toner and ink are repeat purchases. Turn on the welcome series and send refill reminders to bring buyers back.', 'marketing');
    if (out.customers.newAccounts30 === 0 && out.customers.accounts > 0) tip('tip', '🌱', `No new customer accounts ${perTxt}`, 'Try the welcome coupon or a newsletter popup to attract sign-ups.', 'settings');
  }
  if (out.finance && has('field.approve') && out.finance.expN > 0) tip('tip', '🧾', `${out.finance.expN} expense claim${out.finance.expN === 1 ? '' : 's'} (${money(out.finance.expV)}) waiting`, 'Approve or reject them in the mobile app so staff are reimbursed on time.', 'dashboard');
  const order = { warn: 0, tip: 1, good: 2 };
  out.insights = g.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 8);
  return out;
}
const can_ = (has, perm) => has(perm);

/** Reads what the signed-in person's role needs from the database. `ref` is the reference day (today unless the caller asks for another). */
export async function collect(pool, has, refOverride, rangeDays) {
  const q = async (sql, p = []) => (await pool.query(sql, p))[0];
  const ref = refOverride || (await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') d"))[0].d;
  const N = RANGES[rangeDays] ? Number(rangeDays) : 30;
  const fromS = addDays(ref, -(Math.max(60, 2 * N) - 1)), fromP = addDays(ref, -(N - 1)), from30 = addDays(ref, -29), end = addDays(ref, 1);
  const raw = { ref, range: N };
  const sales = has('orders.view') && has('dashboard.view');

  if (sales || has('orders.view')) {
    raw.days = await q("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d, COUNT(*) n, COALESCE(SUM(total), 0) v FROM orders WHERE status <> 'Cancelled' AND created_at >= ? AND created_at < ? GROUP BY d", [fromS, end]);
    raw.cancelled30 = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Cancelled' AND created_at >= ? AND created_at < ?", [fromP, end]))[0].n;
    raw.pendingOrders = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Pending'"))[0].n;
    raw.pendingOldOrders = (await q("SELECT COUNT(*) n FROM orders WHERE status = 'Pending' AND created_at < ?", [addDays(ref, -1)]))[0].n;
  }
  if (sales) {
    raw.status = Object.fromEntries((await q('SELECT status, COUNT(*) n FROM orders GROUP BY status')).map(r => [r.status, r.n]));
    raw.top = (await q("SELECT i.product_id id, MAX(i.name) name, MAX(p.img) img, SUM(i.qty) q, SUM(i.qty * i.price) v FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id ORDER BY q DESC, v DESC LIMIT 6", [fromP, end])).map(r => ({ id: r.id, name: r.name, img: r.img || '', q: Number(r.q), v: Number(r.v) }));
    raw.pay = (await q("SELECT SUBSTRING_INDEX(payment, ' ·', 1) p, COUNT(*) n, COALESCE(SUM(total), 0) v FROM orders WHERE status <> 'Cancelled' AND created_at >= ? AND created_at < ? GROUP BY p ORDER BY v DESC", [fromP, end])).map(r => ({ p: r.p || 'Other', n: Number(r.n), v: Number(r.v) }));
    // lowest sellers: live, priced products with the fewest units sold in the period (unsold ones first, the most stock tied up first)
    raw.low = (await q("SELECT p.id, p.name, p.img, p.stock, COALESCE(s.q, 0) q, COALESCE(s.v, 0) v FROM products p LEFT JOIN (SELECT i.product_id, SUM(i.qty) q, SUM(i.qty * i.price) v FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id) s ON s.product_id = p.id WHERE p.active = 1 AND p.price > 0 ORDER BY q ASC, p.stock DESC, p.name LIMIT 6", [fromP, end])).map(r => ({ id: r.id, name: r.name, img: r.img || '', stock: Number(r.stock), q: Number(r.q), v: Number(r.v) }));
  }
  if (has('products.view')) {
    const rows = await q("SELECT p.id, p.name, p.img, p.stock, COALESCE(s.q, 0) sold30 FROM products p LEFT JOIN (SELECT i.product_id, SUM(i.qty) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' AND o.created_at >= ? AND o.created_at < ? GROUP BY i.product_id) s ON s.product_id = p.id WHERE p.active = 1 AND p.price > 0 AND (p.stock <= 5 OR s.q > 0)", [from30, end]);
    const a = (await q("SELECT SUM(active = 1) live, SUM(active = 1 AND price > 0 AND stock <= 0) outn, SUM(active = 1 AND price > 0 AND stock BETWEEN 1 AND 5) low, SUM(active = 1 AND (img IS NULL OR img = '')) noImg, SUM(active = 1 AND price = 0) quote, COALESCE(SUM(CASE WHEN active = 1 THEN price * stock END), 0) stockval FROM products"))[0];
    raw.stock = { rows: rows.map(r => ({ ...r, stock: Number(r.stock), sold30: Number(r.sold30) })), out: Number(a.outn), low: Number(a.low), noImg: Number(a.noImg), quote: Number(a.quote), live: Number(a.live), value: Number(a.stockval) };
  }
  if (has('customers.view')) {
    const b = (await q("SELECT COUNT(*) buyers, COALESCE(SUM(n >= 2), 0) repeats FROM (SELECT RIGHT(customer_phone, 10) k, COUNT(*) n FROM orders WHERE status <> 'Cancelled' GROUP BY k) t"))[0];
    const weeks = await q("SELECT FLOOR(DATEDIFF(?, DATE(created_at)) / 7) w, COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ? GROUP BY w", [ref, addDays(ref, -55), end]);
    const newByWeek = Array.from({ length: 8 }, (_, i) => Number(weeks.find(r => Number(r.w) === 7 - i)?.n || 0));
    const top = (await q("SELECT MAX(customer_name) name, COUNT(*) n, SUM(total) v FROM orders WHERE status <> 'Cancelled' GROUP BY RIGHT(customer_phone, 10) ORDER BY v DESC LIMIT 5")).map(r => ({ name: r.name, n: Number(r.n), v: Number(r.v) }));
    raw.cust = { buyers: Number(b.buyers), repeat: Number(b.repeats), accounts: Number((await q('SELECT COUNT(*) n FROM users'))[0].n), newAccounts30: Number((await q('SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?', [fromP, end]))[0].n), newByWeek, top };
  }
  if (has('hub.view') || has('hub.cash')) {
    const flow = Object.fromEntries((await q("SELECT flow, COUNT(*) n FROM orders WHERE flow NOT IN ('Delivered','Cancelled','Returned') GROUP BY flow")).map(r => [r.flow, r.n]));
    raw.delivery = { flow, codWith: Number((await q('SELECT COALESCE(SUM(cod_collected), 0) s FROM orders WHERE cod_collected > 0 AND cod_deposited_at IS NULL'))[0].s), returnsPending: Number((await q("SELECT COUNT(*) n FROM order_returns WHERE status = 'Requested'"))[0].n) };
  }
  if (has('hub.cash') || has('field.approve') || has('orders.status')) {
    const u = (await q("SELECT COUNT(*) n, COALESCE(SUM(total), 0) v, COALESCE(SUM(created_at < ?), 0) oldn, COALESCE(SUM(CASE WHEN created_at < ? THEN total END), 0) oldv FROM orders WHERE status NOT IN ('Cancelled') AND pay_status = 'Unpaid' AND NOT (status = 'Pending' AND created_at >= ?)", [addDays(ref, -7), addDays(ref, -7), addDays(ref, -7)]))[0];
    const x = has('field.approve') ? (await q("SELECT COUNT(*) n, COALESCE(SUM(amount), 0) v FROM field_expenses WHERE status = 'Pending'"))[0] : { n: 0, v: 0 };
    raw.finance = { unpaidN: Number(u.n), unpaidV: Number(u.v), unpaidOldN: Number(u.oldn), unpaidOldV: Number(u.oldv), expN: Number(x.n), expV: Number(x.v) };
  }
  raw.engage = {
    services: has('services.manage') ? Number((await q("SELECT COUNT(*) n FROM service_requests WHERE status = 'New'"))[0].n) : 0,
    reviews: has('reviews.moderate') ? Number((await q("SELECT COUNT(*) n FROM reviews WHERE status = 'Pending'"))[0].n) : 0,
    messages: has('messages.manage') ? Number((await q('SELECT COUNT(*) n FROM messages WHERE created_at >= ?', [addDays(ref, -2)]))[0].n) : 0,
    apps: has('careers.manage') ? Number((await q("SELECT COUNT(*) n FROM applications WHERE stage = 'New'"))[0].n) : 0,
    team: has('team.manage') ? Number((await q("SELECT COUNT(*) n FROM staff WHERE status = 'Pending'"))[0].n) : 0
  };
  return raw;
}

export async function buildOverview(pool, staff, asOf, range) {
  const has = p => can(staff, p);
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || '')) ? asOf : undefined;
  const raw = await collect(pool, has, ref, Number(range) || 30);
  return { ...analyse(raw, has), person: { name: staff.name, role: staff.role } };
}

/** One product's sales report for the chosen period: totals against the period before, daily units, rank, stock cover and the latest orders. */
export async function buildProductReport(pool, id, asOf, rangeDays) {
  const q = async (sql, p = []) => (await pool.query(sql, p))[0];
  const [p] = await q('SELECT p.id, p.name, p.brand, p.sku, p.price, p.old_price, p.stock, p.img, p.active, c.title cat FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?', [id]);
  if (!p) throw fail(404, 'Product not found');
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || '')) ? asOf : (await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') d"))[0].d;
  const N = RANGES[rangeDays] ? Number(rangeDays) : 30;
  const span = Math.max(2 * N, 14), end = addDays(ref, 1), from = addDays(ref, -(N - 1)), fromAll = addDays(ref, -(span - 1));
  const live = "o.status <> 'Cancelled'";
  const rows = await q(`SELECT DATE_FORMAT(o.created_at, '%Y-%m-%d') d, SUM(i.qty) q, SUM(i.qty * i.price) v, COUNT(DISTINCT o.id) n FROM order_items i JOIN orders o ON o.id = i.order_id WHERE i.product_id = ? AND ${live} AND o.created_at >= ? AND o.created_at < ? GROUP BY d`, [p.id, fromAll, end]);
  const byDay = new Map(rows.map(r => [r.d, r]));
  const days = [];
  for (let i = span - 1; i >= 0; i--) { const d = addDays(ref, -i), r = byDay.get(d); days.push({ d, q: r ? Number(r.q) : 0, v: r ? Number(r.v) : 0, n: r ? Number(r.n) : 0 }); }
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
