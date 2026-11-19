/** Pure helpers for the product page: name splitting, spec rows, gallery views, share links. */

export const SPEC_ICON = { Brand: '★', 'Part no.': '#', Technology: '⚡', 'Printing colour': '◐', 'Page yield / capacity': '≡', 'Compatible printers': '⎙', Warranty: '✓' };
const SHARE_NAMES = { f: 'Facebook', X: 'X', in: 'LinkedIn', W: 'WhatsApp', '@': 'email' };

/** The product name in two levels: brand + model first, then what it is. "Toshiba T-FC415P CMYK Original Toner Cartridge" becomes
 *  "Toshiba T-FC415P CMYK" and "Original Toner Cartridge". The heading still holds the whole name; a name that does not split stays in one piece. */
const DESC_START = /\s(?=(?:Original|Compatible|Genuine|Premium|Toner|Ink|Cartridge|Cartridges|Laser|LaserJet|Printer|Photocopier|Copier|Drum|Developer|Refill|Bottle)\b)/i;
export function nameParts(name) {
  const n = String(name || '').trim(), m = DESC_START.exec(n);
  if (!m || n.slice(0, m.index).trim().split(/\s+/).length < 2) return [['pn-main', n]];
  return [['pn-main', n.slice(0, m.index).trim()], ['pn-sub', n.slice(m.index).trim()]];
}

/** A product without the flag counts as Yes. */
export const hasWarranty = x => !(x && x.warranty === false);

function baseSpecs(p) {
  return [['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Printing colour', p.color], ['Page yield / capacity', p.yield], ['Compatible printers', p.compat], ...(p.extra || [])]
    .filter(r => r[1] && r[1] !== '—').concat([['Warranty', hasWarranty(p) ? 'Yes — 100% original product' : 'No']]);
}

/** All specification rows: the product's own, then the extra ones from the full record that are not already listed. */
export function specRows(p, full) {
  const own = baseSpecs(p);
  return own.concat(((full && full.specs) || []).filter(x => !own.some(r => r[0].toLowerCase() === x.name.toLowerCase())).map(x => [x.name, x.value]));
}

/** Gallery views: real photos when the record has more than one, otherwise four zoomed crops of the single image. */
export function galleryViews(full) {
  const photos = full && full.gallery && full.gallery.length > 1 ? full.gallery : null;
  return photos
    ? photos.map((u, i) => ({ k: 'Photo ' + (i + 1), s: 1, o: '50% 50%', img: u }))
    : [{ k: 'Front', s: 1, o: '50% 50%' }, { k: 'Close-up', s: 1.5, o: '50% 50%' }, { k: 'Top detail', s: 1.8, o: '28% 28%' }, { k: 'Base detail', s: 1.8, o: '72% 75%' }];
}

/** Stock line: colour, text and whether the stock is low. */
export function stockInfo(p) {
  const low = p.stock > 0 && p.stock <= 5;
  return {
    low,
    tone: p.stock <= 0 ? 'oklch(0.55 0.02 260)' : low ? 'oklch(0.55 0.2 350)' : 'oklch(0.5 0.15 150)',
    text: p.stock <= 0 ? 'Out of stock' : low ? `Only ${p.stock} left — order soon` : 'In stock · ready to ship'
  };
}

/** [label, background, href] for each social share button. */
export function shareLinks(name) {
  const url = encodeURIComponent(window.location.href), tt = encodeURIComponent(name);
  return [['f', '#1877f2', 'https://www.facebook.com/sharer/sharer.php?u=' + url], ['X', '#0f1419', `https://twitter.com/intent/tweet?url=${url}&text=${tt}`], ['in', '#0a66c2', 'https://www.linkedin.com/sharing/share-offsite/?url=' + url], ['W', '#25d366', `https://wa.me/?text=${tt}%20${url}`], ['@', '#5d6270', `mailto:?subject=${tt}&body=${url}`]]
    .map(([i, bg, href]) => ({ i, bg, href, label: 'Share via ' + SHARE_NAMES[i] }));
}
