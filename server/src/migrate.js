// Small, safe schema upgrades that run on every server start (each one only acts when something is missing).
import { pool } from './db.js';
import { ensureBackupTable } from './backup.js';
import { ensureInventory } from './inventory.js';
import { ensureQuotes } from './quotation.js';
import { ensureAudit } from './audit.js';
import { ensureIndexes } from './indexes.js';
import { ensureProductSlugs } from './productSlugs.js';
import { ensureChatLeads } from './chatLeads.js';
import { backfillMemberCodes } from './memberCode.js';
import { ensureBrands } from './brands.js';

const STAFF_COLS = [['nid', 'VARCHAR(20)'], ['present_address', 'VARCHAR(300)'], ['contact_address', 'VARCHAR(300)'], ['ref_name', 'VARCHAR(120)'], ['ref_phone', 'VARCHAR(20)']];

export async function ensureSchema() {
  await ensureBackupTable();
  await ensureInventory();
  await ensureQuotes();
  // who generated the order: the customer on the website, or a call center agent, an admin or a seller in the console
  const [oc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'");
  if (oc.length) {
    const haveO = new Set(oc.map(r => r.c));
    if (!haveO.has('source')) await pool.query("ALTER TABLE orders ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'Customer'");
    if (!haveO.has('placed_by')) await pool.query("ALTER TABLE orders ADD COLUMN placed_by VARCHAR(120) NOT NULL DEFAULT ''");
    // distance-based delivery: where the order goes, the estimated road km and (outside Dhaka) the courier chosen
    for (const [c, def] of [['dest_lat', 'DECIMAL(9,6) NULL'], ['dest_lng', 'DECIMAL(9,6) NULL'], ['distance_km', 'DECIMAL(5,1) NULL'], ['ship_partner', "VARCHAR(60) NOT NULL DEFAULT ''"], ['vat_amount', 'INT NULL DEFAULT NULL']]) { // vat_amount: VAT / taxes shown on the invoice, typed by staff (NULL = excluded)
      if (!haveO.has(c)) await pool.query(`ALTER TABLE orders ADD COLUMN ${c} ${def}`);
    }
  }
  // product warranty available: Yes (1, the default for every existing product) or No (0), set in the admin Product Entry form
  const [prc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'");
  if (prc.length && !prc.some(r => r.c === 'warranty')) await pool.query('ALTER TABLE products ADD COLUMN warranty TINYINT(1) NOT NULL DEFAULT 1');
  // last change of a product, for the sitemap's <lastmod>: stays NULL (no lastmod) until a product is really changed
  if (prc.length && !prc.some(r => r.c === 'updated_at')) { await pool.query('ALTER TABLE products ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP'); console.log('Added products.updated_at'); }
  // GTIN / EAN barcode (digits only, optional), emitted to Google as product data; no backfill
  if (prc.length && !prc.some(r => r.c === 'gtin')) { await pool.query('ALTER TABLE products ADD COLUMN gtin VARCHAR(14) NULL'); console.log('Added products.gtin'); }
  // SEO product fields: condition, sale end date, stock status override, warranty wording, hide from Google
  for (const [c, def] of [['item_condition', "VARCHAR(12) NOT NULL DEFAULT 'new'"], ['sale_ends', 'DATE NULL'], ['stock_status', "VARCHAR(12) NOT NULL DEFAULT 'auto'"], ['warranty_text', "VARCHAR(300) NOT NULL DEFAULT ''"], ['noindex', 'TINYINT(1) NOT NULL DEFAULT 0']]) {
    if (prc.length && !prc.some(r => r.c === c)) { await pool.query(`ALTER TABLE products ADD COLUMN ${c} ${def}`); console.log('Added products.' + c); }
  }
  // brands (one row per distinct product brand) and per-page SEO settings
  const [tb] = await pool.query("SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('brands', 'seo_meta', 'seo_redirects')");
  const haveTb = new Set(tb.map(r => r.t));
  if (!haveTb.has('brands')) {
    await pool.query("CREATE TABLE brands (id INT AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(80) NOT NULL, description TEXT NULL, logo VARCHAR(500) NULL, hidden TINYINT(1) NOT NULL DEFAULT 0, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    console.log('Added table brands');
  }
  if (!haveTb.has('seo_meta')) {
    await pool.query(`CREATE TABLE seo_meta (
      id INT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(20) NOT NULL, entity_id VARCHAR(80) NOT NULL,
      focus_keyword VARCHAR(120) NOT NULL DEFAULT '', secondary_keywords JSON NULL, canonical_url VARCHAR(500) NOT NULL DEFAULT '',
      robots_index TINYINT(1) NOT NULL DEFAULT 1, robots_follow TINYINT(1) NOT NULL DEFAULT 1,
      meta_title VARCHAR(160) NOT NULL DEFAULT '', meta_description VARCHAR(320) NOT NULL DEFAULT '',
      og_title VARCHAR(160) NOT NULL DEFAULT '', og_description VARCHAR(320) NOT NULL DEFAULT '', og_image VARCHAR(500) NOT NULL DEFAULT '',
      twitter_title VARCHAR(160) NOT NULL DEFAULT '', twitter_description VARCHAR(320) NOT NULL DEFAULT '',
      schema_overrides JSON NULL, faq JSON NULL, seo_score INT NULL, seo_issues JSON NULL,
      updated_by VARCHAR(80) NOT NULL DEFAULT '', updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_seo_entity (entity_type, entity_id))`);
    console.log('Added table seo_meta');
  }
  if (!haveTb.has('seo_redirects')) {
    // old address -> new address (301); the unique key uses a 191-character prefix so it fits MySQL 5.7 / 8 utf8mb4 index limits
    await pool.query(`CREATE TABLE seo_redirects (
      id INT AUTO_INCREMENT PRIMARY KEY, source VARCHAR(500) NOT NULL, target VARCHAR(500) NOT NULL, code SMALLINT NOT NULL DEFAULT 301,
      hits INT NOT NULL DEFAULT 0, last_hit TIMESTAMP NULL DEFAULT NULL, auto TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_redirect_source (source(191)))`);
    console.log('Added table seo_redirects');
  }
  // 404 monitor and SEO change history
  const [tb2] = await pool.query("SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('seo_404_log', 'seo_history')");
  const haveTb2 = new Set(tb2.map(r => r.t));
  if (!haveTb2.has('seo_404_log')) {
    // one row per missing address (query string removed); hits are added in batches by the 404 logger
    await pool.query(`CREATE TABLE seo_404_log (
      id INT AUTO_INCREMENT PRIMARY KEY, path VARCHAR(500) NOT NULL, hits INT NOT NULL DEFAULT 1, referrer VARCHAR(300) NOT NULL DEFAULT '',
      ignored TINYINT(1) NOT NULL DEFAULT 0, first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_404_path (path(191)), KEY idx_404_hits (hits), KEY idx_404_last (last_seen))`);
    console.log('Added table seo_404_log');
  }
  if (!haveTb2.has('seo_history')) {
    // before / after snapshots of SEO edits, so a change can be reverted
    await pool.query(`CREATE TABLE seo_history (
      id INT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(20) NOT NULL, entity_id VARCHAR(80) NOT NULL, action VARCHAR(20) NOT NULL DEFAULT 'save',
      source VARCHAR(20) NOT NULL DEFAULT 'editor', summary VARCHAR(300) NOT NULL DEFAULT '', before_json MEDIUMTEXT NULL, after_json MEDIUMTEXT NULL,
      changed_by VARCHAR(80) NOT NULL DEFAULT '', changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, reverted_by INT NULL,
      KEY idx_hist_entity (entity_type, entity_id), KEY idx_hist_at (changed_at))`);
    console.log('Added table seo_history');
  }
  if (prc.length) {
    const added = await ensureBrands(pool).catch(e => { console.error('Brands were not seeded:', e.message); return 0; });
    if (added) console.log(`Added ${added} brands`);
  }
  // search-engine fields the admin fills in for blog articles and site pages (title, description, keywords, hide from Google)
  for (const table of ['blog_posts', 'site_pages']) {
    const [tc] = await pool.query('SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
    if (!tc.length) continue;
    const haveT = new Set(tc.map(r => r.c));
    for (const [c, def] of [['meta_title', "VARCHAR(160) NOT NULL DEFAULT ''"], ['meta_desc', "VARCHAR(320) NOT NULL DEFAULT ''"], ['meta_keywords', "VARCHAR(500) NOT NULL DEFAULT ''"], ['noindex', 'TINYINT(1) NOT NULL DEFAULT 0']]) {
      if (!haveT.has(c)) await pool.query(`ALTER TABLE ${table} ADD COLUMN ${c} ${def}`);
    }
  }
  await ensureAudit();
  await ensureChatLeads().catch(e => console.error('Chat leads table was not created (the chat still works without saving visitors):', e.message));
  await ensureProductSlugs(pool).catch(e => console.error('Product addresses were not stored (the old id addresses keep working):', e.message));
  const [sc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff'");
  if (sc.length) {
    const have = new Set(sc.map(r => r.c));
    for (const [c, def] of STAFF_COLS) if (!have.has(c)) { await pool.query(`ALTER TABLE staff ADD COLUMN ${c} ${def} NOT NULL DEFAULT ''`); console.log('Added staff.' + c); }
    // one admin-console session per user: the id of the newest sign-in (an older device's token stops working)
    if (!have.has('app_session_id')) { await pool.query('ALTER TABLE staff ADD COLUMN app_session_id VARCHAR(40) NULL'); console.log('Added staff.app_session_id'); } // the mobile app has its own one-device session
    if (!have.has('session_id')) { await pool.query('ALTER TABLE staff ADD COLUMN session_id VARCHAR(40) NULL'); console.log('Added staff.session_id'); }
  }
  // member profile ID (SR2026-00001) of every customer account; accounts that joined before it existed are numbered in join order
  const [uc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'");
  if (uc.length) {
    if (!uc.some(r => r.c === 'member_code')) { await pool.query('ALTER TABLE users ADD COLUMN member_code VARCHAR(16) NULL, ADD UNIQUE KEY uq_member_code (member_code)'); console.log('Added users.member_code'); }
    const numbered = await backfillMemberCodes(pool);
    if (numbered) console.log(`Gave ${numbered} existing members a member ID`);
  }
  const [cols] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories'");
  if (cols.length && !cols.some(r => r.c === 'img')) {
    await pool.query('ALTER TABLE categories ADD COLUMN img VARCHAR(500) NULL');
    console.log('Added categories.img (category pictures)');
  }
  // campaign designer: headline, hero colour, picked products and button, stored as one JSON document
  const [mk] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mkt_campaigns'");
  if (mk.length && !mk.some(r => r.c === 'design')) {
    await pool.query('ALTER TABLE mkt_campaigns ADD COLUMN design JSON NULL');
    console.log('Added mkt_campaigns.design');
  }
  // order timeline: who made each entry, and whether it is a status change or a plain comment
  const [oh] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_history'");
  if (oh.length) {
    const have = new Set(oh.map(r => r.c));
    if (!have.has('by_name')) await pool.query("ALTER TABLE order_history ADD COLUMN by_name VARCHAR(120) NOT NULL DEFAULT ''");
    if (!have.has('kind')) await pool.query("ALTER TABLE order_history ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'status'");
  }
  // contact-form messages are worked through in the admin Inbox: a status, a private note and who handled it
  const [mc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages'");
  if (mc.length) {
    const have = new Set(mc.map(r => r.c));
    for (const [c, def] of [['status', "VARCHAR(12) NOT NULL DEFAULT 'New'"], ['note', "VARCHAR(1000) NOT NULL DEFAULT ''"], ['handled_by', "VARCHAR(120) NOT NULL DEFAULT ''"], ['handled_at', 'TIMESTAMP NULL']]) {
      if (!have.has(c)) { await pool.query(`ALTER TABLE messages ADD COLUMN ${c} ${def}`); console.log('Added messages.' + c); }
    }
  }
  // indexes for the tables above (idempotent: only what is missing is created, and only the changed tables are re-analysed)
  await ensureIndexes(pool, m => console.log(m.trim()));
}
