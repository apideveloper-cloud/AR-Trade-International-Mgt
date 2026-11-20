import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotPrices, priceHistoryHealth } from '../src/growth/priceHistory.js';

// a tiny stand-in for the pool: products, snapshot and history held in arrays
function fakeDb(products, snap = []) {
  const history = [], snapshot = new Map(snap.map(s => [s.product_id, s]));
  return {
    history, snapshot,
    async query(sql, args = []) {
      if (/CREATE TABLE/i.test(sql)) return [[]];
      if (/COUNT\(\*\) n FROM product_price_snapshot/.test(sql)) return [[{ n: snapshot.size }]];
      if (/FROM products p LEFT JOIN/.test(sql)) return [products.map(p => { const s = snapshot.get(p.id); return { ...p, seen: s ? s.product_id : null, s_price: s?.price, s_old: s?.old_price, s_ends: s?.sale_ends ?? null }; })];
      if (/INSERT INTO product_price_history/.test(sql)) { history.push(args); return [{}]; }
      if (/INSERT INTO product_price_snapshot/.test(sql)) { snapshot.set(args[0], { product_id: args[0], price: args[1], old_price: args[2], sale_ends: args[3] }); return [{}]; }
      throw new Error('unexpected sql ' + sql);
    }
  };
}

test('price snapshot: first run only seeds, later changes write history', async () => {
  assert.notEqual(priceHistoryHealth().trigger, true);
  const products = [{ id: 1, price: 100, old_price: 0, sale_ends: null }, { id: 2, price: 50, old_price: 60, sale_ends: null }];
  const db = fakeDb(products);
  const first = await snapshotPrices(db);
  assert.equal(first.changes, 0); assert.equal(first.seeded, 2); assert.equal(db.history.length, 0); assert.equal(db.snapshot.size, 2);
  products[0].price = 120; products[1].old_price = 0;
  const second = await snapshotPrices(db);
  assert.equal(second.changes, 2); assert.equal(db.history.length, 2);
  assert.deepEqual(db.history[0].slice(0, 5), [1, 100, 120, 0, 0]);
  assert.deepEqual(db.history[1].slice(0, 5), [2, 50, 50, 60, 0]);
  assert.equal((await snapshotPrices(db)).changes, 0); // nothing changed since
});

test('price snapshot: a new product is seeded without a history row', async () => {
  const products = [{ id: 1, price: 100, old_price: 0, sale_ends: null }];
  const db = fakeDb(products);
  await snapshotPrices(db);
  products.push({ id: 9, price: 10, old_price: 0, sale_ends: null });
  const r = await snapshotPrices(db);
  assert.equal(r.changes, 0); assert.equal(db.history.length, 0); assert.equal(db.snapshot.size, 2);
});
