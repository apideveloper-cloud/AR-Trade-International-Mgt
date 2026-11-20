import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILTERS, SORTS, ACTIONS, MAX_AFFECTED, CHUNK, whereFor, orderFor, parseListQuery, issueCount, rowOut, summaryOut, cleanIds, parseBulkBody, chunk,
  pickAffected, changeText, dryRunOut, planAltFills, autoTexts, scoreProductRow, dupMap, groupBy, aggregateIssues, groupDuplicates, brandStats, sitemapBrandCount,
  TITLE_SET_SQL, DESC_SET_SQL
} from '../src/admin/seoBulkMap.js';
import { mergeSeoSettings } from '../src/seoSettings.js';

const throws400 = fn => assert.throws(fn, e => e.status === 400);

test('every filter name builds a condition and an unknown one is a 400', () => {
  assert.deepEqual(FILTERS, ['all', 'missing_title', 'missing_desc', 'low_score', 'missing_gtin', 'alt_missing', 'noindex', 'unscored']);
  assert.deepEqual(whereFor({ filter: 'all' }), { where: '', params: [] });
  assert.deepEqual(whereFor({}), { where: '', params: [] });
  for (const f of FILTERS.slice(1)) assert.match(whereFor({ filter: f }).where, /^WHERE /, f);
  assert.match(whereFor({ filter: 'low_score' }).where, /seo_score < 50/);
  assert.match(whereFor({ filter: 'unscored' }).where, /seo_score IS NULL/);
  assert.match(whereFor({ filter: 'noindex' }).where, /noindex = 1/);
  assert.match(whereFor({ filter: 'missing_title' }).where, /NOT \(/);
  throws400(() => whereFor({ filter: 'drop table' }));
});
test('hand-written title / description SQL uses the same patterns as isAutoTitle / isAutoDesc', () => {
  assert.match(TITLE_SET_SQL, /AR Trade\( International\)\?\$/);
  assert.match(DESC_SET_SQL, /Genuine, fast delivery/);
});
test('search and category are parameterised', () => {
  const w = whereFor({ filter: 'noindex', q: ' toner ', cat: 'ink' });
  assert.equal(w.params.filter(p => p === '%toner%').length, 5);
  assert.equal(w.params[5], 'ink');
  assert.match(w.where, /LIKE \?.*category_id = \?/);
  assert.ok(!w.where.includes('toner'));
});
test('sort whitelist, direction and unscored last', () => {
  assert.deepEqual(SORTS, ['id', 'name', 'score', 'updated']);
  assert.equal(orderFor('id', 'asc'), 'p.id ASC, p.id ASC');
  assert.equal(orderFor('name', 'desc'), 'p.name DESC, p.id DESC');
  assert.match(orderFor('score', 'asc'), /^m\.seo_score IS NULL ASC, m\.seo_score ASC/);
  assert.match(orderFor('score', 'desc'), /^m\.seo_score IS NULL ASC, m\.seo_score DESC/);
  assert.match(orderFor('updated'), /p\.updated_at/);
  assert.equal(orderFor(undefined, 'sideways'), 'p.id DESC, p.id DESC');
  throws400(() => orderFor('price; drop', 'asc'));
});
test('list query is clamped: size 10..100 default 25, page >= 1', () => {
  assert.deepEqual(parseListQuery({}), { q: '', cat: '', filter: 'all', sort: 'id', dir: 'desc', size: 25, page: 1, offset: 0 });
  assert.equal(parseListQuery({ size: '5' }).size, 10);
  assert.equal(parseListQuery({ size: '9999' }).size, 100);
  assert.equal(parseListQuery({ size: 'x' }).size, 25);
  const p = parseListQuery({ page: '3', size: '50', dir: 'ASC', sort: 'score', filter: 'low_score', q: ' a ' });
  assert.equal(p.offset, 100); assert.equal(p.dir, 'asc'); assert.equal(p.q, 'a');
  assert.equal(parseListQuery({ page: '-4' }).page, 1);
  throws400(() => parseListQuery({ filter: 'nope' }));
  throws400(() => parseListQuery({ sort: 'nope' }));
});
test('issueCount counts non-pass issues and survives bad JSON', () => {
  assert.equal(issueCount(JSON.stringify([{ level: 'pass' }, { level: 'warn' }, { level: 'fail' }])), 2);
  assert.equal(issueCount([{ level: 'fail' }]), 1);
  assert.equal(issueCount('{oops'), 0);
  assert.equal(issueCount(null), 0);
});
test('rowOut shapes a list row and decides the index status', () => {
  const base = { id: 7, name: 'Toner', sku: 'S1', slug: 'toner-7', img: '/a.jpg', category_id: 'ink', cat_title: 'Ink', brand: 'HP', price: 100, seo_score: 80, seo_issues: '[{"level":"warn"}]', title_set: 1, desc_set: 0, gtin_set: 1, alt_missing: '2', image_count: '3', noindex: 0 };
  const r = rowOut(base, true);
  assert.deepEqual(r, { id: 7, name: 'Toner', sku: 'S1', slug: 'toner-7', url: '/product/toner-7', thumb: '/a.jpg', cat: 'ink', catTitle: 'Ink', brand: 'HP', price: 100, live: true, score: 80, titleSet: true, descSet: false, indexStatus: 'indexed', issues: 1, gtin: true, altMissing: 2, imageCount: 3 });
  assert.equal(rowOut({ ...base, noindex: 1 }, true).indexStatus, 'noindex');
  assert.equal(rowOut({ ...base, noindex: 1 }, false).indexStatus, 'hidden');
  const u = rowOut({ ...base, seo_score: null, seo_issues: null }, true);
  assert.equal(u.score, null); assert.equal(u.issues, 0);
  assert.equal(rowOut({ id: 1 }, true).url, '/product/1');
});
test('summaryOut turns SQL sums (strings, nulls) into numbers', () => {
  assert.deepEqual(summaryOut({ total: '5', missing_title: '2', missing_desc: null, low_score: 1, missing_gtin: '0', alt_missing: '3', noindex: '1', unscored: '4' }),
    { total: 5, missingTitle: 2, missingDesc: 0, lowScore: 1, missingGtin: 0, altMissing: 3, noindex: 1, unscored: 4 });
  assert.equal(summaryOut(null).total, 0);
});
test('cleanIds validates, de-duplicates and caps at 3000', () => {
  assert.deepEqual(cleanIds([3, '4', 3]), [3, 4]);
  for (const b of [[0], [-1], [1.5], ['x'], [null], [{}], [], 'nope', [2147483648]]) throws400(() => cleanIds(b));
  assert.equal(cleanIds(Array.from({ length: MAX_AFFECTED }, (_, i) => i + 1)).length, 3000);
  assert.throws(() => cleanIds(Array.from({ length: MAX_AFFECTED + 1 }, (_, i) => i + 1)), e => e.status === 400 && /3000/.test(e.message));
});
test('parseBulkBody: exactly one of ids / scope, known action, boolean dryRun', () => {
  assert.deepEqual(parseBulkBody({ action: 'noindex', ids: [1, 2] }), { action: 'noindex', ids: [1, 2], scope: null, dryRun: false });
  assert.deepEqual(parseBulkBody({ action: 'recalculate', scope: { filter: 'unscored', q: ' x ', cat: 'c' }, dryRun: true }), { action: 'recalculate', ids: null, scope: { filter: 'unscored', q: 'x', cat: 'c' }, dryRun: true });
  assert.equal(parseBulkBody({ action: 'index', scope: {} }).scope.filter, 'all');
  for (const a of ACTIONS) assert.equal(parseBulkBody({ action: a, ids: [1] }).action, a);
  throws400(() => parseBulkBody({ action: 'delete', ids: [1] }));
  throws400(() => parseBulkBody({ ids: [1] }));
  throws400(() => parseBulkBody(null));
  throws400(() => parseBulkBody({ action: 'noindex' }));
  throws400(() => parseBulkBody({ action: 'noindex', ids: [1], scope: {} }));
  throws400(() => parseBulkBody({ action: 'noindex', scope: { filter: 'zzz' } }));
  throws400(() => parseBulkBody({ action: 'noindex', scope: [] }));
  throws400(() => parseBulkBody({ action: 'noindex', ids: [1], dryRun: 'yes' }));
});
test('chunk splits into pieces of 200 by default', () => {
  assert.equal(CHUNK, 200);
  const parts = chunk(Array.from({ length: 450 }, (_, i) => i));
  assert.deepEqual(parts.map(p => p.length), [200, 200, 50]);
  assert.deepEqual(chunk([]), []);
  assert.deepEqual(chunk([1, 2, 3], 2), [[1, 2], [3]]);
  assert.deepEqual(chunk([1, 2], 0).length, 1);
});
test('pickAffected: which selected products each action really changes', () => {
  const sel = [
    { id: 1, name: 'A', noindex: 0, ts: 1, ds: 0, kw: 0, alt_missing: 0 },
    { id: 2, name: 'B', noindex: 1, ts: 0, ds: 0, kw: 0, alt_missing: 2 },
    { id: 3, name: 'C', noindex: 0, ts: 0, ds: 1, kw: 1, alt_missing: 1 }
  ];
  const ids = a => pickAffected(a, sel).affected.map(r => r.id);
  assert.deepEqual(ids('reset_template'), [1, 3]);
  assert.deepEqual(ids('noindex'), [1, 3]);
  assert.deepEqual(ids('index'), [2]);
  assert.deepEqual(ids('alt_autofill'), [2, 3]);
  assert.deepEqual(ids('recalculate'), [1, 2, 3]);
  assert.equal(pickAffected('index', sel).skipped, 2);
  assert.throws(() => pickAffected('x', sel));
});
test('dry run: affected count and at most 8 samples with a change text', () => {
  const sel = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: 'P' + i, noindex: 0, ts: 1, ds: 0, kw: 1, alt_missing: 1 }));
  const d = dryRunOut('reset_template', sel);
  assert.equal(d.dryRun, true); assert.equal(d.affected, 20); assert.equal(d.samples.length, 8);
  assert.deepEqual(Object.keys(d.samples[0]), ['id', 'name', 'change']);
  assert.match(d.samples[0].change, /title, keywords cleared/);
  assert.match(changeText('alt_autofill', { alt_missing: 1 }), /1 empty image alt text will/);
  assert.match(changeText('alt_autofill', { alt_missing: 3 }), /3 empty image alt texts/);
  assert.match(changeText('noindex', {}), /noindex/);
  assert.match(changeText('index', {}), /index/);
  assert.match(changeText('recalculate', {}), /recalculated/);
  assert.deepEqual(dryRunOut('index', sel), { dryRun: true, affected: 0, samples: [] });
});
test('planAltFills fills only empty alts with the phase 2 rule', () => {
  const plan = planAltFills([{ id: 1, alt: '' }, { id: 2, alt: 'kept' }, { id: 3, alt: null }, { id: 4, alt: '  ' }], 'Toner X', 'HP');
  assert.deepEqual(plan, [{ id: 1, alt: 'Toner X - HP' }, { id: 3, alt: 'Toner X - view 3' }, { id: 4, alt: 'Toner X - view 4' }]);
  assert.deepEqual(planAltFills([{ id: 9, alt: 'ok' }], 'N', ''), []);
  assert.deepEqual(planAltFills([{ id: 9, alt: '' }], 'N', ''), [{ id: 9, alt: 'N' }]);
  assert.deepEqual(planAltFills(null, 'N', 'B'), []);
});

const settings = mergeSeoSettings(null);
const goodRow = { id: 1, name: 'HP 12A Black Toner Cartridge', slug: 'hp-12a', brand: 'HP', part: 'Q2612A', gtin: null, price: 4500, stock: 5, description: '<p>' + 'word '.repeat(300) + '</p>', category_title: 'Toner', meta_title: '', meta_desc: '', noindex: 0 };
test('autoTexts renders the template within the limits', () => {
  const a = autoTexts(goodRow, settings);
  assert.ok(a.title.length > 0 && a.title.length <= 60);
  assert.ok(a.description.length <= 155);
});
test('scoreProductRow scores from batch data without a database', () => {
  const imgs = [{ path: '/a.jpg', alt: 'x', width: 1000, height: 800 }];
  const r = scoreProductRow(goodRow, {}, imgs, settings, {});
  assert.ok(r.score >= 0 && r.score <= 100);
  const ids = Object.fromEntries(r.issues.map(i => [i.id, i.level]));
  assert.equal(ids.body_words, 'pass'); assert.equal(ids.image_alt, 'pass'); assert.equal(ids.noindex, 'pass'); assert.equal(ids.gtin_mpn, 'pass');
  const noimg = scoreProductRow(goodRow, {}, [], settings, {});
  assert.equal(Object.fromEntries(noimg.issues.map(i => [i.id, i.level])).has_image, 'fail');
  assert.ok(noimg.score < r.score);
  const noindexed = scoreProductRow({ ...goodRow, noindex: 1 }, {}, imgs, settings, {});
  assert.equal(Object.fromEntries(noindexed.issues.map(i => [i.id, i.level])).noindex, 'fail');
});
test('scoreProductRow: duplicate counts exclude the product itself and use the hand-written text', () => {
  const row = { ...goodRow, meta_title: 'Same hand written title that is long enough' };
  const lvl = dup => Object.fromEntries(scoreProductRow(row, {}, [], settings, dup).issues.map(i => [i.id, i.level])).title_unique;
  assert.equal(lvl({ titles: dupMap([{ t: row.meta_title, n: 1 }]) }), 'pass');
  assert.equal(lvl({ titles: dupMap([{ t: row.meta_title.toUpperCase(), n: 2 }]) }), 'fail');
  assert.equal(lvl({}), 'pass');
  // a title that is only generated ("| AR Trade") is not hand-written: no duplicate check
  const auto = { ...goodRow, meta_title: 'Toner | AR Trade' };
  assert.equal(Object.fromEntries(scoreProductRow(auto, {}, [], settings, { titles: dupMap([{ t: 'Toner | AR Trade', n: 9 }]) }).issues.map(i => [i.id, i.level])).title_unique, 'pass');
  // a seo_meta title counts as hand-written
  const m = scoreProductRow(goodRow, { meta_title: 'Meta Row Title Which Is Long Enough Ok' }, [], settings, { titles: dupMap([{ t: 'Meta Row Title Which Is Long Enough Ok', n: 2 }]) });
  assert.equal(Object.fromEntries(m.issues.map(i => [i.id, i.level])).title_unique, 'fail');
});
test('dupMap and groupBy', () => {
  const m = dupMap([{ t: 'A ', n: 1 }, { t: 'a', n: '2' }, { t: '', n: 5 }]);
  assert.equal(m.get('a'), 3); assert.equal(m.size, 1);
  const g = groupBy([{ k: 1, v: 'a' }, { k: 2, v: 'b' }, { k: 1, v: 'c' }], 'k');
  assert.deepEqual(g.get(1).map(r => r.v), ['a', 'c']);
  assert.equal(groupBy(null, 'k').size, 0);
});
test('aggregateIssues counts warn and fail per issue id, biggest first', () => {
  const j = (...a) => ({ seo_issues: JSON.stringify(a.map(([id, level]) => ({ id, level }))) });
  const out = aggregateIssues([
    j(['title_length', 'warn'], ['image_alt', 'fail'], ['price', 'pass']),
    j(['title_length', 'warn'], ['image_alt', 'warn']),
    j(['title_length', 'fail']),
    { seo_issues: 'broken' }, { seo_issues: null }
  ]);
  assert.deepEqual(out.map(i => [i.id, i.count, i.level]), [['title_length', 3, 'fail'], ['image_alt', 2, 'fail']]);
  assert.equal(out[0].label, 'Title length');
  assert.equal(out[0].warns, 2); assert.equal(out[0].fails, 1);
  assert.equal(aggregateIssues([j(['desc_length', 'warn'])])[0].level, 'warn');
  assert.deepEqual(aggregateIssues([]), []);
  assert.equal(aggregateIssues([j(['zzz_new', 'fail'])])[0].label, 'zzz_new');
});
test('groupDuplicates finds shared hand-written titles and descriptions', () => {
  const rows = [
    { id: 1, t: 'Same Title', d: 'Desc one' }, { id: 2, t: ' same title ', d: 'Desc two' }, { id: 3, t: 'Same Title', d: 'desc one' },
    { id: 4, t: 'Unique', d: '' }, { id: 5, t: '', d: '' }
  ];
  const d = groupDuplicates(rows);
  assert.equal(d.titles, 1); assert.equal(d.descriptions, 1);
  assert.deepEqual(d.samples.map(s => [s.kind, s.ids]), [['title', [1, 2, 3]], ['description', [1, 3]]]);
  assert.equal(d.samples[0].text, 'Same Title');
  const many = Array.from({ length: 14 }, (_, i) => ({ id: i, t: 'T' + (i >> 1), d: '' }));
  assert.equal(groupDuplicates(many).samples.length, 5);
  assert.equal(groupDuplicates(many).titles, 7);
  assert.deepEqual(groupDuplicates([]), { titles: 0, descriptions: 0, samples: [] });
  assert.equal(groupDuplicates([{ id: 1, t: 'x', d: '' }]).titles, 0);
  const big = Array.from({ length: 30 }, (_, i) => ({ id: i, t: 'S', d: '' }));
  assert.equal(groupDuplicates(big).samples[0].ids.length, 20);
});
test('brandStats and sitemapBrandCount', () => {
  const rows = [{ indexable: true, hidden: false, products: 9 }, { indexable: false, hidden: false, products: 1 }, { indexable: false, hidden: true, products: 5 }];
  assert.deepEqual(brandStats(rows), { total: 3, indexed: 1, thin: 1, hidden: 1 });
  assert.deepEqual(brandStats(null), { total: 0, indexed: 0, thin: 0, hidden: 0 });
  const prods = ['HP', 'HP', 'hp', 'Canon', 'Canon', 'Ricoh Co', 'Ricoh Co', 'Ricoh Co'].map(brand => ({ brand }));
  const brands = [{ slug: 'hp', hidden: 0 }, { slug: 'canon', hidden: 0 }, { slug: 'ricoh-co', hidden: 1 }, { slug: 'none', hidden: 0 }];
  assert.equal(sitemapBrandCount(brands, prods), 1);
});
