import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { lookupPlace, isPrivateIp } from '../src/geoIp.js';

test('geo ip: private addresses are never looked up', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.1.1', '::1', 'fe80::1', '']) assert.equal(isPrivateIp(ip), true, ip);
  assert.equal(isPrivateIp('103.7.248.1'), false);
});

test('geo ip: off without a service address, and for private IPs', async () => {
  assert.equal(await lookupPlace('103.7.248.1', { url: '' }), '');
  assert.equal(await lookupPlace('127.0.0.1', { url: 'http://x/{ip}' }), '');
});

test('geo ip: reads city, region and country from a service, and survives errors', async () => {
  const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(req.url);
    if (req.url.startsWith('/ok/')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ city: 'Dhaka', region: 'Dhaka Division', country_code: 'BD' })); }
    else if (req.url.startsWith('/fail/')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ success: false })); }
    else { res.statusCode = 500; res.end('no'); }
  }).listen(0);
  await new Promise(r => srv.on('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.equal(await lookupPlace('103.7.248.1', { url: base + '/ok/{ip}' }), 'Dhaka, Dhaka Division, BD');
    assert.equal(seen[0], '/ok/103.7.248.1');
    assert.equal(await lookupPlace('103.7.248.1', { url: base + '/fail/{ip}' }), '');
    assert.equal(await lookupPlace('103.7.248.1', { url: base + '/boom/{ip}' }), '');
    assert.equal(await lookupPlace('103.7.248.1', { url: 'http://127.0.0.1:1/{ip}', timeoutMs: 500 }), '');
  } finally { srv.close(); }
});
