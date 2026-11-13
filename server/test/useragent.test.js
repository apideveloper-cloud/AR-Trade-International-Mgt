import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUserAgent } from '../src/userAgent.js';
import { readGeo, readTech } from '../src/chatLeads.js';

const UA = {
  chromeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edgeWin: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.87',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0'
};

test('user agent: device, OS and browser', () => {
  assert.deepEqual(parseUserAgent(UA.chromeWin), { device: 'Desktop', os: 'Windows 10/11', browser: 'Chrome 126' });
  assert.equal(parseUserAgent(UA.edgeWin).browser, 'Edge 126');
  assert.deepEqual(parseUserAgent(UA.chromeAndroid), { device: 'Mobile', os: 'Android 13', browser: 'Chrome 126' });
  assert.deepEqual(parseUserAgent(UA.safariIphone), { device: 'Mobile', os: 'iOS 17', browser: 'Safari 17' });
  assert.deepEqual(parseUserAgent(UA.firefoxMac), { device: 'Desktop', os: 'macOS', browser: 'Firefox 127' });
  assert.deepEqual(parseUserAgent(''), { device: '', os: '', browser: '' });
});

test('chat lead geo: only real coordinates are kept', () => {
  assert.deepEqual(readGeo({ lat: 23.8103, lng: 90.4125, acc: 35.4 }), { lat: 23.8103, lng: 90.4125, acc: 35 });
  assert.equal(readGeo({ lat: 123, lng: 90 }), null);
  assert.equal(readGeo({ lat: 'x', lng: 90 }), null);
  assert.equal(readGeo(null), null);
  assert.equal(readGeo({ lat: null, lng: null }), null);
  assert.equal(readGeo({ lat: '', lng: '' }), null);
  assert.equal(readGeo({ lat: 23.8, lng: 90.4 }).acc, null);
});

test('chat lead tech: only known short text fields', () => {
  const t = readTech({ screen: '1920x1080', lang: 'en-US', evil: 'x', ref: 'https://google.com/'.padEnd(500, 'a'), utm_source: 'fb' });
  assert.equal(t.screen, '1920x1080');
  assert.equal(t.evil, undefined);
  assert.equal(t.ref.length, 200);
  assert.equal(t.utm_source, 'fb');
  assert.deepEqual(readTech('junk'), {});
});
