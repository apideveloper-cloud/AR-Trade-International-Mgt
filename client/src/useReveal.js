import { useLayoutEffect, useRef } from 'react';

/** Plays an entrance animation the first time the element scrolls into view: adds "rvl" at once (hidden start state) and "seen" when seen.
 *  Without IntersectionObserver, or when the visitor prefers reduced motion, nothing is hidden. */
export default function useReveal(margin = '-8% 0px') {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    el.classList.add('rvl');
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('seen'); io.disconnect(); } }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return ref;
}
