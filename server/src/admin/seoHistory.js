// Admin > SEO change history and revert (permission seo.manage). Recording is best effort and never fails the real save.
import { pool } from '../db.js';
import { fail, parseJson, wrap } from '../util.js';
import { like } from '../adminHelpers.js';
import { manualFrom } from './seoItemMap.js';
import { isAutoTitle, isAutoDesc } from '../seoHelpers.js';
import { loadItem, imagesOf, saveManual } from './seoSave.js';
import { changeSlug } from './seoItems.js';
import {
  REVERTABLE, buildEntry, snapshot, planRevert, redactSettings, unredactSettings, fieldsOf, safeParse
} from './seoHistoryMap.js';

const RETENTION_DAYS = 365;
const COLS = 'entity_type, entity_id, action, source, summary, before_json, after_json, changed_by';
const rowArgs = e => [e.entity_type, e.entity_id, e.action, e.source, e.summary, e.before_json, e.after_json, e.changed_by];

let pruneStarted = false;
/** Deletes history older than 365 days once a day (unref'd timers, same pattern as audit.js). Started lazily by the first insert. */
export function startHistoryPrune(db = pool) {
  if (pruneStarted) return;
  pruneStarted = true;
  const run = () => db.query('DELETE FROM seo_history WHERE changed_at < DATE_SUB(NOW(), INTERVAL ? DAY)', [RETENTION_DAYS]).catch(e => console.error('seo history prune failed:', e.message));
  setTimeout(run, 90000).unref();
  setInterval(run, 24 * 3600e3).unref();
}

/** Stores one entry ({ type, id, action, source, before, after, who }). Returns the new row id, or null (nothing changed or the insert failed). Never throws. */
export async function recordHistory(db, args) {
  try {
    const e = buildEntry(args);
    if (!e) return null;
    const [r] = await db.query(`INSERT INTO seo_history (${COLS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, rowArgs(e));
    startHistoryPrune();
    return r?.insertId ?? null;
  } catch (err) { console.error('seo history not saved:', err.message); return null; }
}

/** Many entries in ONE multi-row INSERT. Entries with no change are skipped. Never throws. */
export async function recordMany(db, list) {
  try {
    const rows = (list || []).map(buildEntry).filter(Boolean);
    if (!rows.length) return 0;
    await db.query(`INSERT INTO seo_history (${COLS}) VALUES ?`, [rows.map(rowArgs)]);
    startHistoryPrune();
    return rows.length;
  } catch (err) { console.error('seo history not saved:', err.message); return 0; }
}

async function bustSeo() { try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ } }

const NAME_SQL = {
  product: 'SELECT id AS k, name AS n FROM products WHERE id IN (?)',
  category: 'SELECT id AS k, title AS n FROM categories WHERE id IN (?)',
  brand: 'SELECT slug AS k, name AS n FROM brands WHERE slug IN (?)',
  blog: 'SELECT slug AS k, title AS n FROM blog_posts WHERE slug IN (?)',
  page: 'SELECT slug AS k, title AS n FROM site_pages WHERE slug IN (?)'
};
/** Map 'type:id' -> current display name for the items that still exist, one query per type. */
async function namesFor(rows) {
  const by = new Map();
  for (const r of rows) if (NAME_SQL[r.entity_type]) { if (!by.has(r.entity_type)) by.set(r.entity_type, new Set()); by.get(r.entity_type).add(r.entity_id); }
  const out = new Map();
  await Promise.all([...by].map(async ([type, ids]) => {
    try { const [found] = await pool.query(NAME_SQL[type], [[...ids]]); for (const f of found) out.set(`${type}:${f.k}`, String(f.n ?? '')); } catch (e) { console.error('seo history names:', e.message); }
  }));
  return out;
}

async function currentSnapshot(it) {
  const manual = manualFrom(it.type, it.row, it.meta, { isAutoTitle, isAutoDesc });
  const alts = it.type === 'product' ? (await imagesOf(pool, it.row.id)).map(i => ({ src: i.src, alt: i.alt })) : undefined;
  return snapshot(it.type, manual, { slug: it.type === 'category' || it.type === 'brand' ? undefined : it.row.slug, imageAlts: alts });
}

const seoCfg = () => import('../seoSettings.js');
async function readSettings() {
  const { mergeSeoSettings } = await seoCfg();
  const [rows] = await pool.query('SELECT v FROM settings WHERE k = ?', ['seo']);
  let stored = null;
  try { stored = rows.length ? parseJson(rows[0].v) : null; } catch { stored = null; }
  return mergeSeoSettings(stored);
}

export function mountSeoHistoryRoutes(router, guard) {
  const G = guard('seo.manage');

  router.get('/seo/history', G, wrap(async (req, res) => {
    const size = Math.min(100, Math.max(10, parseInt(req.query.size, 10) || 25));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const cond = [], args = [];
    const type = String(req.query.type || '').slice(0, 20), id = String(req.query.id || '').slice(0, 80), source = String(req.query.source || '').slice(0, 20);
    if (type) { cond.push('entity_type = ?'); args.push(type); }
    if (id) { cond.push('entity_id = ?'); args.push(id); }
    if (source) { cond.push('source = ?'); args.push(source); }
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) { const l = like(q); cond.push('(summary LIKE ? OR changed_by LIKE ? OR entity_id LIKE ?)'); args.push(l, l, l); }
    const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) n FROM seo_history ${where}`, args);
    const [rows] = await pool.query(`SELECT * FROM seo_history ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, size, (page - 1) * size]);
    const names = await namesFor(rows);
    res.json({
      total: Number(n),
      rows: rows.map(r => {
        const isSettings = r.entity_type === 'settings', key = `${r.entity_type}:${r.entity_id}`;
        const exists = isSettings || names.has(key);
        return {
          id: r.id, at: r.changed_at ? new Date(r.changed_at).toISOString() : null, who: r.changed_by, type: r.entity_type, entityId: r.entity_id,
          name: isSettings ? 'SEO settings' : names.get(key) || '', action: r.action, source: r.source, summary: r.summary, fields: fieldsOf(r),
          canRevert: REVERTABLE.includes(r.action) && r.reverted_by == null && exists, reverted: r.reverted_by != null
        };
      })
    });
  }));

  router.post('/seo/history/:id/revert', G, wrap(async (req, res) => {
    const hid = parseInt(req.params.id, 10);
    if (!hid) throw fail(404, 'History entry not found');
    const [[row]] = await pool.query('SELECT * FROM seo_history WHERE id = ?', [hid]);
    if (!row) throw fail(404, 'History entry not found');
    if (row.reverted_by != null) throw fail(400, 'This change was already reverted');
    if (!REVERTABLE.includes(row.action)) throw fail(400, 'This kind of entry cannot be reverted');
    const entry = { before: safeParse(row.before_json), after: safeParse(row.after_json) };
    const force = req.body?.force === true;
    const who = req.staff?.name || '';
    const conflictOut = plan => res.status(409).json({ error: 'Some values were changed after this edit. Revert anyway to overwrite them.', conflicts: plan.conflicts });
    let newId = null, fields = [];

    if (row.entity_type === 'settings') {
      const { normaliseSeoSettings } = await seoCfg();
      const cur = await readSettings();
      const plan = planRevert(entry, redactSettings(cur));
      if (!plan.ok && !force) return conflictOut(plan);
      const next = { ...cur };
      for (const [k, v] of Object.entries(plan.apply)) next[k] = unredactSettings(v, cur[k]);
      const { settings, errors } = normaliseSeoSettings(next);
      if (errors?.length) throw fail(400, errors[0]);
      await pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', ['seo', JSON.stringify(settings)]);
      fields = Object.keys(plan.apply);
      newId = await recordHistory(pool, { type: 'settings', id: 'seo', action: 'revert', source: 'revert', who, before: redactSettings(cur), after: redactSettings(settings) });
    } else {
      const it = await loadItem(pool, row.entity_type, row.entity_id);
      if (!it) throw fail(404, 'This item no longer exists, so the change cannot be reverted');
      const plan = planRevert(entry, await currentSnapshot(it));
      if (!plan.ok && !force) return conflictOut(plan);
      fields = Object.keys(plan.apply);
      if (row.action === 'slug') {
        if (!plan.apply.slug) throw fail(400, 'Nothing to revert');
        const r = await changeSlug(pool, it.type, it.id, plan.apply.slug, who, { source: 'revert', action: 'revert' });
        newId = r.historyId ?? null;
      } else {
        const { imageAlts, slug, ...manual } = plan.apply;
        const out = await saveManual(pool, it.type, it.id, manual, { who, images: imageAlts, source: 'revert', action: 'revert' });
        if (!out.ok) return res.status(out.status || 400).json({ error: out.errors?.[0] || 'Not reverted', errors: out.errors });
        newId = out.historyId ?? null;
      }
    }
    await pool.query('UPDATE seo_history SET reverted_by = ? WHERE id = ?', [newId ?? 0, hid]);
    await bustSeo();
    res.json({ ok: true, reverted: { fields } });
  }));
}
