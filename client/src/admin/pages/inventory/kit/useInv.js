import { useCallback, useEffect, useState } from 'react';
import { invApi } from '../../../adminApi.js';

/** GET an inventory API path (null = skip). Returns { data, err, loading, reload }; stale responses are ignored. */
export function useInv(path) {
  const [st, setSt] = useState({ data: null, err: '', loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (path == null) { setSt({ data: null, err: '', loading: false }); return undefined; }
    let stale = false;
    invApi.get(path).then(d => { if (!stale) setSt({ data: d, err: '', loading: false }); }).catch(e => { if (!stale) setSt({ data: null, err: e.message, loading: false }); });
    return () => { stale = true; };
  }, [path, n]);
  return { ...st, reload: useCallback(() => setN(x => x + 1), []) };
}

/** Every vendor (for drop-downs). */
export function useVendors() { const v = useInv('/vendors'); return v.data?.items || []; }
