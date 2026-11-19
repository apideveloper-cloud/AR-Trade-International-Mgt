import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { DEFAULT_DIR, KEEP_DAYS, NAME, SCOPES, dirOf } from './config.js';
import { removeFile } from './files.js';
import { state } from './state.js';

/** True when a stray file in the backup folder should be tidied up (an old .part, or a backup the log no longer knows). */
export const isStrayFile = (f, known, ageMs) => (f.endsWith('.part') && ageMs > 3600e3) || (NAME.test(f) && !known.has(f) && ageMs > KEEP_DAYS * 864e5);

/** Copies older than KEEP_DAYS go (the newest finished copy of each kind always stays); failed runs go after a week. */
export async function prune() {
  let removed = 0;
  for (const scope of SCOPES) for (const kind of ['auto', 'manual']) {
    const [[keep]] = await pool.query("SELECT id FROM backup_log WHERE scope = ? AND kind = ? AND status = 'Done' ORDER BY created_at DESC, id DESC LIMIT 1", [scope, kind]);
    const [old] = await pool.query("SELECT id, file, dir FROM backup_log WHERE scope = ? AND kind = ? AND status = 'Done' AND created_at < (NOW() - INTERVAL ? DAY) AND id <> ?", [scope, kind, KEEP_DAYS, keep?.id || 0]);
    for (const o of old) { await removeFile(o.file, dirOf(o)); await pool.query('DELETE FROM backup_log WHERE id = ?', [o.id]); removed++; }
  }
  const [bad] = await pool.query("SELECT id, file, dir FROM backup_log WHERE status = 'Failed' AND created_at < (NOW() - INTERVAL ? DAY)", [KEEP_DAYS]);
  for (const o of bad) { await removeFile(o.file, dirOf(o)); await pool.query('DELETE FROM backup_log WHERE id = ?', [o.id]); removed++; }
  // files in the folder that the log no longer knows (an old run that crashed half way) are tidied up too
  const [known] = await pool.query('SELECT file FROM backup_log');
  const set = new Set(known.map(k => k.file));
  for (const dir of new Set([state.dir, DEFAULT_DIR])) if (fs.existsSync(dir)) {
    for (const f of await fs.promises.readdir(dir)) {
      const full = path.join(dir, f);
      const age = Date.now() - (await fs.promises.stat(full)).mtimeMs;
      if (isStrayFile(f, set, age)) await fs.promises.rm(full, { force: true });
    }
  }
  return removed;
}
