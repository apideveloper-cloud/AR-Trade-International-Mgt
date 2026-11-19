import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { fmt } from '../../api.js';
import { Stars } from '../../components/Reviews.jsx';
import { nameParts } from './productHelpers.js';
import './product-extra.css';

/** Category tag, SKU, previous/next arrows, name, rating line, price, stock meter, key specs and compatible printers. */
export default function ProductSummary({ p, cat, prev, next, rv, off, stock, rows, works, dlv }) {
  return (
    <>
      <div className="pd-top">
        <div className="pd-tags"><span className="pd-tag">{cat ? cat.t : 'Shop'}</span><span className="mono pfx-sku">SKU · {p.id}</span></div>
        <div className="pd-nav"><Link to={productPath(prev)} title="Previous product" aria-label="Previous product">‹</Link><Link to={productPath(next)} title="Next product" aria-label="Next product">›</Link></div>
      </div>
      <h1 className="pn">{nameParts(p.name).map(([k, t], i) => <span key={k} className={k}>{i ? ' ' : ''}{t}</span>)}</h1>
      <div className="pd-rate"><a href="#reviews" className="rate-link"><Stars value={rv ? rv.avg : 0} size={15} /><b>{rv && rv.count ? rv.avg.toFixed(1) : ''}</b><span>{rv && rv.count ? `(${rv.count} review${rv.count > 1 ? 's' : ''})` : 'No reviews yet'}</span></a><span>Genuine product · Official warranty</span><span className="chip2">✓ Cash on delivery</span></div>

      <div className="pd-price">
        <div className="row">
          <b>{p.price ? fmt(p.price) : 'On request'}</b>
          {off > 0 && <><s>{fmt(p.old)}</s><span className="save">Save {fmt(p.old - p.price)} · {off}% off</span></>}
        </div>
        <div className="note"><span>Prices include VAT</span><span>•</span><span>Free delivery within {dlv.freeKm} km of our Santinagar office</span></div>
      </div>

      {p.stock > 0 && (
        <div className="meter">
          <div className="bar"><i className={stock.low ? 'pfx-fill-low' : 'pfx-fill-ok'} style={{ width: Math.max(8, Math.min(100, p.stock / 20 * 100)) + '%' }} /></div>
          <span style={{ color: stock.tone }}>{stock.text}</span>
        </div>
      )}

      <div className="hl">
        <div className="hl-hd"><b>Key specifications</b><span>{rows.length - 1} details</span></div>
        {rows.slice(0, 6).map(([k, v]) => <div className="hl-row" key={k}><small>{k}</small><b>{v}</b></div>)}
      </div>

      {works.length > 1 && (
        <div className="works"><span>Works with</span><div>{works.map(w => <em key={w}>{w}</em>)}</div></div>
      )}
    </>
  );
}
