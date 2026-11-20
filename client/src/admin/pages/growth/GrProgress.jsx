import { useCallback, useEffect, useRef, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthD.js';

/**
 * Watches a background check (key: 'schema_check' or 'price_check').
 * begin() is called right after the owner presses "Check now"; the hook then polls the server every second,
 * shows the percentage, and calls onDone() once the run has finished. It also picks up a run that is already going when the page opens.
 */
export function useCheckProgress(key, onDone) {
  const [p, setP] = useState(null);
  const [watching, setWatching] = useState(false);
  const since = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;

  const poll = useCallback(async () => {
    const r = await adm.get('/growth/progress?key=' + key).catch(() => null);
    if (!r) return { stop: false };
    setP(r);
    const finished = !r.running && r.finishedAt && r.finishedAt >= since.current;
    const gaveUp = !r.running && Date.now() - since.current > 60000; // the run never started: stop waiting
    return { stop: !!(finished || gaveUp), finished: !!finished };
  }, [key]);

  useEffect(() => { // a run may already be going when the page opens
    let off = false;
    adm.get('/growth/progress?key=' + key).then(r => { if (!off && r?.running) { since.current = 0; setP(r); setWatching(true); } }).catch(() => {});
    return () => { off = true; };
  }, [key]);

  useEffect(() => {
    if (!watching) return undefined;
    let off = false, t;
    const loop = async () => {
      const r = await poll();
      if (off) return;
      if (r.stop) { setWatching(false); if (r.finished && done.current) done.current(); return; }
      t = setTimeout(loop, 1000);
    };
    t = setTimeout(loop, 400);
    return () => { off = true; clearTimeout(t); };
  }, [watching, poll]);

  const begin = () => { since.current = Date.now() - 3000; setP(null); setWatching(true); };
  return { p, watching, begin };
}

/** A graphical progress bar with the percentage written on it. p = the object from useCheckProgress().p. */
export function ProgressBar({ p, watching, noun = 'pages' }) {
  const tr = useT();
  if (!watching) return null;
  const running = !!p?.running;
  const pct = running && Number.isFinite(p.percent) ? p.percent : 0; // 0% until the first numbers arrive
  const detail = running && p.total > 0 ? tr('{n} of {total} {noun} checked', { n: (p.done || 0).toLocaleString(), total: p.total.toLocaleString(), noun: tr(noun) }) : tr('Getting ready…');
  return (
    <div className="adgr-prog" role="status" aria-live="polite">
      <div className="adgr-prog-top"><span>{tr('Check in progress')}</span><b className="adgr-prog-pct">{pct}%</b></div>
      <div className="adgr-prog-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-valuetext={tr('{n} percent', { n: pct })} aria-label={tr('Check progress')}>
        <div className="adgr-prog-fill" style={{ width: pct + '%' }}><span className="adgr-prog-in">{pct >= 8 ? pct + '%' : ''}</span></div>
      </div>
      <div className="adgr-prog-sub">{detail}</div>
    </div>
  );
}
