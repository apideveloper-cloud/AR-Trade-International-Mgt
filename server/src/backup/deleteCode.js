// The delete code: deleting a backup cannot be undone. Once the Master Admin sets a delete code (kept only as a bcrypt hash in backup_config)
// every delete needs it; until then the console asks a plain Yes / No. Five wrong tries in ten minutes lock deleting for ten minutes.
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { fail } from '../util.js';
import { dirOf } from './config.js';
import { removeFile } from './files.js';
import { checkLock, recordWrong } from './lockout.js';

const WRONG = { n: 0, since: 0, until: 0 };

async function storedCodeHash() {
  const [[r]] = await pool.query("SELECT v FROM backup_config WHERE k = 'delete_code'").then(x => (x[0].length ? x : [[null]]));
  return r?.v || '';
}
export const hasDeleteCode = async () => !!(await storedCodeHash());

async function checkDeleteCode(code) {
  const hash = await storedCodeHash();
  if (!hash) return; // no delete code set: the Yes / No question in the console is the only safeguard
  const locked = checkLock(WRONG);
  if (locked) throw fail(429, locked);
  if (await bcrypt.compare(String(code || ''), hash)) { WRONG.n = 0; return; }
  const r = recordWrong(WRONG);
  throw fail(r.status, r.message);
}

/** Sets or changes the delete code. Changing an existing code needs the current one. */
export async function setDeleteCode(code, current) {
  const next = String(code || '');
  if (next.length < 6 || next.length > 60) throw fail(400, 'The delete code must be 6 to 60 characters.');
  if (await hasDeleteCode()) await checkDeleteCode(current);
  await pool.query("INSERT INTO backup_config (k, v) VALUES ('delete_code', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [await bcrypt.hash(next, 10)]);
}

/** Deletes one finished backup (file and log row), after the delete code check. */
export async function deleteBackup(id, code) {
  await checkDeleteCode(code);
  const [[r]] = await pool.query('SELECT file, dir, status FROM backup_log WHERE id = ?', [id]);
  if (!r) throw fail(404, 'Backup not found');
  if (r.status === 'Running') throw fail(409, 'This backup is still running');
  await removeFile(r.file, dirOf(r));
  await pool.query('DELETE FROM backup_log WHERE id = ?', [id]);
}
