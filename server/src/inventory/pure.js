// Pure (database-free) helpers for the inventory modules, unit-tested in test/inventory_split.test.js.
import { fail, int, text } from '../util.js';

/** Formats a numbered ID such as VEN-26-00001 (prefix already includes the year part). */
export const formatSeq = (prefix, n) => prefix + String(n).padStart(5, '0');
/** True when a purchase status counts as a bill on the vendor's account. */
export const billedOf = st => st === 'Approved' || st === 'Stocked';
/** Two-digit year of a date, as used in vendor codes. */
export const yearYY = d => String(new Date(d).getFullYear()).slice(2);

/** Normalises posted lines to [{ productId, qty, unitCost, discount }], dropping rows without a product or quantity (max 60). */
export const normalizeLines = raw => (Array.isArray(raw) ? raw : []).slice(0, 60).map(l => ({ productId: parseInt(l.productId, 10), qty: int(l.qty, 100000), unitCost: int(l.unitCost), discount: int(l.discount) })).filter(l => l.productId && l.qty > 0);

/** Checks normalised lines (at least one, prices, discounts) and throws 400 with the messages the API always used. */
export function checkLines(lines, needCost = true) {
  if (!lines.length) throw fail(400, 'Add at least one product with a quantity');
  if (needCost && lines.some(l => l.unitCost <= 0)) throw fail(400, 'Every product needs its buying price');
  if (lines.some(l => l.discount > l.qty * l.unitCost)) throw fail(400, 'A discount cannot be more than that product\'s amount');
}

/** Total of the lines; money columns are INT so a total they cannot hold is refused instead of failing half way. */
export const sum = lines => {
  const t = lines.reduce((a, l) => a + l.qty * l.unitCost - (l.discount || 0), 0);
  if (!(t <= 2000000000)) throw fail(400, 'The total is too large');
  return t;
};

/** Maps a vendor row (with optional bills/rets/paid/balance columns) to the API shape. */
export const vOut = r => ({
  id: r.id, code: r.code || '', name: r.name, vtype: r.vtype === 'Foreign' ? 'Foreign' : 'Local', kind: r.kind, contact: r.contact, picDesig: r.pic_desig || '', picPhone: r.pic_phone || '', phone: r.phone, email: r.email, address: r.address, note: r.note, active: !!r.active, opening: r.opening,
  bills: Number(r.bills || 0), returns: Number(r.rets || 0), paid: Number(r.paid || 0), balance: Number(r.balance || 0), lastBill: r.last_bill
});
/** Cleans a posted vendor body. */
export const vendorBody = b => ({ name: text(b.name, 160), vtype: b.vtype === 'Foreign' ? 'Foreign' : 'Local', kind: text(b.kind, 60), contact: text(b.contact, 120), picDesig: text(b.picDesig, 80), picPhone: text(b.picPhone, 30), phone: text(b.phone, 30), email: text(b.email, 160), address: text(b.address, 300), note: text(b.note, 300), opening: Math.round(Number(b.opening) || 0), active: b.active === false ? 0 : 1 });
/** Indexes the posted `lines` of an approval / stock-in body by product id. */
export const linesByProduct = body => new Map((Array.isArray(body?.lines) ? body.lines : []).map(l => [parseInt(l.productId, 10), l]));
