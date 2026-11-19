import { fail, int, iso, text, today } from '../util.js';
import { CUSTOMER_TYPES } from './constants.js';
import { totalsOf } from './totals.js';

/** Cleans the item lines of a request body: at most 60, trimmed, empty descriptions dropped. */
export function cleanLines(rawLines) {
  return (Array.isArray(rawLines) ? rawLines : []).slice(0, 60).map(l => ({
    productId: parseInt(l.productId, 10) || null, description: text(l.description, 400), qty: Math.max(1, int(l.qty, 100000)), unit: text(l.unit, 12).toUpperCase() || 'PCS', warranty: text(l.warranty, 60), unitPrice: int(l.unitPrice)
  })).filter(l => l.description);
}

/** Validates a quotation request body and returns the clean fields with totals; throws a 400 on bad input. */
export function parseQuoteBody(b = {}) {
  const lines = cleanLines(b.lines);
  if (!text(b.toName, 200)) throw fail(400, 'Write who the quotation is for');
  if (!lines.length) throw fail(400, 'Add at least one item');
  const charges = { install: int(b.install), transport: int(b.transport), discount: int(b.discount), vat: int(b.vat) };
  const t = totalsOf(lines, charges);
  if (!(t.total <= 2000000000 && t.net <= 2000000000)) throw fail(400, 'The quotation total is too large');
  if (charges.discount > t.total + charges.install + charges.transport + charges.vat) throw fail(400, 'The discount is more than the quotation total');
  return {
    lines, ...charges, ...t, custType: CUSTOMER_TYPES.includes(b.custType) ? b.custType : 'New', customerId: parseInt(b.customerId, 10) || null, date: iso(b.date, today()), toName: text(b.toName, 200), address: text(b.address, 300), attend: text(b.attend, 120), desig: text(b.desig, 120), mobile: text(b.mobile, 40), email: text(b.email, 160),
    subject: text(b.subject, 300), intro: text(b.intro, 2000), notes: text(b.notes, 2000), validDays: Math.max(1, int(b.validDays, 365)),
    signerName: text(b.signerName, 120), signerDesig: text(b.signerDesig, 120), signerDept: text(b.signerDept, 120), signerCell: text(b.signerCell, 80)
  };
}
