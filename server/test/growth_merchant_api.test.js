import test from 'node:test';
import assert from 'node:assert/strict';
import { setFetch, setSleep } from '../src/growth/http.js';
import { setSecret } from '../src/growth/vault.js';
import * as google from '../src/growth/google.js';
import * as api from '../src/growth/merchantApi.js';
import { validateProductChanges, planSettings } from '../src/admin/growthMerchant.js';
import { DEFAULTS } from '../src/growth/merchant.js';
import { fakeDb, res, scriptedFetch } from './growth_fake.js';

setSleep(async () => {});
test.after(() => { setFetch(null); setSleep(null); });
async function init(answers) {
  const db = fakeDb(); google.clearTokenCache(); const f = scriptedFetch(answers); setFetch(f);
  await setSecret('google.clientId', 'cid'); await setSecret('google.clientSecret', 'SECRET-X'); await setSecret('google.refreshToken', 'RT-secret-token');
  return { db, f };
}
const token = res(200, { access_token: 'AT-secret', expires_in: 3600 });

test('insert posts the body to productInputs:insert with the data source', async () => {
  const { f } = await init([token, res(200, { name: 'n' })]);
  const r = await api.insertProductInput('123', '456', { offerId: 'A' });
  assert.equal(r.ok, true);
  const c = f.calls[1];
  assert.equal(c.method, 'POST'); assert.equal(c.headers.Authorization, 'Bearer AT-secret');
  assert.equal(c.url, 'https://merchantapi.googleapis.com/products/v1/accounts/123/productInputs:insert?dataSource=accounts%2F123%2FdataSources%2F456');
  assert.deepEqual(JSON.parse(c.body), { offerId: 'A' });
});
test('delete, list, account and register URLs and methods', async () => {
  const { f } = await init([token, res(204, null), res(200, { products: [] }), res(200, { accountName: 'AR' }), res(200, {})]);
  await api.deleteProductInput('123', '456', api.productInputName('123', 'en', 'BD', 'SKU 1'));
  await api.listProducts('123', 'PT'); await api.getAccount('123'); await api.registerGcp('123', 'a@b.co');
  const [, d, l, g, rg] = f.calls;
  assert.equal(d.method, 'DELETE'); assert.equal(d.url, 'https://merchantapi.googleapis.com/products/v1/accounts/123/productInputs/en~BD~SKU%201?dataSource=accounts%2F123%2FdataSources%2F456');
  assert.equal(l.url, 'https://merchantapi.googleapis.com/products/v1/accounts/123/products?pageSize=250&pageToken=PT');
  assert.equal(g.url, 'https://merchantapi.googleapis.com/accounts/v1/accounts/123'); assert.equal(g.method, 'GET');
  assert.equal(rg.url, 'https://merchantapi.googleapis.com/accounts/v1/accounts/123/developerRegistration:registerGcp'); assert.deepEqual(JSON.parse(rg.body), { developerEmail: 'a@b.co' });
});
test('errors never throw and no secret reaches the call log', async () => {
  const { db } = await init([token, res(403, { error: { message: 'Forbidden' } })]);
  const r = await api.getAccount('123');
  assert.deepEqual([r.ok, r.status, r.error], [false, 403, 'Forbidden']);
  const log = JSON.stringify(db.logs);
  assert.equal(db.logs.at(-1).integration, 'merchant');
  for (const s of ['AT-secret', 'RT-secret-token', 'SECRET-X']) assert.equal(log.includes(s), false);
});
test('Google not connected gives a plain error, not an exception', async () => {
  fakeDb(); google.clearTokenCache(); setFetch(scriptedFetch([]));
  const r = await api.getAccount('1'); assert.equal(r.ok, false); assert.match(r.error, /not connected/i);
});
test('granted scopes are stored at code exchange and read back', async () => {
  await init([res(200, { access_token: 'a', refresh_token: 'R', expires_in: 3600, scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/content' })]);
  const r = await google.exchangeCode('C', 'https://x.test/cb');
  assert.equal(r.scopes.length, 2);
  assert.equal((await google.grantedScopes()).includes(google.MERCHANT_SCOPE), true);
  await init([res(200, { access_token: 'a', refresh_token: 'R', expires_in: 3600, scope: 'https://www.googleapis.com/auth/webmasters' })]);
  await google.exchangeCode('C', 'https://x.test/cb');
  assert.equal(await google.hasScope(google.MERCHANT_SCOPE), false);
});

test('product change validation', () => {
  assert.equal(validateProductChanges([]).ok, false);
  assert.equal(validateProductChanges(Array.from({ length: 201 }, (_, i) => ({ id: i + 1 }))).ok, false);
  assert.equal(validateProductChanges([{ id: 0 }]).ok, false);
  assert.equal(validateProductChanges([{ id: 1, itemGroupId: 'x'.repeat(51) }]).ok, false);
  assert.equal(validateProductChanges([{ id: 1, googleCategory: 'x'.repeat(251) }]).ok, false);
  assert.deepEqual(validateProductChanges([{ id: 1, excluded: true, itemGroupId: ' g1 ', googleCategory: '306' }]).changes, [{ id: 1, excluded: true, itemGroupId: 'g1', googleCategory: '306' }]);
});
test('settings plan: sync needs ids, API ids need the integrations permission', () => {
  assert.match(planSettings({ syncEnabled: true }, DEFAULTS).error, /before turning/);
  assert.equal(planSettings({ syncEnabled: true, accountId: '1', dataSourceId: '2' }, DEFAULTS).touchesApi, true);
  assert.equal(planSettings({ minImagePx: 900 }, DEFAULTS).touchesApi, false);
  assert.equal(planSettings({ accountId: '1' }, { ...DEFAULTS, accountId: '1' }).touchesApi, false);
  assert.ok(planSettings({ minImagePx: 1 }, DEFAULTS).error);
});
