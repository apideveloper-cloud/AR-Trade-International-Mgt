import test from 'node:test';
import assert from 'node:assert/strict';
import { setFetch, setSleep, getIntegration } from '../src/growth/http.js';
import { setSecret } from '../src/growth/vault.js';
import * as google from '../src/growth/google.js';
import { searchAnalytics, inspectUrl, getSitemapStatus, sitemapSummary, resolveSiteUrl } from '../src/growth/gscApi.js';
import { fakeDb, res, scriptedFetch } from './growth_fake.js';

setSleep(async () => {});
test.after(() => { setFetch(null); setSleep(null); });
const init = async answers => { const db = fakeDb(); google.clearTokenCache(); const f = scriptedFetch(answers); setFetch(f); await setSecret('google.clientId', 'cid'); await setSecret('google.clientSecret', 'cs'); await setSecret('google.refreshToken', 'RT'); return { db, f }; };
const tokenOk = res(200, { access_token: 'AT-1', expires_in: 3600 });

test('searchAnalytics: encoded siteUrl, bearer token, JSON body', async () => {
  const { f, db } = await init([tokenOk, res(200, { rows: [{ keys: ['2026-11-01'], clicks: 3, impressions: 40, ctr: 0.075, position: 4.2 }] })]);
  const r = await searchAnalytics('https://shop.test/', { startDate: '2026-08-22', endDate: '2026-11-19', dimensions: ['date'], rowLimit: 1000 });
  assert.equal(r.ok, true); assert.equal(r.data.rows[0].clicks, 3);
  const c = f.calls[1];
  assert.equal(c.url, 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fshop.test%2F/searchAnalytics/query');
  assert.equal(c.method, 'POST'); assert.equal(c.headers.Authorization, 'Bearer AT-1');
  assert.deepEqual(JSON.parse(c.body), { startDate: '2026-08-22', endDate: '2026-11-19', dimensions: ['date'], rowLimit: 1000, startRow: 0 });
  assert.equal(db.logs.at(-1).integration, 'gsc');
});
test('searchAnalytics with a domain property and a filter group', async () => {
  const { f } = await init([tokenOk, res(200, {})]);
  const fg = [{ filters: [{ dimension: 'page', operator: 'contains', expression: '/product/' }] }];
  await searchAnalytics('sc-domain:shop.test', { startDate: 'a', endDate: 'b', dimensions: ['page'], rowLimit: 100, startRow: 100, dimensionFilterGroups: fg });
  assert.match(f.calls[1].url, /sites\/sc-domain%3Ashop\.test\/searchAnalytics\/query$/);
  const b = JSON.parse(f.calls[1].body); assert.equal(b.startRow, 100); assert.deepEqual(b.dimensionFilterGroups, fg);
});
test('inspectUrl posts the inspection body to the URL Inspection API', async () => {
  const { f } = await init([tokenOk, res(200, { inspectionResult: { indexStatusResult: { verdict: 'PASS' } } })]);
  const r = await inspectUrl('sc-domain:shop.test', 'https://shop.test/product/a');
  assert.equal(r.ok, true);
  assert.equal(f.calls[1].url, 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect');
  assert.deepEqual(JSON.parse(f.calls[1].body), { inspectionUrl: 'https://shop.test/product/a', siteUrl: 'sc-domain:shop.test', languageCode: 'en-US' });
});
test('errors come back as values, never thrown (403, no Google connection)', async () => {
  await init([tokenOk, res(403, { error: { message: 'User does not have sufficient permission' } })]);
  const r = await inspectUrl('https://shop.test/', 'https://shop.test/');
  assert.equal(r.ok, false); assert.equal(r.status, 403); assert.match(r.error, /sufficient permission/);
  fakeDb(); google.clearTokenCache();
  const n = await searchAnalytics('https://shop.test/', {});
  assert.deepEqual([n.ok, n.status], [false, 0]); assert.match(n.error, /not connected/i);
});
test('sitemap status sums the contents and tolerates failure', async () => {
  const { f } = await init([tokenOk, res(200, { lastDownloaded: '2026-11-19T01:00:00Z', errors: '0', warnings: '2', contents: [{ type: 'web', submitted: '120', indexed: '90' }, { type: 'image', submitted: '10' }] })]);
  const r = await getSitemapStatus('https://shop.test/', 'https://shop.test/sitemap.xml');
  assert.deepEqual(r.data, { submitted: 130, indexed: 90, lastDownloaded: '2026-11-19T01:00:00Z', errors: 0, warnings: 2, isPending: false });
  assert.match(f.calls[1].url, /sitemaps\/https%3A%2F%2Fshop\.test%2Fsitemap\.xml$/);
  assert.equal(sitemapSummary({}).submitted, null);
  await init([tokenOk, res(404, { error: { message: 'Not found' } })]);
  assert.equal((await getSitemapStatus('https://shop.test/', 'https://shop.test/sitemap.xml')).ok, false);
});
test('resolveSiteUrl picks the property, caches it in the google meta, and returns empty when none matches', async () => {
  const { f } = await init([tokenOk, res(200, { siteEntry: [{ siteUrl: 'sc-domain:shop.test', permissionLevel: 'siteOwner' }, { siteUrl: 'https://shop.test/', permissionLevel: 'siteOwner' }] })]);
  const deps = { siteOrigin: async () => 'https://shop.test' };
  assert.equal(await resolveSiteUrl({ deps }), 'https://shop.test/');
  assert.equal((await getIntegration('google')).meta.gscSite, 'https://shop.test/');
  const before = f.calls.length;
  assert.equal(await resolveSiteUrl({ deps }), 'https://shop.test/'); // cached: no new call
  assert.equal(f.calls.length, before);
  await init([tokenOk, res(200, { siteEntry: [{ siteUrl: 'https://other.test/', permissionLevel: 'siteOwner' }] })]);
  assert.equal(await resolveSiteUrl({ deps }), '');
  assert.equal(await resolveSiteUrl({ deps: { siteOrigin: async () => '' } }), '');
});
