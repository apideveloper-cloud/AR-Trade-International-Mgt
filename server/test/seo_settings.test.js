import test from 'node:test';
import assert from 'node:assert/strict';
import { SEO_DEFAULTS, SEO_FLAGS, mergeSeoSettings, normaliseSeoSettings, validateRobotsTxt } from '../src/seoSettings.js';

const n = o => normaliseSeoSettings(o);

test('defaults: shape, names, flags', () => {
  const { settings, errors } = n(undefined);
  assert.deepEqual(errors, []);
  assert.deepEqual(settings, SEO_DEFAULTS);
  assert.equal(settings.general.siteName, 'AR Trade International');
  assert.equal(settings.general.siteNameFull, 'AR Trade International');
  assert.equal(settings.general.siteNameShort, 'AR Trade');
  assert.deepEqual(SEO_FLAGS, { aiGenerate: false, indexNow: false, merchantFeed: false });
  assert.equal(settings.business.geoLat, null);
  assert.equal(settings.shipping.zones[0].id, 'dhaka');
  assert.equal(settings.templates.product.title.includes('{site_name_short}'), true);
  for (const k of ['product', 'category', 'brand', 'blog', 'page', 'home']) for (const f of ['title', 'description', 'ogTitle', 'ogDescription']) assert.ok(settings.templates[k][f], k + f);
  assert.notEqual(n(undefined).settings, SEO_DEFAULTS); // a copy
});

test('unknown keys dropped, strings trimmed and clamped', () => {
  const { settings } = n({ evil: 1, general: { siteName: '  X  ', siteNameShort: 'S'.repeat(90), nope: 1 }, __proto__: { a: 1 } });
  assert.equal(settings.evil, undefined); assert.equal(settings.general.nope, undefined);
  assert.equal(settings.general.siteName, 'X'); assert.equal(settings.general.siteNameShort.length, 60);
});

test('separator', () => {
  for (const s of ['|', '-', '–', '·']) assert.equal(n({ general: { separator: s } }).settings.general.separator, s);
  const r = n({ general: { separator: '>' } });
  assert.equal(r.settings.general.separator, '|'); assert.equal(r.errors.length, 1);
});

test('templates: <=300, empty uses default', () => {
  assert.equal(n({ templates: { product: { title: ' {product_name} ' } } }).settings.templates.product.title, '{product_name}');
  const r = n({ templates: { brand: { title: 'x'.repeat(301) } } });
  assert.equal(r.errors.length, 1); assert.equal(r.settings.templates.brand.title, SEO_DEFAULTS.templates.brand.title);
  assert.equal(n({ templates: { page: { title: '' } } }).settings.templates.page.title, SEO_DEFAULTS.templates.page.title);
  assert.equal(n({ templates: { nope: { title: 'x' } } }).settings.templates.nope, undefined);
  assert.equal(n({ templates: { page: { title: 5 } } }).errors.length, 1);
});

test('hours', () => {
  const ok = n({ business: { hours: [{ days: ['mon', 'Tuesday', 'xx'], opens: '09:00', closes: '18:30' }] } });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.settings.business.hours, [{ days: ['Monday', 'Tuesday'], opens: '09:00', closes: '18:30' }]);
  assert.equal(n({ business: { hours: [{ days: ['Mon'], opens: '9:00', closes: '18:00' }] } }).errors.length, 1);
  assert.equal(n({ business: { hours: [{ days: [], opens: '09:00', closes: '18:00' }] } }).errors.length, 1);
  assert.equal(n({ business: { hours: 'x' } }).errors.length, 1);
});

test('geo range', () => {
  const ok = n({ business: { geoLat: '23.7', geoLng: 90.4 } });
  assert.equal(ok.settings.business.geoLat, 23.7); assert.equal(ok.settings.business.geoLng, 90.4);
  assert.equal(n({ business: { geoLat: 91 } }).errors.length, 1);
  assert.equal(n({ business: { geoLng: -181 } }).errors.length, 1);
  assert.equal(n({ business: { geoLat: 'abc' } }).errors.length, 1);
  assert.equal(n({ business: { geoLat: '' } }).settings.business.geoLat, null);
  assert.equal(n({ business: { geoLat: 90, geoLng: -180 } }).errors.length, 0);
});

test('shipping and returns', () => {
  assert.equal(n({ shipping: { handlingDays: 365 } }).settings.shipping.handlingDays, 365);
  assert.equal(n({ shipping: { handlingDays: 366 } }).errors.length, 1);
  assert.equal(n({ shipping: { handlingDays: -1 } }).errors.length, 1);
  assert.equal(n({ returns: { windowDays: 7 } }).settings.returns.windowDays, 7);
  assert.equal(n({ returns: { windowDays: 1.5 } }).errors.length, 1);
  assert.equal(n({ shipping: { transitDays: { dhaka: 1, outside: '3' } } }).settings.shipping.transitDays.outside, 3);
  assert.equal(n({ shipping: { zones: [{ id: 'dhaka', label: 'Dhaka', rate: 60 }, { id: 'BAD ID', label: 'x' }] } }).errors.length, 1);
  assert.equal(n({ shipping: { zones: [{ id: 'dhaka', label: 'Dhaka', rate: 60 }] } }).settings.shipping.zones[0].rate, 60);
  for (const m of ['store', 'courier', 'both', '']) assert.equal(n({ returns: { method: m } }).errors.length, 0);
  assert.equal(n({ returns: { method: 'post' } }).errors.length, 1);
  for (const c of ['full', 'exchange', 'none', '']) assert.equal(n({ returns: { category: c } }).errors.length, 0);
  assert.equal(n({ returns: { category: 'x' } }).errors.length, 1);
});

test('verification ids', () => {
  assert.equal(n({ verification: { google: 'abc_-123', bing: 'X' } }).errors.length, 0);
  assert.equal(n({ verification: { google: 'a b' } }).errors.length, 1);
  assert.equal(n({ verification: { bing: 'a'.repeat(101) } }).errors.length, 1);
  assert.equal(n({ verification: { ga4: 'G-ABCD1234' } }).settings.verification.ga4, 'G-ABCD1234');
  assert.equal(n({ verification: { ga4: 'UA-1' } }).errors.length, 1);
  assert.equal(n({ verification: { ga4: '' } }).errors.length, 0);
  assert.equal(n({ verification: { gtm: 'GTM-ABC123' } }).settings.verification.gtm, 'GTM-ABC123');
  assert.equal(n({ verification: { gtm: 'GTM-a' } }).errors.length, 1);
});

test('og image, preferred domain, language', () => {
  for (const v of ['', '/img/a.png', 'https://x.com/a.png']) assert.equal(n({ general: { defaultOgImage: v } }).errors.length, 0);
  assert.equal(n({ general: { defaultOgImage: 'http://x.com/a.png' } }).errors.length, 1);
  assert.equal(n({ general: { defaultOgImage: 'javascript:alert(1)' } }).errors.length, 1);
  assert.equal(n({ general: { preferredDomain: 'https://artradeinternational.com' } }).settings.general.preferredDomain, 'https://artradeinternational.com');
  assert.equal(n({ general: { preferredDomain: 'https://artradeinternational.com/' } }).settings.general.preferredDomain, 'https://artradeinternational.com');
  for (const v of ['http://x.com', 'https://x.com/path', 'x.com']) assert.equal(n({ general: { preferredDomain: v } }).errors.length, 1, v);
  assert.equal(n({ general: { defaultLanguage: 'bn' } }).settings.general.defaultLanguage, 'bn');
  assert.equal(n({ general: { defaultLanguage: '!!' } }).errors.length, 1);
});

test('flags and robots toggles', () => {
  assert.equal(n({ flags: { aiGenerate: true, bogus: true } }).settings.flags.aiGenerate, false); // aiGenerate cannot be switched on (see seo_automation tests)
  assert.equal(n({ flags: { bogus: true } }).settings.flags.bogus, undefined);
  assert.equal(n({ robots: { noindexSearch: false } }).settings.robots.noindexSearch, false);
  assert.equal(n({ robots: { customTxt: 'User-agent: *\nDisallow: /' } }).errors.length, 1);
  assert.equal(n({ robots: { customTxt: 'User-agent: *\nDisallow: /tmp' } }).settings.robots.customTxt, 'User-agent: *\nDisallow: /tmp');
});

test('mergeSeoSettings: defaults under stored', () => {
  const m = mergeSeoSettings({ general: { siteName: 'Foo' }, returns: { windowDays: 7 } });
  assert.equal(m.general.siteName, 'Foo'); assert.equal(m.general.separator, '|'); assert.equal(m.returns.windowDays, 7);
  assert.deepEqual(mergeSeoSettings(null), SEO_DEFAULTS);
  assert.deepEqual(mergeSeoSettings(mergeSeoSettings({ business: { legalName: 'L' } })), mergeSeoSettings({ business: { legalName: 'L' } }));
});

test('validateRobotsTxt', () => {
  assert.deepEqual(validateRobotsTxt('User-agent: *\nAllow: /\nDisallow: /admin\nCrawl-delay: 5\nSitemap: https://x.com/sitemap.xml # c'), { ok: true, errors: [] });
  assert.equal(validateRobotsTxt('User-agent: *\nDisallow: /').ok, false);
  assert.equal(validateRobotsTxt('User-agent: *\nDisallow:').ok, true);
  assert.equal(validateRobotsTxt('Host: x.com').ok, false);
  assert.equal(validateRobotsTxt('hello').ok, false);
  assert.equal(validateRobotsTxt('User-agent: *\n<script>x</script>').ok, false);
  assert.equal(validateRobotsTxt('User-agent: *\n' + '# x\n'.repeat(1300)).ok, false);
  assert.equal(validateRobotsTxt(null).ok, false);
  assert.equal(validateRobotsTxt('').ok, true);
});
