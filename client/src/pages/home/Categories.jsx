import { Link } from 'react-router-dom';
import { CAT_FALLBACK, CAT_TINT, isPhoto } from '../../data.js';
import { useStore } from '../../store.jsx';
import SectionHead from './SectionHead.jsx';

const imgStyle = c => ({ inset: c.photo ? 0 : '-6%', backgroundImage: `url('${c.img}')`, backgroundSize: c.photo ? 'cover' : 'contain', mixBlendMode: c.photo ? 'normal' : 'multiply' });

function CatFoot({ c }) {
  return <div className="cat-foot"><div><span className="t">{c.t}</span><span className="d">{c.d}</span></div><span className="cat-arrow">→</span></div>;
}

/** Category showcase: one wide feature, two tiles, then a row of small cards. */
export default function Categories() {
  const { cats, products, content } = useStore();
  const L = content.labels;
  const cards = cats.map((c, i) => {
    const items = products.filter(p => p.cat === c.id);
    const own = items.find(p => p.img);
    const img = c.img || (own ? own.img : CAT_FALLBACK[c.id] || ''); // a picture chosen in Admin > Categories wins
    const photo = !!c.img || (!own && isPhoto(c.id));
    const n = items.length, h = CAT_TINT[c.id] || 258;
    return { ...c, n, img, photo, h, countL: n ? n + (n === 1 ? ' PRODUCT' : ' PRODUCTS') : 'CALL FOR STOCK', i };
  });
  const top = cards.slice(0, 3), rest = cards.slice(3);
  return (
    <section className="sec">
      <SectionHead kick={L.catKick} title={L.catTitle}><Link to="/shop/all" className="btn hm-browse-btn">Browse all products →</Link></SectionHead>
      <div className="cat-grid hm-cat-grid">
        {top.map((c, k) => k === 0 ? (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-feat hm-cat-wide">
            <span className="glow" />
            <div className="l"><span className="cat-chip">{c.countL}</span><span className="t">{c.t}</span><span className="d">{c.d}</span><span className="shop">Shop now →</span></div>
            <div className="im">{c.img && <i style={{ ...imgStyle(c), inset: '2%', mixBlendMode: 'multiply' }} />}</div>
          </Link>
        ) : (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-tile" style={{ background: `oklch(0.94 0.035 ${c.h})` }}>
            <div className="im">{c.img && <i style={imgStyle(c)} />}<span className="cat-count">{c.countL}</span></div>
            <CatFoot c={c} />
          </Link>
        ))}
      </div>
      <div className="cat-row">
        {rest.map(c => (
          <Link key={c.id} to={'/shop/' + c.id} className="cat-card">
            <div className="im" style={{ background: `radial-gradient(120% 100% at 50% 0%, #fff 0%, oklch(0.94 0.035 ${c.h}) 100%)` }}>
              {c.img && <i style={imgStyle(c)} />}
              <span className="cat-count" style={{ background: c.n ? 'rgba(255,255,255,.92)' : 'rgba(255,248,232,.95)', color: c.n ? 'oklch(0.45 0.15 248)' : 'oklch(0.52 0.12 65)' }}>{c.countL}</span>
            </div>
            <CatFoot c={c} />
          </Link>
        ))}
      </div>
    </section>
  );
}
