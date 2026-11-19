// The built-in reply engine (no AI service needed).
import { isBangla, toEnDigits } from './text.js';
import { understand } from './understand.js';
import { searchProducts } from './search.js';
import { faqAnswer, infoAnswer, intentOf } from './info.js';
import { productAnswer } from './productAnswer.js';

/** Built-in reply (no AI service needed). */
export function engineReply({ text, ctx: prev = {} }, data) {
  const bn = isBangla(text);
  const t = toEnDigits(text.toLowerCase());
  const u = understand(text, data.products, prev);
  const intent = intentOf(t);
  const strongProduct = u.models.length || (u.ctx.cat && (u.budget || u.ctx.sort || u.ctx.brand || u.ctx.tech || /price|দাম|show|have|need|want|buy|looking|চাই|লাগবে|আছে/.test(t)));
  if (intent && !strongProduct) {
    const a = infoAnswer(intent, bn, data);
    if (a) return { text: a, ctx: prev };
  }
  if (u.hasAnchor || u.models.length) {
    const found = searchProducts(u.ctx, u.models, data.products);
    if (found.list.length || u.hasAnchor) return productAnswer(u, found, bn, data.site);
  }
  const faq = faqAnswer(t, data.content, data.site);
  if (faq) return { text: faq, ctx: prev };
  if (intent) { const a = infoAnswer(intent, bn, data); if (a) return { text: a, ctx: prev }; }
  const fallback = bn
    ? `আপনার প্রশ্নটা পুরোপুরি বুঝতে পারিনি। কোন প্রোডাক্ট (যেমন "HP লেজার প্রিন্টার ১০০০০ টাকার মধ্যে"), ডেলিভারি, পেমেন্ট বা সার্ভিসিং নিয়ে জানতে চান? জরুরি হলে কল করুন ${data.site.phone}।`
    : `I did not fully get that. Ask me about a product (for example "HP laser printer under 15000"), delivery, payment, servicing or warranty. For anything urgent, call ${data.site.phone} and the team will help.`;
  return { text: fallback, ctx: prev, unanswered: true };
}
