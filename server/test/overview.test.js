import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse } from '../src/overview.js';

const ALL = () => true;
const NONE = () => false;
const only = (...p) => x => p.includes(x);
const REF = '2026-10-21'; // a Wednesday

/** n days of orders, ending at REF: every day gets `perDay` orders worth `value` each (weekend days get none when skipWeekend). */
function days(n, perDay, value, { skipFri = false } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 9, 21) - i * 864e5);
    if (skipFri && d.getUTCDay() === 5) continue;
    out.push({ d: d.toISOString().slice(0, 10), n: perDay, v: perDay * value });
  }
  return out;
}
const raw = (extra = {}) => ({ ref: REF, days: days(60, 3, 1000), status: { Delivered: 5 }, top: [], pay: [], cancelled30: 0, pendingOrders: 0, pendingOldOrders: 0, engage: {}, ...extra });

test('steady sales give a steady forecast with seven future days after the reference day', () => {
  const a = analyse(raw(), ALL);
  assert.equal(a.sales.forecast.length, 7);
  assert.equal(a.sales.forecast[0].d, '2026-10-22');
  assert.equal(a.sales.forecast[6].d, '2026-10-28');
  assert.equal(a.sales.series.length, 60);
  assert.equal(a.sales.series[59].d, REF);
  for (const f of a.sales.forecast) { assert.equal(f.v, 3000); assert.ok(f.lo < f.v && f.hi > f.v); }
  assert.equal(a.sales.kpis.rev30, 90000);
  assert.equal(a.sales.kpis.revDelta, 0);
  assert.equal(a.sales.confidence, 'good');
});

test('a falling trend lowers the forecast and raises a warning; a day with no sales stays near zero', () => {
  const falling = [...days(14, 1, 1000), ...days(60, 3, 1000).slice(14)];
  const a = analyse(raw({ days: falling }), ALL);
  assert.ok(a.sales.trend < 0.95, 'trend ' + a.sales.trend);
  assert.ok(a.insights.some(i => i.tone === 'warn' && /Revenue is down|Next 7 days/.test(i.title)));
  const noFri = analyse(raw({ days: days(60, 3, 1000, { skipFri: true }) }), ALL);
  assert.equal(noFri.sales.forecast.find(f => f.wd === 5).v, 0);
  assert.match(noFri.insights.map(i => i.title).join('|'), /weakest/);
});

test('no orders at all: no invented forecast, a clear warning instead', () => {
  const a = analyse(raw({ days: [] }), ALL);
  assert.equal(a.sales.fcTotal, 0);
  assert.equal(a.sales.confidence, 'low');
  assert.ok(a.insights.some(i => /No orders in the last 8 weeks/.test(i.title)));
});

test('stock cover: products that run out within two weeks are named', () => {
  const stock = { rows: [{ id: 1, name: 'Toner A', img: '', stock: 6, sold30: 60 }, { id: 2, name: 'Toner B', img: '', stock: 500, sold30: 30 }, { id: 3, name: 'Gone', img: '', stock: 0, sold30: 10 }], out: 1, low: 1, noImg: 4, quote: 0, live: 100, value: 1 };
  const a = analyse(raw({ stock }), ALL);
  assert.equal(a.stock.risk.find(r => r.id === 1).days, 3);
  assert.ok(a.stock.risk.some(r => r.id === 3));
  assert.ok(!a.stock.risk.some(r => r.id === 2));
  const t = a.insights.map(i => i.title).join('|');
  assert.match(t, /will run out within 2 weeks/);
  assert.match(t, /out of stock/);
  assert.match(t, /no photo|have no photo/);
});

test('every person only gets what their role may see', () => {
  const rider = analyse(raw({ stock: { rows: [] }, cust: {}, delivery: {}, finance: {} }), NONE);
  assert.deepEqual(rider.sections, []);
  assert.equal(rider.sales, undefined);
  assert.equal(rider.insights.length, 0);
  const buyer = analyse(raw({ stock: { rows: [{ id: 1, name: 'X', stock: 1, sold30: 90 }], out: 0, low: 1, noImg: 0 }, finance: { unpaidOldN: 2, unpaidOldV: 5000 } }), only('products.view', 'products.manage'));
  assert.deepEqual(buyer.sections, ['stock']);
  assert.equal(buyer.sales, undefined);
  assert.ok(buyer.insights.every(i => !/unpaid|Revenue|Next 7 days/.test(i.title)));
  const acct = analyse(raw({ finance: { unpaidN: 3, unpaidV: 9000, unpaidOldN: 2, unpaidOldV: 5000, expN: 4, expV: 1200 } }), only('dashboard.view', 'orders.view', 'customers.view', 'products.view', 'hub.cash', 'field.approve'));
  assert.ok(acct.insights.some(i => /unpaid for more than 7 days/.test(i.title)));
  assert.ok(acct.insights.some(i => /expense claim/.test(i.title)));
  assert.ok(acct.sections.includes('finance') && acct.sections.includes('stock'));
  assert.equal(analyse(raw({ finance: { unpaidN: 1 } }), only('dashboard.view', 'orders.view')).finance, undefined);
});

test('to-do list only has actions the person can take, and guide lines are capped and ordered warnings first', () => {
  const r = raw({ pendingOrders: 4, engage: { services: 2, reviews: 3, messages: 1, apps: 0, team: 1 } });
  const rm = analyse(r, only('dashboard.view', 'orders.view', 'services.manage', 'reviews.moderate'));
  assert.deepEqual(rm.todo.map(t => t.page).sort(), ['reviews', 'services']);
  const boss = analyse(r, ALL);
  assert.ok(boss.todo.some(t => t.page === 'orders') && boss.todo.some(t => t.page === 'team'));
  assert.ok(boss.insights.length <= 8);
  const tones = boss.insights.map(i => i.tone);
  assert.deepEqual(tones, [...tones].sort((a, b) => ({ warn: 0, tip: 1, good: 2 }[a] - { warn: 0, tip: 1, good: 2 }[b])));
});

test('a buying role leads with stock and never sees payments to chase', () => {
  const purchase = only('dashboard.view', 'orders.view', 'products.view', 'inventory.manage', 'media.upload');
  const a = analyse(raw({ stock: { rows: [{ id: 1, name: 'Toner', stock: 4, sold30: 60 }], out: 1, low: 2, noImg: 3 }, finance: { unpaidN: 9, unpaidV: 9000, unpaidOldN: 4, unpaidOldV: 4000, expN: 2, expV: 500 }, pendingOldOrders: 3 }), purchase);
  assert.equal(a.focus, 'stock');
  assert.equal(a.finance, undefined);
  assert.ok(a.stock.risk.length > 0);
  assert.ok(a.insights.every(i => !/unpaid|pending after 24 hours|expense/.test(i.title)));
  assert.equal(analyse(raw(), ALL).focus, 'sales');
  assert.equal(analyse(raw(), only('dashboard.view', 'orders.view', 'customers.view')).focus, 'sales');
});

test('the chosen period drives the totals and is compared with the period just before it', () => {
  const d = [...days(14, 1, 1000), ...days(60, 3, 1000).slice(14)];
  const week = analyse(raw({ days: d, range: 7 }), ALL).sales;
  assert.equal(week.range, 7);
  assert.equal(week.kpis.rev30, 7000);
  assert.equal(week.kpis.revPrev30, 7000);
  const year = analyse(raw({ days: days(60, 3, 1000), range: 365 }), ALL).sales;
  assert.equal(year.series.length, 365);
  assert.equal(year.kpis.rev30, 180000);
  assert.equal(year.kpis.revDelta, null);
  const day = analyse(raw({ range: 1 }), ALL).sales;
  assert.equal(day.kpis.rev30, 3000);
  assert.equal(day.kpis.revPrev30, 3000);
  assert.equal(analyse(raw({ range: 999 }), ALL).sales.range, 30);
});

test('lowest sellers are passed through next to the top sellers', () => {
  const low = [{ id: 1, name: 'Dusty drum', stock: 40, q: 0, v: 0 }];
  assert.deepEqual(analyse(raw({ low }), ALL).sales.low, low);
  assert.deepEqual(analyse(raw(), ALL).sales.low, []);
});
