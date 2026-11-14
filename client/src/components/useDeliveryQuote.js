import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

/** Asks the server for the delivery charge of a pin position (after a short pause, ignoring older answers).
 *  `retry` asks again for the last position after a failure. */
export function useDeliveryQuote(value, onChange) {
  const seq = useRef(0), timer = useRef(null), cb = useRef(onChange), last = useRef(null);
  const [q, setQ] = useState(value || null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  cb.current = onChange;

  const quote = useCallback((lat, lng) => {
    clearTimeout(timer.current);
    last.current = { lat, lng };
    const id = ++seq.current;
    setErr(''); setBusy(true);
    cb.current?.(null); // no price until the new point has one: an early submit asks for the pin instead of using the old one
    timer.current = setTimeout(async () => {
      try {
        const r = await api.post('/delivery/quote', { lat, lng });
        if (id !== seq.current) return;
        const nq = { lat, lng, km: r.km, fee: r.fee };
        setQ(nq); setBusy(false); cb.current?.(nq);
      } catch (e) {
        if (id !== seq.current) return;
        setBusy(false); setQ(null); cb.current?.(null);
        setErr(e?.message || 'Could not work out the delivery charge. Please try again.');
      }
    }, 350);
  }, []);

  const retry = useCallback(() => { if (last.current) quote(last.current.lat, last.current.lng); }, [quote]);

  useEffect(() => () => { clearTimeout(timer.current); seq.current++; }, []);

  return { q, err, busy, quote, retry };
}
