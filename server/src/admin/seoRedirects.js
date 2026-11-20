// Admin > SEO > Redirects and 404 monitor (permission seo.manage). Pure logic lives in seoRedirectsMap.js and ../notFoundLog.js.
import { pool } from '../db.js';
import { fail, wrap, parseJson } from '../util.js';
import { like } from '../adminHelpers.js';
import { legacySlug, productPath } from '../slug.js';
import { brandSlug } from '../brands.js';
import { flushNow } from '../notFoundLog.js';
import { analyseRows,listRedirects, parse404Query, parseRedirectQuery, pathIsLive, planFlatten, planRedirect, posInt, summarise, targetOkOf, validateRedirect, SORTS_404 } from './seoRedirectsMap.js';

async function bustSeo() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }
const EXACT = ['/', '/shop', '/services', '/about', '/contact', '/faq', '/offers', '/blog', '/careers', '/cart', '/checkout', '/account', '/login', '/wishlist', '/compare', '/track'];
const col = c => ({ id: c.id, source: c.source, target: c.target, code: c.code, hits: c.hits, lastHit: c.last_hit, auto: !!c.auto, createdAt: c.created_at });

/** The pages that exist right now, as sets of ids / slugs (see pathIsLive). */
async function liveSet() {
  const [prods] = await pool.query('SELECT id, name, slug FROM products WHERE active = 1');
  const [cats] = await pool.query('SELECT id FROM categories WHERE hidden = 0');
  const [brands] = await pool.query('SELECT slug FROM brands WHERE hidden = 0');
  const [blog] = await pool.query("SELECT slug FROM blog_posts WHERE status = 'Published'");
  const [pages] = await pool.query("SELECT slug FROM site_pages WHERE status = 'Published' AND grp = 'servicing'");
  let policies = [];
  try { policies = ((parseJson((await pool.query('SELECT v FROM settings WHERE k = "content"'))[0][0]?.v) || {}).policies || []).map(x => x.k).filter(Boolean); } catch { /* none */ }
  const products = new Set();
  for (const p of prods) { products.add(productPath(p).slice(9)); products.add(legacySlug(p)); }
  return { exact: new Set(EXACT), products, categories: new Set(cats.map(c => String(c.id))), brands: new Set(brands.map(b => b.slug)), blog: new Set(blog.map(b => b.slug)), pages: new Set(pages.map(p => p.slug)), policies: new Set(policies) };
}
const allRows = async () => (await pool.query('SELECT * FROM seo_redirects'))[0];

/** Shared by POST and PUT: plan, loop check, live-page warning. Returns { target, warnings, flattened }. */
async function plan(rows, r) {
  const p = planRedirect(rows, r);
  if (p.loop) throw fail(400, 'This redirect would loop back to itself');
  const warnings = [...p.warnings];
  if (p.target.startsWith('/')) {
    try { if (!pathIsLive(p.target, await liveSet())) warnings.push('The new address does not match a live page right now'); } catch { /* no warning when unknown */ }
  }
  return { target: p.target, warnings, flattened: p.flattened };
}
async function repoint(flattened) { for (const f of flattened) await pool.query('UPDATE seo_redirects SET target = ? WHERE id = ?', [f.to, f.id]); }
const idOf = req => { const id = posInt(req.params.id); if (!id) throw fail(404, 'Not found'); return id; };
const bodyOf = req => (req.body && typeof req.body === 'object' ? req.body : {});

export function mountSeoRedirectsRoutes(router, guard) {
  const G = guard('seo.manage');

  // ---------- redirects ----------
  router.get('/seo/redirects', G, wrap(async (req, res) => {
    const q = parseRedirectQuery(req.query);
    const rows = analyseRows((await allRows()).map(col));
    let live = null;
    try { live = await liveSet(); } catch { /* targetOk stays null */ }
    for (const r of rows) r.targetOk = live ? targetOkOf(r.finalTarget, live) : null;
    const page = listRedirects(rows, q);
    res.json({
      total: page.total,
      rows: page.rows.map(r => ({ id: r.id, source: r.source, target: r.target, code: r.code, hits: r.hits, lastHit: r.lastHit, auto: r.auto, createdAt: r.createdAt, hops: r.hops, finalTarget: r.finalTarget, loop: r.loop, targetOk: r.targetOk })),
      summary: summarise(rows)
    });
  }));

  router.post('/seo/redirects/flatten', G, wrap(async (req, res) => {
    const { fix, loops } = planFlatten((await allRows()).map(col));
    await repoint(fix);
    if (fix.length) await bustSeo();
    res.json({ ok: true, fixed: fix.length, loops });
  }));

  router.post('/seo/redirects', G, wrap(async (req, res) => {
    const r = validateRedirect(bodyOf(req));
    const rows = await allRows();
    const dup = rows.find(x => x.source === r.source);
    if (dup) return res.status(409).json({ error: 'A redirect from this address already exists', id: dup.id });
    const p = await plan(rows, r);
    const [ins] = await pool.query('INSERT INTO seo_redirects (source, target, code, auto) VALUES (?,?,?,0)', [r.source, p.target, r.code]);
    await repoint(p.flattened);
    try { await flushNow(pool); await pool.query('DELETE FROM seo_404_log WHERE path = ?', [r.source]); } catch { /* the 404 list may be missing */ }
    await bustSeo();
    res.json({ ok: true, id: ins.insertId, warnings: p.warnings, flattened: p.flattened });
  }));

  router.put('/seo/redirects/:id', G, wrap(async (req, res) => {
    const id = idOf(req);
    const [[row]] = await pool.query('SELECT * FROM seo_redirects WHERE id = ?', [id]);
    if (!row) throw fail(404, 'Redirect not found');
    const b = bodyOf(req);
    const r = validateRedirect({ source: row.source, target: b.target, code: b.code ?? row.code });
    const p = await plan(await allRows(), r);
    await pool.query('UPDATE seo_redirects SET target = ?, code = ? WHERE id = ?', [p.target, r.code, id]);
    await repoint(p.flattened);
    await bustSeo();
    res.json({ ok: true, warnings: p.warnings, flattened: p.flattened });
  }));

  router.delete('/seo/redirects/:id', G, wrap(async (req, res) => {
    const [r] = await pool.query('DELETE FROM seo_redirects WHERE id = ?', [idOf(req)]);
    if (!r.affectedRows) throw fail(404, 'Redirect not found');
    await bustSeo();
    res.json({ ok: true });
  }));

  // ---------- target picker ----------
  router.get('/seo/targets', G, wrap(async (req, res) => {
    const q = String(Array.isArray(req.query.q) ? req.query.q[0] : req.query.q ?? '').trim().slice(0, 100);
    const L = like(q), out = [];
    const [cats] = await pool.query('SELECT id, title FROM categories WHERE hidden = 0 AND title LIKE ? ORDER BY sort_order LIMIT 12', [L]);
    for (const c of cats) out.push({ type: 'category', label: c.title, path: '/shop/' + c.id });
    const [brands] = await pool.query('SELECT slug, name FROM brands WHERE hidden = 0 AND name LIKE ? ORDER BY name LIMIT 12', [L]);
    for (const b of brands) out.push({ type: 'brand', label: b.name, path: '/brand/' + (b.slug || brandSlug(b.name)) });
    if (q.length >= 2) {
      const [prods] = await pool.query('SELECT id, name, slug FROM products WHERE active = 1 AND (name LIKE ? OR sku LIKE ? OR part LIKE ?) ORDER BY popular DESC, id DESC LIMIT 12', [L, L, L]);
      for (const p of prods) out.push({ type: 'product', label: p.name, path: productPath(p) });
      const [posts] = await pool.query("SELECT slug, title FROM blog_posts WHERE status = 'Published' AND title LIKE ? ORDER BY published DESC LIMIT 12", [L]);
      for (const b of posts) out.push({ type: 'blog', label: b.title, path: '/blog/' + b.slug });
      const [pages] = await pool.query("SELECT slug, title FROM site_pages WHERE status = 'Published' AND grp = 'servicing' AND title LIKE ? ORDER BY sort_order LIMIT 12", [L]);
      for (const p of pages) out.push({ type: 'page', label: p.title, path: '/services/' + p.slug });
    }
    // fair share: when there are many matches, mix the types instead of letting the first type fill all 12
    const rows = [];
    const by = {};
    for (const x of out) (by[x.type] ||= []).push(x);
    const lists = Object.values(by);
    for (let i = 0; rows.length < 12 && lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length && rows.length < 12) rows.push(l[i]);
    res.json({ rows });
  }));

  // ---------- 404 monitor ----------
  router.get('/seo/404', G, wrap(async (req, res) => {
    await flushNow(pool);
    const q = parse404Query(req.query);
    const where = [], args = [];
    if (q.status === 'open') where.push('ignored = 0'); else if (q.status === 'ignored') where.push('ignored = 1');
    if (q.q) { where.push('path LIKE ?'); args.push(like(q.q)); }
    const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sortCol = { hits: 'hits', lastSeen: 'last_seen', firstSeen: 'first_seen' }[SORTS_404[q.sort]];
    const dir = q.dir === 'asc' ? 'ASC' : 'DESC';
    const [[t]] = await pool.query(`SELECT COUNT(*) n FROM seo_404_log ${W}`, args);
    const [rows] = await pool.query(`SELECT id, path, hits, referrer, ignored, first_seen, last_seen FROM seo_404_log ${W} ORDER BY ${sortCol} ${dir}, id DESC LIMIT ? OFFSET ?`, [...args, q.size, (q.page - 1) * q.size]);
    const [[s]] = await pool.query('SELECT COALESCE(SUM(ignored = 0), 0) open, COALESCE(SUM(ignored = 1), 0) ignored, COALESCE(SUM(hits), 0) hits, COALESCE(SUM(last_seen >= (NOW() - INTERVAL 1 DAY)), 0) last24h FROM seo_404_log');
    let has = new Set();
    if (rows.length) has = new Set((await pool.query('SELECT source FROM seo_redirects WHERE source IN (?)', [rows.map(r => r.path)]))[0].map(r => r.source));
    res.json({
      total: t.n,
      rows: rows.map(r => ({ id: r.id, path: r.path, hits: r.hits, referrer: r.referrer, ignored: !!r.ignored, firstSeen: r.first_seen, lastSeen: r.last_seen, hasRedirect: has.has(r.path) })),
      summary: { open: Number(s.open), ignored: Number(s.ignored), hits: Number(s.hits), last24h: Number(s.last24h) }
    });
  }));

  router.delete('/seo/404', G, wrap(async (req, res) => {
    const n = Number(req.query.olderThanDays);
    if (!Number.isInteger(n) || n < 1 || n > 3650) throw fail(400, 'olderThanDays must be a whole number from 1 to 3650');
    const ignoredOnly = ['1', 'true'].includes(String(req.query.ignoredOnly));
    await flushNow(pool);
    const [r] = await pool.query(`DELETE FROM seo_404_log WHERE last_seen < (NOW() - INTERVAL ? DAY)${ignoredOnly ? ' AND ignored = 1' : ''}`, [n]);
    res.json({ ok: true, deleted: r.affectedRows });
  }));

  router.put('/seo/404/:id', G, wrap(async (req, res) => {
    const id = idOf(req);
    const v = bodyOf(req).ignored;
    if (typeof v !== 'boolean') throw fail(400, 'ignored must be true or false');
    const [r] = await pool.query('UPDATE seo_404_log SET ignored = ? WHERE id = ?', [v ? 1 : 0, id]);
    if (!r.affectedRows) throw fail(404, 'Not found');
    res.json({ ok: true });
  }));

  router.delete('/seo/404/:id', G, wrap(async (req, res) => {
    const [r] = await pool.query('DELETE FROM seo_404_log WHERE id = ?', [idOf(req)]);
    if (!r.affectedRows) throw fail(404, 'Not found');
    res.json({ ok: true });
  }));
}
