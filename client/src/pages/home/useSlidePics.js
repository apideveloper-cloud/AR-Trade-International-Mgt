import { useEffect, useState } from 'react';
import { useStore } from '../../store.jsx';

const isLocal = url => !url || url.startsWith('/') || url.startsWith('./');

/** Does this picture load? Local paths are assumed fine; remote ones are probed (5 s), so a dead host never leaves a blank slide. */
export function useImgOk(url) {
  const [ok, setOk] = useState(isLocal(url) ? true : null);
  useEffect(() => {
    if (isLocal(url)) { setOk(true); return undefined; }
    let dead = false;
    const im = new Image();
    const t = setTimeout(() => { if (!dead) setOk(false); }, 5000);
    im.onload = () => { if (!dead) { clearTimeout(t); setOk(true); } };
    im.onerror = () => { if (!dead) { clearTimeout(t); setOk(false); } };
    im.src = url;
    return () => { dead = true; clearTimeout(t); };
  }, [url]);
  return ok;
}

/** A good local photo for a slide: the best product of the category the slide links to. */
export function useSlidePic(href) {
  const { products } = useStore();
  const cat = (String(href || '').match(/\/shop\/([\w-]+)/) || [])[1];
  const list = products.filter(p => p.img && (!cat || cat === 'all' || p.cat === cat));
  const score = p => (p.price ? 3 : 0) + (p.popular ? 2 : 0) + (p.old > p.price ? 1 : 0);
  return (list.sort((a, b) => score(b) - score(a))[0] || products.find(p => p.img) || {}).img || '';
}
