// Reading the backup log: the list, the status page figures and the path of one file for download.
import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../db.js';
import { fail } from '../util.js';
import { DEFAULT_DIR, INTERVAL_H, KEEP_DAYS, NAME, SCOPES, dirOf } from './config.js';
import { hasDeleteCode } from './deleteCode.js';
import { state } from './state.js';

/** The newest 400 backup log rows in the shape the console shows. */
export async function list() {
  const [rows] = await pool.query('SELECT id, scope, file, dir, kind, status, size_bytes, tables_n, rows_n, ms, error, by_name, created_at FROM backup_log ORDER BY created_at DESC, id DESC LIMIT 400');
  return rows.map(r => ({ id: r.id, scope: r.scope, file: r.file, kind: r.kind, status: r.status, size: Number(r.size_bytes), tables: r.tables_n, rows: Number(r.rows_n), ms: r.ms, error: r.error, by: r.by_name, at: r.created_at, exists: r.status === 'Done' && NAME.test(r.file) && fs.existsSync(path.join(dirOf(r), r.file)) }));
}

/** Per-scope figures (last copy, next automatic run, copies and bytes on disk). */
function scopeFigures(items, s) {
  const lastAuto = items.find(i => i.scope === s && i.kind === 'auto' && i.status === 'Done');
  const lastDone = items.find(i => i.scope === s && i.status === 'Done');
  const lastSkip = state.lastSkip;
  const base = Math.max(lastAuto ? new Date(lastAuto.at).getTime() : 0, s === 'files' ? lastSkip.files : 0);
  const next = base ? new Date(base + INTERVAL_H * 3600e3) : new Date();
  return { last: lastDone?.at || null, lastKind: lastDone?.kind || null, lastSize: lastDone?.size || 0, nextAuto: next < new Date() ? new Date() : next, copies: items.filter(i => i.scope === s && i.exists).length, bytes: items.filter(i => i.scope === s && i.exists).reduce((t, i) => t + i.size, 0), unchangedAt: s === 'files' && lastSkip.files ? new Date(lastSkip.files) : null };
}

/** Everything the Backups page shows. */
export async function status() {
  const items = await list();
  const per = {};
  for (const s of SCOPES) per[s] = scopeFigures(items, s);
  const prog = state.prog;
  return { deleteCodeSet: await hasDeleteCode(), intervalHours: INTERVAL_H, keepDays: KEEP_DAYS, running: state.running, progress: prog ? { scope: prog.scope, kind: prog.kind, pct: prog.pct, phase: prog.phase, seconds: Math.round((Date.now() - prog.startedAt) / 1000) } : null, scopes: per, totalBytes: per.db.bytes + per.files.bytes, dir: state.dir, defaultDir: DEFAULT_DIR, items };
}

/** The full path and name of a finished backup, for download. */
export async function fileOf(id) {
  const [[r]] = await pool.query('SELECT file, dir, status FROM backup_log WHERE id = ?', [id]);
  if (!r || r.status !== 'Done' || !NAME.test(r.file)) throw fail(404, 'Backup not found');
  const full = path.join(dirOf(r), r.file);
  if (!fs.existsSync(full)) throw fail(404, 'The backup file is no longer on the server');
  return { full, name: r.file };
}
