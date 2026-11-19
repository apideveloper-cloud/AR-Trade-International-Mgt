// Builders for the dashboard sections (pure): sales, stock, customers, delivery, finance and the to-do list.
import { WD, pct, sum } from './dates.js';

/** The sales section: KPIs, series, forecast and the tables. */
export function salesSection(raw, f) {
  const { N, lab, full, rev30, revPrev30, ord30, ordPrev30, rev7, revPrev7, today, profile, trend } = f;
  return {
    kpis: { rev30, revPrev30, revDelta: pct(rev30, revPrev30), ord30, ordPrev30, ordDelta: pct(ord30, ordPrev30), avg: ord30 ? Math.round(rev30 / ord30) : 0, today: today.v, todayN: today.n, rev7, revPrev7, rev7Delta: pct(rev7, revPrev7) },
    series: full.slice(-Math.max(60, N)), range: N, label: lab, low: raw.low || [], forecast: f.forecast, fcTotal: f.fcTotal, fcOrders: f.fcOrders, confidence: f.confidence, trend: Math.round(trend * 100) / 100, profile: profile.map((p, i) => ({ wd: WD[i], v: Math.round(p.v), n: Math.round(p.n * 10) / 10 })),
    status: raw.status || {}, top: raw.top || [], pay: raw.pay || []
  };
}

/** The stock section: products at risk of running out, with days of cover. */
export function stockSection(raw) {
  const rows = (raw.stock?.rows || []).map(r => {
    const perDay = r.sold30 / 30;
    return { id: r.id, name: r.name, img: r.img, stock: r.stock, sold30: r.sold30, days: perDay > 0 ? Math.round(r.stock / perDay) : null };
  });
  const risk = rows.filter(r => r.stock <= 0 || (r.days !== null && r.days <= 21)).sort((a, b) => (a.days ?? -1) - (b.days ?? -1)).slice(0, 8);
  return { risk, out: raw.stock?.out || 0, low: raw.stock?.low || 0, noImg: raw.stock?.noImg || 0, quote: raw.stock?.quote || 0, live: raw.stock?.live || 0, value: raw.stock?.value || 0 };
}

export function customersSection(raw) {
  const c = raw.cust || {};
  return { buyers: c.buyers || 0, repeat: c.repeat || 0, repeatRate: c.buyers ? Math.round(c.repeat / c.buyers * 100) : 0, accounts: c.accounts || 0, newAccounts30: c.newAccounts30 || 0, newByWeek: c.newByWeek || [], top: c.top || [] };
}

export function deliverySection(raw) {
  const d = raw.delivery || {};
  return { flow: d.flow || {}, open: sum(Object.values(d.flow || {})), codWith: d.codWith || 0, returnsPending: d.returnsPending || 0, pendingOld: d.pendingOld || 0 };
}

export function financeSection(raw) {
  const f = raw.finance || {};
  return { unpaidN: f.unpaidN || 0, unpaidV: f.unpaidV || 0, unpaidOldN: f.unpaidOldN || 0, unpaidOldV: f.unpaidOldV || 0, expN: f.expN || 0, expV: f.expV || 0, cancelled30: raw.cancelled30 || 0 };
}

/** "To do today": only things this person can act on. */
export function buildTodo(raw, has) {
  const e = raw.engage || {};
  const todo = [];
  const add = (perm, n, label, page, tone = 'amber') => { if (has(perm) && n > 0) todo.push({ n, label, page, tone }); };
  add('orders.status', raw.pendingOrders || 0, 'orders waiting for a confirmation call', 'orders', 'red');
  add('services.manage', e.services, 'new service requests', 'services');
  add('reviews.moderate', e.reviews, 'reviews waiting for approval', 'reviews');
  add('messages.manage', e.messages, 'messages in the last 2 days', 'inbox', 'blue');
  add('careers.manage', e.apps, 'new job applications', 'careers', 'blue');
  add('team.manage', e.team, 'staff accounts to approve', 'team', 'red');
  add('hub.view', raw.delivery?.returnsPending, 'return requests', 'deliveries', 'red');
  add('field.approve', raw.finance?.expN, 'expense claims to approve', 'dashboard', 'amber');
  return todo;
}
