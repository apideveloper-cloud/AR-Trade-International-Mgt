import { useState } from 'react';

/** Thumbnail column + main stage (CSS background image with hover zoom) + prev/next/expand buttons. */
export default function Gallery({ p, views, view, setView, stock, off, onExpand }) {
  const [zoom, setZoom] = useState(null); // { x, y } while hovering the image
  const cur = views[Math.min(view, views.length - 1)];
  const curImg = cur.img || p.img;
  const step = d => setView(v => (v + d + views.length) % views.length);
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  const stop = fn => e => { e.stopPropagation(); fn(); };

  return (
    <div className="gal-row">
      {p.img && (
        <div className="thumbs">
          {views.map((v, i) => (
            <button key={v.k} type="button" className={i === view ? 'on' : ''} onClick={() => setView(i)} title={v.k}>
              <span style={{ backgroundImage: `url('${v.img || p.img}')`, backgroundSize: v.img ? 'contain' : `${v.s * 100}%`, backgroundPosition: v.img ? 'center' : v.o }} /><em>{v.k}</em>
            </button>
          ))}
        </div>
      )}
      <div className={'stage' + (zoom ? ' zoom' : '')} onMouseMove={onMove} onMouseLeave={() => setZoom(null)} onClick={() => p.img && onExpand()}>
        <span className="ring" />
        {p.img ? <div className="img" role="img" aria-label={p.name} style={{ backgroundImage: `url('${curImg}')`, transformOrigin: zoom ? `${zoom.x}% ${zoom.y}%` : cur.o, ...(view || zoom ? { animation: 'none', transform: `scale(${zoom ? cur.s * 1.7 : cur.s})` } : null) }} /> : <div className="ph">{p.brand}</div>}
        <div className="tl">{off > 0 && <span className="off">−{off}%</span>}{p.isNew && <span className="newb">NEW</span>}</div>
        <span className="br">{p.brand}</span>
        <span className="st" style={{ color: stock.tone }}><i />{stock.text}</span>
        <span className="hint">⌕ Hover to zoom · click to expand</span>
        {p.img && <>
          <button type="button" className="sbtn exp" title="Full-screen view" onClick={stop(onExpand)}>⤢</button>
          <button type="button" className="sbtn pv" title="Previous view" onClick={stop(() => step(-1))}>‹</button>
          <button type="button" className="sbtn nx" title="Next view" onClick={stop(() => step(1))}>›</button>
          <span className="count">{view + 1} / {views.length}</span>
        </>}
      </div>
    </div>
  );
}

/** The image currently shown (used by the full-screen view). */
export const currentImage = (p, views, view) => views[Math.min(view, views.length - 1)].img || p.img;
