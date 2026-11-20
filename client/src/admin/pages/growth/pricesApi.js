import { getAdminToken } from '../../adminApi.js';

/** POST that keeps the error body (adm.post throws it away): returns { status, ok, body }. Never throws. */
export async function send(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getAdminToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  try {
    const res = await fetch('/api/admin' + url, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body: data };
  } catch {
    return { status: 0, ok: false, body: { error: "Can't reach the server. Check your internet connection and try again." } };
  }
}

export const STOCK_STATUS = [['', 'Auto'], ['in_stock', 'In stock'], ['out_of_stock', 'Out of stock'], ['preorder', 'Pre-order'], ['backorder', 'Back-order']];
export const ISSUES = [['no_sku', 'No SKU'], ['sale_expired', 'Sale ended'], ['zero_price', 'Price is 0'], ['out_of_stock', 'Out of stock'], ['low_stock', 'Low stock'], ['no_stock_status', 'No stock status']];
export const money = n => (Number(n) || 0).toLocaleString('en-US');

/** Turns a 409 needsConfirm list into the question shown to the owner. */
export const jumpText = list => 'This changes the price by more than 50 % for:\n' + list.map(p => `${p.name || '#' + p.id} (${money(p.from)} to ${money(p.to)}${p.pct != null ? ', ' + Math.round(p.pct) + ' %' : ''})`).join('\n') + '\nIs this correct?';

/** Short text for a 400 { errors } answer. */
export const errorLines = b => (b.errors || []).map(e => `#${e.id} ${e.field || ''}: ${e.message}`);
