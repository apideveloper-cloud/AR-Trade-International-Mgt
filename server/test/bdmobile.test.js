import test from 'node:test';
import assert from 'node:assert/strict';
import { bdMobile } from '../src/util.js';
import { readLeadForm } from '../src/chatLeads.js';

test('bdMobile: the usual ways of writing a Bangladesh mobile number', () => {
  for (const v of ['01712345678', '01712-345678', '01712 345 678', '+8801712345678', '+880 1712-345678', '8801712345678', '1712345678', '(0171) 2345678'])
    assert.equal(bdMobile(v), '01712345678', v);
  assert.equal(bdMobile('01912345678'), '01912345678');
  assert.equal(bdMobile('01312345678'), '01312345678');
});

test('bdMobile: everything else is refused', () => {
  for (const v of ['', null, undefined, '0171234567', '017123456789', '01212345678', '01012345678', '02712345678', 'abc01712345678', '01712345678x', '0171-234-5678-9', '+8791712345678', '880171234567'])
    assert.equal(bdMobile(v), '', String(v));
});

test('chat lead: a number written with +880 is saved as 01XXXXXXXXX, a bad operator is refused', () => {
  assert.equal(readLeadForm({ name: 'Rahim Uddin', phone: '+880 1712-345678' }).phone, '01712345678');
  assert.throws(() => readLeadForm({ name: 'Rahim Uddin', phone: '01212345678' }), /valid mobile number/);
});
