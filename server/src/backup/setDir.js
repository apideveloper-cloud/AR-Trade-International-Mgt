import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { fail } from '../util.js';
import { SERVER_ROOT, UPLOADS, isInside } from './config.js';
import { state } from './state.js';

/** Master Admin: where new backups are written. Must be an absolute path the server can write to, and never inside the uploads folder or the program's own files. */
export async function setDir(input) {
  const raw = String(input || '').trim();
  if (!raw) throw fail(400, 'Enter a folder path');
  if (raw.length > 400 || /[\0\r\n]/.test(raw)) throw fail(400, 'That path is not valid');
  if (!path.isAbsolute(raw)) throw fail(400, 'Use a full path, for example D:\\Backups\\AR or /var/backups/artrade');
  const dir = path.resolve(raw);
  const app = SERVER_ROOT;
  if (isInside(dir, UPLOADS)) throw fail(400, 'The backup folder cannot be inside the uploads folder (the uploads backup would copy itself)');
  if (isInside(dir, path.join(app, 'src')) || isInside(dir, path.join(app, 'node_modules')) || isInside(dir, path.resolve(app, '../client'))) throw fail(400, 'Choose a folder outside the program files');
  if (state.running) throw fail(409, 'A backup is running. Change the folder after it finishes.');
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    const probe = path.join(dir, '.write-test-' + process.pid);
    await fs.promises.writeFile(probe, 'ok'); await fs.promises.rm(probe, { force: true });
  } catch (e) { throw fail(400, 'The server cannot write to that folder (' + (e.code || 'error') + '). Check the path and permissions.'); }
  await pool.query("INSERT INTO backup_config (k, v) VALUES ('dir', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [dir]);
  state.dir = dir;
  return dir;
}
