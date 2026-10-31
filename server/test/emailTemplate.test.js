import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES, renderEmail } from '../src/emailTemplate.js';

const base = { subject: 'Eid deals', headline: 'Worth your attention', body: 'Line one\nLine two', siteUrl: 'https://shop.example', prefsUrl: 'https://shop.example/prefs/abc' };

test('every email carries the unsubscribe link and the shop name', () => {
  const { html, text } = renderEmail(base);
  assert.match(html, /href="https:\/\/shop\.example\/prefs\/abc"/);
  assert.match(html, /Unsubscribe or change what you receive/);
  assert.match(text, /prefs\/abc/);
});

test('user-supplied text is escaped, never injected as markup', () => {
  const { html } = renderEmail({ ...base, headline: '<script>alert(1)</script>', kicker: '"><img src=x>', products: [{ id: 1, name: '<b>HP</b> toner', price: 100, old: 0, img: '' }] });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x>/);
  assert.match(html, /&lt;b&gt;HP&lt;\/b&gt; toner/);
});

test('product cards show price, a discount badge only when there is a discount, and link to the product page', () => {
  const { html } = renderEmail({ ...base, products: [{ id: 7, name: 'Cut price', price: 800, old: 1000, img: '/api/uploads/a.png' }, { id: 8, name: 'Full price', price: 500, old: 500, img: '' }] });
  assert.match(html, /-20%/);
  assert.equal((html.match(/-\d+%/g) || []).length, 1);
  assert.match(html, /৳ 800/);
  assert.match(html, /href="https:\/\/shop\.example\/product\/cut-price-7"/);
  assert.match(html, /src="https:\/\/shop\.example\/api\/uploads\/a\.png"/); // relative pictures become absolute
});

test('at most eight products, two per row, and the button only appears with both a label and a link', () => {
  const products = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'P' + i, price: 10, old: 0, img: '' }));
  const { html } = renderEmail({ ...base, products });
  assert.equal((html.match(/\/product\//g) || []).length, 8);
  assert.equal((html.match(/<tr><td width="50%"/g) || []).length, 4);
  assert.doesNotMatch(renderEmail({ ...base, cta: 'Shop' }).html, />Shop</);
  assert.match(renderEmail({ ...base, cta: 'Shop', ctaUrl: 'https://shop.example/x' }).html, />Shop</);
});

test('an unknown banner colour falls back to navy', () => {
  assert.ok(HEROES.navy && HEROES.pink);
  assert.match(renderEmail({ ...base, hero: 'nope' }).html, new RegExp(HEROES.navy[0]));
});
