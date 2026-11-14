import { useCallback, useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';

/** Loads one order. State belongs to an id: after the id changes the old order is never shown, and an answer for an older id is ignored. */
export function useOrder(id) {
  const [st, setSt] = useState({ id, o: null, err: '' });
  const cur = st.id === id ? st : { id, o: null, err: '' };
  const patch = useCallback(p => setSt(s => (s.id === id ? { ...s, ...p } : s)), [id]); // a late callback of a previous order finds another id and does nothing
  useEffect(() => {
    let off = false;
    setSt({ id, o: null, err: '' });
    adm.get('/orders/' + id).then(n => { if (!off) setSt({ id, o: n, err: '' }); }).catch(e => { if (!off) setSt({ id, o: null, err: e.message }); });
    return () => { off = true; };
  }, [id]);
  const setO = useCallback(n => patch({ o: n }), [patch]);
  const setErr = useCallback(m => patch({ err: m }), [patch]);
  const reload = useCallback(() => adm.get('/orders/' + id).then(setO).catch(() => {}), [id, setO]);
  return { o: cur.o, err: cur.err, setO, setErr, reload };
}
