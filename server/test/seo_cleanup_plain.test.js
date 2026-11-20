import test from 'node:test';
import assert from 'node:assert/strict';
import { plain, collectionLd } from '../src/seoHelpers.js';

test('plain: decodes common entities once and strips tags, including a tag closed by &gt;', () => {
  assert.equal(plain('<p>Ink &amp; Toner &gt; 5 &quot;pages&quot;</p>'), 'Ink & Toner > 5 "pages"');
  assert.equal(plain('Scan <em class=”short-description”&gt;Area 8.5 inch'), 'Scan Area 8.5 inch');
  assert.equal(plain('&amp;lt;b&amp;gt;'), '&lt;b&gt;'); // decoded once only
  assert.equal(plain(null), '');
  assert.equal(plain('বাংলা &amp; English'), 'বাংলা & English');
});

test('plain: removes a leftover attribute fragment such as class=”x”&gt;', () => {
  const junk = 'Model: Epson V39<br />' + String.fromCharCode(10) + 'class=“short-description”&gt;Scan Area:8.5 inch';
  assert.equal(plain(junk), 'Model: Epson V39 Scan Area:8.5 inch');
  assert.equal(plain('a class="x">b'), 'a b');
  assert.equal(plain('The classroom class is fun'), 'The classroom class is fun');
});

test('collectionLd: an empty list leaves out the ItemList', () => {
  const empty = collectionLd({ name: 'Networking', url: 'https://x/c', description: 'd', total: 0, offset: 0, items: [] });
  assert.equal(empty['@type'], 'CollectionPage'); assert.equal(empty.mainEntity, undefined);
  const full = collectionLd({ name: 'N', url: 'u', description: 'd', total: 1, offset: 0, items: [{ url: 'p', name: 'a' }] });
  assert.equal(full.mainEntity.itemListElement[0].position, 1);
});
