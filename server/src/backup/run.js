import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { pool } from '../db.js';
import { fail } from '../util.js';
import { DEFAULT_DIR, SCOPES, UPLOADS, backupFileName } from './config.js';
import { dumpDb, verifyDb } from './dump.js';
import { list } from './list.js';
import { prune } from './prune.js';
import { setProg, state } from './state.js';
import { scanUploads, verifyTar } from './uploads.js';

/** Packs the uploads folder into `target`, checks it, and returns the number of files. */
async function packUploads(target, scan) {
  let doneBytes = 0;
  setProg(2, 'Packing uploaded files');
  await tar.c({ gzip: { level: 6 }, file: target, cwd: UPLOADS, portable: true, filter: (p, st) => { doneBytes += Number(st?.size) || 0; setProg(2 + (doneBytes / Math.max(scan.bytes, 1)) * 90, 'Packing uploaded files'); return true; } }, ['.']);
  setProg(94, 'Checking the archive');
  await verifyTar(target, scan.n);
  return scan.n;
}

/** Makes one backup now. scope 'db' or 'files'; kind 'auto' (scheduler) or 'manual' (a person pressed the button). */
export async function runBackup(scope, kind, by = '') {
  if (!SCOPES.includes(scope)) throw fail(400, 'Unknown backup type');
  if (state.running) throw fail(409, `A ${state.running === 'db' ? 'database' : 'uploads'} backup is already running. Please wait for it to finish.`);
  state.running = scope;
  state.prog = { scope, kind, pct: 0, phase: 'Starting', startedAt: Date.now() };
  const dir = state.dir;
  const file = backupFileName(scope, kind);
  const t0 = Date.now();
  let logId = null;
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    let scan = null;
    if (scope === 'files') {
      scan = await scanUploads();
      if (kind === 'auto') { // nothing new since the last copy: do not waste disk on an identical archive
        const [[last]] = await pool.query("SELECT sig FROM backup_log WHERE scope = 'files' AND status = 'Done' ORDER BY created_at DESC, id DESC LIMIT 1");
        if (last && last.sig === scan.sig) { state.lastSkip.files = Date.now(); return null; }
      }
    }
    const [r] = await pool.query('INSERT INTO backup_log (scope, file, dir, kind, status, by_name) VALUES (?,?,?,?,?,?)', [scope, file, dir === DEFAULT_DIR ? '' : dir, kind, 'Running', by || (kind === 'auto' ? 'Automatic' : '')]);
    logId = r.insertId;
    const full = path.join(dir, file);
    let tables = 0, rows = 0;
    if (scope === 'db') {
      ({ tables, rows } = await dumpDb(full + '.part'));
      await verifyDb(full + '.part');
    } else {
      rows = await packUploads(full + '.part', scan);
    }
    await fs.promises.rename(full + '.part', full);
    setProg(98, 'Finishing');
    const size = (await fs.promises.stat(full)).size;
    await pool.query("UPDATE backup_log SET status = 'Done', size_bytes = ?, tables_n = ?, rows_n = ?, sig = ?, ms = ? WHERE id = ?", [size, tables, rows, scan?.sig || '', Date.now() - t0, logId]);
    await prune().catch(e => console.error('backup prune:', e.message));
    return (await list()).find(x => x.id === logId);
  } catch (e) {
    await fs.promises.rm(path.join(dir, file + '.part'), { force: true }).catch(() => {});
    if (logId) await pool.query("UPDATE backup_log SET status = 'Failed', error = ?, ms = ? WHERE id = ?", [String(e.message || e).slice(0, 300), Date.now() - t0, logId]).catch(() => {});
    console.error(`[backup] ${scope} ${kind} backup failed:`, e.message);
    throw e.status ? e : fail(500, 'The backup failed: ' + String(e.message || e).slice(0, 160));
  } finally {
    state.running = null;
    state.prog = null;
  }
}
