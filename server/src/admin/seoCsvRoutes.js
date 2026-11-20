// CSV export / import of the SEO fields of products (permission seo.manage). The audit middleware already records every POST under /api/admin, so no extra audit event is written here.
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { like } from '../adminHelpers.js';
import { COLUMNS, buildCsv, exportRow, parseChecked, keysOf, makeLookup, planImport, previewRows, tokenOf, tokenOk, CsvError, MAX_ROWS } from './seoCsv.js';

const CHUNK = 1000;
async function bustSeo() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }
const chunks = a => { const o = []; for (let i = 0; i < a.length; i += CHUNK) o.push(a.slice(i, i + CHUNK)); return o; };

async function metasFor(ids) {
  const out = [];
  for (const part of chunks(ids.map(String))) {
    try { const [r] = await pool.query("SELECT * FROM seo_meta WHERE entity_type = 'product' AND entity_id IN (?)", [part]); out.push(...r); } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') throw e; }
  }
  return out;
}

/** Current products and seo_meta rows for the ids and skus of a file, in a few batched queries. */
async function lookupFor(parsed) {
  const { ids, skus } = keysOf(parsed);
  const products = new Map();
  for (const part of chunks(ids)) { const [r] = await pool.query('SELECT * FROM products WHERE id IN (?)', [part]); r.forEach(p => products.set(p.id, p)); }
  for (const part of chunks(skus)) { const [r] = await pool.query('SELECT * FROM products WHERE sku IN (?)', [part]); r.forEach(p => products.set(p.id, p)); }
  const list = [...products.values()];
  return makeLookup(list, await metasFor(list.map(p => p.id)));
}

const FILTERS = {
  missing_title: "(p.meta_title IS NULL OR p.meta_title = '' OR p.meta_title LIKE '%| AR Trade' OR p.meta_title LIKE '%| AR Trade International')",
  missing_desc: "(p.meta_desc IS NULL OR p.meta_desc = '' OR p.meta_desc LIKE '%Genuine, fast delivery.')",
  noindex: 'p.noindex = 1',
  missing_gtin: "(p.gtin IS NULL OR p.gtin = '')"
};

export function mountSeoCsvRoutes(router, guard) {
  const G = guard('seo.manage');

  router.get('/seo/export.csv', G, wrap(async (req, res) => {
    const cond = [], args = [];
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) { const l = like(q); cond.push('(p.name LIKE ? OR p.sku LIKE ? OR p.part LIKE ? OR p.brand LIKE ?)'); args.push(l, l, l, l); }
    const cat = String(req.query.cat || '').trim();
    if (cat) { cond.push('p.category_id = ?'); args.push(cat); }
    const f = FILTERS[String(req.query.filter || '')];
    if (f) cond.push(f);
    const [products] = await pool.query(`SELECT p.* FROM products p ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY p.id LIMIT ${MAX_ROWS}`, args);
    const metas = new Map((await metasFor(products.map(p => p.id))).map(m => [String(m.entity_id), m]));
    const csv = '﻿' + buildCsv(products.map(p => exportRow(p, metas.get(String(p.id)))), COLUMNS);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="seo-products-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' });
    res.send(csv);
  }));

  const parsedOr400 = csv => { try { return parseChecked(csv); } catch (e) { if (e instanceof CsvError) throw fail(e.status, e.message); throw e; } };

  router.post('/seo/import/preview', G, wrap(async (req, res) => {
    const csv = req.body?.csv;
    const parsed = parsedOr400(csv);
    const plan = planImport(parsed, await lookupFor(parsed));
    const { rows, truncated } = previewRows(plan);
    res.json({ ok: true, token: tokenOf(csv), counts: plan.counts, rows, warnings: parsed.warnings, ...(truncated ? { note: truncated } : {}) });
  }));

  router.post('/seo/import/apply', G, wrap(async (req, res) => {
    const csv = req.body?.csv;
    if (!tokenOk(csv, req.body?.token)) throw fail(400, 'Preview this exact file first: the file does not match the preview');
    const parsed = parsedOr400(csv);
    const plan = planImport(parsed, await lookupFor(parsed));
    const todo = plan.rows.filter(r => !r.errors.length && r.changes.length).slice(0, MAX_ROWS);
    const { saveManual } = await import('./seoSave.js');
    const who = String(req.staff?.name || '');
    let applied = 0, failed = 0;
    const errors = [];
    try {
      for (const r of todo) {
        try {
          const out = await saveManual(pool, 'product', r.id, r.manual, { who, source: 'csv' });
          if (out?.ok) applied++; else { failed++; errors.push({ line: r.line, id: r.id, error: (out?.errors || ['Not saved']).join('; ') }); }
        } catch (e) { failed++; errors.push({ line: r.line, id: r.id, error: String(e?.message || e).slice(0, 300) }); }
      }
    } finally { await bustSeo(); }
    res.json({ ok: true, applied, failed, errors });
  }));
}
