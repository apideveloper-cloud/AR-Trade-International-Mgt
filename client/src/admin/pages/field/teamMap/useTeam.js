import { useCallback, useEffect, useState } from 'react';
import { fld } from '../../../adminApi.js';

/** Live team data: refreshed every 30 s, plus the GPS route of the picked person (stale answers are dropped). */
export function useTeam(sel) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [route, setRoute] = useState([]);
  const load = useCallback(() => fld.get('/team').then(r => { setD(r); setErr(''); }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!sel) { setRoute([]); return undefined; }
    let stale = false;
    fld.get('/team/' + sel + '/route').then(r => { if (!stale) setRoute(r); }).catch(() => { if (!stale) setRoute([]); });
    return () => { stale = true; };
  }, [sel, d?.updatedAt]);
  return { d, err, route, load };
}
