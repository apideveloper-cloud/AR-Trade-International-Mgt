// Admin routes of Search & Growth Phase 6 (product YouTube videos). Reads need seo.manage, writes products.manage.
import { pool } from '../db.js';
import { wrap } from '../util.js';
import { dateText, validateVideoChange, youtubeId } from '../growth/youtube.js';

const clampInt = (v, d, max) => Math.min(max, Math.max(1, parseInt(v, 10) || d));

/** Validates a POST body: [{ id, videoUrl?, videoTitle?, videoDate? }] -> { errors:[{id,field,message}], items:[{id, value}] }. Pure. Max 100; nothing is applied if any entry is bad. */
export function validateChanges(list) {
  if (!Array.isArray(list) || !list.length) return { errors: [{ id: null, field: 'changes', message: 'Nothing to save' }], items: [] };
  if (list.length > 100) return { errors: [{ id: null, field: 'changes', message: 'Save at most 100 products at a time' }], items: [] };
  const errors = [], items = [];
  for (const c of list) {
    const id = Number(c?.id);
    if (!Number.isInteger(id) || id <= 0) { errors.push({ id: c?.id ?? null, field: 'id', message: 'Bad product id' }); continue; }
    const v = validateVideoChange({ videoUrl: c.videoUrl, videoTitle: c.videoTitle, videoDate: c.videoDate });
    for (const e of v.errors) errors.push({ id, ...e });
    items.push({ id, value: v.value });
  }
  return { errors, items };
}

/** Pure: the WHERE of the grid and its params. */
export function gridWhere(query = {}) {
  const w = ['p.active = 1'], p = [];
  const q = String(query.q || '').trim();
  if (q) { const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`; w.push('(CAST(p.id AS CHAR) = ? OR p.sku LIKE ? OR p.name LIKE ?)'); p.push(q, like, like); }
  if (query.filter === 'with') w.push("p.video_url <> ''");
  else if (query.filter === 'without') w.push("(p.video_url IS NULL OR p.video_url = '')");
  return { where: w.join(' AND '), params: p };
}

export const rowOut = r => ({ id: r.id, sku: r.sku || '', name: r.name, category: r.category || '', videoUrl: r.video_url || '', videoId: youtubeId(r.video_url), videoTitle: r.video_title || '', videoDate: dateText(r.video_date) || null });

export function mountGrowthVideosRoutes(router, guard) {
  const R = guard('seo.manage'), W = guard('products.manage');

  router.get('/growth/videos', R, wrap(async (req, res) => {
    const limit = clampInt(req.query.limit, 15, 100), { where, params } = gridWhere(req.query);
    const [[t]] = await pool.query(`SELECT COUNT(*) n FROM products p WHERE ${where}`, params);
    const total = Number(t.n), pages = Math.max(1, Math.ceil(total / limit)), page = Math.min(clampInt(req.query.page, 1, 1e6), pages);
    const [rows] = await pool.query(`SELECT p.id, p.sku, p.name, p.video_url, p.video_title, p.video_date, c.title AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${where} ORDER BY p.id LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
    const [[c]] = await pool.query("SELECT COALESCE(SUM(video_url <> ''), 0) w, COUNT(*) n FROM products WHERE active = 1");
    res.json({ rows: rows.map(rowOut), total, page, pages, counts: { with: Number(c.w), without: Number(c.n) - Number(c.w) } });
  }));

  router.post('/growth/videos', W, wrap(async (req, res) => {
    const v = validateChanges(req.body?.changes);
    if (v.errors.length) return res.status(400).json({ error: v.errors[0].message, errors: v.errors });
    const conn = await pool.getConnection();
    let updated = 0;
    try {
      await conn.beginTransaction();
      for (const { id, value } of v.items) {
        const [r] = await conn.query('UPDATE products SET video_url = ?, video_title = ?, video_date = ? WHERE id = ?', [value.video_url, value.video_title, value.video_date, id]);
        updated += r.affectedRows ? 1 : 0;
      }
      await conn.commit();
    } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
    if (updated) { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') m.bustSeo(); }
    res.json({ updated });
  }));
}
