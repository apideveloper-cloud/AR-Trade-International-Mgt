// 404 monitor: real 404s of storefront pages are counted in memory and written to seo_404_log in batches (never one query per request).
const MAX_PATH = 500, MAX_REF = 300, MAX_KEYS = 2000, FLUSH_MS = 20000, PRUNE_MS = 3600e3, KEEP_DAYS = 90, KEEP_ROWS = 10000;
const IGNORED = /^\/(favicon\.ico|robots\.txt|sitemap\.xml|apple-touch-icon[^/]*\.png)$/;
let pending = new Map(); // path -> { hits, referrer }
let timer = null, lastPrune = 0, flushing = false;

/** '/Old/Page/?a=1#x' -> '/Old/Page' (case kept, query and hash removed, max 500 chars); '' when it is not a path. */
export function normalisePath(p) {
  let s = String(p ?? '').trim();
  if (!s.startsWith('/')) return '';
  s = s.replace(/[?#].*$/, '');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  // eslint-disable-next-line no-control-regex -- control characters never belong in a logged path
  if (/[\u0000-\u001f]/.test(s)) return '';
  return (s || '/').slice(0, MAX_PATH);
}
/** Referrer without query or hash, max 300 chars ('' when empty). */
export function cleanReferrer(r) {
  const s = String(r ?? '').trim().replace(/[?#].*$/, '');
  // eslint-disable-next-line no-control-regex -- see above
  return /[\u0000-\u001f]/.test(s) ? '' : s.slice(0, MAX_REF);
}

/** Counts one 404. Returns true when it was recorded. Pure in-memory aggregation. */
export function logNotFound(path, referrer) {
  const p = normalisePath(path);
  if (!p || IGNORED.test(p.toLowerCase())) return false;
  const cur = pending.get(p);
  if (cur) { cur.hits++; if (!cur.referrer) cur.referrer = cleanReferrer(referrer); return true; }
  if (pending.size >= MAX_KEYS) pending.delete(pending.keys().next().value); // drop the oldest
  pending.set(p, { hits: 1, referrer: cleanReferrer(referrer) });
  return true;
}
/** Test helpers. */
export const pendingSize = () => pending.size;
export const peekPending = () => new Map(pending);
export const resetPending = () => { pending = new Map(); };

/** SQL + params of the multi-row upsert for a Map; null when empty. */
export function buildUpsert(map) {
  if (!map || !map.size) return null;
  const params = [];
  for (const [path, v] of map) params.push(path, v.hits, v.referrer || '');
  const sql = 'INSERT INTO seo_404_log (path, hits, referrer) VALUES ' + [...map.keys()].map(() => '(?,?,?)').join(',') + ' ON DUPLICATE KEY UPDATE hits = hits + VALUES(hits), last_seen = NOW()';
  return { sql, params };
}
/** The prune statements: rows not seen for 90 days, then the least-hit oldest rows above the 10,000 cap (`count` = current row count). */
export function buildPrune(count) {
  const out = [{ sql: 'DELETE FROM seo_404_log WHERE last_seen < (NOW() - INTERVAL ? DAY)', params: [KEEP_DAYS] }];
  if (Number(count) > KEEP_ROWS) out.push({ sql: 'DELETE FROM seo_404_log ORDER BY hits ASC, last_seen ASC LIMIT ?', params: [Number(count) - KEEP_ROWS] });
  return out;
}

/** Writes everything counted so far in one statement and clears the Map. Never throws. */
export async function flushNow(pool) {
  if (flushing || !pending.size) return 0;
  flushing = true;
  const batch = pending;
  pending = new Map();
  try {
    const q = buildUpsert(batch);
    await pool.query(q.sql, q.params);
    return batch.size;
  } catch (e) {
    if (e?.code !== 'ER_NO_SUCH_TABLE') console.error('404 log flush failed:', e?.message || e);
    return 0;
  } finally { flushing = false; }
}
async function prune(pool) {
  try {
    const [[c]] = await pool.query('SELECT COUNT(*) n FROM seo_404_log');
    for (const q of buildPrune(c?.n)) await pool.query(q.sql, q.params);
  } catch (e) { if (e?.code !== 'ER_NO_SUCH_TABLE') console.error('404 log prune failed:', e?.message || e); }
}

/** Starts the 20 s flusher (once). The timer is unref'd so it never keeps the process alive. */
export function startNotFoundFlush(pool) {
  if (timer) return timer;
  timer = setInterval(async () => {
    try {
      await flushNow(pool);
      if (Date.now() - lastPrune >= PRUNE_MS) { lastPrune = Date.now(); await prune(pool); }
    } catch (e) { console.error('404 log timer failed:', e?.message || e); }
  }, FLUSH_MS);
  timer.unref?.();
  return timer;
}
export function stopNotFoundFlush() { if (timer) clearInterval(timer); timer = null; }
export const isFlushing = () => !!timer;
