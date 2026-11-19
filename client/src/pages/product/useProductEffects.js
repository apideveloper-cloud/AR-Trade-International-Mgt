import { useEffect, useState } from 'react';
import { api } from '../../api.js';

/** Title, description and keywords for SPA navigation (crawlers get the same values server-side). Restored when leaving the product. */
export function useProductSeo(p, full) {
  useEffect(() => {
    if (!p) return undefined;
    document.title = full?.metaTitle || `${p.name} | AR Trade International`;
    const undo = [];
    const set = (n, v) => {
      if (!v) return;
      let m = document.head.querySelector(`meta[name="${n}"]`);
      if (m) { const was = m.content; undo.push(() => { m.content = was; }); } else { m = document.createElement('meta'); m.name = n; document.head.appendChild(m); undo.push(() => m.remove()); }
      m.content = v;
    };
    set('description', full?.metaDesc); set('keywords', full?.metaKeywords);
    return () => { undo.forEach(f => f()); document.title = 'AR Trade International'; }; // leaving the product must not leave its description behind on the next page
  }, [p, full]);
}

/** True once the element has scrolled out above the viewport (shows the sticky buy bar). */
export function useScrolledPast(ref, deps) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return past;
}

/** True once the element has scrolled into view (starts the "How to order" animation); resets when deps change. */
export function useRevealed(ref, deps) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return shown;
}

/** Full record (image gallery, description, meta) for a product number; null while loading or on error. */
export function useFullRecord(pid) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    setFull(null);
    if (!pid) return undefined;
    let live = true;
    api.get('/products/' + pid).then(d => { if (live) setFull(d); }).catch(() => { if (live) setFull(null); });
    return () => { live = false; };
  }, [pid]);
  return full;
}

/** Reviews for a product (reloaded when the user changes) plus a `reload` for after a review is submitted. */
export function useReviews(pid, userId) {
  const [rv, setRv] = useState(null);
  const reload = () => (pid ? api.get(`/products/${pid}/reviews`).then(setRv).catch(() => setRv(null)) : null);
  useEffect(() => {
    setRv(null);
    if (!pid) return undefined;
    let live = true;
    api.get(`/products/${pid}/reviews`).then(d => { if (live) setRv(d); }).catch(() => { if (live) setRv(null); });
    return () => { live = false; };
  }, [pid, userId]);
  return [rv, reload];
}
