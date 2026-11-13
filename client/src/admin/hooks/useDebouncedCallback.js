import { useCallback, useEffect, useRef } from 'react';

/** A function that runs `fn` once the caller has been quiet for `ms` milliseconds; a pending call is dropped when the component goes away. */
export function useDebouncedCallback(fn, ms = 300) {
  const timer = useRef(null);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), ms);
  }, [ms]);
}
