import test from 'node:test';
import assert from 'node:assert/strict';
import { CODES, checkSchema, checkFeed, checkSaleExpired, checkOldBelowPrice, checkZeroPrice, checkSku, checkStale, dhakaToday, runCheck, offerOf } from '../src/growth/priceCheck.js';

const P = (o = {}) => ({ id: 1, name: 'Toner', sku: 'T1', price: 1000, old_price: 0, stock: 5, stock_status: 'auto', active: 1, sale_ends: null, updated_at: new Date('2026-11-01'), ...o });
const ld = (price, availability) => [{ '@type': 'Product', offers: { '@type': 'Offer', price: String(price), availability } }];
const codes = a => a.map(x => x.code);
const IN = 'https://schema.org/InStock', OUT = 'https://schema.org/OutOfStock';

test('every code has label, hint, severity', () => {
  for (const c of Object.values(CODES)) { assert.ok(c.label && c.hint); assert.ok(['high', 'medium', 'low'].includes(c.severity)); }
});
test('schema price must equal products.price, sale or not', () => {
  assert.deepEqual(checkSchema(P(), ld(1000, IN)), []);
  assert.deepEqual(codes(checkSchema(P(), ld(900, IN))), ['schema_price_mismatch']);
  assert.deepEqual(checkSchema(P({ price: 900, old_price: 1000 }), ld('900', IN)), []);
  assert.deepEqual(codes(checkSchema(P({ price: 900, old_price: 1000 }), ld(1000, IN))), ['schema_price_mismatch']);
  assert.deepEqual(codes(checkSchema(P(), [])), ['schema_price_mismatch']);
  assert.deepEqual(checkSchema(P({ price: 0 }), []), []); // no Offer expected
});
test('schema availability mapping', () => {
  assert.deepEqual(codes(checkSchema(P({ stock: 0 }), ld(1000, IN))), ['schema_availability_mismatch']);
  assert.deepEqual(checkSchema(P({ stock: 0 }), ld(1000, OUT)), []);
  assert.deepEqual(checkSchema(P({ stock: 0, stock_status: 'in_stock' }), ld(1000, IN)), []);
  assert.deepEqual(checkSchema(P({ stock_status: 'preorder' }), ld(1000, 'http://schema.org/PreOrder')), []);
  assert.deepEqual(codes(checkSchema(P({ stock_status: 'out_of_stock' }), ld(1000, IN))), ['schema_availability_mismatch']);
});
test('offerOf handles array offers', () => { assert.equal(offerOf([{ '@type': 'Product', offers: [{ price: '1' }] }]).price, '1'); assert.equal(offerOf([]), null); });
test('feed price and availability; skipped lines are not mismatches', () => {
  assert.deepEqual(checkFeed(P(), { price: '1000.00 BDT', availability: 'in stock' }), []);
  assert.deepEqual(codes(checkFeed(P(), { price: '1100.00 BDT', availability: 'in stock' })), ['feed_price_mismatch']);
  assert.deepEqual(checkFeed(P({ price: 900, old_price: 1000 }), { price: '1000.00 BDT', sale_price: '900.00 BDT', availability: 'in stock' }), []);
  assert.deepEqual(codes(checkFeed(P({ price: 900, old_price: 1000 }), { price: '900.00 BDT', availability: 'in stock' })), ['feed_price_mismatch']);
  assert.deepEqual(codes(checkFeed(P(), { price: '1000.00 BDT', sale_price: '800.00 BDT', availability: 'in stock' })), ['feed_price_mismatch']);
  assert.deepEqual(codes(checkFeed(P({ stock: 0 }), { price: '1000.00 BDT', availability: 'in stock' })), ['feed_availability_mismatch']);
  assert.deepEqual(checkFeed(P(), { skip: 'no image' }), []);
  assert.deepEqual(checkFeed(P(), null), []);
});
test('sale expiry uses the Dhaka date; ending today is not expired', () => {
  const p = P({ price: 900, old_price: 1000, sale_ends: '2026-11-20' });
  assert.deepEqual(checkSaleExpired(p, '2026-11-20'), []);
  assert.deepEqual(codes(checkSaleExpired(p, '2026-11-21')), ['sale_expired_not_cleared']);
  assert.deepEqual(checkSaleExpired(P({ sale_ends: '2026-01-01' }), '2026-11-21'), []); // no old price: nothing to clear
  assert.deepEqual(checkSaleExpired(P({ price: 900, old_price: 1000 }), '2026-11-21'), []); // no end date
  // 18:30 UTC on the 20th is already the 21st in Dhaka
  assert.equal(dhakaToday(new Date('2026-11-20T18:30:00Z')), '2026-11-21');
  assert.equal(dhakaToday(new Date('2026-11-20T17:59:00Z')), '2026-11-20');
});
test('old below price, zero price, sku', () => {
  assert.deepEqual(codes(checkOldBelowPrice(P({ old_price: 500 }))), ['old_below_price']);
  assert.deepEqual(checkOldBelowPrice(P({ old_price: 0 })), []);
  assert.deepEqual(checkOldBelowPrice(P({ old_price: 1000 })), []);
  assert.deepEqual(codes(checkZeroPrice(P({ price: 0 }))), ['zero_price_active']);
  assert.deepEqual(checkZeroPrice(P({ price: 0, active: 0 })), []);
  assert.deepEqual(codes(checkSku(P({ sku: '  ' }))), ['no_sku']);
  assert.deepEqual(checkSku(P()), []);
});
test('stale price: 180 days, unknown date skipped', () => {
  const now = new Date('2026-11-20T00:00:00Z');
  assert.deepEqual(checkStale(P(), new Date('2026-05-24T00:00:00Z'), now), []); // exactly 180 days
  assert.deepEqual(codes(checkStale(P(), new Date('2026-05-23T00:00:00Z'), now)), ['stale_price']);
  assert.deepEqual(checkStale(P(), null, now), []);
  assert.deepEqual(checkStale(P(), 'garbage', now), []);
});

function stub(products) {
  const log = [], issues = new Map();
  const query = async (sql, p = []) => {
    log.push(sql.slice(0, 40));
    if (sql.startsWith('SELECT * FROM products')) return products.filter(x => x.active && x.id > p[0]).slice(0, p[1]);
    if (sql.startsWith('DELETE FROM growth_price_issues WHERE product_id')) { for (const id of p[0]) for (const k of [...issues.keys()]) if (k.startsWith(id + ':')) issues.delete(k); return {}; }
    if (sql.startsWith('INSERT IGNORE INTO growth_price_issues')) { for (const [id, code, d] of p[0]) issues.set(id + ':' + code, d); return {}; }
    if (sql.startsWith('DELETE i FROM')) return {};
    if (sql.startsWith('INSERT INTO growth_price_runs')) { log.run = p; return {}; }
    throw new Error('stub: ' + sql);
  };
  return { query, log, issues };
}
test('runCheck replaces the issues of a batch and records a run', async () => {
  const products = [P({ id: 1, sku: '' }), P({ id: 2 }), P({ id: 3, price: 0 })];
  const s = stub(products);
  s.issues.set('2:no_sku', 'old'); // fixed since the last run: must disappear
  const r = await runCheck({ query: s.query, history: '', now: new Date('2026-11-20'), preview: async () => ({ status: 200, ld: ld(1000, IN) }), feedLine: () => ({ skip: 'x' }) });
  assert.equal(r.checked, 3);
  assert.equal(r.byCode.no_sku, 1); assert.equal(r.byCode.zero_price_active, 1);
  assert.ok(s.issues.has('1:no_sku') && s.issues.has('3:zero_price_active') && !s.issues.has('2:no_sku'));
  assert.deepEqual(s.log.run.slice(0, 2), [3, r.issues]);
});
test('a failing preview or feed line does not stop the run', async () => {
  const s = stub([P({ id: 1 }), P({ id: 2 })]);
  const r = await runCheck({ query: s.query, history: '', preview: async () => { throw new Error('boom'); }, feedLine: () => { throw new Error('x'); } });
  assert.equal(r.checked, 2);
});
test('redirected pages are skipped; mismatches are found', async () => {
  const s = stub([P({ id: 1 }), P({ id: 2 })]);
  const r = await runCheck({ query: s.query, history: '', preview: async path => (/1$/.test(path) ? { status: 301, redirect: '/x', ld: [] } : { status: 200, ld: ld(5, IN) }), feedLine: () => null });
  assert.deepEqual(r.byCode, { schema_price_mismatch: 1 });
});
test('5,000 products in batches of 200 yield to the event loop and honour the cap', async () => {
  const products = Array.from({ length: 5200 }, (_, i) => P({ id: i + 1, updated_at: new Date() }));
  const s = stub(products); let yields = 0;
  const r = await runCheck({ query: s.query, history: '', preview: async () => ({ status: 200, ld: ld(1000, IN) }), feedLine: () => null, yieldFn: async () => { yields++; await new Promise(r => setImmediate(r)); } });
  assert.equal(r.checked, 5000); assert.equal(yields, 25); assert.equal(r.issues, 0);
  assert.equal(s.log.filter(l => l.startsWith('SELECT * FROM products')).length, 25);
});
