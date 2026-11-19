// Backup settings and the small pure helpers (no database, no state) shared by the other backup modules.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The server folder (this file lives in server/src/backup). */
export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_DIR = path.resolve(SERVER_ROOT, 'backups');
export const UPLOADS = path.resolve(SERVER_ROOT, 'uploads');
export const INTERVAL_H = Math.max(1, Number(process.env.BACKUP_EVERY_HOURS) || 6);
export const KEEP_DAYS = Math.max(1, Number(process.env.BACKUP_KEEP_DAYS) || 7);
export const SKIP = new Set(['backup_log', 'rate_hits']); // the log itself and throw-away counters are not worth saving
export const BATCH = 500;
export const NAME = /^ar-(backup|uploads)-[\w-]+\.(sql|tar)\.gz$/;
export const SCOPES = ['db', 'files'];

/** Bangladesh-time stamp (UTC+6) used in backup file names, e.g. 2026-11-18_153000. */
export function stamp(now = Date.now()) {
  const d = new Date(now + 6 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** The folder a log row's copy lives in; a row with no folder was made in the default one. */
export const dirOf = r => r.dir || DEFAULT_DIR;

/** True when `p` is `root` itself or somewhere below it. */
export function isInside(p, root) {
  const r = path.relative(root, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

/** The file name a scope's backup gets. */
export const backupFileName = (scope, kind, now) => (scope === 'db' ? `ar-backup-${stamp(now)}-${kind}.sql.gz` : `ar-uploads-${stamp(now)}-${kind}.tar.gz`);
