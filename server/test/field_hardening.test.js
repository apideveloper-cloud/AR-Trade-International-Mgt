// Run with:  npm test   (no database needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveImage } from '../src/field/sales_util.js';
import { numberId } from '../src/field/modules/purchase.js';
import { words } from '../src/quotation.js';

test('proof images only accept real image data URLs of a sane size', () => {
  assert.throws(() => saveImage('data:text/html;base64,PGI+', 'x'), /JPG, PNG or WebP/);
  assert.throws(() => saveImage('../../etc/passwd', 'x'), /JPG, PNG or WebP/);
  assert.throws(() => saveImage('data:image/jpeg;base64,' + Buffer.alloc(3 * 1048576).toString('base64'), 'x'), /under/);
  assert.throws(() => saveImage('data:image/jpeg;base64,AAAA', 'x', { png: true }), /PNG/);
});

test('purchase order numbers are padded and never doubled', () => {
  assert.equal(numberId('PO-', 884), 'PO-0884');
  assert.equal(numberId('PO-', 'PO-0884'), 'PO-0884');
});

test('amount in words handles big and empty values', () => {
  assert.equal(words(0), 'ZERO');
  assert.equal(words(Number.NaN), 'ZERO');
  assert.equal(words(-7500), 'SEVEN THOUSAND FIVE HUNDRED');
});

import { trackPointOk } from '../src/field/core/rules.js';
test('a GPS point needs lat, lng and time (null must not become 0, 0 at 1970)', () => {
  assert.equal(trackPointOk({ lat: 23.7, lng: 90.4, time: '2026-11-20T10:00:00Z' }), true);
  assert.equal(trackPointOk({ lat: 0, lng: 0, time: '2026-11-20T10:00:00Z' }), true);
  assert.equal(trackPointOk({ lat: null, lng: 90.4, time: '2026-11-20T10:00:00Z' }), false);
  assert.equal(trackPointOk({ lat: 23.7, lng: '', time: '2026-11-20T10:00:00Z' }), false);
  assert.equal(trackPointOk({ lat: 23.7, lng: 90.4 }), false);
  assert.equal(trackPointOk(null), false);
});
