import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { processUpload } from '../src/imageProcess.js';

const noisy = (w, h) => crypto.randomBytes(w * h * 3);

test('a large PNG becomes a WebP of at most 1600 px and smaller', async () => {
  const png = await sharp(noisy(2400, 1200), { raw: { width: 2400, height: 1200, channels: 3 } }).png().toBuffer();
  const r = await processUpload(png, 'image/png', { maxEdge: 1600 });
  assert.equal(r.converted, true);
  assert.equal(r.ext, 'webp');
  assert.equal(r.mime, 'image/webp');
  assert.ok(r.width <= 1600 && r.width === 1600 && r.height === 800);
  assert.ok(r.buffer.length < png.length);
  assert.equal((await sharp(r.buffer).metadata()).format, 'webp');
});

test('a tiny PNG that would grow stays a PNG', async () => {
  const raw = Buffer.alloc(64 * 64);
  for (let i = 0; i < raw.length; i++) raw[i] = ((i % 64) + Math.floor(i / 64)) % 2 ? 255 : 0; // checkerboard: tiny as PNG, large as WebP
  const png = await sharp(raw, { raw: { width: 64, height: 64, channels: 1 } }).png({ compressionLevel: 9, palette: true, colours: 2 }).toBuffer();
  const r = await processUpload(png, 'image/png');
  assert.equal(r.converted, false);
  assert.equal(r.ext, 'png');
  assert.ok(r.buffer.equals(png));
});

test('garbage bytes come back unchanged', async () => {
  const junk = Buffer.from('this is not an image at all');
  const r = await processUpload(junk, 'image/jpeg');
  assert.equal(r.converted, false);
  assert.ok(r.buffer.equals(junk));
  assert.equal(r.ext, 'jpg');
});

test('a GIF is left untouched', async () => {
  const gif = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } }).gif().toBuffer();
  const r = await processUpload(gif, 'image/gif');
  assert.equal(r.converted, false);
  assert.equal(r.ext, 'gif');
  assert.ok(r.buffer.equals(gif));
});

test('an image is never enlarged', async () => {
  const jpg = await sharp(noisy(300, 200), { raw: { width: 300, height: 200, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
  const r = await processUpload(jpg, 'image/jpeg');
  assert.ok(r.width <= 300 && r.height <= 200);
});
