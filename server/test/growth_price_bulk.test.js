import test from 'node:test';
import assert from 'node:assert/strict';
import { planBulk, planCsv, applyUpdates, productOf, CSV_COLUMNS } from '../src/growth/priceBulk.js';
import { expireSales } from '../src/growth/saleExpiry.js';
import { CREATE_TABLE_SQL, CREATE_TRIGGER_SQL, ensurePriceHistory, priceHistoryHealth, historyOf } from '../src/growth/priceHistory.js';
import { CsvError } from '../src/admin/seoCsv.js';

const mk = (id, o = {}) => productOf({ id, sku: 'SKU' + id, name: 'Toner ' + id, brand: 'HP', category_id: 'toner', price: 1000, old_price: 0, sale_ends: null, stock: 5, stock_status: 'auto', active: 1, ...o });
const catalog = () => new Map([mk(1), mk(2, { sku: 'DUP' }), mk(3, { sku: 'DUP' }), mk(4, { sku: '' }), mk(5, { sku: 'abc-5' })].map(p => [p.id, p]));

test('CSV preview: match by id, by sku (case-insensitive), unknown, duplicate sku, blank cells', () => {
  const csv = ['id,sku,Price,Old_Price,Sale_Ends,Stock,Stock_Status,colour',
    '1,,1100,,,,,red', // id match, price only
    ',ABC-5,,,,9,,', // sku match, stock only
    ',DUP,500,,,,,', // duplicate sku
    '999,,10,,,,,', // unknown id
    ',NOPE,10,,,,,', // unknown sku
    '4,,,,,,,', // matched, nothing to change
    '2,,abc,,,,,'].join('\n'); // bad price
  const r = planCsv(csv, catalog());
  assert.equal(r.rows[0].match, 'id'); assert.deepEqual(r.rows[0].changes, { price: { from: 1000, to: 1100 } });
  assert.equal(r.rows[1].match, 'sku'); assert.equal(r.rows[1].id, 5); assert.deepEqual(r.rows[1].changes, { stock: { from: 5, to: 9 } });
  assert.deepEqual(r.rows[2].errors, ['SKU matches 2 products']); assert.equal(r.rows[2].match, null);
  assert.equal(r.rows[3].match, null); assert.equal(r.rows[3].errors.length, 1);
  assert.equal(r.rows[4].match, null);
  assert.deepEqual(r.rows[5].changes, {}); assert.equal(r.rows[5].errors.length, 0);
  assert.equal(r.rows[6].errors.length, 1);
  assert.deepEqual(r.summary, { total: 7, matched: 4, unmatched: 3, changed: 2, errors: 4, jumps: 0 });
  assert.equal(r.updates.length, 2);
});
test('CSV preview flags jumps, accepts saleEnds/old aliases and thousands separators; rejects bad files', () => {
  const r = planCsv('id,price,old,saleEnds\n1,"2,000",,\n2,1000,1500,2099-01-01', catalog());
  assert.equal(r.rows[0].jump, true); assert.equal(r.summary.jumps, 1); assert.equal(r.jumps[0].pct, 100);
  assert.deepEqual(r.rows[1].changes, { old: { from: 0, to: 1500 }, saleEnds: { from: null, to: '2099-01-01' } });
  assert.throws(() => planCsv('name,price\nx,1', catalog()), CsvError);
  assert.throws(() => planCsv('', catalog()), CsvError);
});
test('CSV: same product twice is an error; export columns', () => {
  const r = planCsv('id,price\n1,1100\n1,1200', catalog());
  assert.deepEqual(r.rows[1].errors, ['This product appears twice in the file']);
  assert.deepEqual(CSV_COLUMNS, ['id', 'sku', 'name', 'price', 'old_price', 'sale_ends', 'stock', 'stock_status']);
});
test('bulk: every change is validated first, one bad change means nothing to write', () => {
  const r = planBulk([{ id: 1, price: 1100 }, { id: 2, price: -5 }, { id: 77, stock: 1 }, { id: 1, stock: 2 }], catalog());
  assert.deepEqual(r.errors.map(e => e.field), ['price', 'id', 'id']);
  const ok = planBulk([{ id: 1, price: 1100 }, { id: 5, stock: 0, stockStatus: 'out_of_stock' }, { id: 4, price: 1000 }], catalog());
  assert.deepEqual(ok.errors, []); assert.equal(ok.updates.length, 2);
  const j = planBulk([{ id: 1, price: 2000 }], catalog());
  assert.deepEqual(j.jumps, [{ id: 1, name: 'Toner 1', from: 1000, to: 2000, pct: 100 }]);
  assert.equal(planBulk([], catalog()).errors.length, 1);
  assert.equal(planBulk(Array.from({ length: 501 }, (_, i) => ({ id: 1, price: i })), catalog()).errors.length, 1);
});
test('applyUpdates runs all statements inside one transaction callback', async () => {
  const sql = [];
  const n = await applyUpdates([{ id: 1, value: { price: 5 } }, { id: 2, value: { stock: 3, saleEnds: null } }], async fn => fn({ query: async (s, p) => { sql.push([s, p]); } }));
  assert.equal(n, 2);
  assert.deepEqual(sql[0], ['UPDATE products SET price = ?, edited = 1 WHERE id = ?', [5, 1]]);
  assert.deepEqual(sql[1], ['UPDATE products SET sale_ends = ?, stock = ?, edited = 1 WHERE id = ?', [null, 3, 2]]);
  assert.equal(await applyUpdates([], async () => assert.fail('no transaction for nothing')), 0);
});
test('expireSales: only past dates, today kept, hook gets the ids, Dhaka date', async () => {
  const calls = [], noted = [];
  const rows = [{ id: 1, d: '2026-11-19' }, { id: 2, d: '2026-11-20' }, { id: 3, d: '2026-11-21' }];
  const query = async (sql, [today]) => { calls.push(sql); return /^SELECT/.test(sql) ? rows.filter(r => r.d < today).map(r => ({ id: r.id })) : { affectedRows: 1 }; };
  const now = Date.parse('2026-11-20T10:00:00+06:00');
  assert.deepEqual(await expireSales({ now, query, note: x => noted.push(x) }), [1]);
  assert.match(calls[1], /^UPDATE products SET old_price = 0, sale_ends = NULL WHERE sale_ends IS NOT NULL AND sale_ends < \?$/);
  assert.deepEqual(noted, [{ productIds: [1], reason: 'sale_expired' }]);
  noted.length = 0; // 00:30 in Dhaka is still the previous day in UTC: today must be the Dhaka date
  assert.deepEqual(await expireSales({ now: Date.parse('2026-11-20T00:30:00+06:00'), query, note: x => noted.push(x) }), [1]);
  noted.length = 0;
  assert.deepEqual(await expireSales({ now, query: async () => [], note: x => noted.push(x) }), []);
  assert.equal(noted.length, 0);
});
test('trigger SQL: only price, old price and sale end changes (NULL-safe), never stock', () => {
  assert.match(CREATE_TRIGGER_SQL, /CREATE TRIGGER trg_products_price_history AFTER UPDATE ON products FOR EACH ROW/);
  for (const c of ['price', 'old_price', 'sale_ends']) assert.match(CREATE_TRIGGER_SQL, new RegExp(`NOT \\(OLD\\.${c} <=> NEW\\.${c}\\)`));
  assert.doesNotMatch(CREATE_TRIGGER_SQL, /stock/);
  assert.match(CREATE_TABLE_SQL, /CREATE TABLE IF NOT EXISTS product_price_history/);
  assert.match(CREATE_TABLE_SQL, /KEY idx_pph_product \(product_id, at\)/);
});
test('ensurePriceHistory: creates a missing trigger, skips an existing one, reports failure without throwing', async () => {
  const log = [];
  const db = exists => ({ query: async s => { log.push(s.slice(0, 14)); return [/information_schema/.test(s) ? (exists ? [{ x: 1 }] : []) : {}]; } });
  assert.deepEqual(await ensurePriceHistory(db(false)), { trigger: true, error: '' });
  assert.ok(log.some(s => s.startsWith('CREATE TRIGGER')));
  log.length = 0; await ensurePriceHistory(db(true));
  assert.ok(!log.some(s => s.startsWith('CREATE TRIGGER')));
  const warn = console.warn; console.warn = () => {};
  try {
    const h = await ensurePriceHistory({ query: async () => { throw new Error('TRIGGER command denied'); } });
    assert.equal(h.trigger, false); assert.match(h.error, /denied/); assert.equal(priceHistoryHealth().trigger, false);
  } finally { console.warn = warn; }
});
test('historyOf attaches the staff name from a nearby audit row, else null', async () => {
  const at = new Date('2026-11-20T10:00:00Z');
  const row = (id, t) => ({ id, at: t, price_old: 1, price_new: 2, old_old: 0, old_new: 0, sale_ends_old: null, sale_ends_new: null });
  const db = { query: async s => [/product_price_history/.test(s) ? [row(1, at), row(2, new Date(at - 3600e3))] : [{ at: new Date(at - 2000), staff_name: 'Rahim' }]] };
  const rows = await historyOf(7, 50, db);
  assert.equal(rows[0].by, 'Rahim'); assert.equal(rows[1].by, null); assert.equal(rows[0].priceNew, 2);
});
