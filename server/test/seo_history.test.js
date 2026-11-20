import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, diffSnapshots, summaryOf, buildEntry, planRevert, redactSettings, unredactSettings, clipValue, fieldsOf, deepEqual } from '../src/admin/seoHistoryMap.js';

const manual = { metaTitle: 'A', metaDescription: 'D', focusKeyword: 'k', secondaryKeywords: ['x'], robotsIndex: true, faq: [{ q: 'q', a: 'a' }], other: 1 };

test('snapshot keeps manual fields, slug and product image alts only', () => {
  const s = snapshot('product', manual, { slug: 'abc', imageAlts: [{ src: '/a.jpg', alt: 'x', width: 5 }] });
  assert.equal(s.metaTitle, 'A'); assert.equal(s.slug, 'abc'); assert.equal('other' in s, false);
  assert.deepEqual(s.imageAlts, [{ src: '/a.jpg', alt: 'x' }]);
  assert.equal('imageAlts' in snapshot('blog', manual, { imageAlts: [{ src: 'a', alt: 'b' }] }), false);
  assert.equal('slug' in snapshot('blog', manual), false);
});

test('diffSnapshots ignores equal values and compares arrays/objects deeply', () => {
  const a = snapshot('product', manual), b = snapshot('product', { ...manual, secondaryKeywords: ['x'], faq: [{ q: 'q', a: 'a' }] });
  assert.deepEqual(diffSnapshots(a, b), []);
  const c = snapshot('product', { ...manual, metaTitle: 'B', faq: [{ q: 'q', a: 'changed' }], secondaryKeywords: ['x', 'y'] });
  assert.deepEqual(diffSnapshots(a, c).map(d => d.field).sort(), ['faq', 'metaTitle', 'secondaryKeywords']);
  const d = diffSnapshots(a, c).find(x => x.field === 'metaTitle');
  assert.deepEqual(d, { field: 'metaTitle', from: 'A', to: 'B' });
  assert.equal(deepEqual({ a: 1, b: undefined }, { a: 1 }), true);
  assert.equal(diffSnapshots({ x: 1 }, {}).length, 1);
  assert.deepEqual(diffSnapshots(null, null), []);
});

test('summaryOf is short and never longer than 300', () => {
  assert.equal(summaryOf([{ field: 'metaTitle' }, { field: 'faq' }], 'save'), 'Meta title, FAQ changed');
  assert.equal(summaryOf([{ field: 'slug' }], 'slug'), 'Web address changed');
  assert.match(summaryOf([{ field: 'faq' }], 'revert'), /^Reverted: FAQ/);
  const many = Array.from({ length: 80 }, (_, i) => ({ field: 'settingKeyNumber' + i }));
  const s = summaryOf(many, 'settings');
  assert.ok(s.length <= 300); assert.match(s, /more changed$/);
  assert.equal(summaryOf([], 'save'), 'No change');
});

test('buildEntry stores only the changed keys and null when nothing changed', () => {
  const before = snapshot('product', manual), after = snapshot('product', { ...manual, metaTitle: 'Z' });
  const e = buildEntry({ type: 'product', id: 7, action: 'save', source: 'editor', before, after, who: 'Rahim' });
  assert.deepEqual(JSON.parse(e.before_json), { metaTitle: 'A' });
  assert.deepEqual(JSON.parse(e.after_json), { metaTitle: 'Z' });
  assert.equal(e.entity_id, '7'); assert.equal(e.changed_by, 'Rahim'); assert.equal(e.summary, 'Meta title changed');
  assert.equal(buildEntry({ type: 'product', id: 7, before, after: before }), null);
  assert.equal(buildEntry({ type: 'product', id: 'x'.repeat(200), before: { a: 1 }, after: { a: 2 }, who: 'w'.repeat(200) }).entity_id.length, 80);
});

test('planRevert without conflicts applies the before values', () => {
  const entry = { before: { metaTitle: 'A', faq: [] }, after: { metaTitle: 'Z', faq: [{ q: 'q', a: 'a' }] } };
  const p = planRevert(entry, { metaTitle: 'Z', faq: [{ q: 'q', a: 'a' }], slug: 'whatever' });
  assert.equal(p.ok, true); assert.deepEqual(p.conflicts, []);
  assert.deepEqual(p.apply, { metaTitle: 'A', faq: [] });
});

test('planRevert reports a conflict when someone changed a field since', () => {
  const entry = { before: { metaTitle: 'A', focusKeyword: 'f' }, after: { metaTitle: 'Z', focusKeyword: 'g' } };
  const p = planRevert(entry, { metaTitle: 'Newer', focusKeyword: 'g' });
  assert.equal(p.ok, false);
  assert.deepEqual(p.conflicts, [{ field: 'metaTitle', expected: 'Z', current: 'Newer' }]);
  assert.deepEqual(p.apply, { metaTitle: 'A', focusKeyword: 'f' });
});

test('redactSettings keeps only 4 characters of verification tokens and leaves the rest', () => {
  const s = { verification: { google: 'abcdefghijkl', bing: '', ga4: 'G-ABCD1234' }, templates: { product: { title: 'x' } }, apiToken: 'secret-value' };
  const r = redactSettings(s);
  assert.equal(r.verification.google, 'abcd…[12]'); assert.equal(r.verification.bing, ''); assert.equal(r.verification.ga4, 'G-ABCD1234');
  assert.equal(r.apiToken, 'secr…[12]'); assert.deepEqual(r.templates, s.templates);
  assert.equal(s.verification.google, 'abcdefghijkl'); // input untouched
  assert.ok(!JSON.stringify(r).includes('efghijkl'));
});

test('unredactSettings keeps the real current token where history holds a redacted one', () => {
  const stored = { verification: { google: 'abcd…[12]', ga4: 'G-NEW12345' } };
  const out = unredactSettings(stored, { verification: { google: 'abcdefghijkl', ga4: 'G-OLD12345' } });
  assert.deepEqual(out, { verification: { google: 'abcdefghijkl', ga4: 'G-NEW12345' } });
});

test('settings entries hold only the changed top-level keys', () => {
  const before = redactSettings({ a: { x: 1 }, b: 2, verification: { google: 'abcdefgh' } });
  const after = redactSettings({ a: { x: 1 }, b: 3, verification: { google: 'abcdefgh' } });
  const e = buildEntry({ type: 'settings', id: 'seo', action: 'settings', source: 'settings', before, after });
  assert.deepEqual(JSON.parse(e.before_json), { b: 2 }); assert.deepEqual(JSON.parse(e.after_json), { b: 3 });
});

test('clipValue and fieldsOf clip long values to 300 characters', () => {
  assert.equal(clipValue('x'.repeat(1000)).length, 300);
  assert.equal(clipValue(undefined), ''); assert.equal(clipValue([1, 2]), '[1,2]'); assert.equal(clipValue(true), 'true');
  const f = fieldsOf({ before_json: JSON.stringify({ faq: [{ q: 'q'.repeat(500), a: 'a' }] }), after_json: JSON.stringify({ faq: [] }) });
  assert.equal(f[0].field, 'faq'); assert.equal(f[0].from.length, 300); assert.equal(f[0].to, '[]');
  assert.deepEqual(fieldsOf({ before_json: 'not json', after_json: null }), []);
});
