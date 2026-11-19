import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import './product-extra.css';

/** A 17px stroke icon used in the buy box buttons. */
const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

/** Quantity, add to cart, buy now, wishlist, compare (or a WhatsApp link when not buyable) plus the contact tiles. */
const BuyBox = forwardRef(function BuyBox({ p, buyable, qty, setQty, wa }, ref) {
  const { addToCart, wish, toggleWish, compare, toggleCompare } = useStore();
  const nav = useNavigate();
  const inWish = wish.includes(p.id), inCmp = compare.includes(p.id);
  return (
    <div className="buybox" ref={ref}>
      {buyable ? (
        <div className="line">
          <div className="qty3"><button type="button" aria-label="Decrease quantity" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button><span>{qty}</span><button type="button" aria-label="Increase quantity" onClick={() => setQty(q => Math.min(q + 1, p.stock))}>+</button></div>
          <button className="cta add" onClick={() => addToCart(p, qty)}><span className="ic"><Icon><path d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></Icon></span>Add to cart</button>
          <button className="cta buy" onClick={() => { addToCart(p, qty); nav('/checkout'); }}>Buy now <span className="ar">→</span></button>
          <button className={'sqbtn' + (inWish ? ' on' : '')} title="Wishlist" aria-label="Wishlist" onClick={() => toggleWish(p.id)}>{inWish ? '♥' : '♡'}</button>
          <button className={'sqbtn' + (inCmp ? ' on pfx-cmp-on' : '')} title="Compare" aria-label="Compare" onClick={() => toggleCompare(p.id)}>⇄</button>
        </div>
      ) : (
        <a href={wa} target="_blank" rel="noreferrer" className="cta buy pfx-ask">{p.price ? 'Out of stock — notify me on WhatsApp' : 'Call for price — ask on WhatsApp'}</a>
      )}
      <div className="contacts2">
        <a href="tel:+8801977554401"><i><Icon><path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 5.3 5.3l1.4-2.2L19 14.5V18a2 2 0 0 1-2 2A14 14 0 0 1 3 6a2 2 0 0 1 2-2z"/></Icon></i><span><small>Hotline</small>+8801977554401-02</span></a>
        <div><i><Icon><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7.5h8M8 12h2M12 12h2M8 16h2M12 16h2"/></Icon></i><span><small>Landline (TNT)</small>+8802-58317706-07</span></div>
        <a className="wa2" href={wa} target="_blank" rel="noreferrer"><i><Icon><path d="M4 20l1.2-4.1A8 8 0 1 1 8.2 19z"/><path d="M9.2 8.8c.3 2.4 2.6 4.7 5 5l1.1-1.2-1.9-1-.8.7a3.6 3.6 0 0 1-1.6-1.6l.7-.8-1-1.9z"/></Icon></i><span><small>WhatsApp</small>Order now →</span></a>
      </div>
    </div>
  );
});

export default BuyBox;
