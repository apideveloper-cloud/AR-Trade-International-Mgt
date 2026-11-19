import { Link } from 'react-router-dom';
import { fmt, offPct } from '../../api.js';
import { productPath } from '../../slug.js';
import { useStore } from '../../store.jsx';

/** Deal of the week card plus the two promo tiles beside the hero. */
export default function HeroSide() {
  const { products, addToCart } = useStore();
  const deal = products.find(p => p.featured) || products[0];
  const off = deal ? offPct(deal) : 0;
  return (
    <div className="hero-side">
      {deal && (
        <div className="deal">
          <div className="row1"><span className="k">Deal of the week</span>{off > 0 && <span className="off">−{off}%</span>}</div>
          <Link to={productPath(deal)} className="pic"><img src={deal.img} alt={deal.name} loading="lazy" decoding="async" /></Link>
          <Link to={productPath(deal)}><span className="nm clamp2">{deal.name}</span></Link>
          <div className="foot">
            <span className="pr"><b>{deal.price ? fmt(deal.price) : 'On request'}</b>{off > 0 && <s>{fmt(deal.old)}</s>}</span>
            <button className="btn" onClick={() => addToCart(deal)}>+ Add to cart</button>
          </div>
        </div>
      )}
      <div className="mini2">
        <Link to="/shop/copier-toner" className="mini hm-mini-copier">
          <div className="im"><img src="/api/uploads/site/toshiba-5018p-photocopier-toner.jpg" alt="" loading="lazy" decoding="async" /></div>
          <b>Copier toner</b><span>Up to 18% off</span>
        </Link>
        <Link to="/shop/printer" className="mini hm-mini-printer">
          <div className="im"><img src="/api/uploads/site/cp1100-01-500x500-1.png" alt="" loading="lazy" decoding="async" className="hm-img-zoom" /></div>
          <b>New: Pantum</b><span>From ৳ 20,000</span>
        </Link>
      </div>
    </div>
  );
}
