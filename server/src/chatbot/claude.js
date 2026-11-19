// Optional Claude mode: when ANTHROPIC_API_KEY is set, a Claude model words the reply from the shop facts only.
import { brandNames, facts, policyText } from './info.js';
import { dl, taka } from './text.js';

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
/** Asks Claude to word the reply from the shop facts; null when no API key is set or the answer is empty. */
export async function claudeReply({ text, history = [] }, data, base) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const { site, content } = data;
  const found = base.items?.length ? base.items : [];
  const catalog = found.map(p => `- ${p.name} | price: ${p.price > 0 ? taka(p.price) : 'on request (call to quote)'} | ${p.stock > 0 ? 'in stock' : 'out of stock'}`).join('\n') || '(no product matched the last message)';
  const system = [
    `You are the sales assistant of AR Trade International, a Dhaka IT supplier (hardware since 2011, IT services since 2019). Your job is to talk with the customer like a helpful salesperson and help them buy.`,
    `Answer ONLY from the facts below. Never invent a price, stock level, spec, warranty period or policy. If a price is "on request", say the team will quote it and give the phone. If you do not know, say so and offer ${site.phone} / WhatsApp.`,
    `Reply in the customer's language (Bangla or English). Keep it short: 2 to 5 sentences, friendly and plain. Ask one useful question (use case, budget, quantity) when it helps, and gently guide to the next step: open the product, add to cart, or order by phone/WhatsApp. Do not use markdown tables; no lists longer than 3 items.`,
    `FACTS`,
    `Showroom: ${site.address}. Open Saturday to Thursday 10:00-20:00. Phone/WhatsApp: ${site.phone}. Email: ${site.email}.`,
    `Delivery: inside Dhaka free within ${dl(site).freeKm} km of the Santinagar office, then ${taka(dl(site).min)} to ${taka(dl(site).max)} by distance${site.freeOver > 0 ? ` (free over ${taka(site.freeOver)})` : ''}; outside Dhaka ${taka(site.outsideFee)} by courier; same-day dispatch in Dhaka if ordered before 2 PM.`,
    `Payment: ${facts(site, content, data.cats).pay.join(', ')}. Coupon ${site.coupon} gives ${site.couponPct}% off; members get ${site.memberPct}% more.`,
    `Categories: ${data.cats.map(c => c.t).join(', ')}. Brands: ${brandNames(content).join(', ')}.`,
    `Servicing: ${(site.svcPrices || []).map(s => `${s.t} ${taka(s.offer)}`).join('; ')}.`,
    `Returns: ${policyText(content, 'returns') || ''}`,
    `FAQ: ${(content?.faqs || []).map(f => `${f.q} ${String(f.a).replace('{phone}', site.phone)}`).join(' | ')}`,
    `PRODUCTS MATCHING THE CUSTOMER'S LATEST MESSAGE (the customer also sees these as cards, so do not repeat every detail):`,
    catalog
  ].join('\n');
  const msgs = [...history.filter(m => m && typeof m === 'object').slice(-8).map(m => ({ role: m.from === 'me' ? 'user' : 'assistant', content: String(m.text).slice(0, 600) })), { role: 'user', content: text }];
  // the API wants the conversation to start with the customer and alternate
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const clean = msgs.filter((m, i) => i === 0 || m.role !== msgs[i - 1].role);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: clean })
    });
    if (!r.ok) throw new Error('Claude API ' + r.status);
    const j = await r.json();
    const out = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    return out || null;
  } finally { clearTimeout(timer); }
}
