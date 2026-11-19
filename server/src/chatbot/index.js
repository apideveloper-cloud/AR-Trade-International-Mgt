// The sales assistant behind the live-chat box. It answers from the shop's own data (products, prices, stock, services,
// delivery, payments, policies, FAQs) and never invents a price. Two modes:
//   - Claude mode: when ANTHROPIC_API_KEY is set in server/.env, a Claude model writes the reply in the customer's language,
//     given only the facts below. If the call fails or times out, the built-in engine answers instead.
//   - Built-in engine: understands product type, brand, technology, budget ("between 5000 to 8000", "under 10k", "cheapest"),
//     model numbers, follow-up questions, and the shop's services and policies, in English and Bangla.
import { engineReply } from './engine.js';
import { claudeReply } from './claude.js';

export { parseBudget } from './budget.js';
export { brandsOf, understand } from './understand.js';
export { searchProducts } from './search.js';
export { engineReply };

/** The reply for one customer message. data = { products, cats, site, content }. */
export async function chatReply(body, data) {
  const text = String(body.text || '').trim().slice(0, 1000);
  const ctx = body.ctx && typeof body.ctx === 'object' ? body.ctx : {};
  const base = engineReply({ text, ctx }, data);
  try {
    const ai = await claudeReply({ text, history: Array.isArray(body.history) ? body.history : [], ctx }, data, base);
    if (ai) return { ...base, text: ai, unanswered: false, ai: true };
  } catch (e) { console.error('Chat assistant fell back to the built-in answers:', e.message); }
  return { ...base, ai: false };
}
