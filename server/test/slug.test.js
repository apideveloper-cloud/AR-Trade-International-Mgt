import test from 'node:test';
import assert from 'node:assert/strict';
import { legacySlug, productIdOf, productPath, productSlug } from '../src/slug.js';
import { pickSlug } from '../src/productSlugs.js';

test('a stored address is used as it is, with no id', () => {
  assert.equal(productPath({ id: 21554, name: 'HP 230A CMYK Toner Cartridge Full Set', slug: 'hp-230a-cmyk-toner-cartridge-full-set' }), '/product/hp-230a-cmyk-toner-cartridge-full-set');
});
test('a product with no stored address falls back to the old form with the id last', () => {
  assert.equal(productPath({ id: 21554, name: 'HP 230A CMYK Toner Cartridge Full Set' }), '/product/hp-230a-cmyk-toner-cartridge-full-set-21554');
  assert.equal(legacySlug({ id: 21554, name: 'HP 230A CMYK Toner Cartridge Full Set' }), 'hp-230a-cmyk-toner-cartridge-full-set-21554');
});
test('a taken address gets the longer form, then the part number, then the id', async () => {
  const name = 'HP 981Y High-Yield Cyan PageWide Cartridge for HP PageWide Enterprise Color 765 Printer Series';
  const short = productSlug(name);
  assert.equal(await pickSlug(async () => false, { id: 1, name }), short);
  const long = await pickSlug(async s => s === short, { id: 1, name });
  assert.ok(long.length > short.length && long.startsWith(short));
  const withPart = await pickSlug(async s => s === short || s === productSlug(name, 100), { id: 1, name, part: 'L0R12A' });
  assert.ok(withPart.endsWith('-l0r12a'), withPart);
  assert.equal(await pickSlug(async () => true, { id: 7, name: 'HP 82 Cyan' }), 'hp-82-cyan-7');
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
