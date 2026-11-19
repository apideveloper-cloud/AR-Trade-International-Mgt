import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { fmt } from '../../api.js';
import { shopLink } from './useMenus.js';
import './header-extra.css';

/** The "All categories" mega menu. `groups` come from buildGroups, `active` is the hovered group index. */
export default function MegaMenu({ groups, active, setActive, close }) {
  const cur = groups[active] || groups[0];
  return (
    <div className="mega hdx-mega">
      <div className="mega-box">
        <div className="mega-l">
          {groups.map((g, gi) => (
            <Link key={g.t} to={shopLink(g.c)} className={gi === active ? 'on' : ''} onMouseEnter={() => setActive(gi)} onClick={close}>
              <span className="th">{g.img ? <img src={g.img} alt="" /> : g.t.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              <span className="nm">{g.t}</span><span className="hdx-chev">›</span>
            </Link>
          ))}
        </div>
        <div className="mega-m">
          <div className="top">
            <div><b>{cur.t}</b><small>{cur.n} products in store</small></div>
            <Link to={shopLink(cur.c)} onClick={close}>View all →</Link>
          </div>
          <div className="mega-links">
            {cur.items.map(([t, qq]) => <Link key={t} to={shopLink(cur.c, qq)} onClick={close}>{t}<span>→</span></Link>)}
          </div>
          <div className="mega-picks">
            {cur.picks.map(p => (
              <Link key={p.id} to={productPath(p)} onClick={close}>
                <span className="im"><img src={p.img} alt="" /></span>
                <span className="n clamp2">{p.name}</span><b>{p.price ? fmt(p.price) : 'Ask price'}</b>
              </Link>
            ))}
          </div>
        </div>
        <Link to="/offers" className="mega-hot" onClick={close}>
          <span className="glow" />
          <span className="k">Hot sale</span>
          <span className="t">Original laser toner at reduced prices</span>
          <span className="d">Cash on delivery in Dhaka. Courier delivery nationwide.</span>
          <span className="im"><img src="/api/uploads/site/hp-79a-black-toner.jpg" alt="" /></span>
          <span className="go">See offers →</span>
        </Link>
      </div>
    </div>
  );
}
