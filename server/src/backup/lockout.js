// The wrong-code counter behind the delete code (pure: the caller passes the counter object and, for tests, the clock).
export const MAX_WRONG = 5;
export const WINDOW_MS = 600000;
export const LOCK_MS = 600000;

/** Returns the "try again" message while the lock is active, otherwise ''. */
export function checkLock(w, now = Date.now()) {
  return now < w.until ? `Too many wrong codes. Try again in ${Math.ceil((w.until - now) / 60000)} minutes.` : '';
}

/** Counts one wrong code. Returns the { status, message } to answer with (429 once the fifth wrong try locks deleting). */
export function recordWrong(w, now = Date.now()) {
  if (now - w.since > WINDOW_MS) { w.n = 0; w.since = now; }
  if (++w.n >= MAX_WRONG) { w.until = now + LOCK_MS; w.n = 0; return { status: 429, message: 'Too many wrong codes. Deleting is locked for 10 minutes.' }; }
  return { status: 403, message: 'That delete code is not right.' };
}
