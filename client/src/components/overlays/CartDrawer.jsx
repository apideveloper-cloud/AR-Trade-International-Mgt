import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { fmt } from '../../api.js';
import { useStore } from '../../store.jsx';
import './overlays.css';

/** Empty-cart placeholder with a link back to the shop. */
function EmptyCart({ onClose }) {
  return (
    <div className="ov-cart-empty">
      <span className="ov-cart-empty-ic">⌂</span>
      <b className="ov-cart-empty-title">Your cart is empty</b>
      <Link to="/shop/all" onClick={onClose} className="btn btn-grad">Browse products →</Link>
    </div>
  );
}

/** One cart line: thumbnail, name, quantity stepper, line total and remove button. */
function CartLine({ p, qty, setQty, onClose }) {
  return (
    <div className="dline">
      <Link to={productPath(p)} onClick={onClose} className="th">{p.img && <img src={p.img} alt="" />}</Link>
      <div className="mid">
        <Link to={productPath(p)} onClick={onClose} className="nm clamp2">{p.name}</Link>
        <div className="row2">
          <div className="q"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(p.id, qty - 1)}>−</button><span>{qty}</span><button type="button" aria-label="Increase quantity" onClick={() => setQty(p.id, qty + 1)}>+</button></div>
          <b>{fmt(p.price * qty)}</b>
        </div>
      </div>
      <button className="rm" onClick={() => setQty(p.id, 0)} title="Remove" aria-label="Remove item">×</button>
    </div>
  );
}

/** Slide-in mini cart with lines, subtotal and checkout links. */
export default function CartDrawer() {
  const { cartOpen, setCartOpen, cartLines, cartCount, cartSubtotal, setQty } = useStore();
  if (!cartOpen) return null;
  const close = () => setCartOpen(false);
  return (
    <>
      <div className="scrim" onClick={close} />
      <aside className="drawer">
        <div className="hd">
          <div className="ov-cart-head">
            <span className="ic">⌂</span>
            <div><b>My cart</b><small>{cartCount} items · {fmt(cartSubtotal)}</small></div>
          </div>
          <button className="x" onClick={close} title="Close" aria-label="Close">×</button>
        </div>
        <div className="list">
          {!cartLines.length && <EmptyCart onClose={close} />}
          {cartLines.map(({ p, qty }) => <CartLine key={p.id} p={p} qty={qty} setQty={setQty} onClose={close} />)}
        </div>
        {cartLines.length > 0 && (
          <div className="ft">
            <div className="sub"><span>Subtotal <span className="ov-cart-note">· delivery at checkout</span></span><b>{fmt(cartSubtotal)}</b></div>
            <div className="acts"><Link to="/cart" onClick={close}>View cart</Link><Link to="/checkout" onClick={close}>Checkout →</Link></div>
            <div className="sec2"><span>✓ Secure checkout</span><span>✓ Cash on delivery</span></div>
          </div>
        )}
      </aside>
    </>
  );
}
