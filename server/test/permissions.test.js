import test from 'node:test';
import assert from 'node:assert/strict';
import { PERM_KEYS, DEFAULTS, ROLE_DEFS, ROLE_NAMES, REGISTRABLE, MASTER, MASTER_ONLY, AUDIT_VIEW, PRODUCTS_WRITE, PURCHASE_APPROVE, ADMIN_ONLY, can, permsOf } from '../src/permissions.js';

test('every role has defaults and every default is a known permission', () => {
  for (const r of ROLE_NAMES) {
    assert.ok(Array.isArray(DEFAULTS[r]), r);
    for (const p of DEFAULTS[r]) assert.ok(PERM_KEYS.includes(p), `${r}: ${p}`);
  }
});

test('the requested seven roles exist, in order', () => {
  assert.deepEqual(ROLE_NAMES.slice(0, 7), ['Master Admin', 'Admin', 'Manager', 'Accountant', 'Purchase Officer', 'RM', 'Field Officer']);
});

test('Master Admin holds everything; nobody else can ever hold the role-matrix permission', () => {
  assert.equal(permsOf(MASTER).size, PERM_KEYS.length + ADMIN_ONLY.length); // + the fixed Master Admin / Admin permissions
  assert.ok(can({ role: MASTER }, MASTER_ONLY));
  for (const r of ROLE_NAMES.filter(x => x !== MASTER)) {
    assert.ok(!DEFAULTS[r].includes(MASTER_ONLY), r);
    assert.ok(!can({ role: r }, MASTER_ONLY), r);
  }
});

test('can() accepts a list (any one is enough) and rejects unknown roles', () => {
  assert.ok(can({ role: MASTER }, ['nothing', 'orders.view']));
  assert.ok(!can({ role: 'Nobody' }, 'orders.view'));
  assert.ok(!can(null, 'orders.view'));
});

test('self-registration can never pick Master Admin or Admin', () => {
  assert.ok(!REGISTRABLE.includes(MASTER) && !REGISTRABLE.includes('Admin'));
  assert.ok(REGISTRABLE.includes('Field Officer') && REGISTRABLE.includes('Accountant'));
});

test('role definitions are unique and the legacy roles are flagged', () => {
  assert.equal(new Set(ROLE_NAMES).size, ROLE_DEFS.length);
  assert.deepEqual(ROLE_DEFS.filter(r => r.legacy).map(r => r.name), ['Delivery rider', 'Marketing manager', 'Content writer']);
});

test('the audit log is for Master Admin and Admin only, and cannot be given to any other role', () => {
  assert.ok(!PERM_KEYS.includes(AUDIT_VIEW), 'it is not part of the editable role matrix');
  assert.ok(can({ role: MASTER }, AUDIT_VIEW));
  assert.ok(can({ role: 'Admin' }, AUDIT_VIEW));
  for (const r of ROLE_NAMES.filter(x => x !== MASTER && x !== 'Admin')) assert.ok(!can({ role: r }, AUDIT_VIEW), r);
});

test('only Master Admin and Admin may change products, whatever the database says', () => {
  assert.ok(!PERM_KEYS.includes(PRODUCTS_WRITE), 'it is not part of the editable role matrix');
  assert.ok(can({ role: MASTER }, PRODUCTS_WRITE));
  assert.ok(can({ role: 'Admin' }, PRODUCTS_WRITE));
  for (const r of ROLE_NAMES.filter(x => x !== MASTER && x !== 'Admin')) {
    assert.ok(!DEFAULTS[r].includes(PRODUCTS_WRITE), r + ' must not default to it');
    assert.ok(!can({ role: r }, PRODUCTS_WRITE), r);
  }
  assert.ok(DEFAULTS['Purchase Officer'].includes('products.view'), 'but they can still look at products');
});

test('only Master Admin and Admin may approve a purchase', () => {
  assert.ok(ADMIN_ONLY.includes(PURCHASE_APPROVE));
  assert.ok(!PERM_KEYS.includes(PURCHASE_APPROVE), 'it is not part of the editable role matrix');
  assert.ok(can({ role: MASTER }, PURCHASE_APPROVE));
  assert.ok(can({ role: 'Admin' }, PURCHASE_APPROVE));
  for (const r of ROLE_NAMES.filter(x => x !== MASTER && x !== 'Admin')) assert.ok(!can({ role: r }, PURCHASE_APPROVE), r);
  assert.ok(DEFAULTS['Purchase Officer'].includes('inventory.manage'), 'the officer still adds purchases and stocks them in');
});
