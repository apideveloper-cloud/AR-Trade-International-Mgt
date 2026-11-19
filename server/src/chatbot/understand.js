// Works out what the customer wants: product type, brand, technology, budget, model numbers.
import { parseBudget } from './budget.js';
import { squash, toEnDigits } from './text.js';

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

/** Brand names that appear on at least 3 products (so a stray typo is not offered as a brand). */
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
