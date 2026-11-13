import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads one thing from the API: { data, setData, error, loading, reload }.
 * - `loader()` returns a promise; it runs on mount, when `deps` change and whenever `reload()` is called.
 * - An answer that arrives after a newer request was made (or after the page was left) is ignored.
 * - `reload()` keeps the old data on screen while it fetches, and resolves when the new answer has been handled.
 * - `initial` is what `data` is before the first answer.
 */
export function useApiData(loader, deps = [], initial = null) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const latest = useRef(loader);
  latest.current = loader;

  const reload = useCallback(() => {
    const id = ++seq.current;
    setLoading(true);
    return Promise.resolve()
      .then(() => latest.current())
      .then(d => { if (id === seq.current) { setData(d); setError(''); } })
      .catch(e => { if (id === seq.current) setError(e.message); })
      .finally(() => { if (id === seq.current) setLoading(false); });
  }, []);

  useEffect(() => { reload(); return () => { seq.current++; }; }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, setData, error, setError, loading, reload };
}
