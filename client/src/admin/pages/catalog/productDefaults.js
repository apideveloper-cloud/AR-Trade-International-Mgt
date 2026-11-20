/** Empty product form values. */
export const BLANK_PRODUCT = { warranty: true, name: '', brand: '', cat: '', price: '', old: '', stock: 10, img: '', part: '', gtin: '', tech: '', color: '', yield: '', compat: '', spec: '', description: '', gallery: [], metaTitle: '', metaDesc: '', metaKeywords: '' };

/** "Name: value" lines -> [{ name, value }] (lines without a colon are dropped). */
export const parseSpecs = text => text.split('\n').map(l => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i), value: l.slice(i + 1) } : null; }).filter(Boolean);

/** [{ name, value }] -> "Name: value" lines for the specifications box. */
export const specsToText = specs => (specs || []).map(s => `${s.name}: ${s.value}`).join('\n');
