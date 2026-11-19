import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BuyAction } from '../../components/ProductCard.jsx';
import { fmt, offPct } from '../../api.js';
import { productPath } from '../../slug.js';
import { useStore } from '../../store.jsx';
import SectionHead from './SectionHead.jsx';

/** Price with optional struck-through old price. */
const Price = ({ p, off }) => <><b>{p.price ? fmt(p.price) : 'On request'}</b>{off > 0 && <s>{fmt(p.old)}</s>}</>;

function Spotlight({ spot, off }) {
  return (
    <div className="spot">
      <span className="glow" />
      <div className="top"><span className="tag">NEW ARRIVAL · {spot.brand}</span>{off > 0 && <span className="save">Save {off}%</span>}</div>
      <Link to={productPath(spot)} className="pic">{spot.img && <img src={spot.img} alt={spot.name} loading="lazy" decoding="async" />}</Link>
      <div className="info">
        <div className="hm-spot-info">
          <Link to={productPath(spot)} className="nm">{spot.name}</Link>
          <span className="hm-spot-spec">{spot.spec}</span>
          <div className="pr"><Price p={spot} off={off} /></div>
        </div>
        <BuyAction p={spot} cls="btn" label="+ Add" />
      </div>
    </div>
  );
}

function MiniProduct({ q }) {
  const o = offPct(q);
  return (
    <div className="mini-p">
      <div className="row">
        <Link to={productPath(q)} className="th">{q.img && <img src={q.img} alt="" loading="lazy" decoding="async" />}{o > 0 && <em>−{o}%</em>}</Link>
        <div className="hm-mini-info">
          <span className="brand-k">{q.brand}</span>
          <Link to={productPath(q)} className="nm clamp2">{q.name}</Link>
        </div>
      </div>
      <div className="foot">
        <span className="pr"><Price p={q} off={o} /></span>
        <BuyAction p={q} cls="btn" label="+ Add" />
      </div>
    </div>
  );
}

/** New arrivals: category tabs, one spotlight product and four minis. */
export default function Fresh() {
  const { products, cats, content } = useStore();
  const L = content.labels;
  const [nk, setNk] = useState('all');
  const pool = products.filter(p => p.isNew);
  const tabs = [{ id: 'all', t: 'All new', items: pool }, ...cats.map(c => ({ id: c.id, t: c.t, items: pool.filter(p => p.cat === c.id) })).filter(c => c.items.length)];
  const list = nk === 'all' ? pool : pool.filter(p => p.cat === nk);
  const spot = list[0];
  const off = spot ? offPct(spot) : 0;
  return (
    <section className="sec">
      <SectionHead kick={L.newKick} title={L.newTitle}>
        <Link to={nk === 'all' ? '/shop/all?new=1' : '/shop/' + nk} className="hm-view-new">{L.viewNew}</Link>
      </SectionHead>
      <div className="fresh-tabs">
        {tabs.map(c => (
          <button key={c.id} className={'fresh-tab' + (c.id === nk ? ' on' : '')} onClick={() => setNk(c.id)}>
            <span className="im">{c.items.find(p => p.img) && <img src={c.items.find(p => p.img).img} alt="" loading="lazy" decoding="async" />}</span>{c.t}<span className="n">{c.items.length}</span>
          </button>
        ))}
      </div>
      {!list.length && <div className="empty2">No new arrivals in this category yet.</div>}
      {spot && (
        <div className="fresh-grid">
          <Spotlight spot={spot} off={off} />
          <div className="fresh-list">{list.slice(1, 5).map(q => <MiniProduct key={q.id} q={q} />)}</div>
        </div>
      )}
    </section>
  );
}
