/**
 * Secondary indexes chosen from the queries the app actually runs (list filters, ORDER BY columns, JOIN keys, lookups).
 * ensureIndexes() is idempotent: it creates only what is missing, so it is safe on every `db:setup` and via `npm run db:optimize`.
 */
export const INDEXES = [
  // catalogue: storefront list (active + category), price/sort filters, popular/featured rails, import re-matching
  ['products', 'idx_active_cat_price', 'active, category_id, price'],
  ['products', 'idx_active_flags', 'active, popular, featured, is_new'],
  ['products', 'idx_part', 'part'],
  ['products', 'idx_source', 'source_url(120)'],
  // orders: admin list/filters (status, flow, date), hub board (branch, rider), track by courier, customer history
  ['orders', 'idx_status_created', 'status, created_at'],
  ['orders', 'idx_flow_created', 'flow, created_at'],
  ['orders', 'idx_created', 'created_at'],
  ['orders', 'idx_branch_flow', 'branch_id, flow'],
  ['orders', 'idx_rider_flow', 'rider_id, flow'],
  ['orders', 'idx_courier_tn', 'courier_tn'],
  ['orders', 'idx_email', 'customer_email'],
  ['orders', 'idx_user_created', 'user_id, created_at'],
  // best sellers / order detail
  ['order_items', 'idx_product', 'product_id'],
  ['order_items', 'idx_order_prod_qty', 'order_id, product_id, qty'], // covering index for the best-sellers aggregate
  ['order_history', 'idx_order_at', 'order_id, at'],
  ['order_returns', 'idx_status', 'status, created_at'],
  // inbox, servicing, careers
  ['service_requests', 'idx_status_created', 'status, created_at'],
  ['service_requests', 'idx_phone', 'phone'],
  ['messages', 'idx_created', 'created_at'],
  ['messages', 'idx_subject', 'subject'],
  ['applications', 'idx_stage_created', 'stage, created_at'],
  ['jobs', 'idx_open_deadline', '`open`, deadline'],
  // content
  ['blog_posts', 'idx_category', 'category, status, published'],
  ['blog_posts', 'idx_author', 'author_id'],
  ['site_pages', 'idx_status', 'status, grp'],
  ['reviews', 'idx_user_prod', 'user_id, product_id'],
  ['reviews', 'idx_created', 'created_at'],
  // email centre
  ['mkt_outbox', 'idx_status_send', 'status, send_at'],
  ['mkt_outbox', 'idx_email', 'email'],
  ['mkt_log', 'idx_email_at', 'email, at'],
  ['mkt_campaigns', 'idx_status_created', 'status, created_at'],
  ['consents', 'idx_status', 'status, created_at'],
  ['subscribers', 'idx_created', 'created_at'],
  // accounts
  ['user_reminders', 'idx_next', 'active, next_at'],
  ['staff', 'idx_role_status', 'role, status'],
  ['categories', 'idx_sort', 'hidden, sort_order']
];

export async function ensureIndexes(pool, log = () => {}) {
  const [have] = await pool.query('SELECT TABLE_NAME t, INDEX_NAME i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()');
  const [tabs] = await pool.query('SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const exists = new Set(have.map(r => r.t + '.' + r.i));
  const tables = new Set(tabs.map(r => r.t));
  let made = 0;
  for (const [t, name, cols] of INDEXES) {
    if (!tables.has(t) || exists.has(t + '.' + name)) continue;
    try { await pool.query(`ALTER TABLE \`${t}\` ADD INDEX \`${name}\` (${cols})`); made++; log(`  + ${t}.${name} (${cols})`); }
    catch (e) { log(`  ! ${t}.${name}: ${e.message}`); }
  }
  for (const t of tables) await pool.query(`ANALYZE TABLE \`${t}\``);
  return made;
}
