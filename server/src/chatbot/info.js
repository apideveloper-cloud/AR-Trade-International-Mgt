// The shop's own information: intents, policies, FAQs and the canned answers.
import { dl, taka } from './text.js';

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
/** First matching shop-information intent of the (lower-cased) message, or null. */
export const intentOf = t => INTENTS.find(([, re]) => re.test(t))?.[0] || null;

/** The first four sections of a policy as one paragraph, or null. */
export function policyText(content, key) {
  const pol = (content?.policies || []).find(p => p.k === key);
  if (!pol) return null;
  return pol.secs.slice(0, 4).map(s => `${s.h}: ${s.p}`).join(' ');
}
export const brandNames = content => (content?.brands || []).map(b => b.n).filter(Boolean);

/** The shop facts the answers need: payment names, brand names, category titles. */
export function facts(site, content, cats) {
  const pay = Object.entries(site.payments || {}).filter(([, on]) => on).map(([k]) => ({ COD: 'cash on delivery', Bank: 'bank transfer' }[k] || k));
  return { pay, brands: brandNames(content), cats: cats.map(c => c.t) };
}

/** Canned answer (English or Bangla) for a shop-information intent. */
export function infoAnswer(intent, bn, { site, content, cats }) {
  const f = facts(site, content, cats);
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

/** Best FAQ answer sharing at least 2 words with the message, or null. */
export function faqAnswer(text, content, site) {
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
