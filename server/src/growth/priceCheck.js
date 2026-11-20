// Nightly price / stock consistency checker of the Search & Growth console. Finds products whose price or stock as a customer or Google sees it
// (page JSON-LD from previewMeta, Merchant feed line from feedItem, both rendered on the server, no HTTP) differs from the database, plus
// plain data mistakes (expired sale, old price below price, zero price, no SKU, price untouched for months).
// Each check is a small pure function over plain objects returning [{ code, detail }].
import { pool } from '../db.js';
import { availabilityOf, dayOf } from '../seoHelpers.js';
import { availabilityText } from '../merchantFeed.js';
import { productPath } from '../slug.js';

export const CAP = 5000, BATCH = 200, STALE_DAYS = 180;

/** code -> sentence shown to staff (label), what to do (hint) and how serious it is (high | medium | low). */
export const CODES = {
  schema_price_mismatch: { label: 'The price Google reads on the product page is different from the catalogue price.', hint: 'Save the product once more (or clear the SEO cache) and run the check again.', severity: 'high' },
  schema_availability_mismatch: { label: 'The stock status Google reads on the product page is different from the catalogue stock.', hint: 'Check stock and the stock status setting, save the product and run the check again.', severity: 'high' },
  feed_price_mismatch: { label: 'The price in the Google Merchant feed is different from the catalogue price.', hint: 'Rebuild the feed (SEO > Merchant feed) and run the check again.', severity: 'high' },
  feed_availability_mismatch: { label: 'The stock status in the Google Merchant feed is different from the catalogue stock.', hint: 'Rebuild the feed (SEO > Merchant feed) and run the check again.', severity: 'high' },
  sale_expired_not_cleared: { label: 'The sale end date has passed but the product still shows a sale price.', hint: 'Clear the old price or set a new end date.', severity: 'medium' },
  old_below_price: { label: 'The old (crossed-out) price is lower than the selling price.', hint: 'Correct or clear the old price.', severity: 'medium' },
  zero_price_active: { label: 'An active product has no price (0).', hint: 'Set a price or make the product inactive.', severity: 'high' },
  no_sku: { label: 'The product has no SKU.', hint: 'Add a SKU so orders and the feed can identify it.', severity: 'low' },
  stale_price: { label: `The price has not changed for more than ${STALE_DAYS} days.`, hint: 'Confirm the price is still right with the supplier.', severity: 'low' }
};
export const CODE_LIST = Object.keys(CODES);

const num = v => (v === null || v === undefined || v === '' ? NaN : Number(v));
const same = (a, b) => Math.abs(a - b) < 0.005;
const SCHEMA = /^https?:\/\/schema\.org\//i;
const norm = s => String(s ?? '').replace(SCHEMA, '');
const sch = p => norm(availabilityOf(p));
const FEED_AVAIL = { InStock: 'in stock', OutOfStock: 'out of stock', PreOrder: 'preorder', BackOrder: 'backorder' };
const money = n => `${Number(n).toFixed(2)} BDT`;
const feedNum = s => num(String(s ?? '').replace(/[^\d.\-]/g, ''));

/** 'YYYY-MM-DD' of now in Asia/Dhaka (UTC+6, no daylight saving). */
export const dhakaToday = (now = new Date()) => new Date(new Date(now).getTime() + 6 * 3600e3).toISOString().slice(0, 10);

/** The Product's first Offer out of the page JSON-LD list (array or object), or null. */
export function offerOf(ld) {
  const list = Array.isArray(ld) ? ld : ld ? [ld] : [];
  const prod = list.find(o => o && (o['@type'] === 'Product' || (Array.isArray(o['@type']) && o['@type'].includes('Product'))));
  const off = prod?.offers;
  return (Array.isArray(off) ? off[0] : off) || null;
}

/** Page JSON-LD Offer against the database. ld = the ld array of previewMeta. */
export function checkSchema(p, ld) {
  const out = [], price = num(p.price);
  if (!(price > 0)) return out; // no Offer is expected; zero_price_active reports it
  const off = offerOf(ld);
  if (!off) return [{ code: 'schema_price_mismatch', detail: `Page has no Offer but the catalogue price is ${price}` }];
  const op = num(off.price);
  if (!Number.isFinite(op) || !same(op, price)) out.push({ code: 'schema_price_mismatch', detail: `Page says ${off.price ?? 'nothing'}, catalogue says ${price}` });
  if (norm(off.availability) !== sch(p)) out.push({ code: 'schema_availability_mismatch', detail: `Page says ${norm(off.availability) || 'nothing'}, catalogue says ${sch(p)}` });
  return out;
}

/** Merchant feed line against the database. item = feedItem() result; a { skip } line (or none) is not a mismatch. */
export function checkFeed(p, item) {
  const out = [];
  if (!item || item.skip) return out;
  const price = num(p.price), old = num(p.old_price);
  const onSale = old > price;
  const wantPrice = onSale ? old : price, wantSale = onSale ? price : null;
  const gotPrice = feedNum(item.price), gotSale = item.sale_price === undefined ? null : feedNum(item.sale_price);
  const bad = !same(gotPrice, wantPrice) || (wantSale === null ? gotSale !== null : gotSale === null || !same(gotSale, wantSale));
  if (bad) out.push({ code: 'feed_price_mismatch', detail: `Feed says ${item.price ?? 'nothing'}${item.sale_price ? ' / sale ' + item.sale_price : ''}, catalogue says ${money(wantPrice)}${wantSale !== null ? ' / sale ' + money(wantSale) : ''}` });
  const wantAvail = FEED_AVAIL[sch(p)] || availabilityText(p);
  if (String(item.availability || '') !== wantAvail) out.push({ code: 'feed_availability_mismatch', detail: `Feed says ${item.availability || 'nothing'}, catalogue says ${wantAvail}` });
  return out;
}

/** today = 'YYYY-MM-DD' in Asia/Dhaka. A sale ending today is still running. */
export function checkSaleExpired(p, today) {
  const d = dayOf(p.sale_ends);
  return d && d < today && num(p.old_price) > num(p.price) ? [{ code: 'sale_expired_not_cleared', detail: `Sale ended ${d}; old price ${num(p.old_price)} is still above ${num(p.price)}` }] : [];
}
export function checkOldBelowPrice(p) {
  const old = num(p.old_price), price = num(p.price);
  return old > 0 && old < price ? [{ code: 'old_below_price', detail: `Old price ${old} is below price ${price}` }] : [];
}
export function checkZeroPrice(p) {
  const active = !(Number(p.active) === 0 || p.active === false);
  const price = num(p.price);
  return active && (price === 0 || p.price === null || p.price === undefined) ? [{ code: 'zero_price_active', detail: 'Price is 0 on an active product' }] : [];
}
export function checkSku(p) { return String(p.sku ?? '').trim() ? [] : [{ code: 'no_sku', detail: 'No SKU' }]; }
/** lastChange: Date | string | null (last price change, else last update). Unknown = skipped. */
export function checkStale(p, lastChange, now = new Date()) {
  if (!lastChange) return [];
  const t = new Date(lastChange).getTime();
  if (!Number.isFinite(t)) return [];
  const days = Math.floor((new Date(now).getTime() - t) / 86400e3);
  return days > STALE_DAYS ? [{ code: 'stale_price', detail: `Price unchanged for ${days} days (since ${new Date(t).toISOString().slice(0, 10)})` }] : [];
}

// ---------- storage ----------
export async function ensurePriceChecks() {
  await pool.query(`CREATE TABLE IF NOT EXISTS growth_price_issues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, product_id INT NOT NULL, code VARCHAR(40) NOT NULL, detail VARCHAR(300) NOT NULL DEFAULT '',
    found_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY uq_gpi (product_id, code), KEY idx_gpi_code (code))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS growth_price_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, checked INT NOT NULL DEFAULT 0, issues INT NOT NULL DEFAULT 0, ms INT NOT NULL DEFAULT 0)`);
}

// ---------- default dependencies (lazy: importing this file never touches the database or the SEO renderer) ----------
const defaultQuery = async (sql, params) => (await pool.query(sql, params))[0];
async function defaultTx(cb) {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const r = await cb(async (sql, params) => (await c.query(sql, params))[0]); await c.commit(); return r; }
  catch (e) { try { await c.rollback(); } catch { /* ignore */ } throw e; }
  finally { c.release(); }
}
const defaultPreview = async path => (await import('../seo.js')).previewMeta(path);
async function defaultFeedLine() {
  const { feedItem, feedContext } = await import('../merchantFeed.js');
  const ctx = feedContext({ base: String(process.env.SITE_URL || 'https://example.invalid').replace(/\/$/, ''), now: new Date() });
  return p => feedItem(p, ctx);
}
const tick = () => new Promise(r => setImmediate(r));
const HISTORY_COLS = ['changed_at', 'created_at', 'at'];

/** Last price change per product id: Map(id -> Date). History table when it exists (best effort), else products.updated_at. */
async function lastChanges(query, ids, rows, hist) {
  const m = new Map();
  if (hist) {
    try { for (const r of await query(`SELECT product_id, MAX(${hist}) AS t FROM product_price_history WHERE product_id IN (?) GROUP BY product_id`, [ids])) if (r.t) m.set(Number(r.product_id), r.t); } catch { /* history unusable: fall back */ }
  }
  for (const p of rows) if (!m.has(p.id) && p.updated_at) m.set(p.id, p.updated_at);
  return m;
}
async function historyColumn(query) {
  try {
    const cols = (await query('SHOW COLUMNS FROM product_price_history')).map(r => r.Field);
    return HISTORY_COLS.find(c => cols.includes(c)) || '';
  } catch { return ''; }
}

/** Checks the active products batch by batch. Returns { checked, issues, byCode }. Never throws for one bad product. */
export async function runCheck(o = {}) {
  const query = o.query || defaultQuery, tx = o.tx || (o.query ? cb => cb(query) : defaultTx);
  const preview = o.preview || defaultPreview, now = o.now ? new Date(o.now) : new Date();
  const cap = o.cap || CAP, size = o.batch || BATCH, yieldFn = o.yieldFn || tick;
  const feedLine = o.feedLine || (await defaultFeedLine());
  const t0 = Date.now(), today = dhakaToday(now), byCode = {};
  const hist = o.history !== undefined ? o.history : await historyColumn(query);
  let checked = 0, issues = 0, lastId = 0, truncated = false;
  while (true) {
    const left = cap - checked;
    if (left <= 0) { truncated = true; break; }
    const rows = await query('SELECT * FROM products WHERE active = 1 AND id > ? ORDER BY id LIMIT ?', [lastId, Math.min(size, left)]);
    if (!rows.length) break;
    lastId = rows[rows.length - 1].id;
    const changes = await lastChanges(query, rows.map(r => r.id), rows, hist);
    const found = [];
    for (const p of rows) {
      let list = [...checkSaleExpired(p, today), ...checkOldBelowPrice(p), ...checkZeroPrice(p), ...checkSku(p), ...checkStale(p, changes.get(p.id), now)];
      try {
        const m = await preview(productPath(p));
        if (m && Number(m.status) === 200 && !m.redirect) list = list.concat(checkSchema(p, m.ld));
      } catch { /* a page that cannot be rendered is not a price mismatch */ }
      try { list = list.concat(checkFeed(p, feedLine(p))); } catch { /* ignore */ }
      for (const i of list) { found.push([p.id, i.code, String(i.detail || '').slice(0, 300)]); byCode[i.code] = (byCode[i.code] || 0) + 1; }
    }
    await tx(async q => {
      await q('DELETE FROM growth_price_issues WHERE product_id IN (?)', [rows.map(r => r.id)]);
      if (found.length) await q('INSERT IGNORE INTO growth_price_issues (product_id, code, detail) VALUES ?', [found]);
    });
    checked += rows.length; issues += found.length;
    if (rows.length < Math.min(size, left)) break;
    await yieldFn(); // let the API answer between batches
  }
  if (!truncated) { // products that are no longer active or no longer exist have nothing to fix
    try { await query('DELETE i FROM growth_price_issues i LEFT JOIN products p ON p.id = i.product_id AND p.active = 1 WHERE p.id IS NULL'); } catch { /* ignore */ }
  }
  const ms = Date.now() - t0;
  await query('INSERT INTO growth_price_runs (checked, issues, ms) VALUES (?,?,?)', [checked, issues, ms]);
  return { checked, issues, byCode, ms };
}

// ---------- weekly digest ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** { total, counts, text, html } from the stored issues; origin = 'https://host' for the links ('' = relative). */
export async function buildDigest({ query = defaultQuery, origin = '' } = {}) {
  const counts = {};
  for (const r of await query('SELECT code, COUNT(*) AS n FROM growth_price_issues GROUP BY code')) counts[r.code] = Number(r.n);
  const codes = CODE_LIST.filter(c => counts[c]);
  const total = codes.reduce((s, c) => s + counts[c], 0);
  const link = origin + '/admin/growth-prices';
  const text = [`Price and stock check: ${total} issue(s) found.`], html = [`<p>Price and stock check: <b>${total}</b> issue(s) found.</p>`];
  for (const c of codes) {
    const top = await query('SELECT i.product_id, i.detail, p.name, p.sku FROM growth_price_issues i LEFT JOIN products p ON p.id = i.product_id WHERE i.code = ? ORDER BY i.found_at DESC, i.id DESC LIMIT 10', [c]);
    text.push('', `${CODES[c].label} (${counts[c]})`);
    html.push(`<h3 style="margin:14px 0 4px">${esc(CODES[c].label)} (${counts[c]})</h3><ul style="margin:0;padding-left:18px">`);
    for (const t of top) {
      const nm = t.name || `Product ${t.product_id}`;
      text.push(`- ${nm}${t.sku ? ' (' + t.sku + ')' : ''}: ${t.detail}`);
      html.push(`<li>${esc(nm)}${t.sku ? ' (' + esc(t.sku) + ')' : ''}: ${esc(t.detail)}</li>`);
    }
    if (counts[c] > top.length) { text.push(`... and ${counts[c] - top.length} more`); html.push(`<li>... and ${counts[c] - top.length} more</li>`); }
    html.push('</ul>');
  }
  text.push('', `Open the list: ${link}`); html.push(`<p><a href="${esc(link)}">Open the list in the admin console</a></p>`);
  return { total, counts, text: text.join('\n'), html: `<div style="font-family:Arial,sans-serif;color:#0b1631">${html.join('')}</div>` };
}

const EMAIL = /^[^\s,;<>"()@]+@[^\s,;<>"()@]+\.[^\s,;<>"()@]+$/;
export const looksLikeEmail = s => EMAIL.test(String(s || '')) && String(s).length <= 160;

async function defaultDeps() {
  const [{ readGrowth }, mailer, { siteOrigin }, { parseJson }] = await Promise.all([import('./siteFiles.js'), import('../mailer.js'), import('./site.js'), import('../util.js')]);
  return {
    readGrowth, mailReady: () => mailer.mailReady(), sendMail: mailer.sendMail, origin: siteOrigin, query: defaultQuery,
    async shopEmail() {
      try { const [r] = await pool.query('SELECT v FROM settings WHERE k = ?', ['site']); const s = r.length ? parseJson(r[0].v) : null; return String(s?.email || process.env.CONTACT_TO || '').trim(); }
      catch { return String(process.env.CONTACT_TO || '').trim(); }
    }
  };
}

/** Sends the current summary. force (admin "send test") ignores the on/off switch. Never throws: { skipped, reason } or { sent:true, to, total }. */
export async function sendDigest({ force = false, deps } = {}) {
  try {
    const d = deps || await defaultDeps();
    const cfg = (await d.readGrowth())?.priceDigest || {};
    if (!force && cfg.enabled !== true) return { skipped: true, reason: 'digest is turned off' };
    if (!d.mailReady()) return { skipped: true, reason: 'mail is not set up' };
    const to = String(cfg.to || '').trim() || await d.shopEmail();
    if (!looksLikeEmail(to)) return { skipped: true, reason: 'no valid e-mail address' };
    const dg = await buildDigest({ query: d.query, origin: await Promise.resolve(d.origin()).catch(() => '') || '' });
    if (!dg.total) return { skipped: true, reason: 'no issues' };
    try { if ((await d.sendMail({ to, subject: `AR Trade price check: ${dg.total} issue(s) to review`, text: dg.text, html: dg.html })) === false) return { skipped: true, reason: 'mail is not set up' }; }
    catch (e) { return { skipped: true, reason: 'send failed: ' + String(e.message || e).slice(0, 200) }; }
    return { sent: true, to, total: dg.total };
  } catch (e) { return { skipped: true, reason: 'digest failed: ' + String(e.message || e).slice(0, 200) }; }
}
