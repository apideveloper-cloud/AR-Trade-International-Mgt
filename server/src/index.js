// Entry point: checks the environment, prepares the database, then starts listening. The app itself is assembled in app.js.
import app from './app.js';
import { pool } from './db.js';
import { startAuditPrune } from './audit.js';
import { startMailWorker } from './mkt.js';
import { initPermissions } from './permissions.js';
import { ensureSchema } from './migrate.js';
import { startBackupSchedule } from './backup.js';
import { startRunner, stopRunner } from './growth/jobs.js';
import './growth/register.js'; // job handlers of the Search & Growth console

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24)) {
  console.error('Refusing to start: set a long random JWT_SECRET in server/.env (e.g. openssl rand -hex 32).');
  process.exit(1);
}

// role matrix: tables, staff.role migration and default grants must be ready before the first request
await ensureSchema().catch(e => { console.error('Schema upgrade failed:', e.message); process.exit(1); });
await initPermissions().catch(e => { console.error('Role matrix setup failed:', e.message); process.exit(1); });

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  console.log(`AR Trade API on http://localhost:${port}`);
  if (process.env.NODE_ENV === 'production' && !process.env.SITE_URL) console.warn('SITE_URL is not set: canonical links, the sitemap and emails will use the request Host header. Set SITE_URL=https://your-domain in server/.env.');
  startMailWorker();
  startAuditPrune(); // old log rows are deleted daily (AUDIT_KEEP_DAYS, default 365)
  startBackupSchedule(); // a full database backup every 6 hours (BACKUP_EVERY_HOURS)
  startRunner(); // Search & Growth job queue
});

// systemctl restart: finish the job in progress, then stop
process.on('SIGTERM', async () => { await stopRunner(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });

// retention: GPS breadcrumbs older than 90 days are of no use
const purge = () => pool.query('DELETE FROM field_track WHERE at < UTC_TIMESTAMP() - INTERVAL 90 DAY LIMIT 50000').catch(() => {});
setTimeout(purge, 60000).unref();
setInterval(purge, 24 * 3600000).unref();
