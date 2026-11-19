import { pool } from '../db.js';
import { state } from './state.js';

/** Creates / upgrades the backup tables, loads the saved backup folder and marks runs that died with the server as Failed. */
export async function ensureBackupTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scope ENUM('db','files') NOT NULL DEFAULT 'db',
    file VARCHAR(120) NOT NULL,
    kind ENUM('auto','manual') NOT NULL,
    status ENUM('Running','Done','Failed') NOT NULL DEFAULT 'Running',
    size_bytes BIGINT NOT NULL DEFAULT 0,
    tables_n INT NOT NULL DEFAULT 0,
    rows_n BIGINT NOT NULL DEFAULT 0,
    sig VARCHAR(80) NOT NULL DEFAULT '',
    ms INT NOT NULL DEFAULT 0,
    error VARCHAR(300) NOT NULL DEFAULT '',
    by_name VARCHAR(120) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_scope_kind_created (scope, kind, created_at)
  )`);
  await pool.query('CREATE TABLE IF NOT EXISTS backup_config (k VARCHAR(40) PRIMARY KEY, v VARCHAR(500) NOT NULL)'); // not the public settings table: a server path must never leave the admin API
  const [cols] = await pool.query("SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'backup_log'");
  const have = new Set(cols.map(r => r.c));
  if (!have.has('scope')) await pool.query("ALTER TABLE backup_log ADD COLUMN scope ENUM('db','files') NOT NULL DEFAULT 'db' AFTER id");
  if (!have.has('dir')) await pool.query("ALTER TABLE backup_log ADD COLUMN dir VARCHAR(500) NOT NULL DEFAULT '' AFTER file");
  if (!have.has('sig')) await pool.query("ALTER TABLE backup_log ADD COLUMN sig VARCHAR(80) NOT NULL DEFAULT '' AFTER rows_n");
  const [[cfg]] = await pool.query("SELECT v FROM backup_config WHERE k = 'dir'").then(r => (r[0].length ? r : [[null]]));
  if (cfg?.v) state.dir = cfg.v;
  await pool.query("UPDATE backup_log SET status = 'Failed', error = 'The server stopped while this backup was running' WHERE status = 'Running' AND created_at < (NOW() - INTERVAL 30 MINUTE)");
}
