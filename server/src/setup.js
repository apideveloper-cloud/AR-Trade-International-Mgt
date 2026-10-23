// Creates the tables and seeds them from the design's ar-data.js.
//   npm run db:setup   create missing tables and upsert catalog/content (keeps orders and users)
//   npm run db:reset   drop every table first (DESTROYS all data), then set up again
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { ensureIndexes } from './indexes.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const TABLES = ['password_resets', 'site_pages', 'field_expenses', 'field_track', 'field_attendance', 'blog_posts', 'reviews', 'mkt_outbox', 'mkt_log', 'mkt_prefs', 'mkt_campaigns', 'mkt_automations', 'mkt_templates', 'order_returns', 'branches', 'user_reminders', 'user_family', 'user_addresses', 'campaigns', 'staff', 'applications', 'jobs', 'consents', 'subscribers', 'messages', 'service_requests', 'order_history', 'order_items', 'orders', 'users', 'products', 'categories', 'settings'];

function loadDesignData() {
  const store = {};
  const win = {
    addEventListener() {}, dispatchEvent() {},
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }
  };
  const ctx = { window: win, localStorage: win.localStorage, Event: class {}, navigator: { userAgent: '' }, URL, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(here, '..', 'ar-data.source.js'), 'utf8'), ctx);
  return win.AR;
}

const g = (a, b) => `linear-gradient(135deg,${a},${b})`;
const TEMPLATES = [
  ['t-welcome', 'Welcome', 'Automation', 'Welcome to AR Trade — here is 10% off', 'Your WELCOME10 code inside', 'Welcome aboard.', 'Thanks for confirming. Use WELCOME10 for 10% off your first order of genuine toner, ink or printers. Cash on delivery across Dhaka.', 'Shop now', g('oklch(0.5 0.16 250)', '#0b1631')],
  ['t-cart', 'Abandoned cart', 'Automation', 'You left something in your cart', 'Your items are saved', 'Still need that toner?', 'Your cart is saved and ready. Complete your order today — cash on delivery, same-day dispatch inside Dhaka.', 'Return to cart', g('oklch(0.55 0.14 230)', 'oklch(0.36 0.1 255)')],
  ['t-refill', 'Refill reminder', 'Automation', 'Running low on toner?', 'Reorder in one click', 'Time for a refill.', 'Based on the page yield of your last toner, you are probably close to empty. Reorder now so your office never stops printing.', 'Reorder now', g('oklch(0.58 0.12 200)', 'oklch(0.38 0.1 240)')],
  ['t-stock', 'Back in stock', 'Automation', "It's back: the product you were watching", 'Limited quantity', "It's back in stock.", 'The item you asked about has just been restocked. Quantities are limited — order before it sells out again.', 'View product', g('oklch(0.6 0.13 160)', 'oklch(0.38 0.09 200)')],
  ['t-eid', 'Eid offer', 'Festival', 'Eid Mubarak: office restock, up to 18% off', 'Festival prices on toner & printers', 'Eid Mubarak from AR Trade.', 'Restock your office before the holidays with festival prices on original HP, Canon and Toshiba supplies.', 'See Eid deals', g('oklch(0.52 0.12 165)', 'oklch(0.3 0.07 200)')],
  ['t-puja', 'Durga Puja offer', 'Festival', 'Shubho Puja — special prices this week', 'Festive offers on printers', 'Shubho Sharodiya.', 'Celebrate Puja with special prices on printers, copier toner and ink — delivered across Dhaka.', 'See Puja offers', g('oklch(0.62 0.18 40)', 'oklch(0.42 0.16 20)')],
  ['t-boishakh', 'Pohela Boishakh', 'Festival', 'Shubho Noboborsho — start the year fresh', 'New year, new toner', 'Shubho Noboborsho.', 'Start the new Bangla year with a fully stocked office. Festival discounts on toner and printers for one week only.', 'Shop the sale', g('oklch(0.6 0.2 25)', 'oklch(0.42 0.14 40)')],
  ['t-tips', 'Printer health tips', 'Health tip', '3 ways to stop paper jams for good', 'A 2-minute printer care guide', 'Keep your printer healthy.', 'Store paper flat and dry, clean the rollers every month, and always use genuine toner. Need a technician? Book servicing from ৳ 500.', 'Read the guide', g('oklch(0.56 0.1 220)', 'oklch(0.32 0.06 250)')],
  ['t-offer', 'Weekly offer', 'Offer', 'Friday deals: up to 19% off HP toner', 'This week only', 'Friday deals are live.', 'This week only: our best prices on HP, Canon and Pantum supplies. Cash on delivery and free delivery inside Dhaka.', 'See deals', g('oklch(0.62 0.13 238)', 'oklch(0.46 0.16 256)')]
];
const AUTOMATIONS = [
  ['welcome', 'Welcome series', 'Subscriber confirms their email', [['Day 0', 'Welcome + your WELCOME10 code'], ['Day 2', 'How to pick the right toner for your printer'], ['Day 7', 'Best-sellers & corporate pricing']]],
  ['cart', 'Abandoned cart', 'Cart left untouched for 1 hour', [['1 hour', 'You left something in your cart'], ['24 hours', 'Still deciding? Cash on delivery inside Dhaka']]],
  ['refill', 'Refill reminder', '~55 days after a toner order, based on page yield', [['Day 55', 'Running low? Reorder your toner in one click'], ['Day 62', 'Last reminder before you run out']]],
  ['stock', 'Back-in-stock alert', 'A product someone is watching is restocked', [['Instant', "It's back in stock — order before it sells out"]]]
];

async function seedEmailCenter() {
  let i = 0;
  for (const [id, name, kind, subject, preheader, headline, body, cta, hero] of TEMPLATES) {
    await pool.query('REPLACE INTO mkt_templates (id,name,kind,subject,preheader,headline,body,cta,hero,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, name, kind, subject, preheader, headline, body, cta, hero, i++]);
  }
  i = 0;
  for (const [id, name, trigger, steps] of AUTOMATIONS) {
    await pool.query('INSERT INTO mkt_automations (id,name,trigger_text,steps,active,sort_order) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), trigger_text=VALUES(trigger_text), steps=VALUES(steps)', [id, name, trigger, JSON.stringify(steps), id === 'stock' ? 0 : 1, i++]);
  }
  await pool.query('INSERT IGNORE INTO settings (k,v) VALUES (?,?)', ['mkt', JSON.stringify({ provider: 'Brevo', apiKey: '', from: 'AR Trade International <hello@artradeinternational.com>', domain: 'artradeinternational.com', dns: { spf: false, dkim: false, dmarc: false } })]);
}

const toDate = t =>new Date(t).toISOString().slice(0, 19).replace('T', ' ');

/** Articles imported from the live AR Trade blog; INSERT IGNORE so later edits are never overwritten. */
async function migrate() {
  // existing databases created before the Content writer role / blog authors existed
  await pool.query("ALTER TABLE staff MODIFY role ENUM('Super admin','Admin','Delivery rider','Marketing manager','Content writer','Field employee','Manager','Accounts') NOT NULL DEFAULT 'Delivery rider'");
  const [pc] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'");
  const pHave = new Set(pc.map(r => r.c));
  for (const [c, def] of [['gallery', 'JSON NULL'], ['description', 'MEDIUMTEXT NULL'], ['source_url', "VARCHAR(500) NOT NULL DEFAULT ''"], ['edited', 'TINYINT(1) NOT NULL DEFAULT 0'], ['short_desc', 'TEXT NULL'], ['sku', "VARCHAR(80) NOT NULL DEFAULT ''"], ['tags', 'JSON NULL'], ['meta_title', "VARCHAR(160) NOT NULL DEFAULT ''"], ['meta_desc', "VARCHAR(320) NOT NULL DEFAULT ''"], ['meta_keywords', "VARCHAR(500) NOT NULL DEFAULT ''"]]) {
    if (!pHave.has(c)) await pool.query(`ALTER TABLE products ADD COLUMN ${c} ${def}`);
  }
  const [cols] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blog_posts'");
  const have = new Set(cols.map(r => r.c));
  const add = [['author', "VARCHAR(120) NOT NULL DEFAULT 'AR Trade International'"], ['author_id', 'INT NULL'], ['edited', 'TINYINT(1) NOT NULL DEFAULT 0'], ['updated_at', 'TIMESTAMP NULL DEFAULT NULL']];
  for (const [c, def] of add) if (!have.has(c)) await pool.query(`ALTER TABLE blog_posts ADD COLUMN ${c} ${def}`);
}

async function seedBlog() {
  const posts = JSON.parse(fs.readFileSync(path.join(here, 'blog.seed.json'), 'utf8'));
  const clean = s => { try { return decodeURIComponent(s); } catch { return s; } };
  for (const p of posts) {
    const slug = clean(p.slug).slice(0, 100);
    // matched on the original article URL; articles never edited in the admin console follow the seed
    // (e.g. images now served from this project), edited ones are left alone
    const [[ex]] = await pool.query('SELECT id, edited FROM blog_posts WHERE source_url = ?', [p.source]);
    if (!ex) {
      await pool.query('INSERT IGNORE INTO blog_posts (slug, title, category, cover, excerpt, body, published, source_url) VALUES (?,?,?,?,?,?,?,?)',
        [slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.source]);
    } else if (!ex.edited) {
      await pool.query('UPDATE blog_posts SET slug = ?, cover = ?, body = ? WHERE id = ?', [slug, p.cover, p.body, ex.id]);
    }
  }
}

async function main() {
  if (process.argv.includes('--reset')) {
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of TABLES) await pool.query(`DROP TABLE IF EXISTS ${t}`);
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('All tables dropped.');
  }
  const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8').split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
  for (const sql of schema) await pool.query(sql);

  const AR = loadDesignData();
  const settings = AR.state().settings;
  const sf = AR.sf();

  let i = 0;
  for (const c of AR.CATS) {
    await pool.query('INSERT INTO categories (id,title,description,sort_order) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), sort_order=VALUES(sort_order)', [c.id, c.t, c.d, i++]);
  }
  // once the real catalogue has been imported (npm run import:site) the design-file demo products are not re-created
  const [[{ importedCount }]] = await pool.query("SELECT COUNT(*) importedCount FROM products WHERE source_url <> ''").catch(() => [[{ importedCount: 0 }]]);
  for (const p of importedCount ? [] : AR.products()) {
    await pool.query(
      `REPLACE INTO products (id,category_id,brand,name,old_price,price,img,stock,popular,is_new,featured,active,tech,color,yield_info,part,compat,spec,extra)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.id, p.cat, p.brand, p.name, p.old || 0, p.price || 0, p.img, p.stock ?? 0, +!!p.popular, +!!p.isNew, +!!p.featured, +(p.active !== false),
        p.tech, p.color, p.yield, p.part, p.compat, p.spec, JSON.stringify(p.extra || [])]
    );
  }

  const site = {
    promo: settings.promo, showPromo: settings.showPromo, insideFee: settings.insideFee, outsideFee: settings.outsideFee, suburbFee: 100,
    freeOver: 5000, expressFee: 150, memberPct: 3, vatPct: 5, coupon: settings.coupon, couponPct: settings.couponPct,
    phone: settings.phone, email: settings.email, address: settings.address, whatsapp: settings.whatsapp,
    heroTitle: settings.heroTitle, heroSub: settings.heroSub, offerTitle: settings.offerTitle, offerSub: settings.offerSub,
    payments: settings.payments, svcPrices: settings.svcPrices
  };
  const content = {
    sections: sf.sections, slideSecs: sf.slideSecs, slides: sf.slides, words: sf.words, perks: sf.perks, brands: sf.brands, faqs: sf.faqs,
    policies: sf.policies, stats: sf.stats, whys: sf.whys, clients: sf.clients, social: sf.social, labels: sf.labels, popup: sf.popup
  };
  for (const [k, v] of [['site', site], ['content', content]]) {
    await pool.query('REPLACE INTO settings (k,v) VALUES (?,?)', [k, JSON.stringify(v)]);
  }

  for (const j of AR.careers().jobs) {
    await pool.query(
      `REPLACE INTO jobs (id,title,dept,type,loc,exp,salary,vacancies,deadline,open,about,resp,req,perks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [j.id, j.title, j.dept, j.type, j.loc, j.exp, j.salary, j.vacancies, toDate(j.deadline), +(j.open !== false), j.about,
        JSON.stringify(j.resp || []), JSON.stringify(j.req || []), JSON.stringify(j.perks || [])]
    );
  }

  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM users');
  const PROD = process.env.NODE_ENV === 'production'; // demo logins (known passwords) are never created on the live server
  if (!n && !PROD) {
    const hash = await bcrypt.hash('demo123', 10);
    await pool.query('INSERT INTO users (name,email,phone,password_hash,address,area) VALUES (?,?,?,?,?,?)',
      ['Shakil Ahmed', 'demo@artrade.com', '01711000000', hash, 'House 12, Road 4, Shantinagar, Dhaka-1217', 'inside']);
  }

  const [[{ ns }]] = await pool.query('SELECT COUNT(*) ns FROM staff');
  if (!ns && PROD) { // a brand-new live database still needs a first admin: random password, shown once
    const pass = crypto.randomBytes(9).toString('base64url');
    await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,"Super admin","Active")', ['AR Admin', 'admin@artradeinternational.com', '01700000000', await bcrypt.hash(pass, 10)]);
    console.log('\nFIRST ADMIN CREATED  admin@artradeinternational.com  password: ' + pass + '  (change it after the first sign-in)\n');
  } else if (!ns) {
    const demoStaff = [
      ['AR Admin', 'admin@artradeinternational.com', '01700000000', 'admin123', 'Super admin', '', 4.8, null],
      ['Rafiq Hasan', 'rider@artradeinternational.com', '01711450012', 'rider123', 'Delivery rider', 'Motorbike · DHA-LA 22-4417', 4.9, 'B1'],
      ['Sumon Mia', 'rider2@artradeinternational.com', '01819662210', 'rider123', 'Delivery rider', 'Motorbike · DHA-HA 13-9021', 4.8, 'B2'],
      ['Jahid Khan', 'rider3@artradeinternational.com', '01912330478', 'rider123', 'Delivery rider', 'Motorbike · DHA-LA 31-1180', 4.7, 'B3'],
      ['Arif Hossain', 'rider4@artradeinternational.com', '01675118833', 'rider123', 'Delivery rider', 'Cargo van · DHA-NA 11-2045', 4.9, 'B1'],
      ['Nusrat Marketing', 'marketing@artradeinternational.com', '01700000002', 'market123', 'Marketing manager', '', 4.8, null]
    ];
    for (const [name, email, phone, pass, role, vehicle, rating, branch] of demoStaff) {
      await pool.query('INSERT INTO staff (name,email,phone,password_hash,role,status,vehicle,rating,branch_id) VALUES (?,?,?,?,?,"Active",?,?,?)', [name, email, phone, await bcrypt.hash(pass, 10), role, vehicle, rating, branch]);
    }
  }

  for (const b of AR.BRANCHES) {
    await pool.query('INSERT INTO branches (id,name,area,area_keys) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), area=VALUES(area), area_keys=VALUES(area_keys)', [b.id, b.name, b.area, JSON.stringify(b.keys)]);
  }

  await migrate();
  await seedEmailCenter();
  await seedBlog();
  await ensureIndexes(pool);
  // demo Content writer account (only created if missing; never on the live server)
  if (!PROD) await pool.query('INSERT IGNORE INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,"Active")',
    ['Content Writer', 'writer@artradeinternational.com', '01700000003', await bcrypt.hash('writer123', 10), 'Content writer']);
  // demo mobile-app accounts (only created if missing)
  if (!PROD) for (const [name, email, phone, pass, role] of [
    ['Alex Field', 'field@artradeinternational.com', '01700000010', 'field123', 'Field employee'],
    ['Rahim Manager', 'manager@artradeinternational.com', '01700000011', 'manager123', 'Manager'],
    ['Karim Accounts', 'accounts@artradeinternational.com', '01700000012', 'accounts123', 'Accounts']
  ]) {
    await pool.query('INSERT IGNORE INTO staff (name,email,phone,password_hash,role,status) VALUES (?,?,?,?,?,"Active")', [name, email, phone, await bcrypt.hash(pass, 10), role]);
  }

  const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM products');
  console.log(`Done. ${AR.CATS.length} categories, ${c} products. ${PROD ? '' : 'Demo login: demo@artrade.com / demo123 · Admin: admin@artradeinternational.com / admin123'}`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
