// words that say what the visitor wants, not which product: they are ignored when matching product names
const STOP = new Set(('a an the of for to is are me my you your i we us please pls give tell show what whats how much price prices cost rate quote need want have has any available stock in with and or about buy get can could would do does this that it on at from there find looking look hi hello hey thanks thank ok okay'
  + ' দাম কত আছে লাগবে চাই').split(' '));
const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Looks the visitor's words up in the catalogue: a model number (MX-235AT, CF279A, 12A) must match, or two or more plain words that narrow it to a few products. */
export function findProducts(text, products) {
  const words = (String(text).toLowerCase().match(/[a-z0-9][a-z0-9\-/.]*/g) || []).map(squash).filter(Boolean);
  const models = words.filter(w => w.length >= 3 && /\d/.test(w) && /[a-z]/.test(w));
  const plain = words.filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w) && !models.includes(w));
  if (!models.length && plain.length < 2) return [];
  const hits = [];
  for (const p of products) {
    const label = p.name + ' ' + (p.part || '') + ' ' + (p.sku || '') + ' ' + (p.brand || '');
    const hay = squash(label), hayWords = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    // short model codes (12A, T372) must be a whole word, or they would match inside other numbers (W2412A); longer ones may span a hyphen (MX-235AT)
    const hasModel = m => hayWords.includes(m) || (m.length >= 6 && hay.includes(m));
    if (models.length ? !models.every(hasModel) : !plain.every(w => hay.includes(w))) continue;
    hits.push({ p, score: plain.filter(w => hay.includes(w)).length * 2 + (p.stock > 0 ? 1 : 0) + (p.price > 0 ? 1 : 0) });
  }
  if (!models.length && hits.length > 6) return []; // too general to be a particular product
  return hits.sort((a, b) => b.score - a.score).slice(0, 3).map(h => h.p);
}
