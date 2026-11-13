import { useCallback, useRef, useState } from 'react';

/** [busy, run]: `run(fn)` runs an async action once at a time. A second click while it is still running is ignored, so a save cannot be sent twice. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(async fn => {
    if (lock.current) return undefined;
    lock.current = true; setBusy(true);
    try { return await fn(); } finally { lock.current = false; setBusy(false); }
  }, []);
  return [busy, run];
}
