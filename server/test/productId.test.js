import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// the product page and the review / detail routes must agree on what a product is called in an address
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '../../client/src/pages/product');
const page = ['ProductPage.jsx', 'useProductEffects.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const api = fs.readFileSync(path.join(here, '../src/routes/catalog.js'), 'utf8');

test('the product page asks the server by product number, not by the words of its address', () => {
  assert.doesNotMatch(page, /`\/products\/\$\{id\}\/reviews`/);
  assert.doesNotMatch(page, /'\/products\/' \+ id\b/);
  assert.match(page, /\/products\/\$\{pid\}\/reviews/);
});

test('no product route turns the address into NaN', () => {
  const routes = api.match(/app\.(get|post)\('\/api\/products\/:id[^]*?\n\s*\}\)\);/g) || [];
  assert.ok(routes.length >= 3);
  for (const r of routes) assert.doesNotMatch(r, /parseInt\(req\.params\.id/);
});
