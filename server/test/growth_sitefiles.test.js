import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountGrowthPublic, saveGrowth, clearSiteFilesCache } from '../src/growth/siteFiles.js';
import { fakeDb } from './growth_fake.js';

async function boot() {
  const db = fakeDb(); clearSiteFilesCache();
  let reads = 0; const q = (await import('../src/db.js')).pool.query; (await import('../src/db.js')).pool.query = async (...a) => { if (String(a[0]).includes('SELECT v FROM settings')) reads++; return q(...a); };
  const app = express(); mountGrowthPublic(app); app.use((req, res) => res.status(404).send('fallback'));
  const srv = await new Promise(r => { const s = app.listen(0, () => r(s)); });
  const get = p => fetch(`http://127.0.0.1:${srv.address().port}${p}`).then(async r => ({ status: r.status, type: r.headers.get('content-type') || '', body: await r.text() }));
  return { db, srv, get, reads: () => reads };
}

test('nothing stored: both routes fall through', async () => {
  const { srv, get } = await boot();
  try {
    assert.equal((await get('/google1234abcd5678.html')).body, 'fallback');
    assert.equal((await get('/BingSiteAuth.xml')).body, 'fallback');
  } finally { srv.close(); }
});
test('Google file is served only under the stored name', async () => {
  const { srv, get } = await boot();
  try {
    await saveGrowth({ googleFileName: 'google1234abcd5678.html', googleFileContent: 'google-site-verification: google1234abcd5678.html' });
    const ok = await get('/google1234abcd5678.html');
    assert.equal(ok.status, 200); assert.match(ok.type, /text\/html/); assert.equal(ok.body, 'google-site-verification: google1234abcd5678.html');
    assert.equal((await get('/google9999zzzz0000.html')).body, 'fallback');
  } finally { srv.close(); }
});
test('Bing file needs a valid code', async () => {
  const { srv, get } = await boot();
  try {
    await saveGrowth({ bingAuthCode: 'not a code!' });
    assert.equal((await get('/BingSiteAuth.xml')).body, 'fallback');
    await saveGrowth({ bingAuthCode: 'ABCDEF0123456789ABCDEF0123456789' });
    const r = await get('/BingSiteAuth.xml');
    assert.match(r.type, /xml/); assert.equal(r.body, '<?xml version="1.0"?><users><user>ABCDEF0123456789ABCDEF0123456789</user></users>');
  } finally { srv.close(); }
});
test('cache: repeated 404s do not hit the database, a save is seen at once', async () => {
  const { srv, get, reads } = await boot();
  try {
    await get('/BingSiteAuth.xml');
    const n = reads();
    for (let i = 0; i < 5; i++) await get('/BingSiteAuth.xml');
    assert.equal(reads(), n);
    await saveGrowth({ bingAuthCode: 'ABCDEF0123456789' });
    assert.match((await get('/BingSiteAuth.xml')).body, /ABCDEF0123456789/);
  } finally { srv.close(); }
});
