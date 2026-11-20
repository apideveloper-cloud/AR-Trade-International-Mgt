import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRedirect, analyseRows, followChain, summarise, planFlatten, planRedirect, pathIsLive, targetOkOf, parseRedirectQuery, parse404Query, listRedirects, posInt, RESERVED } from '../src/admin/seoRedirectsMap.js';

const R = (id, source, target, extra = {}) => ({ id, source, target, hits: 0, auto: 0, ...extra });

test('validateRedirect: valid, defaults and rejections', () => {
  assert.deepEqual(validateRedirect({ source: '/old/', target: '/new' }), { source: '/old', target: '/new', code: 301 });
  assert.equal(validateRedirect({ source: '/old', target: 'https://x.com/a', code: '302' }).code, 302);
  for (const bad of [
    { source: '/', target: '/a' }, { source: 'old', target: '/a' }, { source: '//evil.com', target: '/a' }, { source: '/a?x=1', target: '/b' },
    { source: '/a', target: 'http://x.com' }, { source: '/a', target: 'b' }, { source: '/a', target: '/a' }, { source: '/a', target: '/b', code: 404 },
    { source: '/' + 'x'.repeat(500), target: '/b' }, { source: '/a', target: '/' + 'y'.repeat(500) }, {}, null
  ]) assert.throws(() => validateRedirect(bad), e => e.status === 400, JSON.stringify(bad));
});
test('reserved prefixes are rejected as sources', () => {
  for (const p of ['/admin', '/admin/x', '/api/products', '/hub', '/email/x', '/field/app', '/assets/a.js', '/API/x']) assert.throws(() => validateRedirect({ source: p, target: '/b' }), /cannot be redirected/, p);
  assert.ok(!RESERVED.test('/administrator'));
  assert.ok(!RESERVED.test('/apiary'));
  assert.equal(validateRedirect({ source: '/administrator', target: '/b' }).source, '/administrator');
  assert.equal(validateRedirect({ source: '/old', target: '/admin' }).target, '/admin'); // only the source is restricted
});
test('posInt', () => {
  assert.equal(posInt('12'), 12);
  for (const v of ['0', '-1', '1.5', 'x', '', null, undefined, '99999999999']) assert.equal(posInt(v), 0);
});
test('chain analysis: none, single, self loop, 2-cycle, chain of 4, 5-hop cap', () => {
  const a = analyseRows([R(1, '/a', '/b')]);
  assert.deepEqual([a[0].hops, a[0].finalTarget, a[0].loop], [0, '/b', false]);
  const s = analyseRows([R(1, '/a', '/a')]);
  assert.equal(s[0].loop, true);
  const c2 = analyseRows([R(1, '/a', '/b'), R(2, '/b', '/a')]);
  assert.ok(c2.every(r => r.loop));
  const c4 = analyseRows([R(1, '/a', '/b'), R(2, '/b', '/c'), R(3, '/c', '/d'), R(4, '/d', '/e')]);
  assert.deepEqual(c4.map(r => [r.hops, r.finalTarget, r.loop]), [[3, '/e', false], [2, '/e', false], [1, '/e', false], [0, '/e', false]]);
  const long = [];
  for (let i = 0; i < 9; i++) long.push(R(i + 1, '/p' + i, '/p' + (i + 1)));
  const l = analyseRows(long);
  assert.equal(l[0].hops, 5); // capped
  assert.equal(l[0].loop, false);
  assert.equal(l[8].hops, 0);
});
test('chain follows the path of an internal target with a query, ends at absolute URLs', () => {
  const rows = analyseRows([R(1, '/a', '/b?x=1'), R(2, '/b', 'https://ext.com/z')]);
  assert.deepEqual([rows[0].hops, rows[0].finalTarget], [1, 'https://ext.com/z']);
});
test('followChain direct use', () => {
  const by = new Map([['/b', '/c']]);
  assert.deepEqual(followChain(by, '/a', '/b'), { hops: 1, finalTarget: '/c', loop: false });
  assert.equal(followChain(new Map([['/b', '/a']]), '/a', '/b').loop, true);
});
test('summarise counts', () => {
  const rows = analyseRows([R(1, '/a', '/b', { hits: 5, auto: 1 }), R(2, '/b', '/c', { hits: 2 }), R(3, '/x', '/y'), R(4, '/y', '/x')]);
  rows[0].targetOk = true; rows[1].targetOk = false; rows[2].targetOk = null; rows[3].targetOk = null;
  assert.deepEqual(summarise(rows), { total: 4, auto: 1, manual: 3, hits: 7, chains: 1, loops: 2, deadTargets: 1 });
  assert.deepEqual(summarise([]), { total: 0, auto: 0, manual: 0, hits: 0, chains: 0, loops: 0, deadTargets: 0 });
});
test('planFlatten repoints chains and reports loops', () => {
  const p = planFlatten([R(1, '/a', '/b'), R(2, '/b', '/c'), R(3, '/c', '/d'), R(4, '/l1', '/l2'), R(5, '/l2', '/l1')]);
  assert.deepEqual(p.fix.map(f => [f.id, f.from, f.to]), [[1, '/b', '/d'], [2, '/c', '/d']]);
  assert.deepEqual(p.loops.map(l => l.id), [4, 5]);
  assert.deepEqual(planFlatten([R(1, '/a', '/b')]).fix, []);
});
test('planRedirect: plain, loop, anti-chain forward and backward', () => {
  const rows = [R(1, '/b', '/c'), R(2, '/z', '/new-src')];
  assert.deepEqual(planRedirect(rows, { source: '/a', target: '/q' }), { loop: false, target: '/q', warnings: [], flattened: [] });
  assert.equal(planRedirect([R(1, '/b', '/a')], { source: '/a', target: '/b' }).loop, true);
  assert.equal(planRedirect([R(1, '/b', '/c'), R(2, '/c', '/a')], { source: '/a', target: '/b' }).loop, true);
  const fwd = planRedirect(rows, { source: '/a', target: '/b' });
  assert.equal(fwd.target, '/c');
  assert.equal(fwd.warnings.length, 1);
  const back = planRedirect(rows, { source: '/new-src', target: '/dest' });
  assert.deepEqual(back.flattened, [{ id: 2, source: '/z', from: '/new-src', to: '/dest' }]);
  assert.equal(planRedirect([R(1, '/a', '/old')], { source: '/a', target: '/n' }).loop, false); // update: own row ignored
});
test('pathIsLive and targetOkOf', () => {
  const live = { exact: new Set(['/', '/shop']), products: new Set(['hp-a']), categories: new Set(['toner']), brands: new Set(['hp']), blog: new Set(['post']), pages: new Set(['repair']), policies: new Set(['returns']) };
  for (const p of ['/', '/shop?x=1', '/product/hp-a', '/shop/toner', '/brand/hp', '/blog/post', '/services/repair', '/policy/returns']) assert.equal(pathIsLive(p, live), true, p);
  for (const p of ['/product/nope', '/shop/none', '/zzz', '/product/hp-a/extra']) assert.equal(pathIsLive(p, live), false, p);
  assert.equal(targetOkOf('https://x.com', live), null);
  assert.equal(targetOkOf('/nope', live), false);
  assert.equal(targetOkOf('/shop', live), true);
});
test('query whitelists and clamping', () => {
  assert.deepEqual(parseRedirectQuery({}), { q: '', kind: 'all', sort: 'created', dir: 'desc', size: 25, page: 1 });
  const q = parseRedirectQuery({ q: ' Abc ', kind: 'AUTO', sort: 'drop table', dir: 'asc', size: '5', page: '-3' });
  assert.deepEqual([q.q, q.kind, q.sort, q.dir, q.size, q.page], ['abc', 'auto', 'created', 'asc', 10, 1]);
  assert.equal(parseRedirectQuery({ size: '999' }).size, 100);
  assert.equal(parseRedirectQuery({ sort: '', dir: '', kind: '' }).sort, 'created');
  const n = parse404Query({ status: 'weird', sort: 'last_seen' });
  assert.deepEqual([n.status, n.sort, n.dir], ['open', 'last_seen', 'desc']);
  assert.equal(parse404Query({ sort: 'x' }).sort, 'hits');
});
test('listRedirects filters, sorts and pages', () => {
  const rows = [R(1, '/b', '/x', { hits: 3, auto: 1, createdAt: '2026-01-01' }), R(2, '/a', '/y', { hits: 9, createdAt: '2026-02-01' }), R(3, '/c', '/z', { hits: 1, createdAt: '2026-03-01' })];
  const ids = o => listRedirects(rows, parseRedirectQuery(o)).rows.map(r => r.id);
  assert.deepEqual(ids({}), [3, 2, 1]);
  assert.deepEqual(ids({ sort: 'hits' }), [2, 1, 3]);
  assert.deepEqual(ids({ sort: 'source', dir: 'asc' }), [2, 1, 3]);
  assert.deepEqual(ids({ kind: 'auto' }), [1]);
  assert.deepEqual(ids({ kind: 'manual' }), [3, 2]);
  assert.deepEqual(ids({ q: 'Y' }), [2]);
  const pg = listRedirects(rows, { ...parseRedirectQuery({}), size: 10, page: 2 });
  assert.equal(pg.total, 3);
  assert.deepEqual(pg.rows, []);
});
