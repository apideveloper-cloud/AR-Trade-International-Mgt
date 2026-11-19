import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { DEFAULT_DIR, NAME, backupFileName, dirOf, isInside, stamp } from '../src/backup/config.js';
import { MAX_WRONG, checkLock, recordWrong } from '../src/backup/lockout.js';
import { dumpIsComplete } from '../src/backup/dump.js';
import { isDue } from '../src/backup/schedule.js';
import { isStrayFile } from '../src/backup/prune.js';

test('stamp uses Bangladesh time (UTC+6)', () => {
  assert.equal(stamp(Date.UTC(2026, 10, 18, 20, 5, 9)), '2026-11-19_020509');
});

test('backup file names match the allowed pattern', () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);
  assert.ok(NAME.test(backupFileName('db', 'auto', now)));
  assert.ok(NAME.test(backupFileName('files', 'manual', now)));
  assert.ok(!NAME.test('../ar-backup-x.sql.gz'));
  assert.ok(!NAME.test('evil.sh'));
});

test('dirOf falls back to the default folder', () => {
  assert.equal(dirOf({ dir: '' }), DEFAULT_DIR);
  assert.equal(dirOf({ dir: '/x' }), '/x');
});

test('isInside', () => {
  const root = path.resolve('/a/b');
  assert.ok(isInside(root, root));
  assert.ok(isInside(path.join(root, 'c'), root));
  assert.ok(!isInside(path.resolve('/a/bc'), root));
  assert.ok(!isInside(path.resolve('/a'), root));
});

test('delete-code lockout: locks on the fifth wrong try, then unlocks', () => {
  const w = { n: 0, since: 0, until: 0 };
  const t0 = 1e9;
  for (let i = 1; i < MAX_WRONG; i++) assert.equal(recordWrong(w, t0 + i).status, 403);
  assert.equal(recordWrong(w, t0 + 10).status, 429);
  assert.match(checkLock(w, t0 + 20), /Try again in 10 minutes/);
  assert.equal(checkLock(w, t0 + 10 + 600001), '');
});

test('delete-code counter restarts after the window', () => {
  const w = { n: 0, since: 0, until: 0 };
  for (let i = 0; i < 4; i++) recordWrong(w, 1e9);
  assert.equal(recordWrong(w, 1e9 + 600001).status, 403);
  assert.equal(w.n, 1);
});

test('dump completeness and due / stray checks', () => {
  assert.ok(dumpIsComplete('x\n-- Dump completed on 2026 (1 tables, 2 rows)\n'));
  assert.ok(!dumpIsComplete('INSERT INTO'));
  assert.ok(isDue(null, Infinity));
  assert.ok(!isDue(30, Infinity, 6));
  assert.ok(isDue(361, Infinity, 6));
  assert.ok(!isDue(500, 10, 6));
  const known = new Set(['ar-backup-1-auto.sql.gz']);
  assert.ok(isStrayFile('a.part', known, 3700e3));
  assert.ok(!isStrayFile('a.part', known, 1000));
  assert.ok(!isStrayFile('ar-backup-1-auto.sql.gz', known, 1e12));
  assert.ok(isStrayFile('ar-backup-2-auto.sql.gz', known, 1e12));
});
