import { useEffect, useRef, useState } from 'react';

/** Full-screen viewer: wheel / buttons zoom, drag to pan, arrow keys switch views, Esc closes. */
export default function Lightbox({ img, name, views, start, onClose, onView }) {
  const [i, setI] = useState(start);
  const [z, setZ] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const reset = () => { setZ(1); setPos({ x: 0, y: 0 }); };
  const go = d => { setI(v => { const n = (v + d + views.length) % views.length; onView(n); return n; }); reset(); };
  const zoomBy = d => setZ(v => { const n = Math.max(1, Math.min(5, +(v + d).toFixed(2))); if (n === 1) setPos({ x: 0, y: 0 }); return n; });
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === '+' || e.key === '=') zoomBy(.5); else if (e.key === '-') zoomBy(-.5); };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const v = views[i];
  return (
    <div className="lbx" onClick={onClose} role="dialog" aria-modal="true" aria-label={name}>
      <div className="lbx-top" onClick={e => e.stopPropagation()}>
        <b>{name}</b><span>{v.k} · {i + 1}/{views.length}</span>
        <div className="lbx-tools">
          <button onClick={() => zoomBy(-.5)} title="Zoom out" aria-label="Zoom out">−</button><em>{Math.round(z * 100)}%</em><button onClick={() => zoomBy(.5)} title="Zoom in" aria-label="Zoom in">+</button>
          <button onClick={reset} title="Reset" aria-label="Reset">⟲</button><button onClick={onClose} title="Close (Esc)" aria-label="Close">✕</button>
        </div>
      </div>
      <button className="lbx-nav l" aria-label="Previous view" onClick={e => { e.stopPropagation(); go(-1); }}>‹</button>
      <button className="lbx-nav r" aria-label="Next view" onClick={e => { e.stopPropagation(); go(1); }}>›</button>
      <div className={'lbx-stage' + (z > 1 ? ' pan' : '')} onClick={e => e.stopPropagation()}
        onWheel={e => zoomBy(e.deltaY < 0 ? .3 : -.3)}
        onDoubleClick={() => (z > 1 ? reset() : setZ(2.5))}
        onPointerDown={e => { if (z > 1) { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId); } }}
        onPointerMove={e => { if (drag.current) setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
        onPointerUp={() => { drag.current = null; }}>
        <div className="lbx-img" style={{ backgroundImage: `url('${v.img || img}')`, transform: `translate(${pos.x}px,${pos.y}px) scale(${z * v.s})`, transformOrigin: v.o }} />
      </div>
      <div className="lbx-strip" onClick={e => e.stopPropagation()}>
        {views.map((x, n) => (
          <button key={x.k} aria-label={x.k} className={n === i ? 'on' : ''} onClick={() => { setI(n); onView(n); reset(); }}>
            <span style={{ backgroundImage: `url('${x.img || img}')`, backgroundSize: x.img ? 'contain' : `${x.s * 100}%`, backgroundPosition: x.img ? 'center' : x.o }} />
          </button>
        ))}
      </div>
      <span className="lbx-hint">Scroll to zoom · drag to pan · double-click to toggle · ← → to switch</span>
    </div>
  );
}
