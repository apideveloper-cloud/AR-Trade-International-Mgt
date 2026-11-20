// Nightly JSON-LD (rich result) validator of the Search & Growth console (Phase 5). Renders every public page on the server with previewMeta
// (no HTTP), runs the pure rules of schemaRules.js on its JSON-LD and keeps the findings in growth_schema_issues.
import { pool } from '../db.js';
import { startProgress, setProgress, endProgress, getProgress } from './progress.js';
import { productPath } from '../slug.js';
import { CODES, validateLd } from './schemaRules.js';

export { CODES, CODE_LIST } from './schemaRules.js';
export const CAP = 5000, BATCH = 200, POSTS = 50;
/** Fixed public pages (home, shop, blog index and the info / service pages of seo.js). */
export const STATIC_PAGES = [['/', 'home'], ['/shop', 'shop'], ['/blog', 'blog'], ['/services', 'info'], ['/about', 'info'], ['/contact', 'info'], ['/faq', 'info'], ['/offers', 'info'], ['/careers', 'info']];

const defaultQuery = async (sql, params) => (await pool.query(sql, params))[0];
const defaultPreview = async path => (await import('../seo.js')).previewMeta(path);
const tick = () => new Promise(r => setImmediate(r));
const enc = s => encodeURIComponent(String(s));

let ready = false;
export async function ensureSchemaChecks(query = defaultQuery) {
  if (ready && query === defaultQuery) return;
  await query(`CREATE TABLE IF NOT EXISTS growth_schema_issues (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, url VARCHAR(300) NOT NULL, kind VARCHAR(20) NOT NULL DEFAULT '', product_id INT NULL, type VARCHAR(40) NOT NULL DEFAULT '',
    severity VARCHAR(8) NOT NULL DEFAULT 'warning', code VARCHAR(40) NOT NULL, detail VARCHAR(300) NOT NULL DEFAULT '',
    found_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY idx_gsi_code (code), KEY idx_gsi_prod (product_id))`, []);
  await query(`CREATE TABLE IF NOT EXISTS growth_schema_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, checked INT NOT NULL DEFAULT 0, errors INT NOT NULL DEFAULT 0,
    warnings INT NOT NULL DEFAULT 0, ms INT NOT NULL DEFAULT 0)`, []);
  if (query === defaultQuery) ready = true;
}

async function safeRows(query, sql, params) { try { return await query(sql, params); } catch { return []; } }

/** [{ url, kind }] of the pages that are not products: fixed pages, categories, brands, latest blog posts, service pages, policies. */
export async function listPages(query, posts = POSTS) {
  const pages = STATIC_PAGES.map(([url, kind]) => ({ url, kind }));
  for (const c of await safeRows(query, 'SELECT id FROM categories WHERE hidden = 0 ORDER BY id', [])) pages.push({ url: '/shop/' + enc(c.id), kind: 'category' });
  for (const b of await safeRows(query, 'SELECT slug FROM brands WHERE hidden = 0 ORDER BY slug', [])) if (b.slug) pages.push({ url: '/brand/' + enc(b.slug), kind: 'brand' });
  for (const x of await safeRows(query, 'SELECT slug FROM blog_posts WHERE status = "Published" ORDER BY published DESC LIMIT ?', [posts])) if (x.slug) pages.push({ url: '/blog/' + enc(x.slug), kind: 'post' });
  for (const x of await safeRows(query, 'SELECT slug FROM site_pages WHERE status = "Published"', [])) if (x.slug) pages.push({ url: '/services/' + enc(x.slug), kind: 'service' });
  const rows = await safeRows(query, 'SELECT v FROM settings WHERE k = "content"', []);
  try {
    const v = rows[0]?.v, c = typeof v === 'string' ? JSON.parse(v) : v;
    for (const p of c?.policies || []) if (p?.k) pages.push({ url: '/policy/' + enc(p.k), kind: 'info' });
  } catch { /* no policies */ }
  return pages;
}

/** Runs the check. deps: { query, tx, preview(path), now, cap, batch, posts, yieldFn }. Returns { checked, errors, warnings, byCode, ms }. */
/** Runs the whole check and reports its progress (schema_check) for the admin progress bar. */
export async function runSchemaCheck(o = {}) {
  if (!o.query && getProgress('schema_check').running) return { skipped: true, reason: 'a check is already running' }; // one run at a time (a scheduled run meets a manual one)
  startProgress('schema_check', 0, 'Checking pages');
  try { return await runSchemaCheckInner(o); } finally { endProgress('schema_check'); }
}
async function runSchemaCheckInner(o = {}) {
  const query = o.query || defaultQuery, preview = o.preview || o.previewMeta || defaultPreview;
  const tx = o.tx || (o.query ? cb => cb(query) : async cb => {
    const c = await pool.getConnection();
    try { await c.beginTransaction(); const r = await cb(async (sql, p) => (await c.query(sql, p))[0]); await c.commit(); return r; }
    catch (e) { try { await c.rollback(); } catch { /* ignore */ } throw e; } finally { c.release(); }
  });
  const cap = o.cap || CAP, size = o.batch || BATCH, yieldFn = o.yieldFn || tick;
  await ensureSchemaChecks(query);
  const t0 = Date.now(), runStart = new Date(Math.floor(t0 / 1000) * 1000), byCode = {};
  let checked = 0, errors = 0, warnings = 0, truncated = false;

  // one page: render, validate -> rows. A page that does not answer 200 (404, redirect) has no rich result to check.
  async function checkPage(url, kind, productId) {
    let m;
    try { m = await preview(url); } catch { return []; }
    if (!m || Number(m.status) !== 200 || m.redirect) return [];
    let found = [];
    try { found = validateLd(m.ld, kind === 'product' ? 'product' : kind); } catch { return []; }
    return found.map(f => [url.slice(0, 300), kind, productId ?? null, String(f.type || '').slice(0, 40), f.severity, f.code, String(f.detail || '').slice(0, 300)]);
  }
  const tally = rows => { for (const r of rows) { if (r[4] === 'error') errors++; else warnings++; byCode[r[5]] = (byCode[r[5]] || 0) + 1; } };
  const INS = 'INSERT INTO growth_schema_issues (url, kind, product_id, type, severity, code, detail) VALUES ?';

  // 1. the pages that are not products (counted against the cap too)
  const pages = (await listPages(query, o.posts || POSTS)).slice(0, cap);
  let total = pages.length;
  try { const [c] = await query('SELECT COUNT(*) AS n FROM products WHERE active = 1', []); total = Math.min(cap, pages.length + Number(c?.n || 0)); } catch { /* the total stays the page count: the bar then reaches the end early */ }
  setProgress('schema_check', 0, total);
  for (let i = 0; i < pages.length; i += size) {
    const part = pages.slice(i, i + size), found = [];
    for (const p of part) found.push(...await checkPage(p.url, p.kind, null));
    await tx(async q => {
      await q('DELETE FROM growth_schema_issues WHERE url IN (?)', [part.map(p => p.url.slice(0, 300))]);
      if (found.length) await q(INS, [found]);
    });
    tally(found); checked += part.length;
    setProgress('schema_check', checked);
    await yieldFn();
  }

  // 2. the products, in id order
  let lastId = 0;
  while (true) {
    const left = cap - checked;
    if (left <= 0) { truncated = true; break; }
    const want = Math.min(size, left);
    const rows = await query('SELECT id, slug, name FROM products WHERE active = 1 AND id > ? ORDER BY id LIMIT ?', [lastId, want]);
    if (!rows.length) break;
    lastId = rows[rows.length - 1].id;
    const found = [];
    for (const p of rows) found.push(...await checkPage(productPath(p), 'product', p.id));
    await tx(async q => {
      await q('DELETE FROM growth_schema_issues WHERE product_id IN (?)', [rows.map(r => r.id)]);
      if (found.length) await q(INS, [found]);
    });
    tally(found); checked += rows.length;
    setProgress('schema_check', checked);
    if (rows.length < want) break;
    await yieldFn(); // let the API answer between batches
  }
  if (!truncated) { // pages and products that no longer exist or are no longer active have nothing to fix
    try { await query('DELETE FROM growth_schema_issues WHERE found_at < ?', [runStart]); } catch { /* ignore */ }
  }
  const ms = Date.now() - t0;
  await query('INSERT INTO growth_schema_runs (checked, errors, warnings, ms) VALUES (?,?,?,?)', [checked, errors, warnings, ms]);
  return { checked, errors, warnings, byCode, ms };
}

const iso = d => (d ? new Date(d).toISOString() : null);
/** { lastRun, counts:{error,warning}, byCode:[{code,count,severity,label}] }. Never throws: empty when the tables are missing. */
export async function schemaSummary(query = defaultQuery) {
  const out = { lastRun: null, counts: { error: 0, warning: 0 }, byCode: [] };
  try {
    const run = await query('SELECT at, checked, errors, warnings, ms FROM growth_schema_runs ORDER BY id DESC LIMIT 1', []);
    if (run[0]) out.lastRun = { at: iso(run[0].at), checked: Number(run[0].checked), errors: Number(run[0].errors), warnings: Number(run[0].warnings), ms: Number(run[0].ms) };
  } catch { /* table missing */ }
  try {
    for (const r of await query('SELECT code, severity, COUNT(*) AS n FROM growth_schema_issues GROUP BY code, severity ORDER BY n DESC', [])) {
      const n = Number(r.n), sev = CODES[r.code]?.severity || r.severity;
      if (sev === 'error') out.counts.error += n; else out.counts.warning += n;
      out.byCode.push({ code: r.code, count: n, severity: sev, label: CODES[r.code]?.label || r.code });
    }
  } catch { /* table missing */ }
  if (out.counts.error > 0) { // extra field: distinct pages with an error (the overview says "N pages")
    try { out.pagesWithErrors = Number((await query("SELECT COUNT(DISTINCT url) AS n FROM growth_schema_issues WHERE severity = 'error'", []))[0]?.n || 0) || out.counts.error; } catch { out.pagesWithErrors = out.counts.error; }
  }
  return out;
}
