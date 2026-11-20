// What a buyer sends from the review page: validation of the reviews (pure) and saving them with the order link.
import { pool } from '../db.js';
import { fail } from '../util.js';
import { assessReview as realAssess, hashIp } from './reviewSpam.js';
import { displayName } from './reviewRequestsCore.js';

/** Checks the posted reviews against the rules of the site review form. Returns the clean list or throws a 400/409. */
export function cleanReviews(list, orderProducts, already = new Set()) {
  if (!Array.isArray(list) || !list.length) throw fail(400, 'Please write at least one review');
  if (list.length > 10) throw fail(400, 'Too many reviews in one go (10 at most)');
  const seen = new Set(), out = [];
  for (const r of list) {
    const pid = Number(r?.productId);
    if (!Number.isInteger(pid) || !orderProducts.has(pid)) throw fail(400, 'One of the products is not part of this order');
    if (seen.has(pid)) throw fail(400, 'Only one review per product');
    seen.add(pid);
    if (already.has(pid)) throw fail(409, 'You have already reviewed one of these products');
    const rating = Number(r.rating), body = String(r.body ?? '').trim(), title = String(r.title ?? '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw fail(400, 'Please choose a star rating');
    if (body.length < 10) throw fail(400, 'Please write at least 10 characters');
    if (body.length > 1500) throw fail(400, 'Review is too long (1500 characters max)');
    if (title.length > 120) throw fail(400, 'Title is too long (120 characters max)');
    out.push({ productId: pid, rating, title, body });
  }
  return out;
}

/** Saves the reviews of one request. `req` = { row (review_requests joined with the order name), settings, ip, now, assess }.
 *  Returns { saved, status }. A reject from the spam check is a 400 and nothing is saved. */
export async function submitReviews({ row, settings, body, ip, now = Date.now(), assess = realAssess }) {
  const [items] = await pool.query('SELECT DISTINCT product_id FROM order_items WHERE order_id = ?', [row.order_id]);
  const [have] = await pool.query('SELECT product_id FROM reviews WHERE order_id = ? AND status <> "Rejected"', [row.order_id]);
  const list = cleanReviews(body?.reviews, new Set(items.map(i => i.product_id)), new Set(have.map(h => h.product_id)));
  const checked = list.map(r => ({ r, a: assess({ title: r.title, body: r.body, honeypot: String(body?.website ?? ''), renderedAt: body?.renderedAt, now }) }));
  const bad = checked.find(c => c.a?.reject);
  if (bad) throw fail(400, bad.a.reject);
  const name = displayName(row.customer_name || row.name), ipHash = hashIp(ip);
  let approved = 0;
  for (const { r, a } of checked) {
    const status = a.status === 'Spam' ? 'Spam' : settings.autoApproveVerified ? 'Approved' : 'Pending';
    if (status === 'Approved') approved++;
    await pool.query('INSERT INTO reviews (product_id, user_id, name, rating, title, body, verified, status, order_id, source, ip_hash, spam_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [r.productId, row.user_id || null, name, r.rating, r.title, r.body, 1, status, row.order_id, 'request', ipHash, String(a.reason || '').slice(0, 200)]);
  }
  await pool.query("UPDATE review_requests SET status = 'Reviewed', reviewed_at = ? WHERE id = ? AND status IN ('Queued','Sent','Opened')", [new Date(now), row.id]);
  return { saved: checked.length, status: approved ? 'Approved' : 'Pending' };
}
