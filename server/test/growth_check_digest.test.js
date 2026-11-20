import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { sendDigest, buildDigest, looksLikeEmail } from '../src/growth/priceCheck.js';
import { mountGrowthCheckRoutes, _resetRunGap } from '../src/admin/growthChecks.js';
import { pool } from '../src/db.js';
import { fakeDb } from './growth_fake.js';
import { clearSiteFilesCache } from '../src/growth/siteFiles.js';

const rowsFor = counts => async sql => {
  if (sql.includes('GROUP BY code')) return Object.entries(counts).map(([code, n]) => ({ code, n }));
  return [{ product_id: 7, detail: 'Page says 5, catalogue says 6', name: 'Toner <X>', sku: 'S7' }];
};
const mkDeps = (o = {}) => { const sent = []; return { sent, readGrowth: async () => ({ priceDigest: { enabled: true, to: 'a@b.co' } }), mailReady: () => true, sendMail: async m => { sent.push(m); return true; }, origin: () => 'https://x.test', query: rowsFor({ no_sku: 2 }), shopEmail: async () => 'shop@x.test', ...o }; };

test('digest builds counts, escapes names and links the admin page', async () => {
  const d = await buildDigest({ query: rowsFor({ no_sku: 12, stale_price: 1 }), origin: 'https://x.test' });
  assert.equal(d.total, 13); assert.match(d.html, /Toner &lt;X&gt;/); assert.match(d.text, /https:\/\/x\.test\/admin\/growth-prices/); assert.match(d.text, /and 11 more/);
});
test('digest sends when on, ready and there are issues', async () => {
  const d = mkDeps(); const r = await sendDigest({ deps: d });
  assert.equal(r.sent, true); assert.equal(d.sent[0].to, 'a@b.co');
});
test('digest skip paths never throw', async () => {
  assert.equal((await sendDigest({ deps: mkDeps({ readGrowth: async () => ({}) }) })).reason, 'digest is turned off');
  assert.equal((await sendDigest({ deps: mkDeps({ mailReady: () => false }) })).skipped, true);
  assert.equal((await sendDigest({ deps: mkDeps({ query: rowsFor({}) }) })).reason, 'no issues');
  const f = await sendDigest({ deps: mkDeps({ sendMail: async () => { throw new Error('smtp down'); } }) });
  assert.match(f.reason, /send failed/);
  assert.equal((await sendDigest({ deps: mkDeps({ sendMail: async () => false }) })).skipped, true);
  assert.equal((await sendDigest({ deps: mkDeps({ readGrowth: async () => { throw new Error('db'); } }) })).skipped, true);
  assert.equal((await sendDigest({ deps: mkDeps({ readGrowth: async () => ({ priceDigest: { enabled: true, to: '' } }), shopEmail: async () => '' }) })).reason, 'no valid e-mail address');
  assert.equal((await sendDigest({ deps: mkDeps({ readGrowth: async () => ({ priceDigest: { enabled: true, to: '' } }) }) })).sent, true); // falls back to the shop e-mail
  assert.equal((await sendDigest({ force: true, deps: mkDeps({ readGrowth: async () => ({}) }) })).sent, true);
});
test('looksLikeEmail', () => { assert.ok(looksLikeEmail('a@b.co')); assert.ok(!looksLikeEmail('a@b')); assert.ok(!looksLikeEmail('a@b.co, c@d.co')); });

async function boot() {
  const db = fakeDb(); clearSiteFilesCache();
  const base = pool.query;
  pool.query = async (sql, p) => {
    if (String(sql).includes('FROM settings WHERE k = ?') && p[0] === 'site') return [[]];
    return base(sql, p);
  };
  const router = express.Router(); router.use(express.json());
  mountGrowthCheckRoutes(router, () => (req, res, next) => next(), { start: async () => {} });
  const app = express(); app.use(router);
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const call = (m, path, body) => fetch(`http://127.0.0.1:${srv.address().port}${path}`, { method: m, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }));
  return { db, srv, call };
}
test('digest settings route validates and merges the growth row', async () => {
  const { db, srv, call } = await boot();
  try {
    db.settings.set('growth', JSON.stringify({ googleFileName: 'keep.html' })); clearSiteFilesCache();
    assert.equal((await call('POST', '/growth/price-digest', { enabled: true, to: 'nope' })).status, 400);
    assert.equal((await call('POST', '/growth/price-digest', { enabled: true, to: '' })).status, 400);
    assert.equal((await call('POST', '/growth/price-digest', { enabled: false, to: 'bad' })).status, 400);
    const ok = await call('POST', '/growth/price-digest', { enabled: true, to: 'boss@x.com' });
    assert.equal(ok.status, 200); assert.equal(ok.body.enabled, true);
    const saved = JSON.parse(db.settings.get('growth'));
    assert.deepEqual(saved.priceDigest, { enabled: true, to: 'boss@x.com' }); assert.equal(saved.googleFileName, 'keep.html');
    const g = await call('GET', '/growth/price-digest');
    assert.equal(g.body.enabled, true); assert.equal(g.body.to, 'boss@x.com'); assert.equal(typeof g.body.mailReady, 'boolean');
  } finally { srv.close(); }
});
test('test-send answers 503 with the setup hint when mail is not set', async () => {
  const keep = process.env.SMTP_HOST; delete process.env.SMTP_HOST;
  const { srv, call } = await boot();
  try { const r = await call('POST', '/growth/price-digest/test'); assert.equal(r.status, 503); assert.match(r.body.error, /server\/\.env/); } finally { srv.close(); if (keep) process.env.SMTP_HOST = keep; }
});
test('unknown issue code is rejected', async () => {
  const { srv, call } = await boot();
  try { assert.equal((await call('GET', '/growth/price-checks?code=bogus')).status, 400); } finally { srv.close(); }
});
test('manual run: a second request within a minute is 429', async () => {
  const { srv, call } = await boot();
  const base = pool.query; pool.query = async (sql, p) => (String(sql).includes('growth_jobs') ? [{ affectedRows: 1, insertId: 5 }] : base(sql, p));
  try {
    _resetRunGap();
    const first = await call('POST', '/growth/price-checks/run');
    assert.equal(first.status, 200); assert.deepEqual(first.body, { queued: true, started: true });
    assert.equal((await call('POST', '/growth/price-checks/run')).status, 429);
  } finally { srv.close(); }
});

test('progress: percent grows with the work done and is 100 when the run has ended', async () => {
  const { startProgress, setProgress, endProgress, getProgress } = await import('../src/growth/progress.js');
  assert.equal(getProgress('price_check').running, false);
  startProgress('price_check', 0, 'Checking products');
  assert.equal(getProgress('price_check').percent, null); // total not known yet
  setProgress('price_check', 0, 200);
  assert.equal(getProgress('price_check').percent, 0);
  setProgress('price_check', 50);
  assert.equal(getProgress('price_check').percent, 25);
  setProgress('price_check', 200);
  assert.equal(getProgress('price_check').percent, 99); // never 100 before the run has really ended
  endProgress('price_check');
  const g = getProgress('price_check'); assert.equal(g.running, false); assert.equal(g.percent, 100); assert.ok(g.finishedAt);
});
