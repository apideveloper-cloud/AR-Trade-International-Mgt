import test from 'node:test';
import assert from 'node:assert/strict';
import { hasWarranty, productOut } from '../src/routes/shared.js';

const row = { id: 1, category_id: 'toner', brand: 'HP', name: 'HP 12A', old_price: 0, price: 100, img: '/x.png', stock: 1, popular: 0, is_new: 0, featured: 0, tech: '', color: '', yield_info: '', part: '', compat: '', spec: '', extra: null, slug: 'hp-12a' };

test('warranty: a product counts as covered unless the admin set No', () => {
  assert.equal(hasWarranty({}), true);                    // older rows without the column
  assert.equal(hasWarranty({ warranty: null }), true);
  assert.equal(hasWarranty({ warranty: 1 }), true);
  assert.equal(hasWarranty({ warranty: 0 }), false);
  assert.equal(hasWarranty({ warranty: false }), false);
});

test('warranty: only an explicit No travels in the light product list', () => {
  assert.equal('warranty' in productOut({ ...row, warranty: 1 }), false);
  assert.equal('warranty' in productOut(row), false);
  assert.equal(productOut({ ...row, warranty: 0 }).warranty, false);
});
