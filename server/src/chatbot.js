// The sales assistant behind the live-chat box. It answers from the shop's own data (products, prices, stock, services,
// delivery, payments, policies, FAQs) and never invents a price. Two modes:
//   - Claude mode: when ANTHROPIC_API_KEY is set in server/.env, a Claude model writes the reply in the customer's language,
//     given only the facts below. If the call fails or times out, the built-in engine answers instead.
//   - Built-in engine: understands product type, brand, technology, budget ("between 5000 to 8000", "under 10k", "cheapest"),
//     model numbers, follow-up questions, and the shop's services and policies, in English and Bangla.

import { mergeDelivery } from './delivery.js';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const toEnDigits = s => String(s).replace(/[০-৯]/g, d => BN_DIGITS.indexOf(d));
const isBangla = s => /[ঀ-৿]/.test(s);
const dl = site => { const d = mergeDelivery(site.delivery); const fees = d.tiers.map(t => t.fee).concat(d.maxFee); return { freeKm: d.freeKm, min: Math.min(...fees), max: Math.max(...fees) }; };
const taka = n => '৳' + Math.round(n).toLocaleString('en-IN');
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const has = (t, re) => re.test(t);

// ---------- what the customer asked for ----------
const CATS = [
  { id: 'copier-toner', re: /copier\s*toner|photocopier\s*toner|কপিয়ার\s*টোনার/ },
  { id: 'toner', re: /toner|cartridge|টোনার|কার্টিজ|কাট্রিজ/ },
  { id: 'ink', re: /\bink\b|bottle|refill ink|ইঙ্ক|কালি/ },
  { id: 'printer', re: /printer|প্রিন্টার/ },
  { id: 'copier', re: /photocopier|photocopy|copier|xerox|ফটোকপি|কপিয়ার|জেরক্স/ },
  { id: 'computer', re: /computer|laptop|desktop|\bpc\b|notebook|কম্পিউটার|ল্যাপটপ/ },
  { id: 'scanner', re: /scanner|স্ক্যানার/ },
  { id: 'camera', re: /cctv|camera|security cam|ip cam|ক্যামেরা|সিসিটিভি/ },
  { id: 'network', re: /router|networking|network switch|\bswitch\b|access point|wifi\s*(router|extender|adapter)|নেটওয়ার্ক|রাউটার/ },
  { id: 'parts', re: /spare|parts?\b|drum|fuser|roller|ড্রাম|পার্টস/ }
];
const TECH = [
  { v: 'Laser', re: /laser|লেজার/ },
  { v: 'Inkjet', re: /inkjet|ink tank|ইঙ্কজেট/ }
];
const WORDS = {
  color: /colou?r|কালার/, mono: /mono|black\s*(and|&)\s*white|b\/w|ব্ল্যাক/, wifi: /wi-?fi|wireless|ওয়াইফাই/,
  multi: /multi\s*function|all[\s-]*in[\s-]*one|mfp|scan.*copy|3\s*in\s*1/, duplex: /duplex/
};
const CHEAP = /cheap|cheapest|low\s*price|lowest|low\s*cost|budget|affordable|economy|কম\s*দাম|সস্তা|সাশ্রয়ী/;
const BEST = /best|premium|high\s*end|top|powerful|heavy\s*duty|সেরা/;

function parseNumber(raw, unit) {
  let n = parseFloat(toEnDigits(raw).replace(/,/g, ''));
  if (Number.isNaN(n)) return null;
  if (/^(k|হাজার|thousand)/i.test(unit || '')) n *= 1000;
  if (/^(lakh|lac|লাখ|লক্ষ)/i.test(unit || '')) n *= 100000;
  return n;
}
const NUM = '([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(k|হাজার|thousand|lakh|lac|লাখ|লক্ষ)?';

/** Reads a budget out of the message: {min, max} in taka. Small bare numbers (12, 79) are model numbers, not prices. */
export function parseBudget(text) {
  const t = toEnDigits(text.toLowerCase());
  let m = t.match(new RegExp(`(?:between|from)?\\s*${NUM}\\s*(?:to|and|-|–|থেকে|এবং|-)\\s*${NUM}`));
  if (m) {
    const a = parseNumber(m[1], m[2] || m[4]), b = parseNumber(m[3], m[4]);
    if (a && b && Math.max(a, b) >= 500) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  m = t.match(new RegExp(`(?:under|below|within|less than|upto|up to|max(?:imum)?|not more than|cheaper than|budget(?: is| of)?)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`))
    || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)?(?:র|এর)?\\s*(?:মধ্যে|নিচে|কম|or less|or below|max)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: 0, max: n }; }
  m = t.match(new RegExp(`(?:above|over|more than|minimum|at least|starting|from)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`))
    || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)?(?:র|এর)?\\s*(?:উপরে|বেশি|or more|or above|plus)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n, max: Infinity }; }
  m = t.match(new RegExp(`(?:around|about|near|approx(?:imately)?|roughly|প্রায়)\\s*(?:tk\\.?|taka|bdt|৳)?\\s*${NUM}`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n * 0.8, max: n * 1.2 }; }
  m = t.match(new RegExp(`(?:tk\\.?|taka|bdt|৳)\\s*${NUM}`)) || t.match(new RegExp(`${NUM}\\s*(?:tk|taka|bdt|৳|টাকা)`));
  if (m) { const n = parseNumber(m[1], m[2]); if (n >= 500) return { min: n * 0.8, max: n * 1.2 }; }
  return null;
}

export function brandsOf(products) {
  const count = new Map();
  for (const p of products) {
    const b = String(p.brand || '').trim();
    if (b.length >= 2 && b.length <= 20 && /^[A-Za-z][A-Za-z .&-]*$/.test(b)) count.set(b.toLowerCase(), [(count.get(b.toLowerCase())?.[0]) || b, (count.get(b.toLowerCase())?.[1] || 0) + 1]);
  }
  return [...count.values()].filter(([, n]) => n >= 3).map(([b]) => b);
}

/** Pulls the product wish out of one message. `prev` is what was being discussed, so "price between 5000 to 8000" still means HP printers. */
export function understand(text, products, prev = {}) {
  const t = toEnDigits(text.toLowerCase());
  const cat = CATS.find(c => c.re.test(t))?.id || null;
  const brand = brandsOf(products).find(b => new RegExp('(^|[^a-z])' + b.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(t)) || null;
  const tech = TECH.find(x => x.re.test(t))?.v || null;
  const flags = Object.fromEntries(Object.entries(WORDS).filter(([, re]) => re.test(t)).map(([k]) => [k, true]));
  const budget = parseBudget(t);
  const sort = CHEAP.test(t) ? 'cheap' : BEST.test(t) ? 'best' : null;
  const models = (t.match(/[a-z0-9][a-z0-9\-/.]*/g) || []).map(squash).filter(w => w.length >= 3 && /\d/.test(w) && /[a-z]/.test(w));
  const fresh = !!(cat || brand || models.length);
  const base = fresh && cat && cat !== prev.cat ? {} : prev; // a different product type starts a new search
  const ctx = {
    cat: cat || base.cat || null,
    brand: brand || (fresh && cat ? null : base.brand) || null,
    tech: tech || (fresh && cat ? null : base.tech) || null,
    flags: { ...(fresh && cat ? {} : base.flags), ...flags },
    min: budget ? budget.min : base.min ?? null,
    max: budget ? budget.max : base.max ?? null,
    sort: sort || base.sort || null
  };
  const refines = !!(budget || sort || brand || tech || Object.keys(flags).length);
  return { ctx, models, hasAnchor: fresh || (refines && !!prev.cat), budget: !!budget };
}

function matches(p, ctx) {
  if (ctx.cat && p.cat !== ctx.cat) return false;
  if (ctx.brand && String(p.brand).toLowerCase() !== ctx.brand.toLowerCase()) return false;
  const label = `${p.name} ${p.tech || ''} ${p.spec || ''} ${p.color || ''}`.toLowerCase();
  if (ctx.tech && !(String(p.tech || '').toLowerCase().includes(ctx.tech.toLowerCase()) || label.includes(ctx.tech.toLowerCase()))) return false;
  const f = ctx.flags || {};
  if (f.color && !/colou?r/.test(label)) return false;
  if (f.mono && /colou?r/.test(label) && !/mono/.test(label)) return false;
  if (f.wifi && !/wi-?fi|wireless/.test(label)) return false;
  if (f.multi && !/multi|all[\s-]*in[\s-]*one|mfp|3\s*in\s*1|scan/.test(label)) return false;
  if (f.duplex && !/duplex/.test(label)) return false;
  return true;
}

export function searchProducts(ctx, models, products) {
  if (models.length) {
    const test = p => {
      const label = `${p.name} ${p.part || ''} ${p.sku || ''} ${p.brand || ''} ${p.compat || ''}`;
      const hay = squash(label), words = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      return models.every(m => words.includes(m) || (m.length >= 6 && hay.includes(m)));
    };
    let hits = products.filter(test);
    // "toner for HP M12w": the product type asked for wins over the printer the model number belongs to
    if (ctx.cat) hits = hits.filter(p => p.cat === ctx.cat);
    return { list: hits.sort((a, b) => (b.stock > 0) - (a.stock > 0) || (b.price > 0) - (a.price > 0)).slice(0, 3), exact: true, total: hits.length };
  }
  const run = c => {
    let pool = products.filter(p => matches(p, c));
    const priced = pool.filter(p => p.price > 0);
    const budgeted = c.min != null || c.max != null;
    if (budgeted) pool = priced.filter(p => p.price >= (c.min || 0) && p.price <= (c.max ?? Infinity));
    else if (priced.length) pool = priced;
    const inStock = pool.filter(p => p.stock > 0);
    if (inStock.length) pool = inStock;
    if (c.sort === 'cheap' || budgeted) pool = pool.slice().sort((a, b) => a.price - b.price);
    else if (c.sort === 'best') pool = pool.slice().sort((a, b) => b.price - a.price);
    else pool = pool.slice().sort((a, b) => (b.popular - a.popular) || (b.featured - a.featured) || (b.price > 0) - (a.price > 0));
    return pool;
  };
  const budgeted = ctx.min != null || ctx.max != null;
  let pool = run(ctx);
  let list = pool.slice(0, 3);
  let near = false, relaxed = null;
  // no match for every wish: first drop the extras (Wi-Fi, colour...), then the budget, and say so
  if (!list.length) {
    const steps = [{ ...ctx, flags: {}, tech: null }, { ...ctx, flags: {}, tech: null, min: null, max: null }];
    for (const c of steps) {
      const p2 = run(c);
      if (p2.length) {
        pool = p2; list = p2.slice(0, 3); near = true; relaxed = c;
        if (budgeted && c.min == null) {
          const target = ctx.max !== Infinity && ctx.max != null ? ctx.max : ctx.min;
          const priced = products.filter(p => matches(p, c) && p.price > 0 && p.stock > 0);
          if (priced.length) list = priced.sort((a, b) => Math.abs(a.price - target) - Math.abs(b.price - target)).slice(0, 3);
        }
        break;
      }
    }
  }
  return { list, exact: false, total: pool.length, near, relaxed };
}

// ---------- the shop's own information ----------
const INTENTS = [
  ['greet', /^\s*(hi+|hello|hey|salam|assalamu|হাই|হ্যালো|সালাম|আসসালামু)\b[\s!.,]*$/i],
  ['thanks', /^\s*(thanks|thank you|thx|ok|okay|ধন্যবাদ|শুক্রিয়া)\b/i],
  ['track', /track|where is my order|order status|অর্ডার.*(স্ট্যাটাস|কোথায়)|ট্র্যাক/],
  ['hours', /open|close|opening|hour|time|friday|saturday|কখন|খোলা|সময়/],
  ['where', /address|location|where (is|are)|showroom|shop|store|visit|office|map|ঠিকানা|কোথায়|শোরুম/],
  ['contact', /phone|call|number|whatsapp|email|contact|mobile|ফোন|নাম্বার|নম্বর|হোয়াটসঅ্যাপ|যোগাযোগ/],
  ['delivery', /deliver|shipping|courier|dispatch|charge.*(dhaka|outside)|ডেলিভারি|কুরিয়ার|পৌঁছ/],
  ['payment', /pay|bkash|nagad|upay|cash on|cod|bank transfer|card|পেমেন্ট|বিকাশ|নগদ|ক্যাশ অন/],
  ['returns', /return|refund|replace|exchange|ফেরত|রিফান্ড|রিটার্ন/],
  ['warranty', /warrant|guarantee|genuine|original|authentic|fake|ওয়ারেন্টি|গ্যারান্টি|অরিজিনাল|আসল/],
  ['service', /servic|repair|fix|install|maintenance|not printing|jam|সার্ভিস|মেরামত|ঠিক করা|ইন্সটল/],
  ['offer', /offer|discount|coupon|promo|deal|sale|ছাড়|অফার|ডিসকাউন্ট|কুপন/],
  ['bulk', /bulk|corporate|wholesale|dealer|company order|many|পাইকারি|কর্পোরেট|বাল্ক/],
  ['about', /about (you|ar trade|the company)|who are you|your company|since|experience|কারা|আপনারা|কোম্পানি|প্রতিষ্ঠান/],
  ['brands', /which brands|what brands|brands do you|ব্র্যান্ড/],
  ['categories', /what do you (sell|have)|what products|categories|catalog|কি কি|কী কী.*(আছে|বিক্রি)/]
];
const intentOf = t => INTENTS.find(([, re]) => re.test(t))?.[0] || null;

function policyText(content, key) {
  const pol = (content?.policies || []).find(p => p.k === key);
  if (!pol) return null;
  return pol.secs.slice(0, 4).map(s => `${s.h}: ${s.p}`).join(' ');
}
const brandNames = content => (content?.brands || []).map(b => b.n).filter(Boolean);

function facts(site, content, cats, products) {
  const pay = Object.entries(site.payments || {}).filter(([, on]) => on).map(([k]) => ({ COD: 'cash on delivery', Bank: 'bank transfer' }[k] || k));
  return { pay, brands: brandNames(content), cats: cats.map(c => c.t) };
}

function infoAnswer(intent, bn, { site, content, cats, products }) {
  const f = facts(site, content, cats, products);
  const phone = site.phone;
  const S = {
    greet: [`Hello! 👋 Welcome to AR Trade International. I can help you pick the right printer, toner, ink, copier, computer or CCTV, give prices and stock, or book servicing. What are you looking for?`, `আসসালামু আলাইকুম! 👋 AR Trade International-এ স্বাগতম। প্রিন্টার, টোনার, কালি, ফটোকপিয়ার, কম্পিউটার বা সিসিটিভি বেছে নিতে, দাম ও স্টকের তথ্য জানতে বা সার্ভিসিং বুক করতে সাহায্য করতে পারি। আপনি কী খুঁজছেন?`],
    thanks: [`You are welcome! If you would like to order, add the product to your cart or message us on WhatsApp ${phone}. Anything else I can help with?`, `ধন্যবাদ! অর্ডার করতে প্রোডাক্ট কার্টে যোগ করুন বা WhatsApp-এ জানান: ${phone}। আর কিছু জানার আছে?`],
    track: [`You can track every order on the Track order page. Share your order ID (for example AR-10480) there and you will see the live status.`, `Track order পেজে অর্ডার আইডি (যেমন AR-10480) দিলেই অর্ডারের বর্তমান অবস্থা দেখতে পাবেন।`],
    hours: [`We are open Saturday to Thursday, 10:00 to 20:00 (closed on Friday). Our showroom is at ${site.address}. You can order on this website any time.`, `আমরা শনিবার থেকে বৃহস্পতিবার, সকাল ১০টা থেকে রাত ৮টা পর্যন্ত খোলা (শুক্রবার বন্ধ)। শোরুম: ${site.address}। ওয়েবসাইটে যেকোনো সময় অর্ডার করতে পারবেন।`],
    where: [`Our showroom is at ${site.address}. Call ${phone} before you come so we can have your product ready.`, `আমাদের শোরুম: ${site.address}। আসার আগে ${phone} নম্বরে জানালে প্রোডাক্ট প্রস্তুত রাখতে পারব।`],
    contact: [`Call or WhatsApp us on ${phone}, or email ${site.email}. We reply Saturday to Thursday, 10:00 to 20:00.`, `ফোন বা WhatsApp: ${phone}, ইমেইল: ${site.email}। শনি–বৃহস্পতি, সকাল ১০টা থেকে রাত ৮টা।`],
    delivery: [`Delivery inside Dhaka is free within ${dl(site).freeKm} km of our Santinagar office; beyond that the charge depends on distance, from ${taka(dl(site).min)} up to ${taka(dl(site).max)}${site.freeOver > 0 ? ` (free over ${taka(site.freeOver)})` : ''}, with cash on delivery. Outside Dhaka: ${taka(site.outsideFee)} by courier. Order before 2 PM for same-day dispatch in Dhaka.`,
      `ঢাকার ভেতরে শান্তিনগর অফিস থেকে ${dl(site).freeKm} কিমির মধ্যে ডেলিভারি ফ্রি; এর বেশি হলে দূরত্ব অনুযায়ী ${taka(dl(site).min)} থেকে ${taka(dl(site).max)} পর্যন্ত${site.freeOver > 0 ? `, ${taka(site.freeOver)}-এর বেশি অর্ডারে ফ্রি` : ''} (ক্যাশ অন ডেলিভারি)। ঢাকার বাইরে কুরিয়ারে: ${taka(site.outsideFee)}। ঢাকায় দুপুর ২টার আগে অর্ডার করলে একই দিনে পাঠানো হয়।`],
    payment: [`You can pay by ${f.pay.join(', ')}. Cash on delivery is available inside Dhaka. For bKash, Nagad, Upay or bank transfer, the payment details are shown at checkout.`, `পেমেন্ট করতে পারবেন: ${f.pay.join(', ')}। ঢাকার ভেতরে ক্যাশ অন ডেলিভারি আছে। বিকাশ, নগদ, উপায় বা ব্যাংক ট্রান্সফারের তথ্য চেকআউটে দেখানো হয়।`],
    returns: [policyText(content, 'returns') ? `Our returns policy: ${policyText(content, 'returns')}` : `Unused products in sealed packaging can be returned within 7 days. Call ${phone} for help.`, `রিটার্ন নীতি: অব্যবহৃত ও সিল করা প্রোডাক্ট ডেলিভারির ৭ দিনের মধ্যে ফেরত দেওয়া যায়; ত্রুটিযুক্ত প্রোডাক্ট ৪৮ ঘণ্টার মধ্যে জানালে বদলে দেওয়া হয়। বিস্তারিত: ${phone}।`],
    warranty: [`Everything we sell is original and comes from authorised supply. Each product page says whether a warranty is available (Yes or No), and where it is, the period is stated on your invoice. Tell me the product and I will help you.`, `আমাদের সব প্রোডাক্ট অরিজিনাল ও ওয়ারেন্টিসহ। ওয়ারেন্টির মেয়াদ প্রোডাক্ট অনুযায়ী আলাদা, তা ইনভয়েসে লেখা থাকে। কোন প্রোডাক্ট জানালে সাহায্য করব।`],
    service: [`Printer servicing: ${(site.svcPrices || []).slice(0, 5).map(s => `${s.t} ${taka(s.offer)}`).join('; ')}. It is free to book from the Servicing page, and parts are extra. Want me to point you to the booking page?`,
      `প্রিন্টার সার্ভিসিং: ${(site.svcPrices || []).slice(0, 5).map(s => `${s.bn || s.t} ${taka(s.offer)}`).join('; ')}। Servicing পেজ থেকে বুক করুন; যন্ত্রাংশের দাম আলাদা।`],
    offer: [`Use coupon ${site.coupon} for ${site.couponPct}% off at checkout. Registered members get ${site.memberPct}% more off. Delivery inside Dhaka is free within ${dl(site).freeKm} km of our office. See the Offers page for today's deals.`,
      `চেকআউটে কুপন ${site.coupon} দিলে ${site.couponPct}% ছাড়। রেজিস্টার্ড সদস্যরা আরও ${site.memberPct}% ছাড় পান। আজকের অফার দেখুন Offers পেজে।`],
    bulk: [`Corporate and bulk orders get special pricing. Tell me the model and quantity, or call ${phone}, and we will send a quotation the same day.`, `কর্পোরেট ও বাল্ক অর্ডারে বিশেষ দাম আছে। মডেল ও পরিমাণ জানান বা ${phone} নম্বরে কল করুন, একই দিনে কোটেশন পাঠানো হবে।`],
    about: [`AR Trade International is a Dhaka IT supplier: hardware since 2011 and IT services since 2019. We sell original printers, toner, ink, photocopiers, computers, CCTV and networking, and we service printers. Showroom: ${site.address}.`, `AR Trade International ঢাকার একটি আইটি সরবরাহকারী প্রতিষ্ঠান: ২০১১ থেকে হার্ডওয়্যার, ২০১৯ থেকে আইটি সার্ভিস। অরিজিনাল প্রিন্টার, টোনার, কালি, ফটোকপিয়ার, কম্পিউটার, সিসিটিভি ও নেটওয়ার্কিং বিক্রি করি, প্রিন্টার সার্ভিসও দিই। শোরুম: ${site.address}।`],
    brands: [`We carry ${f.brands.length ? f.brands.join(', ') : 'HP, Canon, Epson, Brother, Toshiba, Sharp and more'}. Tell me the brand and what you need.`, `আমাদের কাছে আছে ${f.brands.length ? f.brands.join(', ') : 'HP, Canon, Epson, Brother, Toshiba, Sharp ও আরও'}। ব্র্যান্ড ও প্রয়োজন জানান।`],
    categories: [`We sell: ${f.cats.join(', ')}. What are you looking for, and what is your budget?`, `আমাদের পণ্য: ${f.cats.join(', ')}। কী লাগবে এবং বাজেট কত জানান।`]
  };
  return S[intent]?.[bn ? 1 : 0] || null;
}

function faqAnswer(text, content, site) {
  const w = new Set(text.toLowerCase().match(/[a-z]{4,}/g) || []);
  if (!w.size) return null;
  let best = null, score = 0;
  for (const f of content?.faqs || []) {
    const q = new Set(`${f.q} ${f.a}`.toLowerCase().match(/[a-z]{4,}/g) || []);
    const s = [...w].filter(x => q.has(x)).length;
    if (s > score) { score = s; best = f; }
  }
  return score >= 2 ? best.a.replace('{phone}', site.phone) : null;
}

const sellLine = (list, bn) => (list[0]
  ? (bn ? ' কার্ডে ট্যাপ করে বিস্তারিত দেখুন বা কার্টে যোগ করুন।' : ' Tap a card for details or add it to your cart.')
  : '');
const labelOf = ctx => [ctx.brand, ctx.tech, ctx.flags?.color ? 'colour' : ctx.flags?.mono ? 'mono' : '', ctx.flags?.wifi ? 'Wi-Fi' : '', ctx.flags?.multi ? 'multifunction' : '',
  { printer: 'printers', toner: 'toner', 'copier-toner': 'copier toner', ink: 'ink', copier: 'photocopiers', computer: 'computers', scanner: 'scanners', camera: 'security cameras', network: 'networking products', parts: 'spare parts' }[ctx.cat] || 'products'].filter(Boolean).join(' ');
const range = ctx => ctx.max === Infinity ? `above ${taka(ctx.min)}` : ctx.min ? `${taka(ctx.min)} to ${taka(ctx.max)}` : `up to ${taka(ctx.max)}`;

function productAnswer(u, found, bn, site) {
  const { ctx } = u, { list } = found;
  const items = list.map(p => ({ id: p.id, name: p.name, img: p.img, price: p.price, stock: p.stock, slug: p.slug }));
  const stock = p => (p.stock > 0 ? (bn ? 'স্টকে আছে' : 'in stock') : (bn ? 'এখন স্টকে নেই' : 'out of stock right now'));
  if (!list.length) {
    if (u.models.length) {
      const m = u.models.map(x => x.toUpperCase()).join(' ');
      return { text: bn ? `${m} মডেলের জন্য এই মুহূর্তে তালিকায় কিছু পাইনি। সঠিক প্রোডাক্ট নিশ্চিত করতে ${site.phone} নম্বরে কল বা WhatsApp করুন।`
        : `I could not find ${labelOf(ctx)} listed for ${m} on the site. Call or WhatsApp ${site.phone} with your printer model and the team will confirm the right one and today's price.`, items, ctx };
    }
    return { text: bn ? `এই মুহূর্তে এমন কোনো প্রোডাক্ট পাইনি। মডেল নম্বর বা বাজেট জানালে খুঁজে দেব, অথবা ${site.phone} নম্বরে কল করুন।`
      : `I could not find a match right now. Tell me the model number or your budget and I will look again, or call ${site.phone} and the team will source it for you.`, items, ctx };
  }
  if (found.exact) {
    const top = list[0];
    const text = list.length === 1
      ? (bn ? `${top.name}: ${top.price > 0 ? taka(top.price) : 'দাম জানতে কল করুন'}, ${stock(top)}।` : `${top.name}: ${top.price > 0 ? taka(top.price) : 'price on request'}, ${stock(top)}.${top.price > 0 ? '' : ` Call or WhatsApp ${site.phone} and we will quote it today.`}`)
      : (bn ? `${list.length}টি মিল পেয়েছি।` : `I found ${found.total} matching products. Here are the closest.`);
    return { text: text + sellLine(list, bn), items, ctx };
  }
  const nameList = list.map(p => `${p.name} (${p.price > 0 ? taka(p.price) : bn ? 'দাম জানতে কল করুন' : 'price on request'})`).join('; ');
  let text;
  if (list.every(p => !(p.price > 0))) {
    text = bn ? `এগুলো আছে: ${nameList}। এসব প্রোডাক্টের দাম আজকের কোটেশনে জানানো হয় — ${site.phone} নম্বরে কল বা WhatsApp করুন।`
      : `We have these ${labelOf(ctx)}: ${nameList}. Their prices are quoted per order, so call or WhatsApp ${site.phone} with the quantity and we will send today's price.`;
    return { text, items, ctx };
  }
  if (found.near) {
    const what = found.relaxed && found.relaxed.min == null && (ctx.min != null || ctx.max != null) ? 'budget' : 'wish';
    text = bn ? `হুবহু মিল পাইনি। কাছাকাছি: ${nameList}।`
      : what === 'budget' ? `I have nothing exactly in ${range(ctx)}, but these ${labelOf(found.relaxed)} are the closest in price: ${nameList}.`
        : `I do not have an exact match for that, but these ${labelOf(found.relaxed)} are close: ${nameList}.`;
  }
  else if (ctx.max != null || ctx.min != null) text = bn ? `আপনার বাজেটে ${found.total}টি প্রোডাক্ট আছে। সেরা কয়েকটি: ${nameList}।` : `I found ${found.total} ${labelOf(ctx)} in ${range(ctx)}. Best picks: ${nameList}.`;
  else if (ctx.sort === 'cheap') text = bn ? `সবচেয়ে কম দামের কয়েকটি: ${nameList}।` : `The lowest-priced ${labelOf(ctx)} in stock: ${nameList}.`;
  else text = bn ? `জনপ্রিয় কয়েকটি: ${nameList}।` : `Popular ${labelOf(ctx)} right now: ${nameList}.`;
  const ask = ctx.cat === 'printer' && !ctx.tech && !(ctx.flags?.color || ctx.flags?.mono)
    ? (bn ? ' বাসার জন্য নাকি অফিসের? মাসে কত পাতা প্রিন্ট হবে এবং কালার লাগবে কিনা জানালে আরও ভালো বেছে দিতে পারব।' : ' Is it for home or office, and do you need colour? Tell me and I will narrow it down.')
    : (bn ? '' : ' What is your budget? I will narrow it down.');
  return { text: text + sellLine(list, bn) + (found.near ? '' : ask), items, ctx };
}

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

// ---------- optional Claude mode ----------
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
async function claudeReply({ text, history = [], ctx = {} }, data, base) {
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
    `Payment: ${facts(site, content, data.cats, data.products).pay.join(', ')}. Coupon ${site.coupon} gives ${site.couponPct}% off; members get ${site.memberPct}% more.`,
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
