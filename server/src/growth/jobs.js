// Database job queue for the Search & Growth console: a job survives a restart, is claimed exactly once (UPDATE ... WHERE status = 'Queued'),
// retries with exponential backoff, can carry a dedupe key (an active job with the same key is not added twice) and recurring jobs are
// re-queued by the runner. One runner per process; a Running job whose lock is older than STALE_MS is put back in the queue.
import { pool } from '../db.js';

export const STALE_MS = 10 * 60 * 1000;
const handlers = new Map(), recurring = new Map();
let timer = null, busy = false, stopping = false;

export async function ensureJobs() {
  await pool.query(`CREATE TABLE IF NOT EXISTS growth_jobs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(40) NOT NULL, payload JSON NULL, status VARCHAR(10) NOT NULL DEFAULT 'Queued',
    attempts SMALLINT NOT NULL DEFAULT 0, max_attempts SMALLINT NOT NULL DEFAULT 5, run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMP NULL DEFAULT NULL, dedupe_key VARCHAR(120) NULL, last_error VARCHAR(300) NOT NULL DEFAULT '', result JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY uq_gj_dedupe (dedupe_key), KEY idx_gj_due (status, run_at), KEY idx_gj_type (type, status))`);
}
export const registerHandler = (type, fn) => handlers.set(type, fn);
/** Run a job of this type every ms (queued by the runner when none is waiting or running). */
export const registerRecurring = (type, everyMs, payload = {}) => recurring.set(type, { everyMs, payload });

/** Adds a job. With dedupeKey, an active (Queued/Running) job with that key makes this a no-op (returns null); a finished one is replaced. */
export async function enqueue(type, payload = {}, o = {}) {
  const runAt = o.runAt ? new Date(o.runAt) : new Date();
  if (o.dedupeKey) {
    await pool.query("DELETE FROM growth_jobs WHERE dedupe_key = ? AND status IN ('Done','Failed')", [o.dedupeKey]);
    const [r] = await pool.query('INSERT IGNORE INTO growth_jobs (type, payload, run_at, max_attempts, dedupe_key) VALUES (?,?,?,?,?)', [type, JSON.stringify(payload), runAt, o.maxAttempts || 5, o.dedupeKey]);
    return r.affectedRows ? r.insertId : null;
  }
  const [r] = await pool.query('INSERT INTO growth_jobs (type, payload, run_at, max_attempts) VALUES (?,?,?,?)', [type, JSON.stringify(payload), runAt, o.maxAttempts || 5]);
  return r.insertId;
}

export const backoffMs = attempts => Math.min(6 * 3600e3, 30e3 * 2 ** Math.max(0, attempts - 1));

const FREE_KEY = "dedupe_key = IF(dedupe_key IS NULL, NULL, CONCAT('done:', id))"; // a finished job gives its dedupe key back

/** Claims and runs at most one due job. Returns the job id or null. */
export async function runOnce() {
  await pool.query("UPDATE growth_jobs SET status = 'Queued', locked_at = NULL WHERE status = 'Running' AND locked_at < ?", [new Date(Date.now() - STALE_MS)]);
  const [due] = await pool.query("SELECT id, type, payload, attempts, max_attempts FROM growth_jobs WHERE status = 'Queued' AND run_at <= NOW() ORDER BY run_at, id LIMIT 1");
  if (!due.length) return null;
  const j = due[0];
  const [c] = await pool.query("UPDATE growth_jobs SET status = 'Running', locked_at = NOW(), attempts = attempts + 1 WHERE id = ? AND status = 'Queued'", [j.id]);
  if (!c.affectedRows) return null; // another runner took it
  const attempts = j.attempts + 1;
  const fn = handlers.get(j.type);
  try {
    if (!fn) throw Object.assign(new Error('No handler for job type ' + j.type), { permanent: true });
    let payload = j.payload; if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
    const result = await fn(payload || {}, { id: j.id, attempts });
    await pool.query(`UPDATE growth_jobs SET status = 'Done', locked_at = NULL, last_error = '', result = ?, finished_at = NOW(), ${FREE_KEY} WHERE id = ?`, [JSON.stringify(result ?? null), j.id]);
  } catch (e) {
    const msg = String(e.message || e).slice(0, 300);
    if (e.permanent || attempts >= j.max_attempts) await pool.query(`UPDATE growth_jobs SET status = 'Failed', locked_at = NULL, last_error = ?, finished_at = NOW(), ${FREE_KEY} WHERE id = ?`, [msg, j.id]);
    else await pool.query("UPDATE growth_jobs SET status = 'Queued', locked_at = NULL, last_error = ?, run_at = ? WHERE id = ?", [msg, new Date(Date.now() + backoffMs(attempts)), j.id]);
  }
  return j.id;
}

export const FAILED_PAUSE_MS = 3600e3; // a recurring job that ran out of attempts is tried again at most once an hour (not every 15 s)
/** Queues every recurring job that has nothing waiting, running, recently done or recently failed. */
export async function queueRecurring() {
  for (const [type, r] of recurring) {
    const now = Date.now();
    const [x] = await pool.query("SELECT 1 FROM growth_jobs WHERE type = ? AND (status IN ('Queued','Running') OR (status = 'Done' AND finished_at > ?) OR (status = 'Failed' AND finished_at > ?)) LIMIT 1", [type, new Date(now - r.everyMs), new Date(now - Math.min(r.everyMs, FAILED_PAUSE_MS))]);
    if (!x.length) await enqueue(type, r.payload, { dedupeKey: 'rec:' + type });
  }
}

export const KEEP_DONE_MS = 14 * 86400e3, KEEP_FAILED_MS = 60 * 86400e3, KEEP_LOG_MS = 90 * 86400e3;
let lastPrune = 0;
/** Finished jobs and API log rows older than their retention are deleted (recurring jobs add hundreds of rows a day). At most once an hour. */
export async function pruneOld(now = Date.now()) {
  if (now - lastPrune < 3600e3) return;
  lastPrune = now;
  await pool.query("DELETE FROM growth_jobs WHERE status = 'Done' AND finished_at < ? LIMIT 5000", [new Date(now - KEEP_DONE_MS)]);
  await pool.query("DELETE FROM growth_jobs WHERE status = 'Failed' AND finished_at < ? LIMIT 5000", [new Date(now - KEEP_FAILED_MS)]);
  await pool.query('DELETE FROM integration_logs WHERE at < ? LIMIT 5000', [new Date(now - KEEP_LOG_MS)]);
}
export const _resetPrune = () => { lastPrune = 0; };

export async function tick() {
  if (busy || stopping) return;
  busy = true;
  try { await queueRecurring(); await pruneOld().catch(() => {}); for (let i = 0; i < 5 && !stopping; i++) if (!(await runOnce())) break; }
  catch (e) { console.error('growth jobs:', e.message); }
  finally { busy = false; }
}
export function startRunner(everyMs = 15000) {
  if (timer) return;
  stopping = false;
  timer = setInterval(tick, everyMs); timer.unref();
  setTimeout(tick, 5000).unref();
}
/** Called on SIGTERM: stop taking new jobs and wait (up to ms) for the one in progress. */
export async function stopRunner(ms = 8000) {
  stopping = true; if (timer) clearInterval(timer); timer = null;
  const end = Date.now() + ms; while (busy && Date.now() < end) await new Promise(r => setTimeout(r, 100));
}

export async function listJobs({ status = '', limit = 50 } = {}) {
  const [r] = await pool.query(`SELECT id, type, status, attempts, max_attempts, run_at, last_error, created_at, finished_at FROM growth_jobs ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT ?`, status ? [status, limit] : [limit]);
  return r;
}
export async function retryJob(id) { const [r] = await pool.query("UPDATE growth_jobs SET status = 'Queued', attempts = 0, run_at = NOW(), locked_at = NULL, last_error = '' WHERE id = ? AND status = 'Failed'", [id]); return r.affectedRows > 0; }
