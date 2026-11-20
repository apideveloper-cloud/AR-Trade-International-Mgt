import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db.js';
import { STARTER, validateLink, createBacklink, updateBacklink, deleteBacklink, addFromStarter, listBacklinks, _resetReady } from '../src/growth/backlinks.js';
import { mountGrowthLinksRoutes } from '../src/admin/growthLinks.js';
import { fakeLinksDb } from './growth_links_fake.js';

const HOST = 'artrade.example';
const bad = (body, re, o = {}) => assert.throws(() => validateLink(body, { host: HOST, ...o }), e => e.status === 400 && re.test(e.message));

test('validators: name, kind, url, target, status, notes', () => {
  bad({}, /Name is required/);
  bad({ name: 'x'.repeat(121) }, /at most 120/);
  bad({ name: 'a', kind: 'blog' }, /Kind/);
  bad({ name: 'a', url: 'ftp://x.com' }, /http/);
  bad({ name: 'a', url: 'javascript:alert(1)' }, /http/);
  bad({ name: 'a', url: 'https://x.com/' + 'a'.repeat(500) }, /at most 500/);
  bad({ name: 'a', target: 'https://evil.example/' }, /Target/);
  bad({ name: 'a', target: 'http://artrade.example/' }, /Target/);
  bad({ name: 'a', target: '//evil.example' }, /Target/);
  bad({ name: 'a', target: 'products' }, /Target/);
  bad({ name: 'a', status: 'Gone' }, /Status/);
  bad({ name: 'a', notes: 'n'.repeat(501) }, /at most 500/);
  bad({ name: 5 }, /must be text/);
  const ok = validateLink({ name: ' Bing ', kind: 'citation', url: 'https://x.com/p', target: 'https://artrade.example/products', status: 'Submitted' }, { host: HOST });
  assert.equal(ok.name, 'Bing'); assert.equal(ok.target, 'https://artrade.example/products');
  const d = validateLink({ name: 'A' }, { host: HOST });
  assert.deepEqual([d.kind, d.url, d.target, d.status], ['backlink', '', '/', 'Planned']);
  assert.deepEqual(validateLink({ notes: 'z' }, { partial: true }), { notes: 'z' });
});

test('starter list has no invented urls and covers the brief', () => {
  assert.equal(STARTER.length, 10);
  for (const s of STARTER) { assert.ok(s.name && s.note && s.kind); assert.ok(!/https?:\/\//.test(s.note)); }
  assert.ok(STARTER.some(s => s.name === 'Bing Places for Business'));
});

test('create, starter add, duplicate 409, update resets result, delete, list', async () => {
  _resetReady(); const db = fakeLinksDb(), q = db.query;
  const r = await addFromStarter('Bing Places for Business', q);
  assert.equal(r.status, 'Planned'); assert.equal(r.url, ''); assert.equal(r.target, '/');
  await assert.rejects(() => addFromStarter('Bing Places for Business', q), e => e.status === 409);
  await assert.rejects(() => addFromStarter('Made up', q), e => e.status === 400);
  await assert.rejects(() => createBacklink(validateLink({ name: 'Bing Places for Business' }), q), e => e.status === 409);
  db.rows[0].link_found = 1; db.rows[0].fail_count = 1;
  const u = await updateBacklink(r.id, { url: 'https://x.com/a' }, q);
  assert.equal(u.url, 'https://x.com/a'); assert.equal(u.link_found, null); assert.equal(u.fail_count, 0);
  await assert.rejects(() => updateBacklink(99, { notes: 'a' }, q), e => e.status === 404);
  const l = await listBacklinks({ limit: 500 }, q);
  assert.equal(l.counts.planned, 1); assert.equal(l.total, 1);
  assert.equal(l.starter.find(s => s.name === 'Bing Places for Business').added, true);
  assert.equal(l.starter.find(s => s.name === 'Apple Business Connect').added, false);
  await deleteBacklink(r.id, q);
  await assert.rejects(() => deleteBacklink(r.id, q), e => e.status === 404);
});

function rig(extra = {}) {
  _resetReady(); const db = fakeLinksDb(); pool.query = db.query;
  const routes = {}, router = {};
  for (const m of ['get', 'post', 'put', 'delete']) router[m] = (p, ...h) => { routes[m + ' ' + p] = h[h.length - 1]; };
  const queued = [];
  mountGrowthLinksRoutes(router, () => 'guard', { siteOrigin: async () => 'https://' + HOST, enqueue: async (...a) => { queued.push(a); return 1; }, ...extra });
  const call = async (key, { body = {}, params = {}, query = {} } = {}) => {
    let status = 200, json; const res = { status(s) { status = s; return this; }, json(j) { json = j; return this; } };
    await routes[key]({ body, params, query }, res); return { status, json };
  };
  return { db, call, queued };
}
const okDeps = html => ({ dns: async () => [{ address: '93.184.216.34', family: 4 }], fetch: async () => ({ status: 200, headers: { get: () => null }, text: async () => html }) });

test('routes: validation, create/update/delete, bad id', async () => {
  const { call } = rig();
  assert.equal((await call('post /growth/backlinks', { body: {} })).status, 400);
  assert.equal((await call('post /growth/backlinks', { body: { name: 'A', target: 'https://other.example/' } })).status, 400);
  const c = await call('post /growth/backlinks', { body: { name: 'Dir', kind: 'citation', url: 'https://dir.example/x' } });
  assert.equal(c.status, 200); assert.equal(c.json.row.status, 'Planned'); assert.equal(c.json.row.linkFound, null);
  const id = c.json.row.id;
  assert.equal((await call('put /growth/backlinks/:id', { params: { id: 'x' }, body: {} })).status, 400);
  assert.equal((await call('put /growth/backlinks/:id', { params: { id }, body: { status: 'Nope' } })).status, 400);
  assert.equal((await call('put /growth/backlinks/:id', { params: { id }, body: { status: 'Submitted' } })).json.row.status, 'Submitted');
  assert.equal((await call('post /growth/backlinks/starter', { body: { name: 'YouTube channel' } })).json.row.kind, 'social');
  assert.equal((await call('post /growth/backlinks/starter', { body: { name: 'YouTube channel' } })).status, 409);
  assert.equal((await call('get /growth/backlinks')).json.total, 2);
  assert.equal((await call('delete /growth/backlinks/:id', { params: { id } })).json.ok, true);
  assert.equal((await call('delete /growth/backlinks/:id', { params: { id } })).status, 404);
});

test('routes: check all is queued once a minute; single check rules', async () => {
  const { call, queued, db } = rig({ checkDeps: okDeps('<p><a href="https://artrade.example/shop" rel="nofollow">us</a></p>') });
  assert.equal((await call('post /growth/backlinks/check')).json.queued, true);
  assert.equal((await call('post /growth/backlinks/check')).status, 429);
  assert.equal(queued[0][0], 'link_check'); assert.equal(queued[0][2].dedupeKey, 'link_check_manual');
  assert.equal((await call('post /growth/backlinks/check', { body: { id: 'abc' } })).status, 400);
  assert.equal((await call('post /growth/backlinks/check', { body: { id: 7 } })).status, 404);
  const a = (await call('post /growth/backlinks', { body: { name: 'NoUrl' } })).json.row;
  assert.equal((await call('post /growth/backlinks/check', { body: { id: a.id } })).status, 400);
  const b = (await call('post /growth/backlinks', { body: { name: 'Has', url: 'https://dir.example/p', status: 'Submitted' } })).json.row;
  const r = await call('post /growth/backlinks/check', { body: { id: b.id } });
  assert.equal(r.status, 200); assert.equal(r.json.row.status, 'Live'); assert.equal(r.json.row.rel, 'nofollow'); assert.equal(r.json.result.note, 'Link found');
  assert.equal(db.rows.find(x => x.id === b.id).fail_count, 0);
});

test('routes: single check rate limit 30 per 10 minutes', async () => {
  const { call } = rig({ checkDeps: okDeps('') });
  const b = (await call('post /growth/backlinks', { body: { name: 'Has', url: 'https://dir.example/p', status: 'Submitted' } })).json.row;
  for (let i = 0; i < 30; i++) assert.equal((await call('post /growth/backlinks/check', { body: { id: b.id } })).status, 200);
  assert.equal((await call('post /growth/backlinks/check', { body: { id: b.id } })).status, 429);
});
