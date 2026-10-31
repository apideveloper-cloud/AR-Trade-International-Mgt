import test from 'node:test';
import assert from 'node:assert/strict';
import { productIdOf, productPath, productSlug } from '../src/slug.js';

test('product addresses use lower-case keywords joined by hyphens, with the id last', () => {
  assert.equal(productPath({ id: 21554, name: 'HP 230A CMYK Toner Cartridge Full Set' }), '/product/hp-230a-cmyk-toner-cartridge-full-set-21554');
});
test('symbols and filler words are dropped', () => {
  assert.equal(productSlug('Canon imageRUNNER 2206N Photocopier & Scanner (A3) for the Office'), 'canon-imagerunner-2206n-photocopier-scanner-a3-office');
});
test('the keyword part is short and never ends in the middle of a word', () => {
  const s = productSlug('HP 981Y High-Yield Cyan PageWide Cartridge for HP PageWide Enterprise Color 765 Printer Series');
  assert.ok(s.length <= 60 && !s.endsWith('-'), s);
});
test('a name with no Latin letters or digits still gets a working address', () => {
  assert.equal(productPath({ id: 99, name: 'ফটোকপিয়ার' }), '/product/99');
});
test('the id is read back from the new and from the old address', () => {
  assert.equal(productIdOf('hp-230a-cmyk-toner-cartridge-full-set-21554'), '21554');
  assert.equal(productIdOf('21554'), '21554');
  assert.equal(productIdOf('no-number-here'), '');
});
