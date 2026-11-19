import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { BuyAction } from '../../components/ProductCard.jsx';
import { fmt, offPct } from '../../api.js';
import { useStore } from '../../store.jsx';
import './shop.css';

/** One product in the list view. */
export default function ListRow({ p }) {
  const { wish, toggleWish } = useStore();
  const off = offPct(p);
  return (
    <article className="lrow">
      <Link to={productPath(p)} className="im">{p.img && <img src={p.img} alt={p.name} loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}{off > 0 && <span className="b-off">−{off}%</span>}</Link>
      <div className="mid">
        <div className="shpx-tags"><span className="bk">{p.brand}</span>{p.isNew && <span className="b-new">New</span>}</div>
        <Link to={productPath(p)}><h3>{p.name}</h3></Link>
        <span className="shpx-spec">{p.spec}</span>
        <div className="tick"><span>✓ Genuine product</span><span>✓ Cash on delivery</span><span>✓ Dhaka next-day</span></div>
      </div>
      <div className="rt">
        <div className="pr"><b>{p.price ? fmt(p.price) : 'On request'}</b>{off > 0 && <s>{fmt(p.old)}</s>}</div>
        <div className="acts">
          <button className={'sq' + (wish.includes(p.id) ? ' on' : '')} title="Wishlist" onClick={() => toggleWish(p.id)}>{wish.includes(p.id) ? '♥' : '♡'}</button>
          <BuyAction p={p} cls="add" label="+ Add to cart" />
        </div>
      </div>
    </article>
  );
}
