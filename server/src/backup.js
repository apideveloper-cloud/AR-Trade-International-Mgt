// Backups: the whole database AND the uploads folder (product images, CVs, vouchers), each an automatic copy every 6 hours plus a manual
// "Back up now" from the admin console. Copies older than 7 days are deleted automatically (the newest copy of each kind is always kept).
// Files live in server/backups/ (never served over the web) and every run is recorded in the backup_log table.
// The code is split into src/backup/*; this file keeps the original import path and exports.
export { DEFAULT_DIR, INTERVAL_H, KEEP_DAYS } from './backup/config.js';
export { backupDir, isRunning } from './backup/state.js';
export { ensureBackupTable } from './backup/table.js';
export { setDir } from './backup/setDir.js';
export { prune } from './backup/prune.js';
export { runBackup } from './backup/run.js';
export { list, status, fileOf } from './backup/list.js';
export { hasDeleteCode, setDeleteCode, deleteBackup } from './backup/deleteCode.js';
export { startBackupSchedule, stopBackupSchedule } from './backup/schedule.js';
