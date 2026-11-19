import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, campOut, cleanDesign, cleanProductIds, dnsRecords, dnsVerdict, filterAudience, pickSubject, prefsOf } from '../src/mkt/helpers.js';
import { applyPrefChanges } from '../src/mkt/routesPrefs.js';
import { resultNumber } from '../src/mkt/routesCampaigns.js';

test('prefsOf defaults every preference to on', () => {
  assert.deepEqual(prefsOf(null), { offers: true, festivals: true, tips: true, refill: true });
  assert.equal(prefsOf({ offers: 0, festivals: 1 }).offers, false);
});

test('cleanDesign trims, limits and validates', () => {
  const d = cleanDesign({ kicker: ' hi ', headline: 'x'.repeat(500), hero: 'nope', ctaUrl: 'javascript:1', products: ['1', 2, 'a', 3.5, 4, 5, 6, 7, 8, 9, 10] });
  assert.equal(d.kicker, 'hi');
  assert.equal(d.headline.length, 120);
  assert.equal(d.hero, 'navy');
  assert.equal(d.ctaUrl, '');
  assert.deepEqual(d.products, [1, 2, 4, 5, 6, 7, 8, 9]);
  assert.equal(cleanDesign({ ctaUrl: 'https://a.b/c' }).ctaUrl, 'https://a.b/c');
});

test('cleanProductIds', () => {
  assert.deepEqual(cleanProductIds('x'), []);
  assert.deepEqual(cleanProductIds(['5', 'z', 6]), [5, 6]);
});

test('A/B subject alternates only when B exists', () => {
  const c = { subj_a: 'A', subj_b: 'B' };
  assert.deepEqual([0, 1, 2, 3].map(i => pickSubject(c, i)), ['A', 'B', 'A', 'B']);
  assert.equal(pickSubject({ subj_a: 'A', subj_b: '' }, 1), 'A');
});

test('filterAudience honours preferences, missing counts as allowed', () => {
  const subs = [{ email: 'a', offers: 1 }, { email: 'b', offers: 0 }, { email: 'c', offers: null }];
  assert.deepEqual(filterAudience(subs, 'offers').map(r => r.email), ['a', 'c']);
  assert.equal(filterAudience(subs, 'all').length, 3);
});

test('campOut builds code and A/B pair', () => {
  const o = campOut({ id: 5, ab_a: 3, ab_b: 4, design: '{"x":1}' });
  assert.equal(o.code, 'CMP-205');
  assert.deepEqual(o.ab, [3, 4]);
  assert.deepEqual(o.design, { x: 1 });
  assert.equal(campOut({ id: 1 }).ab, null);
});

test('DNS verdict and records', () => {
  const p = PROVIDERS.Brevo;
  const v = dnsVerdict(p, 'x.com', { spfTxt: ['v=spf1 include:spf.brevo.com ~all'], dkimCnames: [p.dkim[1] + '.'], dmarcTxt: [] });
  assert.deepEqual(v, { spf: true, dkim: true, dmarc: false });
  const recs = dnsRecords(p, { domain: 'x.com', dns: { spf: true } });
  assert.equal(recs[1].host, 'brevo1._domainkey.x.com');
  assert.equal(recs[0].ok, true);
  assert.equal(recs[2].ok, false);
});

test('applyPrefChanges lists only real changes', () => {
  const cur = { offers: true, festivals: true, tips: true, refill: true };
  const r = applyPrefChanges(cur, { offers: false, tips: true, junk: 1 });
  assert.deepEqual(r.changed, ['Turned off offers']);
  assert.equal(r.next.offers, false);
  assert.equal(cur.offers, true);
});

test('resultNumber', () => {
  assert.equal(resultNumber(''), null);
  assert.equal(resultNumber(null), null);
  assert.equal(resultNumber('-4'), 0);
  assert.equal(resultNumber('12'), 12);
  assert.equal(resultNumber('abc'), 0);
});
