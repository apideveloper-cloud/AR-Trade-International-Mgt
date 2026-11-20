// Job handler of the backlink checker: a weekly run over every tracked page. With nothing to check it returns { skipped } (no error).
import { registerHandler, registerRecurring } from './jobs.js';
import { ensureBacklinks } from './backlinks.js';
import { runLinkCheck } from './linkCheck.js';
import { pool } from '../db.js';

export async function linkCheckJob() {
  await ensureBacklinks();
  const [[c]] = await pool.query("SELECT COUNT(*) AS n FROM growth_backlinks WHERE status <> 'Rejected' AND url <> ''");
  if (!Number(c?.n)) return { skipped: true, reason: 'No tracked pages with an address' };
  return runLinkCheck({});
}
registerHandler('link_check', linkCheckJob);
registerRecurring('link_check', 7 * 24 * 3600e3);
