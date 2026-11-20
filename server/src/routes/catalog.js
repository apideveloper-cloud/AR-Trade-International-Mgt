// Public catalogue: the cached bootstrap payload, best sellers, one product and its reviews.
import { pool } from '../db.js';
import { fail, parseJson, wrap } from '../util.js';
import { hasPicture, published } from '../productImages.js';
import { auth } from '../middleware/customerAuth.js';
import { getBootCache, setBootCache } from '../middleware/cache.js';
import { assessReview, hashIp, makeIpLimiter } from '../growth/reviewSpam.js';
import { LIST_COLS, loadCatalogue, productIdParam, productOut } from './shared.js';

const reviewLimiter = makeIpLimiter({ max: 5, windowMs: 3600e3 }); // 5 reviews per hour per connection
const seoOut = r => ({ metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || '' });

export function mountCatalogRoutes(app) {
  // best sellers: ranked by units on non-cancelled orders; products with no sales yet fall back to the "popular"/"featured" flags
  app.get('/api/bestsellers', wrap(async (req, res) => {
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const [rows] = await pool.query(`SELECT ${LIST_COLS.split(', ').map(c => 'p.' + c).join(', ')}, COALESCE(s.q, 0) AS sold FROM products p
      LEFT JOIN (SELECT i.product_id, SUM(i.qty) q FROM order_items i JOIN orders o ON o.id = i.order_id WHERE o.status <> 'Cancelled' GROUP BY i.product_id) s ON s.product_id = p.id
      WHERE p.active = 1 ORDER BY sold DESC, p.popular DESC, p.featured DESC, p.id DESC LIMIT ?`, [limit + 12]); // a few spare: products without a picture are skipped
    res.json({ products: published(rows).slice(0, limit).map(r => ({ ...productOut(r), sold: Number(r.sold) })) });
  }));

  // one product with its full description and image gallery (the catalogue list in /api/bootstrap stays light)
  app.get('/api/products/:id', wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT * FROM products WHERE id = ? AND active = 1', [await productIdParam(req.params.id)]);
    if (!r || !hasPicture(r.img)) throw fail(404, 'Product not found');
    const [imgs] = await pool.query('SELECT path, alt FROM product_images WHERE product_id = ? ORDER BY position', [r.id]);
    const [specs] = await pool.query('SELECT name, value FROM product_specs WHERE product_id = ? ORDER BY position', [r.id]);
    res.json({ ...productOut(r), description: r.description || '', short: r.short_desc || '', sku: r.sku || '', tags: parseJson(r.tags) || [], specs, ...seoOut(r),
      gallery: imgs.length ? imgs.map(x => x.path) : (parseJson(r.gallery) || []),
      galleryAlt: imgs.length ? imgs.map(x => x.alt || '') : (parseJson(r.gallery) || []).map(() => '') });
  }));

  // The whole catalogue every page needs at start. It is built once and kept (as JSON and as gzip) until something is written or 30 seconds
  // pass, so the next visitors get it without touching the database or compressing 1 MB again; ETag lets a returning browser skip the download.
  app.get('/api/bootstrap', wrap(async (req, res) => {
    const kept = getBootCache() || setBootCache(await loadCatalogue());
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.setHeader('ETag', kept.etag);
    res.setHeader('Vary', 'Accept-Encoding');
    if (req.headers['if-none-match'] === kept.etag) return res.status(304).end();
    res.type('application/json');
    if (/gzip/.test(req.headers['accept-encoding'] || '')) { res.setHeader('Content-Encoding', 'gzip'); return res.send(kept.gzip); }
    res.send(kept.json);
  }));

  // ---------- product reviews (published only after an admin approves them) ----------
  app.get('/api/products/:id/reviews', auth(false), wrap(async (req, res) => {
    const pid = await productIdParam(req.params.id);
    if (!pid) return res.json({ count: 0, avg: 0, dist: [0, 0, 0, 0, 0], mine: null, reviews: [] });
    const [rows] = await pool.query('SELECT id, name, rating, title, body, verified, created_at, admin_reply, replied_at FROM reviews WHERE product_id = ? AND status = "Approved" ORDER BY created_at DESC LIMIT 100', [pid]);
    const dist = [0, 0, 0, 0, 0];
    rows.forEach(r => { dist[r.rating - 1]++; });
    const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0;
    let mine = null;
    if (req.user) {
      const [[m]] = await pool.query('SELECT status FROM reviews WHERE product_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1', [pid, req.user.id]);
      mine = m ? (m.status === 'Spam' ? 'Pending' : m.status) : null; // a spam verdict is never shown to the writer
    }
    res.json({ count: rows.length, avg: Math.round(avg * 10) / 10, dist, mine, reviews: rows.map(r => ({ id: r.id, name: r.name, rating: r.rating, title: r.title, body: r.body, verified: !!r.verified, at: r.created_at, reply: r.admin_reply && String(r.admin_reply).trim() ? { text: r.admin_reply, at: r.replied_at } : null })) });
  }));

  app.post('/api/products/:id/reviews', auth(true), wrap(async (req, res) => {
    const pid = await productIdParam(req.params.id);
    const [[prod]] = await pool.query('SELECT id FROM products WHERE id = ?', [pid]);
    if (!prod) throw fail(404, 'Product not found');
    const rating = parseInt(req.body.rating, 10);
    const body = String(req.body.body || '').trim();
    const title = String(req.body.title || '').trim().slice(0, 120);
    if (!(rating >= 1 && rating <= 5)) throw fail(400, 'Please choose a star rating');
    if (body.length < 10) throw fail(400, 'Please write at least 10 characters');
    if (body.length > 1500) throw fail(400, 'Review is too long (1500 characters max)');
    if (reviewLimiter.over(req.ip || '')) throw fail(429, 'Too many reviews from this connection. Please try again later.');
    const verdict = assessReview({ title, body, honeypot: req.body.website, renderedAt: req.body.renderedAt, now: Date.now() });
    if (verdict.reject) throw fail(400, verdict.reject);
    const [[dup]] = await pool.query('SELECT id FROM reviews WHERE product_id = ? AND user_id = ? AND status NOT IN ("Rejected", "Spam")', [pid, req.user.id]);
    if (dup) throw fail(409, 'You have already reviewed this product');
    const [[u]] = await pool.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
    const [[bought]] = await pool.query('SELECT COUNT(*) n FROM orders o JOIN order_items i ON i.order_id = o.id WHERE o.user_id = ? AND i.product_id = ? AND o.status = "Delivered"', [req.user.id, pid]);
    await pool.query('INSERT INTO reviews (product_id, user_id, name, rating, title, body, verified, status, spam_reason, ip_hash, source) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [pid, req.user.id, (u && u.name) || 'Customer', rating, title, body, bought.n > 0 ? 1 : 0, verdict.status, verdict.status === 'Spam' ? verdict.reason : '', hashIp(req.ip), 'site']);
    res.json({ ok: true, status: 'Pending' });
  }));
}
