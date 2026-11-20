import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { runSchemaCheck, schemaSummary, ensureSchemaChecks, listPages, STATIC_PAGES } from '../src/growth/schemaCheck.js';
import { mountGrowthSchemaRoutes, parseFilters, _resetRunGap } from '../src/admin/growthSchema.js';
import { pool } from '../src/db.js';

const GOOD = [{ '@type': 'Product', name: 'T', image: 'i', sku: 's', brand: 'b', offers: { price: '1', priceCurrency: 'BDT', availability: 'https://schema.org/InStock' } }];
const BAD = [{ '@type': 'Product', name: 'T' }]; // image, offers

/** In-memory stand-in for the few queries of the checker. */
function fake({ products = [], categories = [], posts = [], brands = [], services = [], throwOn = [] } = {}) {
  const log = [], inserted = [];
  const query = async (sql, p = []) => {
    const s = String(sql); log.push(s.replace(/\s+/g, ' ').slice(0, 60));
    for (const t of throwOn) if (s.includes(t)) throw new Error('boom ' + t);
    if (s.startsWith('CREATE TABLE')) return [];
    if (s.includes('FROM categories')) return categories;
    if (s.includes('FROM brands')) return brands;
    if (s.includes('FROM blog_posts')) return posts.slice(0, p[0]);
    if (s.includes('FROM site_pages')) return services;
    if (s.includes('FROM settings')) return [{ v: JSON.stringify({ policies: [{ k: 'returns' }] }) }];
    if (s.includes('FROM products')) return products.filter(x => x.id > p[0]).slice(0, p[1]);
    if (s.startsWith('INSERT INTO growth_schema_issues')) { inserted.push(...p[0]); return { affectedRows: p[0].length }; }
    return [];
  };
  return { query, log, inserted };
}
const prods = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, slug: 'p-' + (i + 1), name: 'P' + (i + 1) }));

test('creates both tables lazily with the required columns', async () => {
  const f = fake();
  await ensureSchemaChecks(f.query);
  assert.equal(f.log.filter(l => l.startsWith('CREATE TABLE')).length, 2);
});

test('checks static pages, categories, brands, posts, services, policies and products; counts severities', async () => {
  const f = fake({ products: prods(3), categories: [{ id: 7 }], brands: [{ slug: 'hp' }], posts: [{ slug: 'a b' }], services: [{ slug: 'repair' }] });
  const seen = [];
  const preview = async path => { seen.push(path); return { status: 200, ld: path === '/product/p-2' ? BAD : GOOD }; };
  const r = await runSchemaCheck({ query: f.query, preview, yieldFn: async () => {} });
  const pages = STATIC_PAGES.length + 5; // + category, brand, post, service, policy
  assert.equal(r.checked, pages + 3);
  for (const u of ['/', '/shop', '/blog', '/shop/7', '/brand/hp', '/blog/a%20b', '/services/repair', '/policy/returns', '/product/p-1', '/product/p-3']) assert.ok(seen.includes(u), u);
  assert.equal(r.errors, 2); assert.equal(r.byCode.product_image_missing, 1); assert.equal(r.byCode.product_offers_missing, 1); assert.equal(r.warnings, 2); // brand + identifier
  const prodRows = f.inserted.filter(x => x[1] === 'product');
  assert.equal(prodRows.length, 4);
  assert.ok(prodRows.every(x => x[2] === 2 && x[0] === '/product/p-2'));
  assert.ok(f.log.some(l => l.startsWith('INSERT INTO growth_schema_runs')));
});

test('non-200 and redirected pages and render errors are skipped, not reported', async () => {
  const f = fake({ products: prods(3) });
  const preview = async path => {
    if (path === '/product/p-1') return { status: 404, ld: [] };
    if (path === '/product/p-2') return { status: 301, redirect: '/product/x', ld: [] };
    if (path === '/product/p-3') throw new Error('render failed');
    return { status: 200, ld: GOOD };
  };
  const r = await runSchemaCheck({ query: f.query, preview, yieldFn: async () => {} });
  assert.equal(r.errors, 0); assert.equal(f.inserted.filter(x => x[1] === 'product').length, 0);
});

test('products: batches of the given size, issues replaced per batch, yields between batches', async () => {
  const f = fake({ products: prods(5) });
  let yields = 0;
  const r = await runSchemaCheck({ query: f.query, batch: 2, preview: async () => ({ status: 200, ld: BAD }), yieldFn: async () => { yields++; } });
  assert.equal(r.checked, STATIC_PAGES.length + 1 + 5); // + the policy page of the fake settings
  const dels = f.log.filter(l => l.startsWith('DELETE FROM growth_schema_issues WHERE product_id IN'));
  assert.equal(dels.length, 3); // 2 + 2 + 1
  assert.ok(yields >= 2);
  assert.ok(f.log.some(l => l.startsWith('DELETE FROM growth_schema_issues WHERE found_at <'))); // stale rows go at the end
});

test('cap stops the run and keeps old rows (no stale cleanup)', async () => {
  const f = fake({ products: prods(50) });
  const preview = async () => ({ status: 200, ld: GOOD });
  const r = await runSchemaCheck({ query: f.query, batch: 10, cap: STATIC_PAGES.length + 12, preview, yieldFn: async () => {} });
  assert.equal(r.checked, STATIC_PAGES.length + 12);
  assert.ok(!f.log.some(l => l.startsWith('DELETE FROM growth_schema_issues WHERE found_at <')));
  const small = await runSchemaCheck({ query: fake().query, cap: 3, preview, yieldFn: async () => {} });
  assert.equal(small.checked, 3);
});

test('a missing optional table (brands, blog) does not stop the run', async () => {
  const f = fake({ products: prods(1), throwOn: ['FROM brands', 'FROM blog_posts', 'FROM site_pages'] });
  const r = await runSchemaCheck({ query: f.query, preview: async () => ({ status: 200, ld: GOOD }), yieldFn: async () => {} });
  assert.ok(r.checked >= STATIC_PAGES.length + 1);
  assert.deepEqual((await listPages(f.query)).filter(p => p.kind === 'brand'), []);
});

test('latest 50 blog posts only', async () => {
  const f = fake({ posts: Array.from({ length: 80 }, (_, i) => ({ slug: 'b' + i })) });
  assert.equal((await listPages(f.query)).filter(p => p.kind === 'post').length, 50);
});

test('an empty run still writes a run row', async () => {
  const f = fake();
  const r = await runSchemaCheck({ query: f.query, preview: async () => ({ status: 404 }), yieldFn: async () => {} });
  assert.equal(r.errors, 0); assert.equal(r.warnings, 0);
  assert.ok(f.log.some(l => l.startsWith('INSERT INTO growth_schema_runs')));
});

test('schemaSummary shape, labels and never throws', async () => {
  const query = async sql => {
    if (sql.includes('growth_schema_runs')) return [{ at: new Date('2026-11-20T00:00:00Z'), checked: 100, errors: 3, warnings: 7, ms: 900 }];
    if (sql.includes('COUNT(DISTINCT url)')) return [{ n: 2 }];
    return [{ code: 'product_image_missing', severity: 'error', n: 3 }, { code: 'product_brand_missing', severity: 'warning', n: 7 }];
  };
  const s = await schemaSummary(query);
  assert.deepEqual(s.counts, { error: 3, warning: 7 });
  assert.equal(s.lastRun.checked, 100); assert.equal(s.lastRun.at, '2026-11-20T00:00:00.000Z');
  assert.equal(s.byCode[0].code, 'product_image_missing'); assert.ok(s.byCode[0].label.length > 5); assert.equal(s.pagesWithErrors, 2);
  const empty = await schemaSummary(async () => { throw new Error("Table doesn't exist"); });
  assert.deepEqual(empty, { lastRun: null, counts: { error: 0, warning: 0 }, byCode: [] });
});

test('parseFilters validates and clamps', () => {
  assert.deepEqual(parseFilters({}), { severity: '', code: '', kind: '', limit: 15, page: 1 });
  assert.equal(parseFilters({ limit: '500' }).limit, 100); assert.equal(parseFilters({ limit: '0' }).limit, 1); assert.equal(parseFilters({ limit: 'x' }).limit, 15);
  assert.equal(parseFilters({ page: '-3' }).page, 1);
  assert.equal(parseFilters({ severity: 'error', code: 'no_ld', kind: 'product' }).code, 'no_ld');
  for (const q of [{ severity: 'bad' }, { code: 'nope' }, { kind: 'nope' }]) assert.throws(() => parseFilters(q), e => e.status === 400);
});

async function boot(handler, deps = {}) {
  const orig = pool.query; pool.query = handler;
  const router = express.Router(); router.use(express.json());
  mountGrowthSchemaRoutes(router, () => (req, res, next) => next(), deps);
  const app = express(); app.use(router);
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const call = (m, path) => fetch(`http://127.0.0.1:${srv.address().port}${path}`, { method: m }).then(async r => ({ status: r.status, body: await r.json() }));
  return { call, close: () => { srv.close(); pool.query = orig; } };
}

test('GET /growth/schema-checks lists, joins labels and paginates; bad filters are 400', async () => {
  const seen = [];
  const t = await boot(async (sql, p) => {
    seen.push([sql, p]);
    if (sql.includes('growth_schema_runs')) return [[{ at: new Date('2026-11-20T00:00:00Z'), checked: 10, errors: 1, warnings: 0, ms: 5 }]];
    if (sql.includes('COUNT(DISTINCT')) return [[{ n: 1 }]];
    if (sql.includes('GROUP BY code')) return [[{ code: 'product_image_missing', severity: 'error', n: 1 }]];
    if (sql.includes('COUNT(*) AS n FROM growth_schema_issues')) return [[{ n: 31 }]];
    if (sql.includes('FROM growth_schema_issues i')) return [[{ url: '/product/a', kind: 'product', product_id: 5, type: 'Product', severity: 'error', code: 'product_image_missing', detail: 'd', found_at: new Date('2026-11-20T01:00:00Z'), name: 'Toner' }]];
    throw new Error('unexpected ' + sql);
  });
  try {
    const r = await t.call('GET', '/growth/schema-checks?severity=error&kind=product&limit=10&page=9');
    assert.equal(r.status, 200);
    assert.equal(r.body.total, 31); assert.equal(r.body.pages, 4); assert.equal(r.body.page, 4);
    assert.equal(r.body.rows[0].productName, 'Toner'); assert.equal(r.body.rows[0].productId, 5);
    assert.ok(r.body.rows[0].label && r.body.rows[0].hint);
    assert.ok(r.body.byCode[0].hint); assert.equal(r.body.counts.error, 1); assert.equal(r.body.lastRun.checked, 10);
    const last = seen.at(-1); assert.deepEqual(last[1], ['error', 'product', 10, 30]);
    assert.equal((await t.call('GET', '/growth/schema-checks?code=zzz')).status, 400);
    assert.equal((await t.call('GET', '/growth/schema-checks?severity=x')).status, 400);
    assert.equal((await t.call('GET', '/growth/schema-checks?kind=x')).status, 400);
  } finally { t.close(); }
});

test('GET with missing tables answers an empty list', async () => {
  const t = await boot(async () => { throw new Error("Table doesn't exist"); });
  try {
    const r = await t.call('GET', '/growth/schema-checks');
    assert.equal(r.status, 200); assert.equal(r.body.total, 0); assert.deepEqual(r.body.rows, []); assert.equal(r.body.lastRun, null); assert.equal(r.body.pages, 1);
  } finally { t.close(); }
});

test('POST run starts the check at once, a second call within a minute is 429, a running check is reported', async () => {
  _resetRunGap();
  let started = 0;
  const t = await boot(async () => [{}], { start: async () => { started++; } });
  try {
    assert.deepEqual((await t.call('POST', '/growth/schema-checks/run')).body, { queued: true, started: true });
    assert.equal(started, 1);
    assert.equal((await t.call('POST', '/growth/schema-checks/run')).status, 429);
    _resetRunGap();
    const { startProgress, endProgress } = await import('../src/growth/progress.js');
    startProgress('schema_check', 10, 'x');
    const r = await t.call('POST', '/growth/schema-checks/run');
    assert.equal(r.body.queued, false); assert.ok(r.body.message); assert.equal(started, 1);
    endProgress('schema_check');
  } finally { t.close(); _resetRunGap(); }
});
