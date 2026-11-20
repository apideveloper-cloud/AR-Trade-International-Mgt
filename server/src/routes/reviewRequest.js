// Public routes of review requests: /api/review-request/:token (signed link from the review e-mail / WhatsApp message). No login.
import { pool } from '../db.js';
import { wrap } from '../util.js';
import { makeIpLimiter } from '../growth/reviewSpam.js';
import { SHOP, firstName, verifyToken } from '../growth/reviewRequestsCore.js';
import { optOutRequest, readSettings } from '../growth/reviewRequests.js';
import { submitReviews } from '../growth/reviewRequestsSubmit.js';

const limiter = makeIpLimiter({ max: 30, windowMs: 10 * 60e3 });
const gone = (res, msg) => res.status(410).json({ error: msg });

/** The request behind a token: { row } or a response already sent ({ done: true }). */
async function open(req, res) {
  const t = verifyToken(req.params.token);
  if (!t) { res.status(404).json({ error: 'This link is not valid' }); return { done: true }; }
  const [[row]] = await pool.query('SELECT r.*, o.customer_name FROM review_requests r JOIN orders o ON o.id = r.order_id WHERE r.id = ?', [t.rid]);
  if (!row) { res.status(404).json({ error: 'This link is not valid' }); return { done: true }; }
  if (row.status === 'OptedOut' || row.status === 'Cancelled') { gone(res, 'This link is no longer active'); return { done: true }; }
  if (t.expired || row.status === 'Expired' || new Date(row.expires_at).getTime() <= Date.now()) { gone(res, 'This link has expired'); return { done: true }; }
  return { row };
}

export function mountReviewRequestRoutes(app) {
  const base = '/api/review-request/:token';
  app.use('/api/review-request', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (limiter.over(req.ip)) return res.status(429).json({ error: 'Too many requests. Please try again in a few minutes.' });
    next();
  });

  app.get(base, wrap(async (req, res) => {
    const { row, done } = await open(req, res); if (done) return;
    const [items] = await pool.query('SELECT product_id, MIN(name) name, MIN(img) img FROM order_items WHERE order_id = ? GROUP BY product_id', [row.order_id]);
    const [have] = await pool.query('SELECT product_id FROM reviews WHERE order_id = ? AND status <> "Rejected"', [row.order_id]);
    const reviewed = new Set(have.map(h => h.product_id));
    await pool.query("UPDATE review_requests SET opened_at = COALESCE(opened_at, ?), sent_at = COALESCE(sent_at, ?), status = IF(status IN ('Queued','Sent'), 'Opened', status) WHERE id = ?", [new Date(), new Date(), row.id]);
    res.json({
      shop: SHOP, firstName: firstName(row.customer_name || row.name), orderRef: row.order_id, renderedAt: new Date().toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
      items: items.map(i => ({ productId: i.product_id, name: i.name, img: i.img || '', alreadyReviewed: reviewed.has(i.product_id) }))
    });
  }));

  app.post(base, wrap(async (req, res) => {
    const { row, done } = await open(req, res); if (done) return;
    const r = await submitReviews({ row, settings: await readSettings(), body: req.body, ip: req.ip });
    res.json({ ok: true, ...r });
  }));

  app.post(base + '/optout', wrap(async (req, res) => {
    const t = verifyToken(req.params.token);
    if (!t) return res.status(404).json({ error: 'This link is not valid' });
    const [[row]] = await pool.query('SELECT * FROM review_requests WHERE id = ?', [t.rid]);
    if (!row) return res.status(404).json({ error: 'This link is not valid' });
    await optOutRequest(row); // works even after the link expired: stopping the mails must always be possible
    res.json({ ok: true });
  }));
}
