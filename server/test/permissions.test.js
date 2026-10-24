import test from 'node:test';
import assert from 'node:assert/strict';
import { PERM_KEYS, DEFAULTS, ROLE_DEFS, ROLE_NAMES, REGISTRABLE, MASTER, MASTER_ONLY, can, permsOf } from '../src/permissions.js';

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
  assert.equal(permsOf(MASTER).size, PERM_KEYS.length);
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
