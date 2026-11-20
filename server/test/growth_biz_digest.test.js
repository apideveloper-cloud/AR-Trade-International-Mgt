import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { buildGrowthDigest, sendGrowthDigest, digestFromOverview } from '../src/growth/digest.js';
import { mountGrowthBusinessRoutes, _resetNapGap } from '../src/admin/growthBusiness.js';
import { fakeDb } from './growth_fake.js';
import { clearSiteFilesCache } from '../src/growth/siteFiles.js';

const OV = {
  search: { connected: true, clicks: 80, prevClicks: 100, impressions: 1000, prevImpressions: 900 },
  health: { reviews: { pending: 3, whatsappWaiting: 2 }, schema: { counts: { error: 4, warning: 1 } }, price: { total: 5 } },
  actions: Array.from({ length: 10 }, (_, i) => ({ id: 'a' + i, severity: i < 3 ? 'low' : 'high', title: 'Thing <' + i + '>', count: i }))
};
const mk = (o = {}) => { const sent = []; return { sent, loadOverview: async () => OV, readGrowth: async () => ({ growthDigest: { enabled: true, to: 'a@b.co' } }), mailReady: () => true, sendMail: async m => { sent.push(m); return true; }, origin: () => 'https://x.test', shopEmail: async () => 'shop@x.test', ...o }; };

test('digest content: top 8 by severity, counts, search change, escaped', async () => {
  const d = await buildGrowthDigest(mk());
  assert.equal(d.text.split('\n').filter(l => l.startsWith('- [')).length, 8); assert.match(d.text, /Clicks: 80 \(before: 100, -20%\)/); assert.match(d.text, /Impressions: 1,000/);
  assert.match(d.text, /Reviews waiting for approval: 3/); assert.match(d.text, /structured data errors: 4/); assert.match(d.text, /Price and stock issues: 5/); assert.match(d.text, /WhatsApp: 2/);
  assert.ok(d.text.indexOf('[high]') < d.text.indexOf('[low]')); assert.match(d.html, /Thing &lt;/); assert.match(d.subject, /8 things/); assert.match(d.text, /https:\/\/x\.test\/admin\/growth/);
  assert.equal(digestFromOverview({}, '').empty, true);
});
test('digest sends when enabled and ready, to the saved address then the shop e-mail', async () => {
  const d = mk(); const r = await sendGrowthDigest({ deps: d });
  assert.equal(r.sent, true); assert.equal(d.sent[0].to, 'a@b.co');
  const d2 = mk({ readGrowth: async () => ({ growthDigest: { enabled: true, to: '' } }) }); assert.equal((await sendGrowthDigest({ deps: d2 })).sent, true); assert.equal(d2.sent[0].to, 'shop@x.test');
  const d3 = mk(); assert.equal((await sendGrowthDigest({ force: true, to: 'z@y.co', deps: d3 })).sent, true); assert.equal(d3.sent[0].to, 'z@y.co');
});
test('digest skip paths never throw', async () => {
  assert.equal((await sendGrowthDigest({ deps: mk({ readGrowth: async () => ({}) }) })).reason, 'digest is turned off');
  assert.equal((await sendGrowthDigest({ deps: mk({ readGrowth: async () => ({ growthDigest: { enabled: false } }) }) })).skipped, true);
  assert.equal((await sendGrowthDigest({ deps: mk({ mailReady: () => false }) })).reason, 'mail is not set up');
  assert.equal((await sendGrowthDigest({ deps: mk({ readGrowth: async () => ({ growthDigest: { enabled: true, to: '' } }), shopEmail: async () => '' }) })).reason, 'no valid e-mail address');
  assert.equal((await sendGrowthDigest({ deps: mk({ loadOverview: async () => ({ actions: [], health: {}, search: { connected: false } }) }) })).reason, 'nothing to say');
  const f = await sendGrowthDigest({ deps: mk({ sendMail: async () => { throw new Error('smtp down'); } }) }); assert.equal(f.skipped, true); assert.equal(f.reason, 'mail failed');
  assert.equal((await sendGrowthDigest({ deps: mk({ sendMail: async () => false }) })).skipped, true);
  assert.equal((await sendGrowthDigest({ deps: mk({ readGrowth: async () => { throw new Error('db'); } }) })).skipped, true);
  assert.equal((await sendGrowthDigest({ deps: mk({ loadOverview: async () => { throw new Error('x'); } }) })).skipped, true);
});

async function boot() {
  const db = fakeDb(); clearSiteFilesCache(); _resetNapGap();
  db.settings.set('site', JSON.stringify({ email: 'shop@x.test', phone: '01977554401', address: '159, Santinagar, Dhaka-1217', keep: 1 }));
  const router = express.Router(); router.use(express.json());
  const seen = [];
  mountGrowthBusinessRoutes(router, perm => (req, res, next) => { seen.push(perm); req.staff = { name: 'T' }; next(); });
  const app = express(); app.use(router);
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const call = (m, path, body) => fetch(`http://127.0.0.1:${srv.address().port}${path}`, { method: m, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }));
  return { db, srv, call, seen };
}
test('routes: business read/save, gbp, digest settings and validators', async () => {
  const keep = { h: process.env.SMTP_HOST, q: process.env.SMTP_QUOTE_USER };
  delete process.env.SMTP_HOST;
  const { db, srv, call, seen } = await boot();
  try {
    let r = await call('GET', '/growth/business');
    assert.equal(r.status, 200); assert.equal(r.body.info.phone, '01977554401'); assert.equal(r.body.gbp.checklist.length, 11); assert.match(r.body.copy.text, /Phone: 01977554401/); assert.deepEqual(r.body.nap, { at: null, issues: 0, rows: [] });
    r = await call('POST', '/growth/business', { phone: 'abc' }); assert.equal(r.status, 400);
    r = await call('POST', '/growth/business', { phone: '+880 1711-111222', geoLat: 23.7 });
    assert.equal(r.status, 200); assert.equal(r.body.info.phone, '+880 1711-111222'); assert.equal(JSON.parse(db.settings.get('site')).keep, 1); assert.equal(JSON.parse(db.settings.get('seo')).business.geoLat, 23.7);
    assert.ok(seen.includes('settings.manage') && seen.includes('seo.manage'));
    r = await call('POST', '/growth/business/gbp', { reviewLink: 'http://x.com' }); assert.equal(r.status, 400);
    r = await call('POST', '/growth/business/gbp', { reviewLink: 'https://g.page/r/x/review', checklist: { claim: true } }); assert.equal(r.status, 200); assert.equal(r.body.gbp.reviewLink, 'https://g.page/r/x/review');
    r = await call('GET', '/growth/digest'); assert.deepEqual([r.body.enabled, r.body.mailReady, r.body.shopEmail], [false, false, 'shop@x.test']); assert.ok(r.body.hint);
    r = await call('POST', '/growth/digest', { enabled: true, to: 'nope' }); assert.equal(r.status, 400);
    r = await call('POST', '/growth/digest', { enabled: true, to: 'o@x.co' }); assert.equal(r.status, 200); assert.equal(JSON.parse(db.settings.get('growth')).growthDigest.to, 'o@x.co');
    r = await call('POST', '/growth/digest/test', {}); assert.equal(r.status, 503); assert.ok(r.body.error);
    r = await call('POST', '/growth/digest/test', { to: 'bad' }); assert.equal(r.status, 400);
  } finally { srv.close(); if (keep.h !== undefined) process.env.SMTP_HOST = keep.h; if (keep.q !== undefined) process.env.SMTP_QUOTE_USER = keep.q; }
});
