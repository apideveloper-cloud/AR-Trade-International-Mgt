import { useEffect, useState } from 'react';

/** The value, but only after it has stopped changing for `ms` milliseconds (for search boxes that call the server). */
export function useDebounced(v, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}
