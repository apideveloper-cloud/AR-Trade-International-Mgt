// The mutable state of the backup system, in one object so every module sees the same values.
import { DEFAULT_DIR } from './config.js';

export const state = {
  dir: DEFAULT_DIR, // where NEW backups go; the Master Admin can change it (copies already made stay where they were made)
  running: null, // 'db' | 'files' | null
  lastSkip: { files: 0 }, // when an automatic uploads run last found nothing new
  prog: null // live progress of the run in flight, shown as a percentage bar on the Backups page
};
export const backupDir = () => state.dir;
export const isRunning = () => state.running;
/** Moves the progress bar forward (never backwards). */
export const setProg = (pct, phase) => { const p = state.prog; if (p) { p.pct = Math.max(p.pct, Math.min(100, Math.round(pct))); p.phase = phase; } };
