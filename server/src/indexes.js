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
  ['categories', 'idx_sort', 'hidden, sort_order'],
  // who generated the order (Customer / Call center / Admin / Seller) is a filter on the Orders page
  ['orders', 'idx_source_created', 'source, created_at'],
  // purchasing: list by stage and date, the vendor balance (status and total are read straight from the index), the month summary, the next invoice number
  ['stock_receipts', 'idx_status_date', 'status, received_on'],
  ['stock_receipts', 'idx_date', 'received_on'],
  ['stock_receipts', 'idx_vendor_status', 'vendor_id, status, total'],
  ['stock_receipts', 'idx_invoice', 'invoice_no'],
  ['stock_moves', 'idx_product_kind', 'product_id, kind, id'], // the "last buying price" lookup
  ['stock_damages', 'idx_product', 'product_id'],
  ['stock_damages', 'idx_vendor', 'vendor_id'],
  ['vendor_returns', 'idx_date', 'returned_on'],
  ['vendor_payments', 'idx_paid', 'paid_on'],
  ['field_vendors', 'idx_active_name', 'active, name'],
  // quotations: list by status / customer type and date, open a shared link by its token
  ['quotations', 'idx_status_date', 'status, quote_date'],
  ['quotations', 'idx_ctype_date', 'cust_type, quote_date'],
  ['quotations', 'idx_token', 'share_token']
];

/** Indexes that are only the first columns of another index. MySQL uses the longer one for the same lookups, so the short one only costs space and slows writes. [table, index to drop, index that covers it] */
export const REDUNDANT = [
  ['orders', 'idx_user', 'idx_user_created'],
  ['field_expenses', 'idx_staff', 'idx_client_ref'],
  ['field_payments', 'idx_staff', 'idx_client_ref'],
  ['field_sales_orders', 'idx_staff', 'idx_client_ref'],
  ['quotations', 'idx_status', 'idx_status_date']
];

/** Creates the missing indexes, drops the redundant ones (only when the covering index exists) and refreshes the statistics of the tables that changed (all of them with `analyzeAll`). */
export async function ensureIndexes(pool, log = () => {}, { analyzeAll = false } = {}) {
  const [have] = await pool.query('SELECT TABLE_NAME t, INDEX_NAME i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()');
  const [tabs] = await pool.query('SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()');
  const exists = new Set(have.map(r => r.t + '.' + r.i));
  const tables = new Set(tabs.map(r => r.t));
  let made = 0;
  const touched = new Set();
  for (const [t, name, cols] of INDEXES) {
    if (!tables.has(t) || exists.has(t + '.' + name)) continue;
    try { await pool.query(`ALTER TABLE \`${t}\` ADD INDEX \`${name}\` (${cols})`); made++; touched.add(t); exists.add(t + '.' + name); log(`  + ${t}.${name} (${cols})`); }
    catch (e) { log(`  ! ${t}.${name}: ${e.message}`); }
  }
  for (const [t, drop, keep] of REDUNDANT) {
    if (!exists.has(t + '.' + drop) || !exists.has(t + '.' + keep)) continue;
    try { await pool.query(`ALTER TABLE \`${t}\` DROP INDEX \`${drop}\``); touched.add(t); log(`  - ${t}.${drop} (covered by ${keep})`); }
    catch (e) { log(`  ! ${t}.${drop}: ${e.message}`); }
  }
  for (const t of analyzeAll ? tables : touched) await pool.query(`ANALYZE TABLE \`${t}\``);
  return made;
}
