/** Checks that the app's real queries use the new indexes (EXPLAIN) and times them with and without (IGNORE INDEX). */
import { pool } from '../src/db.js';

const Q = [
  ['shop list: category + active, by price', "SELECT id FROM products {I} WHERE active = 1 AND category_id = 'toner' ORDER BY price LIMIT 24", 'products'],
  ['popular rail', "SELECT id FROM products {I} WHERE active = 1 AND popular = 1 LIMIT 12", 'products'],
  ['admin orders by status/date', "SELECT id FROM orders {I} WHERE status = 'Delivered' ORDER BY created_at DESC LIMIT 25", 'orders'],
  ['hub board by flow/date', "SELECT id FROM orders {I} WHERE flow = 'Confirmed' ORDER BY created_at DESC", 'orders'],
  ['orders by date', "SELECT id FROM orders {I} ORDER BY created_at DESC LIMIT 25", 'orders'],
  ['customer order history', "SELECT id FROM orders {I} WHERE user_id = 5 ORDER BY created_at DESC", 'orders'],
  ['best sellers join', "SELECT i.product_id, SUM(i.qty) q FROM order_items i {I} JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' GROUP BY i.product_id ORDER BY q DESC LIMIT 6", 'order_items'],
  ['order detail history', "SELECT id FROM order_history {I} WHERE order_id = 'WP-21315' ORDER BY at", 'order_history'],
  ['blog by category', "SELECT id FROM blog_posts {I} WHERE category = 'Toner' AND status = 'Published' ORDER BY published DESC", 'blog_posts'],
  ['mail queue due', "SELECT id FROM mkt_outbox {I} WHERE status = 'Queued' AND send_at <= NOW()", 'mkt_outbox']
];
const ours = new Set();
const [ix] = await pool.query("SELECT TABLE_NAME t, INDEX_NAME i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME LIKE 'idx\_%'");
ix.forEach(r => ours.add(r.t + '.' + r.i));
async function time(sql) { const t = process.hrtime.bigint(); for (let k = 0; k < 40; k++) await pool.query(sql); return Number(process.hrtime.bigint() - t) / 1e6 / 40; }
for (const [name, tpl, tab] of Q) {
  const plain = tpl.replace('{I}', '');
  const [ex] = await pool.query('EXPLAIN ' + plain);
  const row = ex.find(r => r.table === tab || r.table === 'i' || r.table === 'o') || ex[0];
  const used = row.key || 'NONE';
  const mine = [...ours].filter(k => k.startsWith(tab + '.')).map(k => k.split('.')[1]);
  // "without" = force the primary key only (ignore every secondary index we added)
  const without = tpl.replace('{I}', mine.length ? 'IGNORE INDEX (' + mine.join(',') + ')' : '');
  const a = await time(plain), b = await time(without);
  console.log(`${name.padEnd(36)} key=${String(used).padEnd(22)} rows~${String(row.rows).padStart(5)}  with ${a.toFixed(2)}ms  without ${b.toFixed(2)}ms`);
}
await pool.end();
