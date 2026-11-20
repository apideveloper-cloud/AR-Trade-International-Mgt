import test from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, safeFetch, scanLinks, checkBacklink, applyCheck, runLinkCheck, MAX_PER_RUN, PAUSE_MS } from '../src/growth/linkCheck.js';
import { _resetReady } from '../src/growth/backlinks.js';
import { fakeLinksDb } from './growth_links_fake.js';

const PUBLIC = [{ address: '93.184.216.34', family: 4 }];
const resp = (status, body = '', headers = {}) => ({ status, text: async () => body, headers: { get: k => headers[k.toLowerCase()] ?? null } });
const mk = (answers, dnsMap = {}) => {
  const calls = [], dnsCalls = [];
  return {
    calls, dnsCalls,
    dns: async h => { dnsCalls.push(h); return dnsMap[h] || PUBLIC; },
    fetch: async (url, init) => { calls.push({ url, init }); const a = typeof answers === 'function' ? answers(url, calls.length) : answers.shift(); if (a instanceof Error) throw a; return a; },
  };
};

test('isBlockedIp: private, loopback, link-local, unique-local, metadata, mapped', () => {
  for (const ip of ['127.0.0.1', '127.255.1.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'febf::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', 'nonsense', '']) assert.equal(isBlockedIp(ip), true, ip);
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.15.0.1', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946', '::ffff:8.8.8.8']) assert.equal(isBlockedIp(ip), false, ip);
});

test('safeFetch refuses every bad target before any request', async () => {
  const cases = [
    ['file:///etc/passwd', 'scheme'], ['ftp://example.com/', 'scheme'], ['javascript:alert(1)', 'scheme'],
    ['http://localhost/', 'localhost'], ['http://foo.localhost/', 'localhost'],
    ['http://127.0.0.1/', 'private address'], ['http://[::1]/', 'private address'], ['http://2130706433/', 'private address'],
    ['http://10.0.0.5/', 'private address'], ['http://192.168.0.1/x', 'private address'], ['http://172.20.1.1/', 'private address'],
    ['http://169.254.169.254/latest/meta-data/', 'private address'], ['http://[fe80::1]/', 'private address'], ['http://[fd00::1]/', 'private address'],
    ['http://0.0.0.0/', 'private address'], ['http://[::ffff:127.0.0.1]/', 'private address'],
    ['http://example.com:8080/', 'port'], ['https://example.com:22/', 'port'], ['http://user:pw@example.com/', 'credentials'], ['not a url', 'bad address'],
  ];
  for (const [url, why] of cases) {
    const d = mk([resp(200, 'x')]); const r = await safeFetch(url, d);
    assert.equal(r.ok, false, url); assert.equal(r.blocked, true, url); assert.equal(r.why, why, url);
    assert.equal(r.error, 'Blocked: this address is not allowed'); assert.equal(d.calls.length, 0, 'no request for ' + url);
  }
});

test('safeFetch refuses a name that resolves to a private address (any of several answers)', async () => {
  for (const addrs of [[{ address: '10.0.0.1', family: 4 }], [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }], [{ address: '::1', family: 6 }]]) {
    const d = mk([resp(200)], { 'evil.example': addrs }); const r = await safeFetch('https://evil.example/', d);
    assert.equal(r.blocked, true); assert.equal(d.calls.length, 0);
  }
  const r = await safeFetch('https://nx.example/', { dns: async () => { throw new Error('ENOTFOUND'); }, fetch: async () => { throw new Error('no'); } });
  assert.equal(r.ok, false); assert.match(r.error, /address not found/);
});

test('safeFetch: ports 80 and 443 allowed, headers, pinned address, manual redirect mode', async () => {
  const d = mk([resp(200, 'hello'), resp(200, 'hi')]);
  const r = await safeFetch('http://example.com:80/a?b=1', { ...d, site: 'https://artrade.example' });
  assert.equal(r.ok, true); assert.equal(r.body, 'hello');
  assert.equal(d.calls[0].init.redirect, 'manual'); assert.equal(d.calls[0].init.headers['User-Agent'], 'ARTradeLinkChecker/1.0 (+https://artrade.example)');
  assert.equal(d.calls[0].init.address, '93.184.216.34');
  assert.equal((await safeFetch('https://example.com:443/', d)).ok, true);
  const x = mk([resp(200)]); await safeFetch('https://example.com/', x); assert.match(x.calls[0].init.headers['User-Agent'], /^ARTradeLinkChecker\/1\.0 \(\+/);
});

test('safeFetch: redirects are followed up to 3 and each hop is rechecked', async () => {
  const d = mk([resp(301, '', { location: '/b' }), resp(302, '', { location: 'https://other.example/c' }), resp(200, 'done')]);
  const r = await safeFetch('https://example.com/a', d);
  assert.equal(r.ok, true); assert.equal(r.finalUrl, 'https://other.example/c'); assert.equal(r.redirects, 2);
  assert.deepEqual(d.dnsCalls, ['example.com', 'example.com', 'other.example']);
  for (const loc of ['http://127.0.0.1/admin', 'http://169.254.169.254/', 'http://[::1]/', 'file:///etc/passwd', 'http://example.com:8080/', 'http://internal.example/']) {
    const e = mk([resp(302, '', { location: loc }), resp(200, 'SECRET')], { 'internal.example': [{ address: '192.168.1.5', family: 4 }] });
    const x = await safeFetch('https://example.com/', e);
    assert.equal(x.blocked, true, loc); assert.equal(e.calls.length, 1, 'second hop never fetched: ' + loc);
  }
  const loop = mk(() => resp(302, '', { location: '/again' }));
  const t = await safeFetch('https://example.com/', loop);
  assert.equal(t.ok, false); assert.match(t.error, /too many redirects/); assert.equal(loop.calls.length, 4);
});

test('safeFetch: body cap and timeout', async () => {
  const big = 'a'.repeat(2 * 1024 * 1024);
  const r = await safeFetch('https://example.com/', mk([resp(200, big)]));
  assert.equal(r.truncated, true); assert.equal(Buffer.byteLength(r.body), 1024 * 1024);
  const small = await safeFetch('https://example.com/', { ...mk([resp(200, 'abcdef')]), maxBytes: 3 });
  assert.equal(small.body, 'abc');
  const d = { dns: async () => PUBLIC, fetch: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))), timeoutMs: 30 };
  const t = await safeFetch('https://example.com/', d);
  assert.equal(t.ok, false); assert.equal(t.error, 'Could not load: timeout');
  const hang = await safeFetch('https://example.com/', { dns: async () => PUBLIC, fetch: () => new Promise(() => {}), timeoutMs: 30 });
  assert.equal(hang.error, 'Could not load: timeout');
});

const O = 'https://artrade.example';
test('scanLinks: relative, nofollow, uppercase, quotes, host lookalikes', () => {
  const base = 'https://dir.example/list/page';
  assert.deepEqual(scanLinks('<a href="https://artrade.example/shop" rel="nofollow ugc">x</a>', { base, origin: O }), { linkFound: true, rel: 'nofollow ugc', href: 'https://artrade.example/shop' });
  assert.equal(scanLinks("<A HREF='https://WWW.ArTrade.example/'>x</A>", { base, origin: O }).linkFound, true);
  assert.equal(scanLinks('<a class=x href=https://artrade.example/p rel=sponsored>', { base, origin: O }).rel, 'sponsored');
  assert.equal(scanLinks('<a href="https://artrade.example/p?a=1&amp;b=2">', { base, origin: O }).href, 'https://artrade.example/p?a=1&b=2');
  assert.equal(scanLinks('<a href="/local">x</a>', { base, origin: O }).linkFound, false, 'relative link resolves to the other site');
  assert.equal(scanLinks('<a href="/local">x</a>', { base: 'https://artrade.example/page', origin: O }).linkFound, true, 'relative link on our own site');
  assert.equal(scanLinks('<a href="//artrade.example/x">', { base, origin: O }).linkFound, true);
  for (const h of ['https://evilartrade.example/', 'https://artrade.example.evil.com/', 'https://evil.com/?u=https://artrade.example/', 'https://evil.com/artrade.example', 'https://shop.artrade.example/', 'mailto:a@artrade.example', 'javascript:void(0)']) assert.equal(scanLinks(`<a href="${h}">x</a>`, { base, origin: O }).linkFound, false, h);
  assert.equal(scanLinks('<link href="https://artrade.example/"><img src="https://artrade.example/a.png"><a name="x">', { base, origin: O }).linkFound, false);
  assert.equal(scanLinks('<a href="https://other.example/page">', { base, origin: O, target: 'https://other.example/page' }).linkFound, true, 'exact target match');
  assert.equal(scanLinks('<p>no links</p>', { base, origin: O }).linkFound, false);
});

test('checkBacklink: plain notes', async () => {
  const row = { url: 'https://dir.example/p', target: '/' };
  const run = async (answer, extra = {}) => checkBacklink(row, { origin: O, ...mk([answer]), ...extra });
  const f = await run(resp(200, '<a href="https://artrade.example/" rel="nofollow">'));
  assert.deepEqual([f.ok, f.httpStatus, f.linkFound, f.rel, f.note], [true, 200, true, 'nofollow', 'Link found']);
  assert.equal((await run(resp(200, '<p>nothing</p>'))).note, 'Page loads but has no link to your site');
  const nf = await run(resp(404)); assert.deepEqual([nf.ok, nf.linkFound, nf.note], [true, false, 'Page not found (404)']);
  assert.equal((await run(resp(503))).ok, false);
  assert.equal((await checkBacklink({ url: 'http://127.0.0.1/' }, { origin: O, ...mk([]) })).note, 'Blocked: this address is not allowed');
  const t = await checkBacklink(row, { origin: O, dns: async () => PUBLIC, fetch: () => new Promise(() => {}), timeoutMs: 20 });
  assert.equal(t.note, 'Could not load: timeout');
});

const DAY = 24 * 3600e3, T0 = new Date('2026-11-01T00:00:00Z'), found = { ok: true, httpStatus: 200, linkFound: true, rel: '', note: 'Link found' }, missing = { ok: true, httpStatus: 200, linkFound: false, rel: '', note: 'x' };
const row = o => ({ id: 1, url: 'https://d.example/', status: 'Submitted', fail_count: 0, last_checked: null, link_found: null, rel: '', ...o });

test('applyCheck state machine', () => {
  assert.equal(applyCheck(row({ url: '' }), found, T0), null);
  assert.equal(applyCheck(row({ status: 'Planned', url: '' }), found, T0), null);
  assert.equal(applyCheck(row({ status: 'Rejected' }), found, T0), null);
  const a = applyCheck(row({ status: 'Submitted' }), { ...found, rel: 'nofollow' }, T0);
  assert.deepEqual([a.status, a.link_found, a.rel, a.fail_count], ['Live', 1, 'nofollow', 0]);
  assert.equal(applyCheck(row({ status: 'Submitted' }), missing, T0).status, 'Submitted');
  assert.equal(applyCheck(row({ status: 'Submitted' }), missing, T0).fail_count, 0);
  assert.equal(applyCheck(row({ status: 'Live', fail_count: 1 }), found, T0).fail_count, 0);
  assert.equal(applyCheck(row({ status: 'Lost', fail_count: 2 }), found, T0).status, 'Live');
  // two strikes a week apart
  const s1 = applyCheck(row({ status: 'Live', last_checked: new Date(T0 - 7 * DAY) }), missing, T0);
  assert.deepEqual([s1.status, s1.fail_count, s1.link_found], ['Live', 1, 0]);
  const s2 = applyCheck(row({ status: 'Live', fail_count: 1, last_checked: T0 }), missing, new Date(+T0 + 7 * DAY));
  assert.deepEqual([s2.status, s2.fail_count], ['Lost', 2]);
  // a second miss only hours later does not count as a second week
  const early = applyCheck(row({ status: 'Live', fail_count: 1, last_checked: T0 }), missing, new Date(+T0 + 3600e3));
  assert.deepEqual([early.status, early.fail_count], ['Live', 1]);
  assert.equal(applyCheck(row({ status: 'Lost', fail_count: 2 }), missing, T0).status, 'Lost');
  // could not load: nothing changes but the time and status code
  const e = applyCheck(row({ status: 'Live', fail_count: 1 }), { ok: false, httpStatus: null, linkFound: null, note: 'Could not load: timeout' }, T0);
  assert.deepEqual([e.status, e.fail_count], ['Live', 1]);
});

function seed(db, n, o = {}) { for (let i = 0; i < n; i++) db.rows.push(row({ id: ++db.seq, name: 'n' + i, target: '/', ...o })); }

test('runLinkCheck: skips, caps at 200, pauses 300 ms between rows, survives per-row errors', async () => {
  _resetReady(); const db = fakeLinksDb(), sleeps = [];
  seed(db, 3); db.rows.push(row({ id: ++db.seq, name: 'rej', status: 'Rejected' }), row({ id: ++db.seq, name: 'plan', status: 'Planned', url: '' }));
  let n = 0;
  const check = async () => { n++; if (n === 2) throw new Error('boom'); return found; };
  const out = await runLinkCheck({ deps: { query: db.query, sleep: ms => { sleeps.push(ms); }, check } });
  assert.deepEqual([out.total, out.checked, out.errors, out.found], [3, 2, 1, 2]);
  assert.deepEqual(sleeps, [PAUSE_MS, PAUSE_MS]); assert.equal(PAUSE_MS, 300);
  assert.equal(db.rows.filter(r => r.status === 'Live').length, 2);

  _resetReady(); const big = fakeLinksDb(); seed(big, 250);
  const o2 = await runLinkCheck({ deps: { query: big.query, sleep: async () => {}, check: async () => missing } });
  assert.equal(MAX_PER_RUN, 200); assert.equal(o2.checked, 200); assert.equal(o2.notFound, 200);

  _resetReady(); const one = fakeLinksDb(); seed(one, 2); one.rows[0].status = 'Live'; one.rows[0].fail_count = 1; one.rows[0].last_checked = new Date(Date.now() - 8 * DAY);
  const o3 = await runLinkCheck({ id: 1, deps: { query: one.query, sleep: async () => { throw new Error('no pause for one row'); }, check: async () => missing } });
  assert.equal(o3.checked, 1); assert.equal(o3.lost, 1); assert.equal(one.rows[0].status, 'Lost'); assert.equal(one.rows[1].last_checked, null);
});
