// Admin SEO controls (permission seo.manage): templates and defaults, robots.txt text, live preview of a title / description.
import { pool } from '../db.js';
import { fail, parseJson, wrap } from '../util.js';
import { previewInput, MAX_FOR } from './seoValidate.js';

const KEY = 'seo';
// loaded on demand so this file works (and its tests run) before the sibling modules exist
const tpl = () => import('../seoTemplate.js');
const cfg = () => import('../seoSettings.js');

async function bustSeo() { // clears the server's SEO cache when ../seo.js exports a hook for it
  try { const m = await import('../seo.js'); if (typeof m.bustSeo === 'function') await m.bustSeo(); } catch { /* optional */ }
}
async function readStored() {
  const [rows] = await pool.query('SELECT v FROM settings WHERE k = ?', [KEY]);
  return rows.length ? parseJson(rows[0].v) : null;
}
/** Best effort history entry of a settings change (verification tokens redacted). Never throws. */
async function record(before, after, who) {
  try {
    const { redactSettings } = await import('./seoHistoryMap.js');
    const { recordHistory } = await import('./seoHistory.js');
    await recordHistory(pool, { type: 'settings', id: 'seo', action: 'settings', source: 'settings', before: redactSettings(before), after: redactSettings(after), who });
  } catch (e) { console.error('seo history failed:', e.message); }
}
const save = value => pool.query('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', [KEY, JSON.stringify(value)]);

export function mountSeoRoutes(router, guard) {
  router.get('/seo/settings', guard('seo.manage'), wrap(async (req, res) => {
    const { SEO_DEFAULTS, mergeSeoSettings } = await cfg();
    const { TEMPLATE_VARS } = await tpl();
    const stored = await readStored();
    res.json({ settings: stored ? mergeSeoSettings(stored) : SEO_DEFAULTS, defaults: SEO_DEFAULTS, vars: TEMPLATE_VARS, flags: { stored: !!stored } });
  }));

  router.put('/seo/settings', guard('seo.manage'), wrap(async (req, res) => {
    const { normaliseSeoSettings } = await cfg();
    const { settings, errors } = normaliseSeoSettings(req.body?.settings);
    if (errors?.length) return res.status(400).json({ error: errors[0], errors });
    const { mergeSeoSettings } = await cfg();
    let prev = null;
    try { prev = mergeSeoSettings(await readStored()); } catch { /* history only */ }
    await save(settings);
    if (prev) await record(prev, settings, req.staff?.name);
    await bustSeo();
    res.json({ ok: true, settings });
  }));

  router.put('/seo/robots', guard('seo.manage'), wrap(async (req, res) => {
    const { mergeSeoSettings, validateRobotsTxt } = await cfg();
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const v = validateRobotsTxt(text);
    if (!v.ok) return res.status(400).json({ error: v.errors?.[0] || 'Invalid robots.txt', errors: v.errors || [] });
    const cur = mergeSeoSettings(await readStored());
    const next = { ...cur, robots: { ...(cur.robots || {}), customTxt: text } };
    await save(next);
    await record(cur, next, req.staff?.name);
    await bustSeo();
    res.json({ ok: true, settings: next });
  }));

  router.post('/seo/preview', guard('seo.manage'), wrap(async (req, res) => {
    let inp;
    try { inp = previewInput(req.body); } catch (e) { throw fail(400, e.message); }
    const { renderTemplate, varsFor, sampleVars, DEFAULT_TEMPLATES } = await tpl();
    const { mergeSeoSettings } = await cfg();
    const settings = mergeSeoSettings(await readStored());
    const max = MAX_FOR[inp.field];
    const saved = settings.templates?.[inp.kind]?.[inp.field] ?? DEFAULT_TEMPLATES?.[inp.kind]?.[inp.field] ?? '';
    const template = inp.template ?? String(saved).slice(0, 300);
    let entity = null;
    if (inp.id) {
      const sql = { product: ['SELECT * FROM products WHERE id = ?', 1], category: ['SELECT * FROM categories WHERE id = ?', 1], brand: ['SELECT * FROM brands WHERE id = ? OR slug = ?', 2] }[inp.kind];
      if (sql) { const [rows] = await pool.query(sql[0], Array(sql[1]).fill(inp.id)); entity = rows[0] || null; }
    }
    const vars = entity ? varsFor(inp.kind, entity, settings) : sampleVars(inp.kind);
    const text = renderTemplate(template, vars, { max });
    res.json({ text, length: text.length, max, maxFor: max, sample: !entity, vars });
  }));
}
