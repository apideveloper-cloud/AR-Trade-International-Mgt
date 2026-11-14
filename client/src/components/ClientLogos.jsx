import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';

/** Repeats a short list until it is long enough to fill a wide screen, so the moving row never shows a gap. */
const fill = (a, min = 14) => { let r = a; while (a.length && r.length < min) r = r.concat(a); return r; };

/** The corporate-client logos, as managed in Admin > Site pages > "Our corporate clients" (falls back to the logos in Site content).
 *  One component for the Home and About pages so both always show the same logos. Renders nothing when there are none.
 *  variant "marquee": a dark panel with two rows of logos gliding in opposite directions (Home). Default: a quiet grid (About). */
export default function ClientLogos({ title = 'Corporate clients', eyebrow, variant = 'grid', className = '' }) {
  const { content } = useStore();
  const [page, setPage] = useState(null);
  useEffect(() => { api.get('/pages/our-clients').then(setPage).catch(() => {}); }, []);
  const logos = page && page.images.length ? page.images : (content.clients || []).filter(Boolean);
  if (!logos.length) return null;
  const head = (
    <div className="clients-hd">
      <div>
        {eyebrow && <span className="mono">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      <span className="clients-n"><b>{logos.length}</b> organisations trust AR Trade</span>
    </div>
  );
  if (variant !== 'marquee') {
    return (
      <section className={'clients-sec ' + className} aria-label={title}>
        {head}
        <div className="clients-g">
          {logos.map((c, i) => <div className="client" key={i + c}><div role="img" aria-label="Client logo" style={{ backgroundImage: `url('${c}')` }} /></div>)}
        </div>
      </section>
    );
  }
  const half = Math.ceil(logos.length / 2);
  const rows = [logos.slice(0, half), logos.slice(half).length ? logos.slice(half) : logos.slice(0, half)];
  return (
    <section className={'clients-wow ' + className} aria-label={title}>
      <i className="cw-glow a" aria-hidden="true" /><i className="cw-glow b" aria-hidden="true" />
      {head}
      <div className="cw-rows">
        {rows.map((row, r) => {
          const items = fill(row);
          return (
            <div className={'cw-row ' + (r ? 'rev' : '')} key={r} style={{ '--cw-n': items.length }}>
              <div className="cw-track">
                {items.concat(items).map((c, i) => <div className="cw-logo" key={r + '-' + i} aria-hidden={i >= items.length || undefined}><div role="img" aria-label={i < items.length ? 'Client logo' : undefined} style={{ backgroundImage: `url('${c}')` }} /></div>)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
