// Admin routes of Search & Growth Phase 5 (Schema): the JSON-LD validator findings and a manual run.
import { pool } from '../db.js';
import { fail, wrap } from '../util.js';
import { enqueue } from '../growth/jobs.js';
import { CODES, schemaSummary } from '../growth/schemaCheck.js';

export const RUN_GAP_MS = 60000;
export const KINDS = ['home', 'shop', 'category', 'brand', 'blog', 'post', 'service', 'info', 'product'];
let lastRun = 0; // manual run: once per minute per process
export const _resetRunGap = () => { lastRun = 0; };
const iso = d => (d ? new Date(d).toISOString() : null);
const int = (v, d, min, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d; };

/** Validates the query string. Returns { severity, code, kind, limit, page } or throws 400. */
export function parseFilters(q = {}) {
  const severity = String(q.severity || ''), code = String(q.code || ''), kind = String(q.kind || '');
  if (severity && !['error', 'warning'].includes(severity)) throw fail(400, 'Severity must be error or warning');
  if (code && !CODES[code]) throw fail(400, 'Unknown issue type');
  if (kind && !KINDS.includes(kind)) throw fail(400, 'Unknown page kind');
  return { severity, code, kind, limit: int(q.limit, 15, 1, 100), page: int(q.page, 1, 1, 1e6) };
}

export function mountGrowthSchemaRoutes(router, guard) {
  const R = guard('seo.manage');

  router.get('/growth/schema-checks', R, wrap(async (req, res) => {
    const f = parseFilters(req.query);
    const sum = await schemaSummary(async (sql, p) => (await pool.query(sql, p))[0]);
    const where = [], args = [];
    if (f.severity) { where.push('i.severity = ?'); args.push(f.severity); }
    if (f.code) { where.push('i.code = ?'); args.push(f.code); }
    if (f.kind) { where.push('i.kind = ?'); args.push(f.kind); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    let total = 0, rows = [], page = f.page, pages = 1;
    try {
      const [[c]] = await pool.query(`SELECT COUNT(*) AS n FROM growth_schema_issues i ${w}`, args);
      total = Number(c?.n || 0);
      pages = Math.max(1, Math.ceil(total / f.limit)); page = Math.min(f.page, pages);
      [rows] = await pool.query(`SELECT i.url, i.kind, i.product_id, i.type, i.severity, i.code, i.detail, i.found_at, p.name FROM growth_schema_issues i LEFT JOIN products p ON p.id = i.product_id ${w} ORDER BY i.severity = 'error' DESC, i.found_at DESC, i.id DESC LIMIT ? OFFSET ?`, [...args, f.limit, (page - 1) * f.limit]);
    } catch { total = 0; rows = []; } // tables are created by the first run
    res.json({
      lastRun: sum.lastRun, counts: sum.counts,
      byCode: sum.byCode.map(b => ({ ...b, hint: CODES[b.code]?.hint || '' })),
      rows: rows.map(r => ({ url: r.url, kind: r.kind, productId: r.product_id ?? null, productName: r.name || '', type: r.type, severity: r.severity, code: r.code, label: CODES[r.code]?.label || r.code, hint: CODES[r.code]?.hint || '', detail: r.detail, foundAt: iso(r.found_at) })),
      total, page, pages
    });
  }));

  router.post('/growth/schema-checks/run', R, wrap(async (req, res) => {
    if (Date.now() - lastRun < RUN_GAP_MS) throw fail(429, 'A check was started a moment ago. Wait a minute and try again');
    lastRun = Date.now();
    const id = await enqueue('schema_check', {}, { dedupeKey: 'schema_check_manual', maxAttempts: 2 });
    res.json(id ? { queued: true } : { queued: false, message: 'A check is already waiting' });
  }));
}
