// Small, safe schema upgrades that run on every server start (each one only acts when something is missing).
import { pool } from './db.js';
import { ensureBackupTable } from './backup.js';
import { ensureInventory } from './inventory.js';
import { ensureQuotes } from './quotation.js';
import { ensureAudit } from './audit.js';
import { ensureIndexes } from './indexes.js';
import { ensureProductSlugs } from './productSlugs.js';
import { ensureChatLeads } from './chatLeads.js';

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
