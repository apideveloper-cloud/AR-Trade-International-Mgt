import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Thin reading-progress bar; portalled out of the zoomed storefront wrapper so position:fixed stays correct. */
export default function Progress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const on = () => { const el = document.querySelector('.bp-body'); if (!el) return; const r = el.getBoundingClientRect(); const total = r.height - window.innerHeight * 0.5; setW(Math.max(0, Math.min(100, (-r.top / Math.max(1, total)) * 100))); };
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return createPortal(<div className="bp-progress"><i style={{ width: w + '%' }} /></div>, document.body);
}
