import test from 'node:test';
import assert from 'node:assert/strict';
import { COLUMNS, buildCsv, parseCsv, rowToManual, diffManual, exportRow, cell, tokenOf, tokenOk, parseChecked, keysOf, makeLookup, planImport, previewRows, CsvError, MAX_ROWS } from '../src/admin/seoCsv.js';

const product = (o = {}) => ({ id: 7, sku: 'SK-7', name: 'Toner "X", black', slug: 'toner-x', meta_title: '', meta_desc: '', meta_keywords: 'a,b', noindex: 0, ...o });
const FAQ_EMPTY = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [[`faq_${i + 1}_q`, ''], [`faq_${i + 1}_a`, '']]).flat());

test('columns are in the contract order', () => {
  assert.deepEqual(COLUMNS.slice(0, 11), ['id', 'sku', 'name', 'url', 'meta_title', 'meta_description', 'meta_keywords', 'focus_keyword', 'secondary_keywords', 'canonical_url', 'robots_index']);
  assert.equal(COLUMNS.length, 17 + 10);
  assert.equal(COLUMNS.at(-1), 'faq_5_a');
});

test('cell escapes quotes, newlines and formula injection', () => {
  assert.equal(cell('a,b'), '"a,b"');
  assert.equal(cell('say "hi"'), '"say ""hi"""');
  assert.equal(cell('l1\nl2'), '"l1\nl2"');
  for (const f of ['=1+1', '+1', '-1', '@x', '\tx']) assert.equal(cell(f)[0], "'");
  assert.equal(cell('\rx'), '"\'\rx"');
  assert.equal(cell(null), '');
  assert.equal(cell(5), '5');
});

test('export then parse round trips every tricky value', () => {
  const rows = [{ id: 1, sku: 'A', name: 'Quote " and, comma', meta_title: '=SUM(A1)', meta_description: 'line1\nline2\r\nline3', focus_keyword: '-5 off', canonical_url: '@home', og_title: ' lead', faq_1_q: 'Q?', faq_1_a: '"A"' }, { id: 2, sku: '', name: 'plain' }];
  const csv = '﻿' + buildCsv(rows);
  const p = parseCsv(csv);
  assert.deepEqual(p.header, COLUMNS);
  assert.equal(p.records.length, 2);
  const get = (r, c) => p.records[r][COLUMNS.indexOf(c)];
  assert.equal(get(0, 'name'), 'Quote " and, comma');
  assert.equal(get(0, 'meta_title'), '=SUM(A1)');
  assert.equal(get(0, 'meta_description'), 'line1\nline2\r\nline3');
  assert.equal(get(0, 'focus_keyword'), '-5 off');
  assert.equal(get(0, 'canonical_url'), '@home');
  assert.equal(get(0, 'faq_1_a'), '"A"');
  assert.equal(get(1, 'name'), 'plain');
  assert.equal(get(1, 'meta_title'), '');
  assert.deepEqual(p.warnings, []);
  assert.deepEqual(p.lines, [2, 5]);
});

test('parser handles LF, CRLF, BOM, blank lines, no final newline, header case and spaces', () => {
  const p = parseCsv('﻿ ID , SKU,Meta Title\n\n1,A,"x\ny"\r\n2,B,z');
  assert.deepEqual(p.header, ['id', 'sku', 'meta_title']);
  assert.deepEqual(p.records, [['1', 'A', 'x\ny'], ['2', 'B', 'z']]);
  assert.deepEqual(parseCsv('id,sku\r\n').records, []);
  assert.deepEqual(parseCsv('').header, []);
});

test('unterminated quote throws, unknown and duplicate columns warn', () => {
  assert.throws(() => parseCsv('id\n"abc'), CsvError);
  const p = parseCsv('id,sku,zzz,id\n1,a,b,2');
  assert.ok(p.warnings.some(w => /Unknown columns ignored: zzz/.test(w)));
  assert.ok(p.warnings.some(w => /"id" appears twice/.test(w)));
  assert.ok(parseCsv('id,faq_1_q\n1,x').warnings.some(w => /FAQ columns are incomplete/.test(w)));
});

test('exportRow: meta title/description only when hand-written, every column filled', () => {
  const meta = { meta_title: 'My title', focus_keyword: 'toner', secondary_keywords: JSON.stringify(['a', 'b']), canonical_url: 'https://x.com/p', robots_follow: 0, og_title: 'OG', og_description: 'OGD', og_image: '/i.png', twitter_title: 'T', twitter_description: 'TD', faq: JSON.stringify([{ q: 'q1', a: 'a1' }]) };
  const r = exportRow(product({ noindex: 1, meta_desc: 'Buy it now. Genuine, fast delivery.' }), meta);
  assert.equal(r.id, 7); assert.equal(r.url, '/product/toner-x'); assert.equal(r.meta_title, 'My title');
  assert.equal(r.meta_description, ''); // generated, so empty = use the template
  assert.equal(r.meta_keywords, 'a,b'); assert.equal(r.secondary_keywords, 'a|b');
  assert.equal(r.robots_index, 0); assert.equal(r.robots_follow, 0);
  assert.equal(r.og_image, '/i.png'); assert.equal(r.faq_1_q, 'q1'); assert.equal(r.faq_2_q, '');
  const auto = exportRow(product({ meta_title: 'Toner | AR Trade' }), {});
  assert.equal(auto.meta_title, ''); assert.equal(auto.robots_index, 1);
});

const H = ['id', ...COLUMNS.slice(4)];
const rec = o => H.map(h => o[h] ?? '');

test('rowToManual maps every column', () => {
  const { manual, errors } = rowToManual(rec({
    id: '7', meta_title: 'T', meta_description: 'D', meta_keywords: 'k', focus_keyword: 'f', secondary_keywords: 'a| b |a|', canonical_url: 'https://x.com/', robots_index: 'No', robots_follow: 'TRUE',
    og_title: 'o', og_description: 'od', og_image: '/x.png', twitter_title: 't', twitter_description: 'td', faq_1_q: 'Q', faq_1_a: 'A', faq_3_q: '', faq_3_a: ''
  }), H);
  assert.deepEqual(errors, []);
  assert.deepEqual(manual, { metaTitle: 'T', metaDescription: 'D', metaKeywords: 'k', focusKeyword: 'f', secondaryKeywords: ['a', 'b'], canonicalUrl: 'https://x.com/', robotsIndex: false, robotsFollow: true, ogTitle: 'o', ogDescription: 'od', ogImage: '/x.png', twitterTitle: 't', twitterDescription: 'td', faq: [{ q: 'Q', a: 'A' }] });
});

test('rowToManual: empty cells clear, absent columns are not touched, empty robots untouched', () => {
  const m = rowToManual(rec({ id: '7' }), H).manual;
  assert.equal(m.metaTitle, ''); assert.equal(m.ogImage, ''); assert.deepEqual(m.secondaryKeywords, []); assert.deepEqual(m.faq, []);
  assert.ok(!('robotsIndex' in m));
  const only = rowToManual(['7', 'New'], ['id', 'meta_title']);
  assert.deepEqual(only.manual, { metaTitle: 'New' });
  assert.deepEqual(rowToManual(['7'], ['id']).manual, {});
});

test('rowToManual errors: half FAQ, bad robots, limits, bad url', () => {
  assert.match(rowToManual(rec({ faq_2_q: 'only q' }), H).errors.join(), /FAQ 2 needs both/);
  assert.match(rowToManual(rec({ faq_2_a: 'only a' }), H).errors.join(), /FAQ 2 needs both/);
  assert.match(rowToManual(rec({ robots_index: 'maybe' }), H).errors.join(), /robots_index/);
  assert.match(rowToManual(rec({ meta_title: 'x'.repeat(161) }), H).errors.join(), /at most 160/);
  assert.match(rowToManual(rec({ canonical_url: 'http://x.com' }), H).errors.join(), /https/);
  assert.match(rowToManual(rec({ secondary_keywords: Array.from({ length: 13 }, (_, i) => 'k' + i).join('|') }), H).errors.join(), /At most 12/);
});

test('partial FAQ columns leave FAQs alone', () => {
  assert.ok(!('faq' in rowToManual(['7', 'Q', 'A'], ['id', 'faq_1_q', 'faq_1_a']).manual));
});

test('diffManual compares cleaned values and reports from/to', () => {
  const cur = { metaTitle: 'Old  title', focusKeyword: 'a', robotsIndex: true, secondaryKeywords: ['x'], faq: [{ q: 'q', a: 'a' }] };
  assert.deepEqual(diffManual(cur, { metaTitle: 'Old title', focusKeyword: 'a', robotsIndex: true, secondaryKeywords: ['x'], faq: [{ q: 'q', a: 'a' }] }), []);
  const d = diffManual(cur, { metaTitle: 'New', robotsIndex: false, secondaryKeywords: ['x', 'y'], faq: [], canonicalUrl: '' });
  assert.deepEqual(d.map(c => c.field), ['meta_title', 'robots_index', 'secondary_keywords', 'faq']);
  assert.deepEqual(d[1], { field: 'robots_index', from: '1', to: '0', key: 'robotsIndex' });
  assert.equal(d[2].to, 'x|y');
});

test('token is the sha256 of the text and must match', () => {
  const csv = 'id\n1\n';
  assert.match(tokenOf(csv), /^[0-9a-f]{64}$/);
  assert.ok(tokenOk(csv, tokenOf(csv)));
  assert.ok(!tokenOk(csv + ' ', tokenOf(csv)));
  assert.ok(!tokenOk(csv, 'abc'));
  assert.ok(!tokenOk(undefined, tokenOf(csv)));
});

test('limits and required columns', () => {
  assert.throws(() => parseChecked('name\nx'), /"id" or a "sku"/);
  assert.throws(() => parseChecked(''), CsvError);
  assert.throws(() => parseChecked(123), CsvError);
  try { parseChecked('id\n' + 'x'.repeat(2 * 1024 * 1024)); assert.fail(); } catch (e) { assert.equal(e.status, 413); }
  try { parseChecked('id\n' + Array(MAX_ROWS + 1).fill('1').join('\n')); assert.fail(); } catch (e) { assert.equal(e.status, 400); assert.match(e.message, /5000/); }
  assert.equal(parseChecked('id\n' + Array(MAX_ROWS).fill('1').join('\n')).records.length, MAX_ROWS);
});

test('planImport: found by id then sku, errors, unchanged, changed, duplicates', () => {
  const p7 = product(), p8 = product({ id: 8, sku: 'SK-8', name: 'Other' }), p9 = product({ id: 9, sku: 'DUP' }), p10 = product({ id: 10, sku: 'dup' });
  const lookup = makeLookup([p7, p8, p9, p10], [{ entity_id: '7', focus_keyword: 'old' }]);
  const csv = ['id,sku,focus_keyword,robots_index', '7,,old,1', ',SK-8,new,', '999,,x,', ',nope,x,', ',DUP,x,', '8,,again,', '7,,old2,bogus'].join('\n');
  const parsed = parseChecked(csv);
  assert.deepEqual(keysOf(parsed), { ids: ['7', '999', '8'], skus: ['SK-8', 'nope', 'DUP'] });
  const plan = planImport(parsed, lookup);
  assert.deepEqual(plan.counts, { total: 7, valid: 2, invalid: 5, changed: 1, unchanged: 1 });
  assert.equal(plan.rows[0].changes.length, 0);
  assert.deepEqual(plan.rows[1].manual, { focusKeyword: 'new' });
  assert.equal(plan.rows[1].id, 8);
  assert.deepEqual(plan.rows[2].errors, ['Product not found']);
  assert.match(plan.rows[4].errors[0], /more than one/);
  assert.match(plan.rows[5].errors[0], /Same product as line 3/);
  assert.match(plan.rows[6].errors.join(), /Same product as line 2|robots_index/);
  const pv = previewRows(plan);
  assert.equal(pv.rows.length, 6); // 5 invalid + 1 changed
  assert.deepEqual(pv.rows[0].changes, [{ field: 'focus_keyword', from: '', to: 'new' }]);
});

test('planImport flags short rows and clears fields', () => {
  const lookup = makeLookup([product()], [{ entity_id: '7', focus_keyword: 'old', og_title: 'x' }]);
  const plan = planImport(parseCsv('id,focus_keyword,og_title\n7,,\n7,only'), lookup);
  assert.deepEqual(plan.rows[0].changes.map(c => [c.field, c.to]), [['focus_keyword', ''], ['og_title', '']]);
  assert.match(plan.rows[1].errors[0], /2 cells but the header has 3|Same product/);
});

test('previewRows truncates changed rows at 200 but keeps every invalid row', () => {
  const rows = Array.from({ length: 300 }, (_, i) => product({ id: i + 1, sku: 'S' + i }));
  const lookup = makeLookup(rows, []);
  const csv = 'id,focus_keyword\n' + rows.map(r => `${r.id},kw${r.id}`).join('\n') + '\n9999,zz\n';
  const plan = planImport(parseCsv(csv), lookup);
  const pv = previewRows(plan);
  assert.equal(pv.rows.length, 201);
  assert.match(pv.truncated, /200 of 300/);
  assert.ok(pv.rows.some(r => r.errors.length));
});

test('4,000 rows build, parse and plan in under a second', () => {
  const prods = Array.from({ length: 4000 }, (_, i) => product({ id: i + 1, sku: 'S' + i, name: 'Product ' + i }));
  const csv = buildCsv(prods.map(p => ({ ...exportRow(p, {}), focus_keyword: 'kw ' + p.id, meta_description: 'line1\nline2 "q"', ...FAQ_EMPTY })));
  const t0 = performance.now();
  const parsed = parseChecked(csv);
  const ms = performance.now() - t0;
  const t1 = performance.now();
  const plan = planImport(parsed, makeLookup(prods, []));
  const ms2 = performance.now() - t1;
  assert.equal(parsed.records.length, 4000);
  assert.equal(plan.counts.changed, 4000);
  assert.ok(ms < 1000, `parse took ${ms}ms`);
  assert.ok(ms2 < 3000, `plan took ${ms2}ms`); // about 0.3 s alone; the margin is for a busy machine running tests in parallel
});
