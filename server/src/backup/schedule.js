import { pool } from '../db.js';
import { INTERVAL_H, KEEP_DAYS, SCOPES } from './config.js';
import { prune } from './prune.js';
import { runBackup } from './run.js';
import { state } from './state.js';

/** True when the last copy (or the last "nothing changed" skip) is at least `intervalH` hours old. `m` is minutes since the last copy, or null. */
export const isDue = (m, sinceSkipMin, intervalH = INTERVAL_H) => Math.min(m === null ? Infinity : m, sinceSkipMin) >= intervalH * 60;

let firstTimer = null, tickTimer = null;

/** Clears the schedule's timers (for a clean shutdown). */
export function stopBackupSchedule() {
  clearTimeout(firstTimer); clearInterval(tickTimer);
  firstTimer = tickTimer = null;
}

/** Every few minutes: is a copy older than the interval? Make one (database first, then the uploads). Once an hour: delete copies older than 7 days. */
export function startBackupSchedule() {
  let lastPrune = 0;
  const due = async scope => {
    const [[r]] = await pool.query("SELECT TIMESTAMPDIFF(MINUTE, MAX(created_at), NOW()) m FROM backup_log WHERE scope = ? AND kind = 'auto' AND status = 'Done'", [scope]);
    const sinceSkip = scope === 'files' && state.lastSkip.files ? (Date.now() - state.lastSkip.files) / 60000 : Infinity;
    return isDue(r.m, sinceSkip);
  };
  const tick = async () => {
    try {
      if (state.running) return;
      for (const scope of SCOPES) {
        if (state.running || !(await due(scope))) continue;
        console.log(`[backup] automatic ${scope === 'db' ? 'database' : 'uploads'} backup (every ${INTERVAL_H} h)`);
        await runBackup(scope, 'auto').catch(e => console.error(`[backup] ${scope}:`, e.message));
      }
      if (Date.now() - lastPrune > 3600e3) { lastPrune = Date.now(); const n = await prune(); if (n) console.log(`[backup] removed ${n} copies older than ${KEEP_DAYS} days`); }
    } catch (e) { console.error('[backup] schedule:', e.message); }
  };
  stopBackupSchedule();
  firstTimer = setTimeout(tick, 90 * 1000); // shortly after start, so a restart never skips a due backup
  tickTimer = setInterval(tick, 5 * 60 * 1000);
  firstTimer.unref(); tickTimer.unref();
}
