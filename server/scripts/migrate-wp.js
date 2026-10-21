/**
 * Data migration from the WordPress/WooCommerce database (default: bloggin1_wpartrade, table prefix wptg_)
 * into this application's database. Read-only on the source. Safe to re-run (everything is matched on a stable key):
 *   customers      wp users with role "customer"  (+ billing meta)   -> users           (matched on email)
 *   orders         shop_order posts + line items                      -> orders/order_items/order_history  (id "WP-<wp id>")
 *   subscribers    MailPoet (wysija) users with status = subscribed   -> subscribers + consents (token "WP-<id>")
 *   products       SKU / managed stock for products already imported  -> products (only fields still empty)
 *
 *   npm run migrate:wp                       migrate
 *   npm run migrate:wp -- --dry              show what would happen, write nothing
 *   npm run migrate:wp -- --source=dbname    use another source schema
 *
 * Passwords are NOT migrated (WordPress hashes are not compatible); migrated customers get a locked password.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { pool } from '../src/db.js';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const DRY = !!args.dry;
const SRC = args.source || 'bloggin1_wpartrade';
const P = args.prefix || 'wptg_';
const src = await mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASS, database: SRC });
const sq = async (sql, p) => (await src.query(sql, p))[0];
const digits = s => String(s || '').replace(/\D/g, '');
const phone11 = s => { const d = digits(s); return d.startsWith('880') ? '0' + d.slice(3) : d.length === 10 ? '0' + d : d; };
const area = state => (state === 'BD-13' ? 'inside' : 'outside'); // BD-13 = Dhaka district
const log = (...a) => console.log(...a);
const meta = (rows, key) => (rows.find(r => r.meta_key === key) || {}).meta_value || '';
log(`source: ${SRC}${DRY ? '  (dry run)' : ''}`);

// ---------- customers ----------
async function customers() {
  const rows = await sq(`SELECT u.ID, u.user_email, u.user_registered, u.display_name FROM ${P}users u
    JOIN ${P}usermeta c ON c.user_id = u.ID AND c.meta_key = '${P}capabilities' AND c.meta_value LIKE '%"customer"%' WHERE u.user_email <> ''`);
  const metas = await sq(`SELECT user_id, meta_key, meta_value FROM ${P}usermeta WHERE meta_key IN ('billing_first_name','billing_last_name','billing_phone','billing_address_1','billing_city','billing_state','billing_company','first_name','last_name')`);
  const by = new Map();
  metas.forEach(m => { (by.get(m.user_id) || by.set(m.user_id, []).get(m.user_id)).push(m); });
  const locked = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
  const map = new Map(); // wp user id -> our user id
  let ins = 0, known = 0;
  for (const u of rows) {
    const m = by.get(u.ID) || [];
    const name = (`${meta(m, 'billing_first_name') || meta(m, 'first_name')} ${meta(m, 'billing_last_name') || meta(m, 'last_name')}`.trim() || u.display_name || u.user_email.split('@')[0]).slice(0, 120);
    const email = u.user_email.toLowerCase().slice(0, 160);
    const [[ex]] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (ex) { map.set(u.ID, ex.id); known++; continue; }
    const addr = [meta(m, 'billing_address_1'), meta(m, 'billing_city')].filter(Boolean).join(', ').slice(0, 255);
    const profile = JSON.stringify({ company: meta(m, 'billing_company'), migrated: 'wordpress', wpId: u.ID });
    if (!DRY) {
      const [r] = await pool.query('INSERT INTO users (name,email,phone,password_hash,address,area,profile,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [name, email, phone11(meta(m, 'billing_phone')).slice(0, 40), locked, addr, area(meta(m, 'billing_state')), profile, u.user_registered]);
      map.set(u.ID, r.insertId);
    }
    ins++;
  }
  log(`customers: ${rows.length} in WordPress → ${ins} created, ${known} already existed`);
  return map;
}

// ---------- orders ----------
const FLOW = { 'wc-completed': ['Delivered', 'Delivered'], 'wc-cancelled': ['Cancelled', 'Cancelled'], 'wc-on-hold': ['Pending', 'Verification'], 'wc-processing': ['Confirmed', 'Confirmed'], 'wc-pending': ['Pending', 'Placed'], 'wc-refunded': ['Cancelled', 'Returned'], 'wc-failed': ['Cancelled', 'Cancelled'] };
async function orders(userMap) {
  const posts = await sq(`SELECT ID, post_status, post_date, post_excerpt FROM ${P}posts WHERE post_type = 'shop_order' ORDER BY ID`);
  const ids = posts.map(p => p.ID);
  if (!ids.length) return;
  const metas = await sq(`SELECT post_id, meta_key, meta_value FROM ${P}postmeta WHERE post_id IN (?) AND meta_key IN ('_billing_first_name','_billing_last_name','_billing_full_name','_billing_phone','_billing_email','_billing_company','_billing_address_1','_billing_city','_billing_state','_shipping_address_1','_order_total','_order_shipping','_cart_discount','_payment_method','_payment_method_title','_customer_user','_paid_date','_date_paid')`, [ids]);
  const items = await sq(`SELECT i.order_id, i.order_item_id, i.order_item_name FROM ${P}woocommerce_order_items i WHERE i.order_id IN (?) AND i.order_item_type = 'line_item'`, [ids]);
  const imeta = await sq(`SELECT order_item_id, meta_key, meta_value FROM ${P}woocommerce_order_itemmeta WHERE meta_key IN ('_product_id','_qty','_line_total','_line_subtotal') AND order_item_id IN (?)`, [items.map(i => i.order_item_id).concat([0])]);
  const pm = new Map(), im = new Map();
  metas.forEach(m => { (pm.get(m.post_id) || pm.set(m.post_id, []).get(m.post_id)).push(m); });
  imeta.forEach(m => { (im.get(m.order_item_id) || im.set(m.order_item_id, []).get(m.order_item_id)).push(m); });
  const lines = new Map();
  items.forEach(i => { (lines.get(i.order_id) || lines.set(i.order_id, []).get(i.order_id)).push(i); });
  const [prods] = await pool.query('SELECT id, img FROM products');
  const prodImg = new Map(prods.map(p => [p.id, p.img]));
  let ins = 0, dup = 0, noItems = 0;
  for (const p of posts) {
    const id = 'WP-' + p.ID;
    const [[ex]] = await pool.query('SELECT id FROM orders WHERE id = ?', [id]);
    if (ex) { dup++; continue; }
    const m = pm.get(p.ID) || [];
    const [status, flow] = FLOW[p.post_status] || ['Pending', 'Placed'];
    const ls = (lines.get(p.ID) || []).map(i => { const x = im.get(i.order_item_id) || []; return { pid: parseInt(meta(x, '_product_id'), 10) || 0, name: i.order_item_name, qty: Math.max(1, parseInt(meta(x, '_qty'), 10) || 1), total: Math.round(parseFloat(meta(x, '_line_total')) || 0), sub: Math.round(parseFloat(meta(x, '_line_subtotal')) || 0) }; });
    if (!ls.length) noItems++;
    const subtotal = ls.reduce((a, l) => a + (l.sub || l.total), 0);
    const total = Math.round(parseFloat(meta(m, '_order_total')) || 0);
    const delivery = Math.round(parseFloat(meta(m, '_order_shipping')) || 0);
    const disc = Math.round(parseFloat(meta(m, '_cart_discount')) || 0);
    const name = (meta(m, '_billing_full_name') || `${meta(m, '_billing_first_name')} ${meta(m, '_billing_last_name')}`.trim() || 'Customer').slice(0, 120);
    const cod = meta(m, '_payment_method') === 'cod';
    const paid = status === 'Delivered' && !cod ? 'Paid' : status === 'Delivered' ? 'Paid' : 'Unpaid';
    const uid = userMap.get(parseInt(meta(m, '_customer_user'), 10)) || null;
    const addr = (meta(m, '_shipping_address_1') || meta(m, '_billing_address_1') || '-').slice(0, 255);
    if (DRY) { ins++; continue; }
    await pool.query(`INSERT INTO orders (id,user_id,customer_name,customer_phone,customer_email,company,address,area,subtotal,discount,delivery,total,payment,pay_status,status,flow,note,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, uid, name, phone11(meta(m, '_billing_phone')).slice(0, 40) || '-', meta(m, '_billing_email').slice(0, 160), meta(m, '_billing_company').slice(0, 160), addr, area(meta(m, '_billing_state')),
        subtotal, disc, delivery, total || subtotal + delivery - disc, (meta(m, '_payment_method_title') || 'Cash on delivery').slice(0, 40), paid, status, flow, 'Migrated from the WordPress shop', p.post_date]);
    for (const l of ls) await pool.query('INSERT INTO order_items (order_id,product_id,name,img,price,qty) VALUES (?,?,?,?,?,?)', [id, l.pid, l.name.slice(0, 255), prodImg.get(l.pid) || null, Math.round((l.total || l.sub) / l.qty), l.qty]);
    await pool.query('INSERT INTO order_history (order_id,status,flow,note,at) VALUES (?,?,?,?,?)', [id, status, flow, 'Imported from WordPress (status: ' + p.post_status.replace('wc-', '') + ')', p.post_date]);
    ins++;
  }
  log(`orders: ${posts.length} in WordPress → ${ins} created, ${dup} already migrated, ${noItems} without line items`);
}

// ---------- subscribers ----------
async function subscribers() {
  const rows = await sq(`SELECT user_id, email, created_at FROM ${P}wysija_user WHERE status = 1 AND email <> ''`);
  let ins = 0, known = 0;
  for (const r of rows) {
    const email = r.email.toLowerCase().trim().slice(0, 160);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    const [[ex]] = await pool.query('SELECT email FROM subscribers WHERE email = ?', [email]);
    if (ex) { known++; continue; }
    if (!DRY) {
      const when = r.created_at ? new Date(r.created_at * 1000) : new Date();
      await pool.query('INSERT IGNORE INTO subscribers (email, created_at) VALUES (?,?)', [email, when]);
      await pool.query('INSERT IGNORE INTO consents (email, source, token, status, ip, created_at, confirmed_at) VALUES (?,?,?,?,?,?,?)', [email, 'MailPoet import', 'WP-' + r.user_id, 'Confirmed', '', when, when]);
    }
    ins++;
  }
  log(`subscribers: ${rows.length} subscribed in MailPoet → ${ins} added, ${known} already present`);
}

// ---------- products (fill gaps only) ----------
async function products() {
  const rows = await sq(`SELECT p.ID id, sku.meta_value sku, ms.meta_value managed, st.meta_value stock, ss.meta_value status FROM ${P}posts p
    LEFT JOIN ${P}postmeta sku ON sku.post_id = p.ID AND sku.meta_key = '_sku'
    LEFT JOIN ${P}postmeta ms ON ms.post_id = p.ID AND ms.meta_key = '_manage_stock'
    LEFT JOIN ${P}postmeta st ON st.post_id = p.ID AND st.meta_key = '_stock'
    LEFT JOIN ${P}postmeta ss ON ss.post_id = p.ID AND ss.meta_key = '_stock_status'
    WHERE p.post_type = 'product' AND p.post_status = 'publish'`);
  let sku = 0, stk = 0, oos = 0, missing = 0;
  for (const r of rows) {
    const [[pr]] = await pool.query('SELECT id, part, stock, edited FROM products WHERE id = ?', [r.id]);
    if (!pr) { missing++; continue; }
    if (pr.edited) continue;
    if (r.sku && !pr.part) { if (!DRY) await pool.query('UPDATE products SET part = ? WHERE id = ?', [String(r.sku).slice(0, 80), r.id]); sku++; }
    if (r.managed === 'yes' && r.stock !== null && r.stock !== '') { if (!DRY) await pool.query('UPDATE products SET stock = ? WHERE id = ?', [Math.max(0, parseInt(r.stock, 10) || 0), r.id]); stk++; }
    else if (r.status === 'outofstock') { if (!DRY) await pool.query('UPDATE products SET stock = 0 WHERE id = ?', [r.id]); oos++; }
  }
  log(`products: ${rows.length} published in WordPress → ${sku} SKUs filled, ${stk} stock counts, ${oos} marked out of stock, ${missing} not in the application catalogue`);
}

try {
  const um = await customers();
  await orders(um);
  await subscribers();
  await products();
  const [[c]] = await pool.query('SELECT (SELECT COUNT(*) FROM users) u, (SELECT COUNT(*) FROM orders) o, (SELECT COUNT(*) FROM subscribers) s');
  log(`application database now: ${c.u} customers, ${c.o} orders, ${c.s} subscribers`);
} catch (e) { console.error('Migration failed:', e); process.exitCode = 1; }
await src.end(); await pool.end();
