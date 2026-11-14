import test from 'node:test';
import assert from 'node:assert/strict';
import { normPhone, genPassword, isPlaceholderEmail, placeholderEmail, attemptsExceeded, recordFailedAttempt, _resetAttempts, MAX_ATTEMPTS, ATTEMPT_WINDOW } from '../src/routes/auth.js';

test('normPhone: all spellings of one mobile collapse to 01XXXXXXXXX', () => {
  for (const v of ['01712345678', '+8801712345678', '8801712345678', '1712-345678']) assert.equal(normPhone(v), '01712345678');
  assert.equal(normPhone('12345'), '12345');
  assert.equal(normPhone(''), '');
});

test('placeholder emails', () => {
  assert.equal(placeholderEmail('01712345678'), '01712345678@noemail.invalid');
  assert.ok(isPlaceholderEmail('01712345678@NoEmail.invalid '));
  assert.ok(!isPlaceholderEmail('a@gmail.com'));
  assert.ok(!isPlaceholderEmail(null));
});

test('genPassword: 10 chars, letters and digits, no look-alikes', () => {
  for (let i = 0; i < 200; i++) {
    const p = genPassword();
    assert.equal(p.length, 10);
    assert.match(p, /[A-Za-z]/);
    assert.match(p, /\d/);
    assert.doesNotMatch(p, /[0O1lI]/);
  }
});

test('attempt limiter: 5 failures per order per hour, then expires', () => {
  _resetAttempts();
  const t = 1000;
  for (let i = 0; i < MAX_ATTEMPTS; i++) { assert.equal(attemptsExceeded(7, t), false); recordFailedAttempt(7, t); }
  assert.equal(attemptsExceeded(7, t + 1), true);
  assert.equal(attemptsExceeded(8, t), false);
  assert.equal(attemptsExceeded(7, t + ATTEMPT_WINDOW + 1), false);
  recordFailedAttempt(7, t + ATTEMPT_WINDOW + 2);
  assert.equal(attemptsExceeded(7, t + ATTEMPT_WINDOW + 3), false);
});

// Importing the route module pulls in timers (rate limiter) that would keep the runner alive.
test.after(() => { setTimeout(() => process.exit(process.exitCode || 0), 200); });
