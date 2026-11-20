import test from 'node:test';
import assert from 'node:assert/strict';
import { addRedirect, normaliseRedirectPath, detectLoop, checkRedirect, moveRedirect } from '../src/redirects.js';

test('normaliseRedirectPath keeps site paths only', () => {
  assert.equal(normaliseRedirectPath('/product/a/'), '/product/a');
  assert.equal(normaliseRedirectPath('/product/a?x=1#h'), '/product/a');
  assert.equal(normaliseRedirectPath('/'), '/');
  for (const bad of ['product/a', '//evil.com', 'https://x.com/a', '/a b', '/a"b', '', null]) assert.equal(normaliseRedirectPath(bad), '');
});
test('checkRedirect validates source, target and code', () => {
  assert.deepEqual(checkRedirect({ source: '/a/', target: '/b' }), { source: '/a', target: '/b', code: 301 });
  assert.equal(checkRedirect({ source: '/a', target: 'https://x.com/p' }).target, 'https://x.com/p');
  assert.throws(() => checkRedirect({ source: '/a', target: '/a' }));
  assert.throws(() => checkRedirect({ source: '/a?q=1', target: '/b' }));
  assert.throws(() => checkRedirect({ source: 'a', target: '/b' }));
  assert.throws(() => checkRedirect({ source: '/a', target: 'http://x.com' }));
  assert.throws(() => checkRedirect({ source: '/a', target: '//x.com' }));
  assert.throws(() => checkRedirect({ source: '/' + 'a'.repeat(500), target: '/b' }));
  assert.throws(() => checkRedirect({ source: '/a', target: '/b', code: 200 }));
});
test('detectLoop follows targets up to 5 hops', () => {
  const rows = [{ source: '/b', target: '/c' }, { source: '/c', target: '/a' }];
  assert.equal(detectLoop(rows, '/a', '/b'), true);
  assert.equal(detectLoop(rows, '/z', '/b'), false);
  assert.equal(detectLoop([], '/a', '/a'), true);
  const long = [1, 2, 3, 4, 5, 6].map(i => ({ source: '/n' + i, target: '/n' + (i + 1) }));
  assert.equal(detectLoop(long, '/n7', '/n1'), false); // 6 hops away is out of reach
  assert.equal(detectLoop(long, '/n5', '/n1'), true);
});
function fakeDb(rows = []) {
  const calls = [];
  return { calls, query: async (sql, p = []) => { calls.push([sql, p]); return /^SELECT/.test(sql) ? [rows] : [{}]; } };
}
test('addRedirect upserts by source and refuses loops', async () => {
  const db = fakeDb([{ source: '/b', target: '/a' }]);
  const r = await addRedirect(db, { source: '/a', target: '/c', auto: 1 });
  assert.deepEqual(r, { source: '/a', target: '/c', code: 301 });
  assert.match(db.calls[1][0], /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(db.calls[1][1], ['/a', '/c', 301, 1]);
  await assert.rejects(addRedirect(fakeDb([{ source: '/b', target: '/a' }]), { source: '/a', target: '/b' }), /loop/);
  await assert.rejects(addRedirect(db, { source: '/a', target: '/a' }));
});
test('moveRedirect clears the new address as a source, repoints and stores old -> new', async () => {
  const db = fakeDb([]);
  const r = await moveRedirect(db, '/product/old', '/product/new');
  assert.deepEqual(r, { source: '/product/old', target: '/product/new', code: 301 });
  assert.match(db.calls[0][0], /DELETE FROM seo_redirects WHERE source = \?/);
  assert.deepEqual(db.calls[0][1], ['/product/new']);
  assert.match(db.calls[1][0], /UPDATE seo_redirects SET target/);
  assert.deepEqual(db.calls[1][1], ['/product/new', '/product/old']);
});
