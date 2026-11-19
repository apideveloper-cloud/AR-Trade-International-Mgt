// Pure purchasing maths: order totals, budget check, quote tags, ids and due dates.
export const BUDGET = parseInt(process.env.PURCHASE_BUDGET || '420000', 10);
export const VAT_PCT = 5;
export const FREIGHT = 1500;
export const TERMS = ['Advance', '15 days', '30 days', 'On delivery'];
export const DELIVER_TO = ['Head office · Santinagar', 'Warehouse · Tejgaon'];
export const STATUS_KEY = { Draft: 'draft', Submitted: 'submitted', ManagerApproved: 'manager_approved', Approved: 'approved', Rejected: 'rejected' };
/** Query-string status filter -> stored order status. */
export const STATUS_FILTER = { draft: 'Draft', submitted: 'Submitted', manager_approved: 'ManagerApproved', approved: 'Approved', rejected: 'Rejected' };

/** 'PO-', 883 / 'PO-0884' -> 'PO-0884' (the prefix is never doubled). */
export const numberId = (prefix, n) => prefix + String(n).replace(prefix, '').padStart(4, '0');

/** 'Lowest' = cheapest quote; 'Best value' = best rating for the price (rating x cheapest / price). */
export function tagQuotes(quotes) {
  if (!quotes.length) return quotes;
  const min = Math.min(...quotes.map(q => q.unitPrice));
  const lowest = quotes.find(q => q.unitPrice === min);
  const score = q => q.rating * (min / q.unitPrice);
  const best = [...quotes].sort((a, b) => score(b) - score(a))[0];
  return quotes.map(q => ({ ...q, tag: q === lowest ? 'Lowest' : (q === best ? 'Best value' : '') }));
}

/** Subtotal, VAT, freight (only when there are lines), grand total and piece count of order lines [{ qty, unitPrice }]. */
export function totals(lines, freight = FREIGHT) {
  const subtotal = lines.reduce((t, l) => t + l.qty * l.unitPrice, 0);
  const vat = Math.round(subtotal * VAT_PCT / 100);
  const fr = lines.length ? freight : 0;
  return { subtotal, vat, freight: fr, grand: subtotal + vat + fr, pcs: lines.reduce((t, l) => t + l.qty, 0) };
}
/** Budget line for an order total. */
export const budgetOf = grand => ({ budget: BUDGET, within: grand <= BUDGET, over: Math.max(0, grand - BUDGET) });

/** The Bangladesh date (YYYY-MM-DD) `days` days from now. */
export const dueDateBD = (days, now = Date.now()) => new Date(now + 6 * 3600e3 + days * 864e5).toISOString().slice(0, 10);

/** Cleans one order line from the edit form (text cut to the column sizes, numbers parsed). */
export const cleanLine = l => ({
  productId: parseInt(l.productId, 10) || null, name: String(l.name || '').trim().slice(0, 255), sku: String(l.sku || '').trim().slice(0, 80),
  qty: parseInt(l.qty, 10), unitPrice: parseInt(l.unitPrice, 10)
});
