import test from 'node:test';
import assert from 'node:assert/strict';
import { setFetch, setSleep, getIntegration } from '../src/growth/http.js';
import { setSecret } from '../src/growth/vault.js';
import * as google from '../src/growth/google.js';
import * as bing from '../src/growth/bing.js';
import { submitSitemapAll, shouldSkip } from '../src/growth/sitemapSubmit.js';
import { sitemapResubmit } from '../src/growth/register.js';
import { fakeDb, res, scriptedFetch } from './growth_fake.js';

setSleep(async () => {});
test.after(() => { setFetch(null); setSleep(null); });
const init = async (answers) => { const db = fakeDb(); google.clearTokenCache(); const f = scriptedFetch(answers); setFetch(f); await setSecret('google.clientId', 'cid.apps.googleusercontent.com'); await setSecret('google.clientSecret', 'GOCSPX-secret'); await setSecret('google.refreshToken', 'RT-refresh-token'); return { db, f }; };
const tokenOk = res(200, { access_token: 'AT-1', expires_in: 3600 });

test('authUrl has scopes, offline access and consent', async () => {
  fakeDb(); await setSecret('google.clientId', 'cid');
  const u = new URL(await google.authUrl('ST', 'https://x.test/cb'));
  assert.equal(u.host, 'accounts.google.com');
  assert.equal(u.searchParams.get('access_type'), 'offline'); assert.equal(u.searchParams.get('prompt'), 'consent');
  assert.equal(u.searchParams.get('state'), 'ST'); assert.equal(u.searchParams.get('client_id'), 'cid');
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/content');
});
test('state token round trip, and a wrong token is refused', () => {
  assert.equal(google.readState(google.signState(7)), 7);
  assert.equal(google.readState('nope'), 0);
});
test('exchangeCode posts a form and returns the refresh token', async () => {
  const { f } = await init([res(200, { access_token: 'a', refresh_token: 'RT-new', expires_in: 3600 })]);
  const r = await google.exchangeCode('CODE', 'https://x.test/cb');
  assert.deepEqual(r, { ok: true, refreshToken: 'RT-new', scopes: [] });
  assert.equal(f.calls[0].url, 'https://oauth2.googleapis.com/token');
  const p = new URLSearchParams(f.calls[0].body);
  assert.equal(p.get('grant_type'), 'authorization_code'); assert.equal(p.get('code'), 'CODE'); assert.equal(p.get('redirect_uri'), 'https://x.test/cb');
});
test('exchangeCode without a refresh token explains what to do', async () => {
  await init([res(200, { access_token: 'a', expires_in: 3600 })]);
  const r = await google.exchangeCode('CODE', 'https://x.test/cb');
  assert.equal(r.ok, false); assert.match(r.error, /connect again/i);
});
test('refresh flow: token cached, Bearer header, encoded URL, PUT', async () => {
  const { f } = await init([tokenOk, res(204, '')]);
  const r = await google.submitSitemap('https://ar.test/', 'https://ar.test/sitemap.xml');
  assert.equal(r.ok, true);
  assert.equal(f.calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(new URLSearchParams(f.calls[0].body).get('refresh_token'), 'RT-refresh-token');
  assert.equal(f.calls[1].method, 'PUT');
  assert.equal(f.calls[1].url, 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Far.test%2F/sitemaps/https%3A%2F%2Far.test%2Fsitemap.xml');
  assert.equal(f.calls[1].headers.Authorization, 'Bearer AT-1');
  f.calls.length = 0;
  // second call reuses the cached token (only one request)
  const answers = [res(200, { siteEntry: [{ siteUrl: 'https://ar.test/', permissionLevel: 'siteOwner' }] })];
  setFetch(scriptedFetch(answers));
  const l = await google.listSites();
  assert.deepEqual(l.sites, [{ siteUrl: 'https://ar.test/', permissionLevel: 'siteOwner' }]);
});
test('invalid_grant marks the integration as error with a clear message', async () => {
  await init([res(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' })]);
  const r = await google.listSites();
  assert.equal(r.ok, false); assert.match(r.error, /Connect Google again/);
  const gi = await getIntegration('google');
  assert.equal(gi.status, 'error'); assert.match(gi.last_error, /Connect Google again/);
});
test('verification token and verify request shapes', async () => {
  const { f } = await init([tokenOk, res(200, { method: 'FILE', token: 'google1234abcd5678.html' }), res(200, { id: 'x' })]);
  const t = await google.siteVerificationToken('https://ar.test/');
  assert.deepEqual(t, { ok: true, token: 'google1234abcd5678.html' });
  assert.equal(f.calls[1].url, 'https://www.googleapis.com/siteVerification/v1/token');
  assert.deepEqual(JSON.parse(f.calls[1].body), { site: { type: 'SITE', identifier: 'https://ar.test/' }, verificationMethod: 'FILE' });
  const v = await google.verifySite('https://ar.test/');
  assert.equal(v.ok, true);
  assert.equal(f.calls[2].url, 'https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=FILE');
  assert.equal(f.calls[2].method, 'POST');
});
test('Bing SubmitFeed body, URL and the key never reaches the log', async () => {
  const db = fakeDb(); await setSecret('bing.apiKey', 'BINGKEY1234567890abcdef');
  const f = scriptedFetch([res(200, { d: null })]); setFetch(f);
  const r = await bing.submitSitemap('https://ar.test', 'https://ar.test/sitemap.xml');
  assert.equal(r.ok, true);
  assert.equal(f.calls[0].url, 'https://ssl.bing.com/webmaster/api.svc/json/SubmitFeed?apikey=BINGKEY1234567890abcdef');
  assert.equal(f.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[0].body), { siteUrl: 'https://ar.test', feedUrl: 'https://ar.test/sitemap.xml' });
  assert.equal(db.logs[0].target, 'ssl.bing.com/webmaster/api.svc/json/SubmitFeed');
  assert.ok(!JSON.stringify(db.logs).includes('BINGKEY'));
});
test('Bing error message is shown without the key', async () => {
  fakeDb(); await setSecret('bing.apiKey', 'BINGKEY1234567890abcdef');
  setFetch(scriptedFetch([res(400, { ErrorCode: 14, Message: 'Not authorized BINGKEY1234567890abcdef' })]));
  const r = await bing.getUserSites();
  assert.equal(r.ok, false); assert.ok(!r.error.includes('BINGKEY')); assert.match(r.error, /Not authorized/);
});
test('shouldSkip', () => {
  assert.match(shouldSkip('google', { googleConnected: false }), /not connected/);
  assert.equal(shouldSkip('bing', { bingKey: true }), '');
});
test('submitSitemapAll: needs a preferred domain, then reports per engine', async () => {
  const db = fakeDb(); google.clearTokenCache();
  const old = process.env.SITE_URL; delete process.env.SITE_URL;
  await assert.rejects(submitSitemapAll({}), /preferred domain/);
  db.settings.set('seo', JSON.stringify({ general: { preferredDomain: 'https://ar.test' } }));
  await setSecret('bing.apiKey', 'BINGKEY1234567890abcdef');
  setFetch(scriptedFetch([res(200, { d: null })]));
  const r = await submitSitemapAll({});
  assert.equal(r.google.skipped, true); assert.equal(r.bing.ok, true);
  const g = JSON.parse(db.settings.get('growth')); assert.ok(g.lastSubmit.bing);
  assert.equal((await getIntegration('bing')).status, 'connected');
  // the job handler: nothing failing -> ok; a failing engine throws so the queue retries
  setFetch(scriptedFetch([res(200, { d: null })]));
  assert.ok((await sitemapResubmit()).results);
  setFetch(scriptedFetch(() => res(400, { Message: 'nope' })));
  await assert.rejects(sitemapResubmit(), /bing: nope/);
  db.secrets.delete('bing.apiKey');
  assert.deepEqual(await sitemapResubmit(), { skipped: true });
  if (old !== undefined) process.env.SITE_URL = old;
});
