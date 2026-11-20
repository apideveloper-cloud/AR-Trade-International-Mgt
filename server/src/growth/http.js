// One HTTP client for every outside call of the Search & Growth console: timeout, retry with backoff on network errors / 429 / 5xx,
// Retry-After respected (capped), and every call recorded in integration_logs (host + path without the query string, status, time, error;
// never headers or bodies, so no secret is stored). fetch can be replaced in tests with setFetch().
import { pool } from '../db.js';

let doFetch = (...a) => fetch(...a);
export const setFetch = f => { doFetch = f || ((...a) => fetch(...a)); };
let sleep = ms => new Promise(r => setTimeout(r, ms));
export const setSleep = f => { sleep = f || (ms => new Promise(r => setTimeout(r, ms))); };

export async function ensureIntegrationTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS integration_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    integration VARCHAR(30) NOT NULL, action VARCHAR(60) NOT NULL DEFAULT '', method VARCHAR(8) NOT NULL DEFAULT '', target VARCHAR(300) NOT NULL DEFAULT '',
    status SMALLINT NOT NULL DEFAULT 0, ok TINYINT(1) NOT NULL DEFAULT 0, ms INT NOT NULL DEFAULT 0, attempt TINYINT NOT NULL DEFAULT 1, error VARCHAR(300) NOT NULL DEFAULT '',
    KEY idx_il_at (at), KEY idx_il_int (integration, at), KEY idx_il_ok (ok, at))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS growth_integrations (
    k VARCHAR(30) NOT NULL PRIMARY KEY, status VARCHAR(20) NOT NULL DEFAULT 'not_connected', account VARCHAR(200) NOT NULL DEFAULT '',
    last_sync TIMESTAMP NULL DEFAULT NULL, last_error VARCHAR(300) NOT NULL DEFAULT '', meta JSON NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
}

export async function logCall(row) {
  try {
    await pool.query('INSERT INTO integration_logs (integration, action, method, target, status, ok, ms, attempt, error) VALUES (?,?,?,?,?,?,?,?,?)',
      [row.integration, String(row.action || '').slice(0, 60), row.method || '', String(row.target || '').slice(0, 300), row.status || 0, row.ok ? 1 : 0, row.ms || 0, row.attempt || 1, String(row.error || '').slice(0, 300)]);
  } catch { /* logging never breaks the call */ }
}
const targetOf = u => { try { const x = new URL(u); return x.host + x.pathname; } catch { return String(u).split('?')[0]; } };

/** callApi({ integration, action, url, method, headers, body, timeoutMs, retries }) -> { ok, status, data, text, error } (never throws). */
export async function callApi(o) {
  const method = (o.method || 'GET').toUpperCase(), retries = o.retries ?? 2, timeoutMs = o.timeoutMs || 15000;
  let last = { ok: false, status: 0, data: null, text: '', error: 'No attempt made' };
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const t0 = Date.now();
    let wait = 0;
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
      const res = await doFetch(o.url, { method, headers: o.headers, body: o.body, signal: ctl.signal, redirect: 'follow' }).finally(() => clearTimeout(timer));
      const text = await res.text();
      let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      const ok = res.status >= 200 && res.status < 300;
      const error = ok ? '' : (data?.error?.message || data?.error_description || data?.error || data?.message || text.slice(0, 200) || 'HTTP ' + res.status);
      last = { ok, status: res.status, data, text, error: typeof error === 'string' ? error : JSON.stringify(error).slice(0, 200) };
      if (res.status === 429 || res.status >= 500) { const ra = Number(res.headers?.get?.('retry-after')); wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** (attempt - 1); }
    } catch (e) {
      last = { ok: false, status: 0, data: null, text: '', error: e.name === 'AbortError' ? 'Timed out after ' + timeoutMs / 1000 + ' s' : String(e.message || e) };
      wait = 500 * 2 ** (attempt - 1);
    }
    await logCall({ integration: o.integration, action: o.action, method, target: targetOf(o.url), status: last.status, ok: last.ok, ms: Date.now() - t0, attempt, error: last.error });
    if (last.ok || !wait || attempt > retries) break;
    await sleep(wait);
  }
  return last;
}

export async function getIntegration(k) {
  const [r] = await pool.query('SELECT status, account, last_sync, last_error, meta FROM growth_integrations WHERE k = ?', [k]);
  if (!r.length) return { status: 'not_connected', account: '', last_sync: null, last_error: '', meta: {} };
  let meta = r[0].meta; if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
  return { ...r[0], meta: meta || {} };
}
export async function setIntegration(k, patch) {
  const n = { ...(await getIntegration(k)), ...patch };
  await pool.query('INSERT INTO growth_integrations (k, status, account, last_sync, last_error, meta) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status = VALUES(status), account = VALUES(account), last_sync = VALUES(last_sync), last_error = VALUES(last_error), meta = VALUES(meta)',
    [k, n.status, String(n.account || '').slice(0, 200), n.last_sync || null, String(n.last_error || '').slice(0, 300), JSON.stringify(n.meta || {})]);
}
