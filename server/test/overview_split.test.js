import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, clamp, isDay, pct, periodDays, sum } from '../src/overview/dates.js';
import { buildForecast, dailySeries } from '../src/overview/forecast.js';
import { buildTodo, stockSection } from '../src/overview/sections.js';
import { analyse, collect, RANGES } from '../src/overview.js';

test('date helpers', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(pct(150, 100), 50);
  assert.equal(pct(1, 0), null);
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(sum([{ a: 1 }, { a: 2 }], x => x.a), 3);
  assert.ok(isDay('2026-10-21'));
  assert.ok(!isDay('21/10/2026'));
  assert.equal(periodDays(7), 7);
  assert.equal(periodDays(8), 30);
  assert.equal(RANGES[1], 'day');
});

test('dailySeries zero-fills and ends on the reference day', () => {
  const s = dailySeries({ ref: '2026-10-21', days: [{ d: '2026-10-21', n: 2, v: '500' }] }, 5);
  assert.equal(s.length, 5);
  assert.equal(s[4].d, '2026-10-21');
  assert.equal(s[4].v, 500);
  assert.equal(s[0].n, 0);
});

test('buildForecast with no orders is a flat low-confidence zero', () => {
  const f = buildForecast({ ref: '2026-10-21', range: 30, days: [] });
  assert.equal(f.confidence, 'low');
  assert.equal(f.fcTotal, 0);
  assert.equal(f.forecast.length, 7);
  assert.equal(f.trend, 1);
});

test('stockSection ranks risk by days of cover', () => {
  const s = stockSection({ stock: { rows: [{ id: 1, name: 'a', stock: 0, sold30: 3 }, { id: 2, name: 'b', stock: 100, sold30: 3 }, { id: 3, name: 'c', stock: 5, sold30: 30 }] } });
  assert.deepEqual(s.risk.map(r => r.id), [1, 3]);
});

test('buildTodo only lists what the person may act on', () => {
  const raw = { pendingOrders: 2, engage: { reviews: 4, services: 1 }, delivery: { returnsPending: 0 } };
  const t = buildTodo(raw, p => p === 'orders.status' || p === 'reviews.moderate');
  assert.deepEqual(t.map(x => x.page), ['orders', 'reviews']);
});

test('analyse still exposes the original sections', () => {
  const out = analyse({ ref: '2026-10-21', days: [] }, () => true);
  assert.deepEqual(out.sections, ['sales', 'stock', 'customers', 'delivery', 'finance']);
  assert.equal(typeof collect, 'function');
});
