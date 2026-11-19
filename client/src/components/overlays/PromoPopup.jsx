import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { popupAllowed, popupOpen } from '../../popupBus.js';
import { copyText, fmt, offPct } from '../../api.js';
import { useStore } from '../../store.jsx';
import PopupShell from './PopupShell.jsx';
import usePopupSlot from './usePopupSlot.js';
import './overlays.css';

/** Home-page "Mega Toner Sale" popup, shown once per browser session (as in the design). */
export default function PromoPopup() {
  const { pathname } = useLocation();
  const { products, site } = useStore();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (pathname !== '/') return undefined;
    const mode = site.popupMode || 'one';
    const t = setTimeout(() => {
      try { if (sessionStorage.getItem('arPromoSeen')) return; } catch { /* storage unavailable */ }
      if (popupAllowed('promo', mode)) { popupOpen('promo'); setOpen(true); }
    }, Math.max(0, Number(site.promoDelay ?? 1)) * 1000);
    return () => clearTimeout(t);
  }, [pathname, site.popupMode, site.promoDelay]);
  usePopupSlot('promo', open);
  if (!open) return null;

  const src = products.filter(p => p.img && p.old && p.price).map(p => ({ p, off: offPct(p) })).sort((a, b) => b.off - a.off);
  const close = () => { try { sessionStorage.setItem('arPromoSeen', '1'); } catch { /* storage unavailable */ } setOpen(false); };
  const copy = () => copyText(site.coupon).then(ok => { if (ok) setCopied(true); });

  return (
    <PopupShell onClose={close} panelClass="promo-pop">
      <button className="x" onClick={close} title="Close" aria-label="Close">×</button>
      <div className="promo-card">
        <span className="rays" /><span className="glow" />
        <div className="ov-promo-top">
          <span className="brandpill"><img src="/ar-icon-round.png" alt="" />AR Trade</span><span className="lt">LIMITED TIME</span>
        </div>
        <div className="promo-head">
          <span className="bn">ধামাকা অফার!</span>
          <span className="ttl">Mega Toner Sale</span>
          <span className="bigrow"><span className="big">UP TO {src.length ? src[0].off : 20}%</span><span className="off">OFF</span></span>
        </div>
        <div className="promo-items">
          {src.slice(0, 3).map(({ p, off }) => (
            <Link key={p.id} to={productPath(p)} onClick={close}><em>−{off}%</em><div style={{ backgroundImage: `url('${p.img}')` }} /><b>{fmt(p.price)}</b></Link>
          ))}
        </div>
        <div className="promo-coupon">
          <div className="c"><small>Extra {site.couponPct}% off with code</small><b>{site.coupon}</b></div>
          <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
        <Link to="/offers" className="promo-cta" onClick={close}>Shop the offer now →</Link>
        <div className="promo-cont">
          <a href="tel:+8801977554401"><i>☏</i><span><small>Call / WhatsApp</small><b>{site.phone}</b></span></a>
          <a href={'mailto:' + site.email}><i>@</i><span><small>Email</small><b>{site.email}</b></span></a>
        </div>
        <button className="promo-later" onClick={close}>No thanks, maybe later</button>
      </div>
    </PopupShell>
  );
}
