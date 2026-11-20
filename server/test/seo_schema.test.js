import test from 'node:test';
import assert from 'node:assert/strict';
import { CHILD_SITEMAPS, aggregateLd, faqLd, gtinProp, colourOf, heroImage, hoursLd, isVariantQuery, latestDay, offerExtras, parseAddress, policyMeta, productExtras, reviewsLd, robotsTxt, sameAsOf, serviceLd, sitemapIndex, storeLd, urlEntry, urlset } from '../src/seoSchema.js';
import { faqBlock, notFoundFallback, policyBlocks } from '../src/seoFallback.js';

test('faqLd: only real Q+A, null when none', () => {
  assert.equal(faqLd([]), null);
  assert.equal(faqLd(undefined), null);
  assert.equal(faqLd([{ q: 'x', a: '' }]), null);
  const l = faqLd([{ q: 'Delivery?', a: '<b>Yes</b> in Dhaka' }, { q: '', a: 'z' }]);
  assert.equal(l['@type'], 'FAQPage');
  assert.equal(l.mainEntity.length, 1);
  assert.equal(l.mainEntity[0].acceptedAnswer.text, 'Yes in Dhaka');
});

test('serviceLd: provider by @id, Dhaka/BD area, no empty description', () => {
  const s = serviceLd({ name: 'Printer repair', description: '<p>We fix printers.</p>', url: 'https://x/services/a', storeId: 'https://x/#store' });
  assert.equal(s['@type'], 'Service');
  assert.deepEqual(s.provider, { '@id': 'https://x/#store' });
  assert.equal(s.areaServed.name, 'Dhaka');
  assert.equal(s.areaServed.address.addressCountry, 'BD');
  assert.equal(s.description, 'We fix printers.');
  assert.ok(!('description' in serviceLd({ name: 'A', description: '', url: 'u' })));
});

test('gtin chosen by digit count, only all digits', () => {
  assert.deepEqual(gtinProp('12345678'), { gtin8: '12345678' });
  assert.deepEqual(gtinProp('123456789012'), { gtin12: '123456789012' });
  assert.deepEqual(gtinProp('1234567890123'), { gtin13: '1234567890123' });
  assert.deepEqual(gtinProp('12345678901234'), { gtin14: '12345678901234' });
  for (const bad of ['123456789', '12345678A', '', null, undefined, '1234 5678']) assert.deepEqual(gtinProp(bad), {});
});

test('colour: real colour words only', () => {
  assert.equal(colourOf('black'), 'Black');
  assert.equal(colourOf(' Cyan '), 'Cyan');
  for (const bad of ['Color', 'Colour', 'Black & White', 'Mono', '', undefined]) assert.equal(colourOf(bad), undefined);
});

test('productExtras: model from part, colour, gtin; nothing when absent', () => {
  assert.deepEqual(productExtras({}), {});
  assert.deepEqual(productExtras({ part: 'TN-150BK', color: 'Black', gtin: '1234567890123' }), { gtin13: '1234567890123', color: 'Black', model: 'TN-150BK' });
  assert.ok(!('color' in productExtras({ color: 'Black & White' })));
});

test('offerExtras: VAT note and pre-order only when allowed', () => {
  const o = offerExtras({}, 5300);
  assert.equal(o.priceSpecification.valueAddedTaxIncluded, true);
  assert.equal(o.priceSpecification.price, '5300');
  assert.ok(!('availability' in o));
  assert.equal(offerExtras({ preorder: 1 }, 1).availability, 'https://schema.org/PreOrder');
  assert.ok(!('priceSpecification' in offerExtras({}, 1, { vatShown: false })));
});

test('reviewsLd: max 10, rating bounds, ISO date, omitted empty fields', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ name: 'A' + i, rating: 5, title: '', body: 'good', created_at: new Date('2026-03-04T10:00:00Z') }));
  const r = reviewsLd(rows);
  assert.equal(r.length, 10);
  assert.deepEqual(r[0].reviewRating, { '@type': 'Rating', ratingValue: 5, bestRating: 5, worstRating: 1 });
  assert.equal(r[0].datePublished, '2026-03-04');
  assert.ok(!('name' in r[0]));
  assert.equal(r[0].reviewBody, 'good');
  assert.equal(reviewsLd([{ name: 'x', rating: 9 }]).length, 0);
  assert.equal(reviewsLd(undefined).length, 0);
  assert.equal(aggregateLd(3, 4.666).ratingValue, '4.7');
  assert.equal(aggregateLd(3, 4).bestRating, 5);
});

test('parseAddress: only what is in the text', () => {
  assert.deepEqual(parseAddress('159 Santinagar, Dhaka-1217'), { locality: 'Dhaka', postalCode: '1217' });
  assert.deepEqual(parseAddress('Somewhere'), { locality: undefined, postalCode: undefined });
});

test('hoursLd: valid rows only, undefined when none', () => {
  assert.equal(hoursLd(undefined), undefined);
  assert.equal(hoursLd([{ days: ['Saturday'], opens: '9:00', closes: '18:00' }]), undefined);
  const h = hoursLd([{ days: ['saturday', 'Sunday', 'Funday'], opens: '09:00', closes: '18:00' }, { days: [], opens: '09:00', closes: '10:00' }]);
  assert.equal(h.length, 1);
  assert.deepEqual(h[0], { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Saturday', 'Sunday'], opens: '09:00', closes: '18:00' });
});

test('storeLd: minimal settings keep the current block; extras only when present', () => {
  const base = 'https://x.com';
  const a = storeLd({ base, site: { phone: '017', email: 'a@b.c', address: '159 Santinagar' } });
  assert.deepEqual(a['@type'], ['Store', 'ElectronicsStore']);
  assert.equal(a['@id'], base + '/#store');
  assert.equal(a.address.addressLocality, 'Dhaka');
  assert.equal(a.address.postalCode, '1217');
  for (const k of ['legalName', 'geo', 'openingHoursSpecification', 'sameAs']) assert.ok(!(k in a), k);
  assert.equal(a.contactPoint.length, 1);
  assert.deepEqual(a.contactPoint[0].availableLanguage, ['en', 'bn']);
  const b = storeLd({ base, sameAs: ['https://fb.com/x'], site: { phone: '017', whatsapp: '+880 1711-222333', legalName: 'AR Trade Ltd', address: 'House 5, Gulshan, Dhaka-1212', delivery: { office: { lat: 23.7, lng: 90.4 } }, hours: [{ days: ['Monday'], opens: '09:00', closes: '17:00' }] } });
  assert.equal(b.legalName, 'AR Trade Ltd');
  assert.equal(b.address.postalCode, '1212');
  assert.deepEqual(b.geo, { '@type': 'GeoCoordinates', latitude: 23.7, longitude: 90.4 });
  assert.equal(b.contactPoint[1].url, 'https://wa.me/8801711222333');
  assert.equal(b.contactPoint[1].contactOption, 'https://schema.org/None');
  assert.equal(b.openingHoursSpecification.length, 1);
  assert.deepEqual(b.sameAs, ['https://fb.com/x']);
  assert.ok(!('geo' in storeLd({ base, site: { delivery: { office: { lat: '', lng: '' } } } })));
  assert.deepEqual(sameAsOf({ facebook: 'https://f', x: '', y: 'javascript:1' }), ['https://f']);
});

test('isVariantQuery', () => {
  assert.equal(isVariantQuery({ sort: 'price' }), true);
  assert.equal(isVariantQuery({ view: 'list' }), true);
  assert.equal(isVariantQuery({ order: 'asc' }), true);
  assert.equal(isVariantQuery({ page: '2' }), false);
  assert.equal(isVariantQuery({}), false);
});

test('policyMeta: title within 60, description from first paragraph within 155', () => {
  const m = policyMeta({ t: 'Return Policy', secs: [{ h: 'A', p: '' }, { h: 'B', p: '<b>You may</b> return within 7 days. ' + 'x '.repeat(200) }] });
  assert.equal(m.title, 'Return Policy | AR Trade International');
  assert.ok(m.desc.length <= 155 && m.desc.startsWith('You may return'));
  assert.ok(policyMeta({ t: 'A very long policy title that goes on and on and on', secs: [] }).title.length <= 60);
  assert.ok(policyMeta({ t: 'T', secs: [] }).desc.length > 0);
});

test('robots.txt: new disallows, old ones and Sitemap kept', () => {
  const r = robotsTxt('https://x.com');
  for (const l of ['Disallow: /wishlist', 'Disallow: /compare', 'Disallow: /login', 'Disallow: /*?sort=', 'Disallow: /*?q=', 'Disallow: /*?new=', 'Disallow: /admin', 'Disallow: /api/', 'Allow: /api/uploads/', 'Sitemap: https://x.com/sitemap.xml']) assert.ok(r.includes(l), l);
});

test('sitemap index and urlset: lastmod only when a real date', () => {
  const idx = sitemapIndex('https://x.com', CHILD_SITEMAPS.map((path, i) => ({ path, lm: i === 0 ? '2026-01-02' : '' })));
  assert.equal((idx.match(/<sitemap>/g) || []).length, 5);
  assert.equal((idx.match(/<lastmod>/g) || []).length, 1);
  assert.ok(idx.includes('https://x.com/sitemap-pages.xml'));
  assert.ok(!urlEntry('https://x/a', '0.5', '', '').includes('lastmod'));
  assert.ok(!urlEntry('https://x/a', '0.5', '', 'garbage').includes('lastmod'));
  assert.ok(urlEntry('https://x/a&b', '0.5', '<image:image/>', '2026-02-03').includes('<lastmod>2026-02-03</lastmod>'));
  assert.ok(urlEntry('https://x/a&b', '0.5').includes('a&amp;b'));
  assert.ok(urlset([urlEntry('https://x/a', '1')]).includes('xmlns:image'));
  assert.equal(latestDay(['2026-01-01', '', '2026-03-01']), '2026-03-01');
  assert.equal(latestDay(['']), '');
});

test('heroImage: first enabled image slide, else undefined', () => {
  assert.equal(heroImage([{ type: 'design' }, { type: 'image', on: false, img: '/a' }, { type: 'image', img: '/b.jpg' }]), '/b.jpg');
  assert.equal(heroImage([{ type: 'design' }]), undefined);
  assert.equal(heroImage(undefined), undefined);
});

test('fallbacks: FAQ text, policy text, 404 links, all escaped', () => {
  assert.equal(faqBlock([]), '');
  const f = faqBlock([{ q: 'Q <1>', a: 'A & B' }]);
  assert.ok(f.includes('Q &lt;1&gt;') && f.includes('A &amp; B'));
  const p = policyBlocks({ secs: [{ h: 'Head', p: 'Para' }, { h: '', p: '' }] });
  assert.equal(p.length, 1);
  assert.ok(p[0].includes('<h2>Head</h2>') && p[0].includes('<p>Para</p>'));
  const n = notFoundFallback({ cats: [{ id: 'toner', title: 'Toner' }], site: {} });
  assert.ok(n.includes('href="/"') && n.includes('href="/shop"') && n.includes('href="/shop/toner"') && n.includes('Page not found'));
});
