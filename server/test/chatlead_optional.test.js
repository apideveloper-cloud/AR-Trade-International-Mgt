import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// the chat start form needs a name and a mobile number; the location is optional
const src = readFileSync(new URL('../src/chatLeads.js', import.meta.url), 'utf8');
test('chat lead: name and mobile are checked, location is not required', () => {
  assert.match(src, /Please enter your name/);
  assert.match(src, /valid mobile number/);
  assert.doesNotMatch(src, /Please enter your location/);
});

import { readLeadForm } from '../src/chatLeads.js';
test('chat lead: usage type is one of Personal, Office, Reseller (Personal by default)', () => {
  const base = { name: 'Rahim Uddin', phone: '01712345678' };
  assert.equal(readLeadForm({ ...base, usage: 'Reseller' }).usage, 'Reseller');
  assert.equal(readLeadForm({ ...base, usage: 'Office' }).usage, 'Office');
  assert.equal(readLeadForm({ ...base, usage: 'hacker' }).usage, 'Personal');
  assert.equal(readLeadForm(base).usage, 'Personal');
});
