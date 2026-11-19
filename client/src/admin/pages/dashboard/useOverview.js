import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';

/** Periods offered by the dashboard picker: [days, label]. */
export const PERIODS = [[7, 'Last 7 days'], [15, 'Last 15 days'], [30, 'Last 30 days'], [90, 'Last 3 months'], [180, 'Last 6 months'], [365, 'Last 12 months'], [1, 'Today']];

const readRange = () => { try { const v = Number(localStorage.getItem('dash_range')); return PERIODS.some(p => p[0] === v) ? v : 30; } catch { return 30; } };

/** Loads /overview for the picked period (remembered in localStorage); a slower, older answer never overwrites a newer one. */
export function useOverview(asOf) {
  const [o, setO] = useState(null);
  const [err, setErr] = useState('');
  const [range, setRange] = useState(readRange);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stale = false;
    setBusy(true); setErr('');
    const qs = new URLSearchParams({ range });
    if (asOf) qs.set('asOf', asOf);
    adm.get('/overview?' + qs).then(r => { if (!stale) setO(r); }).catch(e => { if (!stale) setErr(e.message); }).finally(() => { if (!stale) setBusy(false); });
    return () => { stale = true; };
  }, [asOf, range]);
  const pick = v => { setRange(v); try { localStorage.setItem('dash_range', String(v)); } catch { /* storage unavailable */ } };
  return { o, err, range, busy, pick };
}
