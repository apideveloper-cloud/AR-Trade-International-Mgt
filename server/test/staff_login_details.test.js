import test from 'node:test';
import assert from 'node:assert/strict';
import { loginPhone } from '../src/admin/auth.js';
import { staffDetails } from '../src/admin/team.js';

test('staff sign-in: a mobile number with a country code finds the account stored as 11 digits', () => {
  assert.equal(loginPhone('01712345678'), '01712345678');
  assert.equal(loginPhone('+880 1712-345678'), '01712345678');
  assert.equal(loginPhone('8801712345678'), '01712345678');
});

test('staff sign-in: an email is never read as a phone number', () => {
  assert.equal(loginPhone('user01712345678@mail.com'), '');
  assert.equal(loginPhone('rider@artradeinternational.com'), '');
});

test('staff details: a field that is not sent keeps its stored value, one sent empty is cleared', () => {
  const cur = { nid: '1234567890', present_address: 'House 1', contact_address: 'House 2', ref_name: 'Rina', ref_phone: '01711000000' };
  assert.deepEqual(staffDetails({}, cur), { nid: '1234567890', present_address: 'House 1', contact_address: 'House 2', ref_name: 'Rina', ref_phone: '01711000000' });
  const d = staffDetails({ nid: '', refName: '' }, cur);
  assert.equal(d.nid, ''); assert.equal(d.ref_name, ''); assert.equal(d.present_address, 'House 1');
  assert.deepEqual(staffDetails({}), { nid: '', present_address: '', contact_address: '', ref_name: '', ref_phone: '' });
});
