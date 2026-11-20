import { useCallback, useEffect, useMemo, useState } from 'react';
import { adm } from '../adminApi.js';
import { putJson } from '../pages/seo/seoModel.js';

const STORE = 'https://artradeinternational.com';
/** Absolute address of the live page (the admin shares the host with the store in dev). */
export const liveUrl = url => (/^https?:/i.test(url || '') ? url : (import.meta.env.DEV ? window.location.origin : STORE) + (url || '/'));

/** Loads one item's SEO data and keeps the editable copy, the dirty flag and the save call. */
export function useSeoItem(type, id, onChanged) {
  const base = `/seo/item/${type}/${id}`;
  const [data, setData] = useState(null);
  const [manual, setManual] = useState({});
  const [images, setImages] = useState([]);
  const [snap, setSnap] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, lines }
  const apply = useCallback(d => {
    const m = { secondaryKeywords: [], faq: [], robotsIndex: true, robotsFollow: true, ...d.manual };
    setData(d); setManual(m); setImages(d.images || []); setSnap(JSON.stringify([m, d.images || []]));
  }, []);
  useEffect(() => {
    let stale = false;
    setData(null); setLoadErr(''); setMsg(null);
    adm.get(base).then(d => { if (!stale) apply(d); }).catch(e => { if (!stale) setLoadErr(e.message); });
    return () => { stale = true; };
  }, [base, apply]);
  const set = useCallback(patch => { setMsg(null); setManual(m => ({ ...m, ...patch })); }, []);
  const dirty = useMemo(() => !!data && JSON.stringify([manual, images]) !== snap, [data, manual, images, snap]);
  const save = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await putJson(base, { manual, images });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, lines: r.errors }); return; }
    setSnap(JSON.stringify([manual, images]));
    setData(d => ({ ...d, score: { ...d.score, score: r.data.score ?? d.score?.score, issues: r.data.issues || d.score?.issues }, resolved: r.data.resolved ?? d.resolved }));
    setMsg({ ok: true, lines: ['SEO saved.'] });
    onChanged?.();
  };
  return { data, manual, set, images, setImages, dirty, save, busy, msg, loadErr, setData };
}
