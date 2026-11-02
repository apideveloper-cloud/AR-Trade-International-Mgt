// Admin console: blog articles, picture uploads, site pages and the storefront content (home slides, logos, FAQs, policies, labels).
// Split out of admin.js; the routes are registered in the same order, on a sub-router that admin.js mounts where the block used to be.
import { Router } from 'express';
import sanitizeHtml from 'sanitize-html';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { fail, parseJson, wrap, isLocalImg, localImg } from './util.js';
import { addRange } from './listing.js';
import { can } from './permissions.js';
import { like, page } from './adminHelpers.js';

// ---------- blog: managed by Admin and the Content writer role ----------
export const SAN = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'figure', 'figcaption'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt', 'loading'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: [] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, at) => ({ tagName: 'a', attribs: { ...at, target: '_blank', rel: 'noopener' } }),
    img: (tag, at) => ({ tagName: 'img', attribs: { src: isLocalImg(at.src) ? at.src : '', alt: at.alt || '', loading: 'lazy' } }),
    div: 'p', b: 'strong', i: 'em'
  }
};
const slugify = s => String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 120);
const textOf = html => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
/** The SEO fields a blog article or a site page carries. */
const seoIn = b => ({ metaTitle: String(b.metaTitle || '').trim().slice(0, 160), metaDesc: String(b.metaDesc || '').replace(/\s+/g, ' ').trim().slice(0, 320), metaKeywords: String(b.metaKeywords || '').replace(/\s+/g, ' ').trim().slice(0, 500), noindex: b.noindex ? 1 : 0 });
const seoOut = r => ({ metaTitle: r.meta_title || '', metaDesc: r.meta_desc || '', metaKeywords: r.meta_keywords || '', noindex: !!r.noindex });
const blogRow = r => ({ id: r.id, slug: r.slug, title: r.title, category: r.category, cover: r.cover, excerpt: r.excerpt, body: r.body, date: r.published, status: r.status, author: r.author, authorId: r.author_id, updated: r.updated_at, ...seoOut(r) });
const IMG_TYPES = { png: [0x89, 0x50, 0x4e, 0x47], jpg: [0xff, 0xd8, 0xff], gif: [0x47, 0x49, 0x46], webp: [0x52, 0x49, 0x46, 0x46] };

const savePost = async (req, id) => {
  const b = req.body;
  const title = String(b.title || '').trim();
  if (title.length < 3) throw fail(400, 'Please enter a title');
  const body = sanitizeHtml(String(b.body || ''), SAN);
  if (textOf(body).length < 20) throw fail(400, 'The article text is too short');
  const category = String(b.category || 'Articles').trim().slice(0, 60) || 'Articles';
  const status = b.status === 'Draft' ? 'Draft' : 'Published';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : new Date().toISOString().slice(0, 10);
  const excerpt = (String(b.excerpt || '').trim() || textOf(body)).slice(0, 190);
  const cover = localImg(b.cover, 'The cover must be an uploaded image');
  let slug = slugify(b.slug || title) || 'post-' + Date.now();
  const [dup] = await pool.query('SELECT id FROM blog_posts WHERE slug = ? AND id <> ?', [slug, id || 0]);
  if (dup.length) { if (b.slug) throw fail(409, 'This web address is already used by another article'); slug += '-' + Date.now().toString(36).slice(-4); }
  return { title, body, category, status, date, excerpt, cover, slug, ...seoIn(b) };
};
// images for products / blog / servicing / clients / company pages are stored under server/uploads/<folder>/ (folder = section/category)
const FOLDER = /^(products|blog|services|clients|company|site)(\/[a-z0-9][a-z0-9-]{0,58}){0,2}$/;
// ---------- site pages: servicing details, corporate clients, company profile ----------
const pageRow = r => ({ id: r.id, slug: r.slug, group: r.grp, title: r.title, excerpt: r.excerpt, body: r.body, cover: r.cover, images: parseJson(r.images) || [], status: r.status, order: r.sort_order, edited: !!r.edited, updated: r.updated_at, ...seoOut(r) });
const savePage = (b) => {
  const title = String(b.title || '').trim();
  if (title.length < 3) throw fail(400, 'Please enter a title');
  const body = sanitizeHtml(String(b.body || ''), SAN);
  const cover = localImg(b.cover, 'The cover must be an uploaded image');
  return { title, body, cover, excerpt: (String(b.excerpt || '').trim() || textOf(body)).slice(0, 190), status: b.status === 'Draft' ? 'Draft' : 'Published', order: parseInt(b.order, 10) || 0, ...seoIn(b) };
};
// ---------- storefront content (home slides, brand + client logos, FAQs, policies, labels…) ----------
const text = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const url = v => { const u = text(v, 500); if (u && !/^(\/api\/uploads\/|https?:\/\/|\/|#\/|\.\/)/.test(u)) throw fail(400, 'Links must start with / , #/ or https://'); return u; };
const img = v => localImg(text(v, 500), 'Images must be uploaded here');
const list = (v, max = 60) => { if (!Array.isArray(v)) throw fail(400, 'Expected a list'); return v.slice(0, max); };
const CONTENT = {
  slides: v => list(v, 12).map(s => (s.type === 'image'
    ? { on: s.on !== false, type: 'image', alt: text(s.alt, 160), img: img(s.img), href: url(s.href) || '#/shop/all', ratio: Number(s.ratio) || 2.68 }
    : { on: s.on !== false, type: 'design', tag: text(s.tag, 120), title: text(s.title, 200), sub: text(s.sub, 400), c1: text(s.c1, 60), h1: url(s.h1), c2: text(s.c2, 60), h2: url(s.h2), pic: img(s.pic), badgeT: text(s.badgeT, 30), badgeV: text(s.badgeV, 30) })),
  brands: v => list(v, 40).filter(b => text(b.n)).map(b => ({ n: text(b.n, 60), src: img(b.src) })),
  clients: v => list(v, 80).map(c => img(typeof c === 'string' ? c : c.src)).filter(Boolean),
  faqs: v => list(v, 40).filter(f => text(f.q)).map(f => ({ q: text(f.q, 300), a: text(f.a, 2000) })),
  perks: v => list(v, 8).map(p => ({ ic: text(p.ic, 8), t: text(p.t, 80), d: text(p.d, 160), dot: text(p.dot, 60) || 'oklch(0.72 0.13 220)' })),
  whys: v => list(v, 12).map(w => ({ t: text(w.t, 80), d: text(w.d, 400) })),
  stats: v => list(v, 8).map(x => ({ v: text(x.v, 20), t: text(x.t, 80) })),
  words: v => list(v, 20).map(w => text(w, 120)).filter(Boolean),
  social: v => Object.fromEntries(['facebook', 'instagram', 'linkedin', 'youtube', 'x'].map(k => [k, url(v && v[k])])),
  labels: v => Object.fromEntries(Object.entries(v || {}).slice(0, 40).map(([k, x]) => [text(k, 40), text(x, 160)])),
  policies: v => list(v, 8).map(p => ({ k: slugify(p.k || p.t) || 'policy', t: text(p.t, 120), secs: list(p.secs || [], 30).map(x => ({ h: text(x.h, 160), p: text(x.p, 3000) })) })),
  sections: v => Object.fromEntries(Object.entries(v || {}).slice(0, 20).map(([k, x]) => [text(k, 30), !!x])),
  slideSecs: v => Math.min(30, Math.max(2, Number(v) || 5.5)),
  about: v => Object.fromEntries(['heading', 'intro', 'mdMessage', 'mdName', 'mdTitle', 'vision', 'mission'].map(k => [k, text(v && v[k], 2000)])),
  footer: v => Object.fromEntries(['tagline', 'hours', 'mobileBanking', 'email2'].map(k => [k, text(v && v[k], 300)])),
  menus: v => Object.fromEntries(['hot', 'services', 'blog', 'about'].map(k => [k, list((v || {})[k] || [], 20).filter(i => text(i.t)).map(i => {
    const l = url(i.href || i.to);
    return /^https?:\/\//.test(l) ? { t: text(i.t, 80), href: l, mark: '↗' } : { t: text(i.t, 80), to: l || '/' };
  })]))
};

/** The routes of this block. `guard` is passed in (admin.js owns it), which avoids a circular import. */
export function contentRouter(guard) {
  const router = Router();
  router.get('/blog', guard('blog.manage'), wrap(async (req, res) => {
    const { size, offset } = page(req);
    const cond = [], params = [];
    if (req.query.q) { cond.push('(title LIKE ? OR category LIKE ? OR author LIKE ?)'); params.push(like(req.query.q), like(req.query.q), like(req.query.q)); }
    if (req.query.status) { cond.push('status = ?'); params.push(req.query.status); }
    addRange(cond, params, 'published', req);
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM blog_posts ${where}`, params);
    const [rows] = await pool.query(`SELECT id, slug, title, category, cover, excerpt, author, author_id, status, DATE_FORMAT(published, "%Y-%m-%d") AS published, updated_at FROM blog_posts ${where} ORDER BY published DESC, id DESC LIMIT ${size} OFFSET ${offset}`, params);
    const [cats] = await pool.query('SELECT DISTINCT category FROM blog_posts ORDER BY category');
    res.json({ total: n, rows: rows.map(blogRow), categories: cats.map(c => c.category) });
  }));
  router.get('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT *, DATE_FORMAT(published, "%Y-%m-%d") AS published FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!r) throw fail(404, 'Article not found');
    res.json(blogRow(r));
  }));
  router.post('/blog', guard('blog.manage'), wrap(async (req, res) => {
    const p = await savePost(req, 0);
    const [r] = await pool.query('INSERT INTO blog_posts (slug, title, category, cover, excerpt, body, published, status, author, author_id, meta_title, meta_desc, meta_keywords, noindex, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW())',
      [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, req.staff.name, req.staff.id, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex]);
    res.json({ id: r.insertId, slug: p.slug });
  }));
  router.put('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
    const [[cur]] = await pool.query('SELECT id FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!cur) throw fail(404, 'Article not found');
    const p = await savePost(req, cur.id);
    await pool.query('UPDATE blog_posts SET slug=?, title=?, category=?, cover=?, excerpt=?, body=?, published=?, status=?, meta_title=?, meta_desc=?, meta_keywords=?, noindex=?, edited=1, updated_at=NOW() WHERE id=?',
      [p.slug, p.title, p.category, p.cover, p.excerpt, p.body, p.date, p.status, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex, cur.id]);
    res.json({ ok: true, slug: p.slug });
  }));
  router.delete('/blog/:id', guard('blog.manage'), wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT author_id FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!r) throw fail(404, 'Article not found');
    if (req.staff.role === 'Content writer' && r.author_id !== req.staff.id) throw fail(403, 'Writers can delete only their own articles');
    await pool.query('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));
  router.post('/upload-image', guard('media.upload'), wrap(async (req, res) => {
    const folder = String(req.body.folder || 'blog/general').toLowerCase();
    if (!FOLDER.test(folder)) throw fail(400, 'Unknown upload folder');
    if (!can(req.staff, 'products.manage') && !/^(blog|services|clients|company|site)(\/|$)/.test(folder)) throw fail(403, 'Your role cannot upload product images');
    const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(String(req.body.data || ''));
    if (!m) throw fail(400, 'Choose a PNG, JPG, GIF or WebP image');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 6 * 1024 * 1024) throw fail(400, 'Image is larger than 6 MB');
    const kind = m[1] === 'jpeg' ? 'jpg' : m[1];
    const sig = IMG_TYPES[kind];
    if (!sig || !sig.every((x, k) => buf[k] === x)) throw fail(400, 'That file is not a valid image');
    const base = slugify(String(req.body.name || 'image').replace(/\.[a-z0-9]+$/i, '')).slice(0, 40) || 'image';
    const file = `${base}-${Date.now().toString(36)}.${kind}`;
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), buf);
    res.json({ url: `/api/uploads/${folder}/${file}` });
  }));

  router.get('/pages', guard('pages.manage'), wrap(async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM site_pages ORDER BY FIELD(grp, "servicing", "clients", "company"), sort_order, id');
    res.json(rows.map(pageRow));
  }));
  router.get('/pages/:id', guard('pages.manage'), wrap(async (req, res) => {
    const [[r]] = await pool.query('SELECT * FROM site_pages WHERE id = ?', [req.params.id]);
    if (!r) throw fail(404, 'Page not found');
    res.json(pageRow(r));
  }));
  router.put('/pages/:id', guard('pages.manage'), wrap(async (req, res) => {
    const p = savePage(req.body);
    const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
    const [r] = await pool.query('UPDATE site_pages SET title=?, excerpt=?, body=?, cover=?, images=?, status=?, sort_order=?, meta_title=?, meta_desc=?, meta_keywords=?, noindex=?, edited=1, updated_at=NOW() WHERE id=?',
      [p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.status, p.order, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex, req.params.id]);
    if (!r.affectedRows) throw fail(404, 'Page not found');
    res.json({ ok: true });
  }));
  router.post('/pages', guard('pages.manage'), wrap(async (req, res) => {
    const grp = ['servicing', 'clients', 'company'].includes(req.body.group) ? req.body.group : 'servicing';
    const p = savePage(req.body);
    let slug = slugify(req.body.slug || p.title) || 'page-' + Date.now();
    const [dup] = await pool.query('SELECT id FROM site_pages WHERE slug = ?', [slug]);
    if (dup.length) slug += '-' + Date.now().toString(36).slice(-4);
    const imgs = [...p.body.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]);
    const [r] = await pool.query('INSERT INTO site_pages (slug, grp, title, excerpt, body, cover, images, sort_order, status, meta_title, meta_desc, meta_keywords, noindex, edited, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW())',
      [slug, grp, p.title, p.excerpt, p.body, p.cover, JSON.stringify(imgs), p.order, p.status, p.metaTitle, p.metaDesc, p.metaKeywords, p.noindex]);
    res.json({ id: r.insertId, slug });
  }));
  router.delete('/pages/:id', guard('pages.delete'), wrap(async (req, res) => { await pool.query('DELETE FROM site_pages WHERE id = ?', [req.params.id]); res.json({ ok: true }); }));

  router.get('/content', guard('pages.manage'), wrap(async (req, res) => {
    const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "content"');
    const c = parseJson(row.v);
    res.json(Object.fromEntries(Object.keys(CONTENT).map(k => [k, c[k]])));
  }));
  router.put('/content/:section', guard('pages.manage'), wrap(async (req, res) => {
    const fn = CONTENT[req.params.section];
    if (!fn) throw fail(404, 'Unknown content section');
    const value = fn(req.body.value);
    const [[row]] = await pool.query('SELECT v FROM settings WHERE k = "content"');
    const c = parseJson(row.v);
    c[req.params.section] = value;
    await pool.query('UPDATE settings SET v = ? WHERE k = "content"', [JSON.stringify(c)]);
    res.json({ ok: true, value });
  }));
  return router;
}
