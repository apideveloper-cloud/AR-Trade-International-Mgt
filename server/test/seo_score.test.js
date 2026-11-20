import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreItem } from '../src/seoScore.js';

const body = Array.from({ length: 300 }, (_, i) => 'word' + i).join(' ');
const good = () => ({
  title: 'HP 230A Black Toner Cartridge – Price in BD', description: 'Buy HP 230A Black Toner Cartridge at 16,200 in Bangladesh. Genuine product, fast delivery in Dhaka and cash on delivery.',
  slug: 'hp-230a-black-toner', h1: 'HP 230A Black Toner', focusKeyword: '', bodyText: body, wordCount: 300,
  images: [{ src: '/a.jpg', alt: 'HP toner', width: 1200 }], price: 16200, stock: 5, brand: 'HP', gtin: '', mpn: 'CF230A', noindex: false, canonical: ''
});
const ok = { duplicateTitles: 0, duplicateDescriptions: 0, descriptionDuplicateOf: null };
const lv = (r, id) => r.issues.find(i => i.id === id)?.level;
const sum = r => r.issues.reduce((a, i) => a + i.weight, 0);

test('perfect product scores 100, weights sum to 100', () => {
  const r = scoreItem('product', good(), ok);
  assert.equal(r.score, 100);
  assert.ok(r.issues.every(i => i.level === 'pass'));
  assert.ok(Math.abs(sum(r) - 100) < 0.1);
  assert.equal(r.issues.some(i => i.id.startsWith('kw_')), false);
});

const cases = [
  ['title_length', i => { i.title = 'Short'; }, 'warn'],
  ['title_length', i => { i.title = 'x '.repeat(40); }, 'warn'],
  ['title_length', i => { i.title = ''; }, 'fail'],
  ['title_unique', null, 'fail', { duplicateTitles: 2 }],
  ['desc_length', i => { i.description = 'Short'; }, 'warn'],
  ['desc_length', i => { i.description = 'x '.repeat(100); }, 'warn'],
  ['desc_unique', null, 'fail', { duplicateDescriptions: 1 }],
  ['body_words', i => { i.wordCount = 100; }, 'fail'],
  ['body_duplicate', null, 'fail', { descriptionDuplicateOf: 'P-9' }],
  ['has_image', i => { i.images = []; }, 'fail'],
  ['image_alt', i => { i.images = [{ src: '/a.jpg', alt: '', width: 900 }]; }, 'fail'],
  ['image_size', i => { i.images = [{ src: '/a.jpg', alt: 'a', width: 400 }]; }, 'fail'],
  ['image_size', i => { i.images = [{ src: '/a.jpg', alt: 'a' }]; }, 'warn'],
  ['price', i => { i.price = 0; }, 'fail'],
  ['stock', i => { i.stock = null; }, 'fail'],
  ['brand', i => { i.brand = ''; }, 'fail'],
  ['gtin_mpn', i => { i.mpn = ''; i.gtin = ''; }, 'fail'],
  ['noindex', i => { i.noindex = true; }, 'fail']
];
for (const [id, mut, level, ctx] of cases) {
  test(`rule ${id} -> ${level}`, () => {
    const it = good(); if (mut) mut(it);
    const r = scoreItem('product', it, { ...ok, ...(ctx || {}) });
    assert.equal(lv(r, id), level);
    assert.ok(r.score < 100);
    assert.ok(r.issues.find(i => i.id === id).fix);
  });
}

test('pass cases for boundary values', () => {
  const it = good(); it.title = 'x'.repeat(30); it.description = 'y'.repeat(155); it.images[0].width = 800; it.gtin = '123'; it.mpn = '';
  const r = scoreItem('product', it, ok);
  for (const id of ['title_length', 'desc_length', 'image_size', 'gtin_mpn']) assert.equal(lv(r, id), 'pass', id);
  const t = good(); t.title = 'x'.repeat(60); t.description = 'y'.repeat(120);
  const r2 = scoreItem('product', t, ok);
  assert.equal(lv(r2, 'title_length'), 'pass'); assert.equal(lv(r2, 'desc_length'), 'pass');
  assert.equal(lv(scoreItem('product', { ...good(), stock: 0 }, ok), 'stock'), 'pass'); // 0 is a real stock value
});

test('focus keyword rules only when set; pass and fail', () => {
  const it = good(); it.focusKeyword = 'black toner'; it.bodyText = 'The black toner is great. ' + body;
  const r = scoreItem('product', it, ok);
  assert.equal(r.issues.filter(i => i.id.startsWith('kw_')).length, 5);
  assert.equal(r.score, 100); assert.ok(Math.abs(sum(r) - 100) < 0.1);
  const bad = good(); bad.focusKeyword = 'laser printer';
  const rb = scoreItem('product', bad, ok);
  for (const id of ['kw_title', 'kw_h1', 'kw_slug', 'kw_desc', 'kw_body']) assert.equal(lv(rb, id), 'fail', id);
  assert.ok(rb.score <= 80);
  const mixed = good(); mixed.focusKeyword = 'HP 230A';
  const rm = scoreItem('product', mixed, ok);
  assert.equal(lv(rm, 'kw_title'), 'pass'); assert.equal(lv(rm, 'kw_slug'), 'pass'); assert.equal(lv(rm, 'kw_body'), 'fail');
});

test('other kinds use a subset re-normalised to 100', () => {
  for (const kind of ['category', 'brand', 'blog', 'page']) {
    const r = scoreItem(kind, { ...good(), wordCount: 400 }, ok);
    assert.ok(Math.abs(sum(r) - 100) < 0.2, kind);
    assert.equal(r.score, 100, kind);
    assert.ok(!r.issues.some(i => ['price', 'stock', 'brand', 'gtin_mpn'].includes(i.id)), kind);
  }
  assert.ok(scoreItem('blog', { ...good(), wordCount: 100 }, ok).issues.find(i => i.id === 'body_words').level === 'fail');
  assert.equal(scoreItem('page', { ...good(), wordCount: 1 }, ok).issues.some(i => i.id === 'body_words'), false);
  assert.equal(scoreItem('category', { ...good(), noindex: true }, ok).issues.find(i => i.id === 'noindex').level, 'fail');
});

test('deterministic and safe on empty input', () => {
  assert.deepEqual(scoreItem('product', good(), ok), scoreItem('product', good(), ok));
  const r = scoreItem('product', null, null);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(scoreItem('weird', {}, {}).issues.length > 0);
});
