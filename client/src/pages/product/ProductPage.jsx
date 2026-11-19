import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { productIdOf, productPath } from '../../slug.js';
import { offPct, waLink } from '../../api.js';
import { deliveryOf } from '../../data.js';
import Reviews from '../../components/Reviews.jsx';
import BestSellers from '../../components/BestSellers.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import { useStore } from '../../store.jsx';
import { NotFound } from '../info/NotFound.jsx';
import Gallery, { currentImage } from './Gallery.jsx';
import TrustCards from './TrustCards.jsx';
import ProductSummary from './ProductSummary.jsx';
import BuyBox from './BuyBox.jsx';
import DeliveryPerks from './DeliveryPerks.jsx';
import OfferRail from './OfferRail.jsx';
import ShareRow from './ShareRow.jsx';
import SpecTabs from './SpecTabs.jsx';
import RelatedProducts from './RelatedProducts.jsx';
import HowToOrder from './HowToOrder.jsx';
import StickyBuyBar from './StickyBuyBar.jsx';
import { galleryViews, hasWarranty, specRows, stockInfo } from './productHelpers.js';
import { useFullRecord, useProductSeo, useReviews, useRevealed, useScrolledPast } from './useProductEffects.js';
import '../../productStyles.css';
import './product-extra.css';

/** Product detail page: gallery, buy box, specs, how-to-order, reviews, related products and the sticky buy bar. */
export default function Product() {
  const { id: segment } = useParams();
  const here = useLocation().pathname;
  const { find, products, cats, site, addToCart, user, setLoginOpen } = useStore();
  const dlv = deliveryOf(site);
  const nav = useNavigate();
  const [qty, setQty] = useState(1);
  const [view, setView] = useState(0);
  const [box, setBox] = useState(false);
  const buyRef = useRef(null);
  const howRef = useRef(null);
  const p = products.find(x => x.slug === segment) || find(productIdOf(segment) || segment); // /product/hp-230a-toner, and the old /product/hp-230a-toner-21554 or /product/21554
  const id = p ? p.id : productIdOf(segment) || segment;
  // the address holds words (hp-05a-…); the server's detail and review routes are keyed by the product's number
  const pid = p?.id;
  const full = useFullRecord(pid);
  const [rv, loadRv] = useReviews(pid, user?.id);

  useEffect(() => { setQty(1); setView(0); setBox(false); }, [id]);
  // an old or mistyped address (/product/21554) is replaced by the real one, so the address bar and shared links always show the keyword address
  useEffect(() => { if (p && here !== productPath(p)) nav(productPath(p), { replace: true }); }, [p, here, nav]);
  useProductSeo(p, full);
  const barOn = useScrolledPast(buyRef, [id, p]);
  const howIn = useRevealed(howRef, [id, p]);

  if (!p) return <NotFound />;
  const warranty = hasWarranty(full && 'warranty' in full ? full : p); // admin: Product Entry > Warranty (Yes | No)
  const views = galleryViews(full);
  const cat = cats.find(c => c.id === p.cat);
  const buyable = !!p.price && p.stock > 0;
  const rows = specRows(p, full);
  const sib = products.filter(x => x.cat === p.cat);
  const si = Math.max(0, sib.findIndex(x => x.id === p.id));
  const prev = sib[(si - 1 + sib.length) % sib.length], next = sib[(si + 1) % sib.length];
  const offers = products.filter(x => x.id !== p.id && x.old && x.price && x.old > x.price).slice(0, 6);
  const works = String(p.compat || '').split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const wa = waLink(site, 'Hi, I want to order: ' + p.name);
  const stock = stockInfo(p);

  return (
    <section className="pdp2">
      <div className="crumbs pfx-crumbs"><Link to="/">Home</Link><span>/</span>{cat && <Link to={'/shop/' + cat.id}>{cat.t}</Link>}<span>/</span><span className="pfx-crumb-cur">{p.name}</span></div>

      <div className="pdp2-grid">
        <div className="pdp2-gal">
          <Gallery p={p} views={views} view={view} setView={setView} stock={stock} off={offPct(p)} onExpand={() => setBox(true)} />
          <TrustCards warranty={warranty} />
        </div>

        <div className="pdp2-info">
          <ProductSummary p={p} cat={cat} prev={prev} next={next} rv={rv} off={offPct(p)} stock={stock} rows={rows} works={works} dlv={dlv} />
          <BuyBox ref={buyRef} p={p} buyable={buyable} qty={qty} setQty={setQty} wa={wa} />
          <DeliveryPerks site={site} />
          {offers.length > 0 && <OfferRail offers={offers} resetKey={id} />}
          <ShareRow name={p.name} />
        </div>
      </div>

      <div className="pd-lower">
        <div className="pd-left">
          <SpecTabs full={full} rows={rows} dlv={dlv} site={site} resetKey={id} />
          <Reviews pid={p.id} data={rv} user={user} onLogin={() => setLoginOpen(true)} onSubmitted={loadRv} />
          <RelatedProducts p={p} products={products} />
          <BestSellers exclude={p.id} />
        </div>
        <HowToOrder ref={howRef} shown={howIn} />
      </div>

      {box && p.img && createPortal(<Lightbox img={currentImage(p, views, view)} name={p.name} views={views} start={view} onClose={() => setBox(false)} onView={setView} />, document.body)}
      {buyable && <StickyBuyBar p={p} on={barOn} stockText={stock.text} qty={qty} onAdd={addToCart} />}
    </section>
  );
}
