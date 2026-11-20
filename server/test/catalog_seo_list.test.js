import test from 'node:test';
import assert from 'node:assert/strict';
import { SEO_JOIN, seoCondition, seoScoreOf } from '../src/admin/catalogSeoList.js';

test('seoCondition maps the three filters and ignores anything else', () => {
  assert.equal(seoCondition('low'), 'sm.seo_score < 50');
  assert.equal(seoCondition('unscored'), 'sm.seo_score IS NULL');
  assert.equal(seoCondition('noindex'), 'p.noindex = 1');
  for (const v of [undefined, '', 'all', 'LOW', "x'; DROP TABLE products;--", 5, null]) assert.equal(seoCondition(v), null);
});

test('seoScoreOf gives a number or null', () => {
  assert.equal(seoScoreOf({ seo_score: 72 }), 72);
  assert.equal(seoScoreOf({ seo_score: '0' }), 0);
  assert.equal(seoScoreOf({ seo_score: null }), null);
  assert.equal(seoScoreOf({}), null);
  assert.equal(seoScoreOf(undefined), null);
});

test('SEO_JOIN joins product rows by text id', () => {
  assert.match(SEO_JOIN, /LEFT JOIN seo_meta sm/);
  assert.match(SEO_JOIN, /entity_type = 'product'/);
  assert.match(SEO_JOIN, /CAST\(p\.id AS CHAR\)/);
});
