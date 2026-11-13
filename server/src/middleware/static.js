// Static files: uploaded images (served through /api so the Vite dev proxy covers them) and, in production, the built client.
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isPrivateUploadPath } from '../util.js';
import { mountSeo } from '../seo.js';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Blog and product images live in the project (server/uploads/...). Mounted before the API routers. */
export function mountUploads(app) {
  // blog images are served through /api so the Vite dev proxy covers them too
  app.use('/api/media', express.static(path.join(SERVER_ROOT, 'uploads/blog'), { maxAge: '7d', fallthrough: false })); // old blog image links
  // every imported / uploaded image lives under server/uploads/<products|blog|services|clients|company>/<category>/
  app.use('/api/uploads', (req, res, next) => (isPrivateUploadPath(req.url.split('?')[0]) ? res.status(404).end() : next())); // private folders (CVs, vouchers) are never served, whatever the URL spelling
  app.use('/api/uploads', express.static(path.join(SERVER_ROOT, 'uploads'), { maxAge: '7d', fallthrough: false, index: false, dotfiles: 'deny' }));
}

/** Production: serve the built client, with robots.txt, sitemap.xml and the per-page HTML shell registered last. */
export function mountClient(app) {
  const dist = path.resolve(SERVER_ROOT, '../client/dist');
  if (!fs.existsSync(dist)) return;
  app.get('/index.html', (req, res) => res.redirect(301, '/')); // the home page has one address
  // Vite names built files by their content (assets/index-AbC123.js), so they can be kept by the browser for a year; the HTML shell is never cached
  app.use(express.static(dist, { index: false, setHeaders: (res, file) => { if (/[\/]assets[\/]/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  mountSeo(app, dist); // robots.txt, sitemap.xml and the HTML shell with per-page meta tags
}
