import test from 'node:test';
import assert from 'node:assert/strict';
import { runMerchantSync, refreshMerchantStatus, diffItems, MAX_PER_RUN } from '../src/growth/merchantSync.js';
import { itemHash } from '../src/growth/merchantMap.js';

const S = { syncEnabled: true, accountId: '123', dataSourceId: '456', contentLanguage: 'en', feedLabel: 'BD' };
const mk = n => ({ pid: n, id: 'SKU' + n, title: 'T' + n, price: '10.00 BDT', availability: 'in stock' });
const OK = { ok: true, status: 200, data: {}, error: '' };

function rig({ items = [], states = [], settings = S, google = { connected: true, merchantScope: true }, insert, del, list } = {}) {
  const db = new Map(states.map(s => [s.product_id, { ...s }])), calls = { insert: [], del: [], integ: [] };
  const deps = {
    settings: async () => settings, googleState: async () => google, loadItems: async () => items,
    setIntegration: async (k, p) => { calls.integ.push([k, p]); },
    query: async (sql, p) => {
      if (sql.startsWith('SELECT')) return [...db.values()];
      if (sql.startsWith('UPDATE merchant_sync_state SET hash')) { for (const s of db.values()) s.hash = ''; return {}; }
      if (sql.startsWith('INSERT')) { const [pid, offer, hash, status, error] = p; db.set(pid, { product_id: pid, offer_id: offer, hash, status, error }); return {}; }
      if (sql.startsWith('UPDATE merchant_sync_state SET issues')) { for (const s of db.values()) if (s.offer_id === p[1]) s.issues = p[0]; return {}; }
      throw new Error('unexpected ' + sql);
    },
    api: { insertProductInput: async (a, d, b) => { calls.insert.push({ a, d, b }); return insert ? insert(b, calls.insert.length) : OK; }, deleteProductInput: async (a, d, n) => { calls.del.push({ a, d, n }); return del ? del(n) : OK; }, listProducts: async (a, t) => (list ? list(t) : OK) }
  };
  return { deps, db, calls };
}

test('diff: new, changed, unchanged, removed', () => {
  const a = mk(1), b = mk(2), c = mk(3), changed = { ...b, price: '11.00 BDT' };
  const states = [{ product_id: 1, offer_id: 'SKU1', hash: itemHash(a), status: 'Synced' }, { product_id: 2, offer_id: 'SKU2', hash: itemHash(b), status: 'Synced' }, { product_id: 9, offer_id: 'SKU9', hash: 'h', status: 'Synced' }, { product_id: 8, offer_id: 'SKU8', hash: '', status: 'Deleted' }];
  const d = diffItems([a, changed, c], states);
  assert.deepEqual(d.toSend.map(t => t.pid), [2, 3]); assert.equal(d.unchanged, 1);
  assert.deepEqual(d.remove.map(r => r.pid), [9]);
  assert.equal(diffItems([a], states, true).toSend.length, 1);
});
test('sync sends new, skips unchanged, deletes removed, records states', async () => {
  const a = mk(1), b = mk(2);
  const { deps, db, calls } = rig({ items: [a, b], states: [{ product_id: 1, offer_id: 'SKU1', hash: itemHash(a), status: 'Synced' }, { product_id: 7, offer_id: 'OLD', hash: 'x', status: 'Synced' }] });
  const r = await runMerchantSync({ deps });
  assert.deepEqual([r.synced, r.deleted, r.unchanged, r.errors], [1, 1, 1, 0]);
  assert.equal(calls.insert.length, 1); assert.equal(calls.insert[0].b.offerId, 'SKU2'); assert.equal(calls.insert[0].d, '456');
  assert.equal(calls.del[0].n, 'accounts/123/productInputs/en~BD~OLD');
  assert.equal(db.get(2).status, 'Synced'); assert.equal(db.get(2).hash, itemHash(b)); assert.equal(db.get(7).status, 'Deleted');
  assert.equal(calls.integ.at(-1)[1].status, 'connected');
});
test('a refused product is recorded as Error and retried next run', async () => {
  const { deps, db } = rig({ items: [mk(1)], insert: () => ({ ok: false, status: 400, data: null, error: 'Bad price' }) });
  const r = await runMerchantSync({ deps });
  assert.equal(r.errors, 1); assert.equal(db.get(1).status, 'Error'); assert.equal(db.get(1).error, 'Bad price');
  assert.equal(diffItems([mk(1)], [...db.values()]).toSend.length, 1);
});
test('full run clears hashes and resends everything', async () => {
  const a = mk(1);
  const { deps, calls } = rig({ items: [a], states: [{ product_id: 1, offer_id: 'SKU1', hash: itemHash(a), status: 'Synced' }] });
  assert.equal((await runMerchantSync({ deps })).synced, 0);
  assert.equal((await runMerchantSync({ full: true, deps })).synced, 1);
  assert.equal(calls.insert.length, 1);
});
test('403 stops early and marks Reconnect Google', async () => {
  const { deps, calls } = rig({ items: [mk(1), mk(2), mk(3)], insert: () => ({ ok: false, status: 403, data: null, error: 'denied' }) });
  const r = await runMerchantSync({ deps });
  assert.equal(r.stopped, 'Reconnect Google'); assert.equal(calls.insert.length, 1);
  assert.deepEqual(calls.integ.at(-1), ['merchant', { status: 'error', last_error: 'Reconnect Google' }]);
});
test('quota 429 is thrown so the job retries', async () => {
  const { deps } = rig({ items: [mk(1)], insert: () => ({ ok: false, status: 429, data: null, error: 'quota' }) });
  await assert.rejects(runMerchantSync({ deps }), /quota/i);
});
test('at most 200 calls per run, the rest stays pending', async () => {
  const items = Array.from({ length: 250 }, (_, i) => mk(i + 1));
  const { deps, calls } = rig({ items });
  const r = await runMerchantSync({ deps });
  assert.equal(MAX_PER_RUN, 200); assert.equal(calls.insert.length, 200); assert.equal(r.pending, 50);
  const r2 = await runMerchantSync({ deps });
  assert.equal(r2.synced, 50); assert.equal(r2.pending, 0);
});
test('skipped when disabled, incomplete or not connected', async () => {
  for (const [o, re] of [[{ settings: { ...S, syncEnabled: false } }, /off/], [{ settings: { ...S, accountId: '' } }, /missing/], [{ google: { connected: false } }, /not connected/], [{ google: { connected: true, merchantScope: false } }, /again/]]) {
    const { deps, calls } = rig({ items: [mk(1)], ...o });
    const r = await runMerchantSync({ deps });
    assert.equal(r.skipped, true); assert.match(r.reason, re); assert.equal(calls.insert.length, 0);
    assert.equal((await refreshMerchantStatus({ deps })).skipped, true);
  }
});
test('status refresh stores issues per offer id and follows pages (max 10)', async () => {
  let n = 0;
  const { deps, db } = rig({ states: [{ product_id: 1, offer_id: 'SKU1', hash: 'h', status: 'Synced' }], list: () => { n++; return { ok: true, status: 200, data: { products: n === 1 ? [{ offerId: 'SKU1', productStatus: { itemLevelIssues: [{ code: 'x', severity: 'ERROR', description: 'bad' }], destinationStatuses: [] } }] : [], nextPageToken: 'more' } }; } });
  const r = await refreshMerchantStatus({ deps });
  assert.equal(r.pages, 10); assert.equal(r.withIssues, 1);
  assert.match(db.get(1).issues, /"code":"x"/);
});
test('the job handler module loads', async () => { await import('../src/growth/registerMerchant.js'); });
