import test from 'node:test';
import assert from 'node:assert/strict';
import { brandSlug, ensureBrands } from '../src/brands.js';

test('brandSlug: lower case, runs of non-alphanumerics become one hyphen, trimmed', () => {
  const cases = {
    HP: 'hp', Canon: 'canon', 'Hi-Speed': 'hi-speed', Avtech: 'avtech', Xerox: 'xerox', 'D-Link': 'd-link', 'TP Link': 'tp-link',
    'Epson ': 'epson', ' brother': 'brother', 'Kyocera  Mita': 'kyocera-mita', 'Fuji Xerox!': 'fuji-xerox', '--Dahua--': 'dahua', 'A&B': 'a-b', Samsung2: 'samsung2', 'Ricoh/Gestetner': 'ricoh-gestetner'
  };
  for (const [n, s] of Object.entries(cases)) assert.equal(brandSlug(n), s, n);
  assert.equal(Object.keys(cases).length, 15);
});

test('brandSlug handles empty and odd input', () => {
  assert.equal(brandSlug(''), '');
  assert.equal(brandSlug(null), '');
  assert.equal(brandSlug(undefined), '');
  assert.equal(brandSlug('বাংলা'), '');
  assert.equal(brandSlug('x'.repeat(200)).length, 80);
});

test('ensureBrands inserts one row per slug and keeps the first name', async () => {
  let inserted;
  const pool = {
    async query(sql, params) {
      if (/^SELECT/.test(sql)) return [[{ b: 'HP' }, { b: 'Hp ' }, { b: 'TP Link' }, { b: 'TP-Link' }, { b: '!!!' }, { b: 'Canon' }]];
      inserted = params[0];
      return [{ affectedRows: params[0].length }];
    }
  };
  assert.equal(await ensureBrands(pool), 3);
  assert.deepEqual(inserted, [['hp', 'HP'], ['tp-link', 'TP Link'], ['canon', 'Canon']]);
});

test('ensureBrands does nothing when there are no brands', async () => {
  const pool = { async query() { return [[]]; } };
  assert.equal(await ensureBrands(pool), 0);
});
