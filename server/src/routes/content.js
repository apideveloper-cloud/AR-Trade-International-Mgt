// Public content: servicing / clients / company pages and the blog, both managed from the admin console.
import { pool } from '../db.js';
import { fail, parseJson, wrap } from '../util.js';

const pageOut = r => ({ id: r.id, slug: r.slug, group: r.grp, title: r.title, metaTitle: r.meta_title || '', excerpt: r.excerpt, cover: r.cover, images: parseJson(r.images) || [], body: r.body });
const blogOut = r => ({ slug: r.slug, title: r.title, category: r.category, cover: r.cover, excerpt: r.excerpt, date: r.published, author: r.author });
const BLOG_LIST_COLS = 'slug, title, category, cover, excerpt, author, DATE_FORMAT(published, "%Y-%m-%d") AS published';

export function mountContentRoutes(app) {
  app.get('/api/pages', wrap(async (req, res) => {
    const g = ['servicing', 'clients', 'company'].includes(req.query.group) ? req.query.group : null;
    const [rows] = await pool.query(`SELECT * FROM site_pages WHERE status = 'Published' ${g ? 'AND grp = ?' : ''} ORDER BY grp, sort_order, id`, g ? [g] : []);
    res.json({ pages: rows.map(pageOut) });
  }));
  app.get('/api/pages/:slug', wrap(async (req, res) => {
    const [[r]] = await pool.query("SELECT * FROM site_pages WHERE slug = ? AND status = 'Published'", [req.params.slug]);
    if (!r) throw fail(404, 'Page not found');
    res.json(pageOut(r));
  }));

  app.get('/api/blog', wrap(async (req, res) => {
    const [rows] = await pool.query(`SELECT ${BLOG_LIST_COLS} FROM blog_posts WHERE status = "Published" ORDER BY published DESC, id DESC`);
    res.json({ posts: rows.map(blogOut) });
  }));
  app.get('/api/blog/:slug', wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT *, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE slug = ? AND status = "Published"', [req.params.slug]);
    if (!r) throw fail(404, 'Article not found');
    const [rel] = await pool.query(`SELECT ${BLOG_LIST_COLS} FROM blog_posts WHERE status = "Published" AND slug <> ? ORDER BY (category = ?) DESC, published DESC LIMIT 3`, [r.slug, r.category]);
    res.json({ post: { ...blogOut(r), body: r.body, metaTitle: r.meta_title || '' }, related: rel.map(blogOut) });
  }));
}
