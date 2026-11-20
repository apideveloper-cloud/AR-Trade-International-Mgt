import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { openGzipFile } from '../src/backup/dump.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ar-gz-'));

test('gzip file writer: what is put in comes back out', async () => {
  const dir = tmp();
  try {
    const f = path.join(dir, 'a.sql.gz.part');
    const w = openGzipFile(f);
    await w.put('hello\n'); await w.put('world\n'); await w.finish();
    assert.equal(zlib.gunzipSync(fs.readFileSync(f)).toString(), 'hello\nworld\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('gzip file writer: a file that cannot be written rejects instead of hanging or crashing the process', async () => {
  const dir = tmp();
  try {
    const w = openGzipFile(path.join(dir, 'no-such-folder', 'x.part')); // the stream errors with ENOENT, like a full or vanished disk
    const outcome = await Promise.race([
      (async () => { for (let i = 0; i < 400; i++) await w.put(crypto.randomBytes(65536)); await w.finish(); return 'finished'; })().catch(e => 'rejected:' + e.code),
      new Promise(r => setTimeout(() => r('hung'), 5000))
    ]);
    assert.match(outcome, /^rejected:/);
    w.abort();
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
