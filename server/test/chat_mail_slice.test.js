import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail } from '../src/emailTemplate.js';
import { chatReply } from '../src/chatbot.js';

test('plain-text email links use the stored product address, like the HTML part', () => {
  const { text } = renderEmail({ subject: 's', headline: 'h', siteUrl: 'https://shop.example', products: [{ id: 7, slug: 'my-toner', name: 'Toner', price: 10, old: 0 }] });
  assert.match(text, /https:\/\/shop\.example\/product\/my-toner/);
  assert.doesNotMatch(text, /\/product\/7\b/);
});

test('a malformed chat history does not break the reply', async () => {
  const data = { products: [], cats: [], site: { phone: '01', delivery: {} }, content: {} };
  const r = await chatReply({ text: 'hello', history: [null, 5, { from: 'me', text: 'hi' }] }, data).catch(e => e);
  assert.ok(!(r instanceof Error) || !/Cannot read/.test(r.message));
});
