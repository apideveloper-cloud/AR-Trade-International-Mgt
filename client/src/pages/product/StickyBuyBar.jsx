import { createPortal } from 'react-dom';
import { fmt } from '../../api.js';

/** Bar pinned to the bottom of the screen once the main buy box has scrolled away. */
export default function StickyBuyBar({ p, on, stockText, qty, onAdd }) {
  return createPortal(
    <div className={'sticky-buy' + (on ? ' on' : '')} aria-hidden={!on}>
      <div className="in">
        <span className="th" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
        <div className="nm"><b>{p.name}</b><span>{stockText}</span></div>
        <span className="pr">{fmt(p.price)}</span>
        <button className="cta add" onClick={() => onAdd(p, qty)}>Add to cart</button>
      </div>
    </div>, document.body
  );
}
