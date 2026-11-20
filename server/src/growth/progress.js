// Progress of long background checks (structured data check, price check): kept in memory because the job runner and the API run in
// the same process. The admin pages poll getProgress(key) to draw a progress bar with a percentage.
const state = new Map();

/** A new run starts. total may be 0 while it is still unknown. */
export function startProgress(key, total = 0, label = '') {
  state.set(key, { running: true, done: 0, total: Number(total) || 0, label, startedAt: Date.now(), finishedAt: null });
}
/** done of total items are finished (total optional: only given once it is known). */
export function setProgress(key, done, total) {
  const s = state.get(key); if (!s) return;
  s.done = Math.max(0, Number(done) || 0);
  if (total !== undefined && Number.isFinite(Number(total))) s.total = Number(total);
}
export function endProgress(key) {
  const s = state.get(key); if (!s) return;
  s.running = false; s.finishedAt = Date.now(); if (s.total > 0) s.done = s.total;
}
/** { running, done, total, percent (0..100 or null when the total is unknown), label, startedAt, finishedAt } or an idle answer. */
export function getProgress(key) {
  const s = state.get(key);
  if (!s) return { running: false, done: 0, total: 0, percent: null, label: '', startedAt: null, finishedAt: null };
  const percent = s.running ? (s.total > 0 ? Math.min(99, Math.floor((s.done / s.total) * 100)) : null) : 100;
  return { running: s.running, done: s.done, total: s.total, percent, label: s.label, startedAt: s.startedAt, finishedAt: s.finishedAt };
}
export const KEYS = ['schema_check', 'price_check'];
