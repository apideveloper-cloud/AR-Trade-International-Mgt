import { useCallback, useEffect, useState } from 'react';
import { fld } from '../../../adminApi.js';

const NONE = []; // one shared empty list, so the map is not redrawn on every render

/** Live team data: refreshed every 30 s, plus the GPS route of the picked person (stale answers are dropped). */
export function useTeam(sel) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [got, setGot] = useState({ sel: null, rows: [] }); // the route together with the person it belongs to
  const load = useCallback(() => fld.get('/team').then(r => { setD(r); setErr(''); }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!sel) return undefined;
    let stale = false;
    fld.get('/team/' + sel + '/route').then(r => { if (!stale) setGot({ sel, rows: r }); }).catch(() => { if (!stale) setGot({ sel, rows: [] }); });
    return () => { stale = true; };
  }, [sel, d?.updatedAt]);
  const route = sel && got.sel === sel ? got.rows : NONE; // never the route of the person picked before, while the new one is loading
  return { d, err, route, load };
}
