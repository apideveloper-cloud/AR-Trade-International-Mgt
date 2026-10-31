// Product search used by the header live search and the shop page, so both show the same products.
// A typed word must match the START of a word in the product (name, brand, part number, compatible printers): "05a" finds "HP 05A Black…" but
// not "HP 205A…" or "…F9K05A". Only when nothing matches that way does it fall back to a match anywhere inside a word, so a half-remembered
// ending ("532a" for CF532A) still finds something.

const tokens = s => String(s || '').toLowerCase().match(/[a-z0-9ঀ-৿]+/g) || [];

/** How well one typed word matches a list of words: 3 the whole word, 2 the start of a word, 1 inside a word, 0 not at all. */
function wordScore(w, toks) {
  let best = 0;
  for (const t of toks) {
    if (t === w) return 3;
    if (t.startsWith(w)) best = Math.max(best, 2);
    else if (best < 1 && t.includes(w)) best = 1;
  }
  return best;
}

/** The products that match `q`, best first. */
export function matchProducts(products, q) {
  const words = tokens(q);
  if (!words.length) return [];
  const strong = [], weak = [];
  for (const p of products) {
    const nameT = tokens(p.name);
    const all = nameT.concat(tokens(p.brand), tokens(p.part), tokens(p.compat));
    let score = 0, ok = true, wk = false;
    for (const w of words) {
      const s = wordScore(w, all);
      if (!s) { ok = false; break; }
      if (s === 1) wk = true;
      score += s * 10 + wordScore(w, nameT) * 3; // a hit in the name counts more than one in the compatible-printers list
    }
    if (!ok) continue;
    if (tokens(p.part).includes(words[0])) score += 40; // the exact part number
    if (nameT[0] && nameT[0].startsWith(words[0])) score += 10;
    if (p.stock > 0) score += 2;
    (wk ? weak : strong).push({ p, score });
  }
  const pick = strong.length ? strong : weak;
  return pick.sort((a, b) => b.score - a.score).map(x => x.p);
}

/** [text, isMatch] pieces of `text` for highlighting: only the beginning of the words that were typed. */
export function highlight(text, q) {
  const words = tokens(q);
  const out = [];
  let last = 0;
  const re = /[a-zA-Z0-9ঀ-৿]+/g;
  let m;
  const s = String(text);
  while ((m = re.exec(s))) {
    const low = m[0].toLowerCase();
    const w = words.find(x => low.startsWith(x));
    if (!w) continue;
    if (m.index > last) out.push([s.slice(last, m.index), false]);
    out.push([s.slice(m.index, m.index + w.length), true]);
    last = m.index + w.length;
  }
  if (last < s.length) out.push([s.slice(last), false]);
  return out;
}
