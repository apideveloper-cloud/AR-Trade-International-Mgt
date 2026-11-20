import test from 'node:test';
import assert from 'node:assert/strict';
import { getBusiness, saveBusiness, formatHours, gbpCopyBlock, checkGoogleUrl, saveGbp, getGbp, getReviewLink, gbpView, GBP_STEPS, groupHours, expandHours } from '../src/growth/business.js';
import { normPhone, phonesMatch, addressesMatch, normText, extractContacts, contentStrings, buildNapRows, countIssues, runNapCheck, storeBlock, hoursMatch, DEFAULT_ADDRESS_NOTE } from '../src/growth/napCheck.js';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function stores(over = {}) {
  const s = {
    site: { email: 'Shop@AR.test', phone: '01977-554401', address: '159, Santinagar, Dhaka-1217', whatsapp: '8801977554401', heroTitle: 'Keep me', delivery: { a: 1 } },
    seo: { general: { siteName: 'AR Trade', preferredDomain: 'https://ar.test' }, business: { hours: [{ days: ['Saturday', 'Sunday'], opens: '10:00', closes: '20:00' }] }, robots: { customTxt: '' } },
    content: { social: { facebook: 'https://facebook.com/ar', x: 'not a url ' }, policies: { returns: { secs: [{ p: 'Call +880 1977-554401 or mail Old@AR.test' }] } } },
    growth: {}, ...over
  };
  const writes = [], bust = [];
  return { s, writes, bust, deps: {
    readSite: async () => s.site, writeSite: async v => { writes.push(['site', v]); s.site = v; }, readSeo: async () => s.seo, writeSeo: async v => { writes.push(['seo', v]); s.seo = v; },
    readContent: async () => s.content, bustSeo: async () => { bust.push(1); }, record: async () => {}, readGrowth: async () => s.growth, saveGrowth: async p => { s.growth = { ...s.growth, ...p }; return s.growth; }
  } };
}
const rej = (p, re) => assert.rejects(p, e => e.status === 400 && re.test(e.message));

test('read model: values and sources', async () => {
  const { deps } = stores();
  const { info } = await getBusiness(deps);
  assert.equal(info.name, 'AR Trade'); assert.equal(info.phone, '01977-554401'); assert.equal(info.postalCode, '1217'); assert.equal(info.locality, 'Dhaka'); assert.equal(info.country, 'BD');
  assert.equal(info.website, 'https://ar.test'); assert.deepEqual(info.social, { facebook: 'https://facebook.com/ar', x: 'not a url' });
  assert.equal(info.sources.phone, 'site'); assert.equal(info.sources.priceRange, 'seo.business'); assert.equal(info.sources.social, 'content.social');
  assert.equal(info.hours.length, 7); assert.equal(info.hours.find(h => h.day === 'Friday').closed, true); assert.equal(info.hours.find(h => h.day === 'Saturday').opens, '10:00');
});
test('read model with nothing saved never throws', async () => {
  const { deps } = stores({ site: {}, seo: null, content: null });
  const { info } = await getBusiness({ ...deps, readSite: async () => { throw new Error('db'); } });
  assert.equal(info.phone, ''); assert.deepEqual(info.hours, []); assert.equal(info.name, 'AR Trade International');
});
test('save routes each field to its real store and keeps other keys', async () => {
  const { deps, writes, s, bust } = stores();
  const { info } = await saveBusiness({ phone: '+880 1977-554401', email: 'new@ar.test', legalName: 'AR Trade Intl Ltd', priceRange: '$$', geoLat: '23.73', geoLng: 90.38 }, 'Amin', deps);
  assert.equal(s.site.heroTitle, 'Keep me'); assert.deepEqual(s.site.delivery, { a: 1 }); assert.equal(s.site.phone, '+880 1977-554401'); assert.equal(s.site.address, '159, Santinagar, Dhaka-1217');
  assert.equal(s.seo.business.legalName, 'AR Trade Intl Ltd'); assert.equal(s.seo.business.geoLat, 23.73); assert.equal(s.seo.general.preferredDomain, 'https://ar.test'); assert.equal(s.seo.business.hours.length, 1);
  assert.equal(info.legalName, 'AR Trade Intl Ltd'); assert.equal(info.email, 'new@ar.test'); assert.equal(bust.length, 1); assert.deepEqual(writes.map(w => w[0]), ['site', 'seo']);
});
test('a site-only patch does not touch seo, a seo-only patch not site', async () => {
  const a = stores(); await saveBusiness({ address: '5 Road, Dhaka-1000' }, 'x', a.deps); assert.deepEqual(a.writes.map(w => w[0]), ['site']);
  const b = stores(); await saveBusiness({ priceRange: '$' }, 'x', b.deps); assert.deepEqual(b.writes.map(w => w[0]), ['seo']);
});
test('validation of every field and boundaries; nothing is written on error', async () => {
  const { deps, writes } = stores();
  const bad = [[{ phone: '12345' }, /Phone/], [{ phone: 'abc12345' }, /Phone/], [{ phone: '1'.repeat(21) }, /Phone/], [{ whatsapp: '123456789' }, /WhatsApp/], [{ whatsapp: '1'.repeat(16) }, /WhatsApp/],
    [{ email: 'a@b' }, /E-mail/], [{ address: 'x'.repeat(201) }, /Address/], [{ legalName: 'x'.repeat(121) }, /Legal/], [{ priceRange: 'x'.repeat(21) }, /Price/],
    [{ geoLat: 91 }, /Latitude/], [{ geoLng: -181 }, /Longitude/], [{ geoLat: 'abc' }, /Latitude/], [{ hours: 'x' }, /list/], [{ hours: [{ days: ['Mon'], opens: '9', closes: '18:00' }] }, /Hours row 1/], [{ logo: 'http://x/y.png' }, /logo/]];
  for (const [p, re] of bad) await rej(saveBusiness({ phone: '01711111111', ...p }, 'x', deps), re);
  assert.equal(writes.length, 0);
  await saveBusiness({ phone: '123456', whatsapp: '1'.repeat(15), address: 'x'.repeat(200), legalName: 'y'.repeat(120), priceRange: 'z'.repeat(20), geoLat: 90, geoLng: -180 }, 'x', deps);
  await saveBusiness({ geoLat: '' }, 'x', deps);
});
test('hours: per-day input is grouped, closed days dropped, format', async () => {
  const { deps, s } = stores();
  await saveBusiness({ hours: [{ day: 'Sat', opens: '10:00', closes: '20:00' }, { day: 'Sunday', opens: '10:00', closes: '20:00' }, { day: 'Friday', closed: true }, { day: 'Mon', opens: '09:00', closes: '17:00' }] }, 'x', deps);
  assert.deepEqual(s.seo.business.hours, [{ days: ['Saturday', 'Sunday'], opens: '10:00', closes: '20:00' }, { days: ['Monday'], opens: '09:00', closes: '17:00' }].map(h => ({ ...h, days: WEEK.filter(d => h.days.includes(d)) })));
  const { info } = await getBusiness(deps);
  const lines = formatHours(info.hours);
  assert.equal(lines[0], 'Sat: 10:00-20:00'); assert.equal(lines.at(-1), 'Fri: Closed'); assert.equal(lines.length, 7);
  assert.deepEqual(formatHours([]), []); assert.equal(groupHours([]).length, 0); assert.deepEqual(expandHours([]), []);
  await saveBusiness({ hours: [] }, 'x', deps); assert.deepEqual(s.seo.business.hours, []);
});
test('copy block', async () => {
  const { deps } = stores(); const { info } = await getBusiness(deps);
  const c = gbpCopyBlock(info);
  assert.equal(c.name, 'AR Trade'); assert.equal(c.website, 'https://ar.test');
  assert.match(c.text, /^Business name: AR Trade\nPhone: 01977-554401\nAddress: 159, Santinagar, Dhaka-1217\nWebsite: https:\/\/ar\.test\nOpening hours:\nSat: 10:00-20:00/); assert.match(c.hours, /Fri: Closed/);
  assert.equal(gbpCopyBlock({}).text, '');
});
test('phone and address normalisation', () => {
  for (const p of ['01977554401', '+880 1977-554401', '8801977554401', '008801977554401', '1977554401']) assert.equal(normPhone(p), '01977554401');
  assert.ok(phonesMatch('01977554401', '+880 1977-554401')); assert.ok(!phonesMatch('01977554401', '01977554402')); assert.ok(!phonesMatch('', ''));
  assert.ok(addressesMatch('159 Santinagar, Dhaka 1217', '159, Santinagar, Dhaka-1217')); assert.ok(addressesMatch('Shop 2, 159 Santinagar, DHAKA-1217, Bangladesh', '159, Santinagar, Dhaka-1217'));
  assert.ok(!addressesMatch('160 Santinagar Dhaka 1217', '159, Santinagar, Dhaka-1217')); assert.ok(!addressesMatch('', 'x')); assert.equal(normText('  A,, b  '), 'a b');
  assert.deepEqual(extractContacts('Call 01977-554401 / +880 1711 111222 or a@b.co, not 12345678901234.').phones.map(normPhone), ['01977554401', '01711111222']);
  assert.ok(hoursMatch('Sat 10:00 - 20:00', ['Sat: 10:00-20:00'])); assert.ok(!hoursMatch('Sat 9:00-20:00', ['Sat: 10:00-20:00']));
});
const ld = (o = {}) => ({ ld: [{ '@type': 'WebSite' }, { '@type': ['Store', 'ElectronicsStore'], '@id': 'x/#store', telephone: '01977-554401', email: 'shop@ar.test', priceRange: '৳', sameAs: ['https://facebook.com/ar'], address: { streetAddress: '159, Santinagar, Dhaka-1217', addressLocality: 'Dhaka', postalCode: '1217' }, ...o }] });
test('NAP rows: all matching', async () => {
  const { deps, s } = stores({ content: { social: { facebook: 'https://facebook.com/ar' }, faqs: [{ q: 'q', a: 'Mail Shop@AR.test or 8801977554401' }] } });
  const info = (await getBusiness(deps)).info;
  const rows = buildNapRows({ info, siteRow: s.site, home: storeBlock(ld()), contact: storeBlock(ld()), content: s.content, gbp: {} });
  assert.equal(rows.filter(r => !r.match && r.severity !== 'info').length, 0, JSON.stringify(rows.filter(r => !r.match)));
  assert.ok(rows.some(r => r.place.startsWith('content.faqs') && r.match));
});
test('NAP rows: mismatches', async () => {
  const { deps, s } = stores();
  const info = (await getBusiness(deps)).info;
  const rows = buildNapRows({ info, siteRow: s.site, home: storeBlock(ld({ telephone: '01711111111', email: 'other@x.test' })), contact: null, content: s.content, gbp: { listedName: 'Other Name', listedPhone: '01977554401', listedAddress: '1 Road Chittagong', listedHours: 'Sat 09:00-20:00' } });
  const bad = rows.filter(r => !r.match);
  assert.ok(bad.some(r => r.field === 'phone' && r.place.startsWith('Home') && r.severity === 'error'));
  assert.ok(bad.some(r => r.field === 'email' && r.place.startsWith('Home')));
  assert.ok(bad.some(r => r.place.startsWith('Contact') && r.field === 'store block'));
  assert.ok(bad.some(r => r.place.startsWith('content.policies') && r.field === 'email' && r.value === 'Old@AR.test' && r.severity === 'warning'));
  assert.ok(!bad.some(r => r.place.startsWith('content.policies') && r.field === 'phone'));
  assert.ok(bad.some(r => r.place.startsWith('Google') && r.field === 'name') && bad.some(r => r.place.startsWith('Google') && r.field === 'address') && bad.some(r => r.place.startsWith('Google') && r.field === 'hours'));
  assert.ok(rows.some(r => r.place.startsWith('Google') && r.field === 'phone' && r.match));
  assert.ok(countIssues(rows) >= 6);
});
test('NAP: built-in default address warning when no address is saved', async () => {
  const { deps, s } = stores({ site: { email: 'a@b.co', phone: '01977554401' } });
  const info = (await getBusiness(deps)).info;
  const l = ld({ email: 'a@b.co', telephone: '01977554401' });
  const rows = buildNapRows({ info, siteRow: s.site, home: storeBlock(l), contact: storeBlock(l), content: {}, gbp: {} });
  const w = rows.filter(r => r.note === DEFAULT_ADDRESS_NOTE); assert.equal(w.length, 1); assert.equal(w[0].severity, 'warning'); assert.equal(w[0].match, false);
  assert.ok(!rows.some(r => r.field === 'postal code'));
});
test('runNapCheck stores napLast and survives a failing page', async () => {
  const { deps, s } = stores();
  let n = 0; const r = await runNapCheck({ ...deps, now: () => new Date('2026-01-01T00:00:00Z'), previewMeta: async p => { if (p === '/contact') throw new Error('boom'); n++; return ld(); } });
  assert.equal(r.at, '2026-01-01T00:00:00.000Z'); assert.equal(n, 1); assert.ok(r.rows.some(x => x.field === 'pages')); assert.deepEqual(s.growth.napLast, r); assert.equal(r.issues, countIssues(r.rows));
  assert.deepEqual(contentStrings({ social: { a: 'x' }, b: ['y'] }).map(x => x.path), ['content.b[0]']);
});
test('GBP url validation and workflow state', async () => {
  for (const ok of ['https://business.google.com/x', 'https://g.page/r/abc/review', 'https://goo.gl/maps/abc', 'https://maps.app.goo.gl/abc', 'https://share.google/abc', 'https://www.google.com/maps/place/x', '']) assert.equal(checkGoogleUrl(ok, 'L'), ok);
  for (const bad of ['http://google.com/x', 'https://evil.com/google.com', 'https://notgoogle.com', 'https://google.com.evil.com/', 'javascript:alert(1)', 'google.com', 'https://u:p@google.com/']) assert.throws(() => checkGoogleUrl(bad, 'L'), e => e.status === 400, bad);
  const { deps, s } = stores();
  const g = await saveGbp({ reviewLink: 'https://g.page/r/abc/review', claimed: true, listedName: ' AR  Trade ', checklist: { claim: true } }, deps);
  assert.equal(g.reviewLink, 'https://g.page/r/abc/review'); assert.equal(g.listedName, 'AR Trade'); assert.equal(g.checklist.find(c => c.id === 'claim').done, true); assert.equal(g.checklist.length, GBP_STEPS.length);
  await saveGbp({ checklist: { photos: true } }, deps); assert.equal(s.growth.gbp.checklist.claim, true); assert.equal(s.growth.gbp.reviewLink, 'https://g.page/r/abc/review');
  assert.equal(await getReviewLink(deps), 'https://g.page/r/abc/review');
  await rej(saveGbp({ profileUrl: 'http://x.com' }, deps), /Profile link/); await rej(saveGbp({ checklist: { nope: true } }, deps), /Unknown/); await rej(saveGbp({ listedName: 'x'.repeat(121) }, deps), /Listed name/);
  assert.equal(gbpView(null).checklist.every(c => !c.done), true); assert.equal((await getGbp(deps)).claimed, true);
});

test('storeLd: the saved business block (legal name, price range, geo, hours) reaches the page', async () => {
  const { storeLd } = await import('../src/seoSchema.js');
  const base = 'https://example.test';
  const plain = storeLd({ base, site: { phone: '+880 1977-554401', address: '159, Santinagar, Dhaka-1217' } });
  assert.equal(plain.priceRange, '৳'); assert.equal(plain.legalName, undefined); assert.equal(plain.geo, undefined);
  const ld = storeLd({ base, site: { address: '159, Santinagar, Dhaka-1217' }, business: { legalName: 'AR Trade International Ltd', priceRange: '৳৳', geoLat: 23.73, geoLng: 90.41, hours: [{ days: ['Saturday', 'Sunday'], opens: '10:00', closes: '20:00' }] } });
  assert.equal(ld.legalName, 'AR Trade International Ltd'); assert.equal(ld.priceRange, '৳৳');
  assert.equal(ld.geo.latitude, 23.73); assert.equal(ld.openingHoursSpecification[0].opens, '10:00');
  const nullGeo = storeLd({ base, site: {}, business: { geoLat: null, geoLng: null } });
  assert.equal(nullGeo.geo, undefined);
});
