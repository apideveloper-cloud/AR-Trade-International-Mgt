// Run with:  npm test   (no database needed)
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { isPrivateUploadPath, checkPassword, secret } from '../src/util.js';

test('private upload folders are blocked however the URL is spelled', () => {
  for (const p of ['/cv/APP-2005.pdf', '/%63v/APP-2005.pdf', '/%2563v/x', '//cv/x', '/./CV/x', '/blog/../vouchers/x', '/Vouchers/x', '/%76ouchers/x', '/cv']) {
    assert.equal(isPrivateUploadPath(p), true, p);
  }
  for (const p of ['/blog/a.png', '/products/toner/cv.png', '/site/logo.png', '/products/cv/a.png']) {
    assert.equal(isPrivateUploadPath(p), false, p);
  }
});

test('the guard actually stops express.static from serving a CV (the %63v bypass)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  fs.mkdirSync(path.join(dir, 'cv'));
  fs.writeFileSync(path.join(dir, 'cv', 'APP-1.pdf'), 'SECRET');
  const app = express();
  app.use('/api/uploads', (req, res, next) => (isPrivateUploadPath(req.url.split('?')[0]) ? res.status(404).end() : next()));
  app.use('/api/uploads', express.static(dir, { fallthrough: false, index: false }));
  app.use((e, req, res, next) => res.status(e.status || 500).end());
  const server = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  try {
    for (const u of ['/cv/APP-1.pdf', '/%63v/APP-1.pdf', '//cv/APP-1.pdf', '/%2e/cv/APP-1.pdf']) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/uploads${u}`);
      assert.equal(res.status, 404, u);
    }
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('password rule', () => {
  assert.throws(() => checkPassword('short1'));
  assert.throws(() => checkPassword('onlyletters'));
  assert.throws(() => checkPassword('12345678'));
  assert.doesNotThrow(() => checkPassword('goodpass1'));
});

test('production refuses a weak or missing JWT secret', () => {
  const env = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(() => secret());
    process.env.JWT_SECRET = 'too-short';
    assert.throws(() => secret());
    process.env.JWT_SECRET = 'x'.repeat(32);
    assert.equal(secret(), 'x'.repeat(32));
  } finally { process.env = env; }
});
