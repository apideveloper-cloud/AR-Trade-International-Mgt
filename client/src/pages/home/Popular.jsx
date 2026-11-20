import { useEffect, useRef, useState } from 'react';
import ProductCard from '../../components/ProductCard.jsx';
import { useStore } from '../../store.jsx';
import SectionHead from './SectionHead.jsx';

const TABS = [['all', 'All'], ['toner', 'Laser toner'], ['copier-toner', 'Copier toner'], ['ink', 'Ink']];

/** Popular products rail with category tabs; auto-scrolls until hovered. */
export default function Popular() {
  const { products, content } = useStore();
  const L = content.labels;
  const [tab, setTab] = useState('all');
  const rail = useRef(null);
  const paused = useRef(false);
  const list = products.filter(p => p.popular && (tab === 'all' || p.cat === tab)).slice(0, 10);

  useEffect(() => {
    const t = setInterval(() => {
      const el = rail.current;
      if (!el || paused.current || document.hidden || !el.children.length) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      const w = el.children[0].offsetWidth + 14;
      el.scrollTo({ left: atEnd ? 0 : Math.round(el.scrollLeft / w + 1) * w, behavior: 'smooth' });
    }, 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="sec">
      <SectionHead kick={L.popKick} title={L.popTitle}>
        <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); rail.current?.scrollTo({ left: 0 }); }}>{l}</button>)}</div>
      </SectionHead>
      <div onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
        <div className="pop-rail" ref={rail}>{list.map((p, n) => <div key={p.id}><ProductCard p={p} priority={n < 4} /></div>)}</div>
      </div>
    </section>
  );
}
