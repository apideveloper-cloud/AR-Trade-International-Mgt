import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmt } from '../../api.js';
import { productPath } from '../../slug.js';
import { useStore } from '../../store.jsx';
import { bgImage } from './constants.js';
import { totalBeforeDelivery } from './helpers.js';
import { CouponBox, Row } from './parts.jsx';
import ViewSwitch from './ViewSwitch.jsx';

const VIEW_KEY = 'ar_cart_view';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } };

/** One line of the cart: picture, name, quantity buttons and line total. */
function CartLine({ l, setQty }) {
  return (
    <div className="cline">
      <Link to={productPath(l)}><div className="im" style={bgImage(l.img)} /></Link>
      <div className="ct-line-col">
        <Link to={productPath(l)} className="ct-line-name">{l.name}</Link>
        <span className="ct-line-each">{fmt(l.price)} each</span>
        {l.short > 0 && <span className="ct-line-short">Only {l.avail} in stock — you can choose how to handle the rest at checkout</span>}
        <div className="ct-line-actions">
          <div className="qty2"><button onClick={() => setQty(l.id, l.qty - 1)}>−</button><span>{l.qty}</span><button onClick={() => setQty(l.id, l.qty + 1)}>+</button></div>
          <button onClick={() => setQty(l.id, 0)} className="ct-line-remove">Remove</button>
        </div>
      </div>
      <span className="ct-line-total">{fmt(l.price * l.qty)}</span>
    </div>
  );
}

/** The cart page. Delivery is not priced here (it depends on the address), so the total is before delivery. */
export default function CartPage() {
  const { cartLines, setQty, user, totals } = useStore();
  const [coupon, setCoupon] = useState('');
  const [view, setViewState] = useState(readView);
  const setView = v => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked: the choice just is not remembered */ } };
  const t = totals({ area: user?.area || 'inside', coupon });
  return (
    <section className="page ct-page">
      <div className="ct-head"><h1 className="h1 ct-h1">Your cart</h1>{cartLines.length > 0 && <ViewSwitch view={view} onChange={setView} />}</div>
      {!cartLines.length ? (
        <div className="empty"><span className="ct-empty-t">Your cart is empty</span><Link to="/shop/all" className="btn btn-dark btn-pill ct-btn-start">Start shopping</Link></div>
      ) : (
        <div className="cart-body">
          <div className={'cart-lines' + (view === 'grid' ? ' grid' : '')}>{t.lines.map(l => <CartLine key={l.id} l={l} setQty={setQty} />)}</div>
          <aside className="summary">
            <span className="ct-sum-t">Order summary</span>
            <CouponBox value={coupon} onChange={setCoupon} ok={t.okCoupon} />
            <Row k={`Subtotal (${t.count} items)`} v={fmt(t.subtotal)} />
            <Row k="Discount" v={'− ' + fmt(t.discount + t.member)} />
            <Row k="Delivery" v="Calculated at checkout" />
            <Row k="You save vs. regular price" v={fmt(t.saved)} cls="ct-save" />
            <div className="tot"><b className="ct-tot-l">Total (before delivery)</b><b>{fmt(totalBeforeDelivery(t))}</b></div>
            <Link to="/checkout" className="btn btn-blue ct-center">Proceed to checkout</Link>
            <Link to="/shop/all" className="ct-more">Continue shopping</Link>
          </aside>
        </div>
      )}
    </section>
  );
}
