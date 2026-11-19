import { Link } from 'react-router-dom';
import { productPath } from '../../slug.js';
import { fmt } from '../../api.js';
import './chat-cards.css';

/** Mini product cards the assistant shows under a reply; onPick runs when one is opened. */
export default function ChatProductCards({ items, onPick }) {
  if (!items?.length) return null;
  return (
    <div className="cpcs">
      {items.map(p => (
        <Link key={p.id} to={productPath(p)} className="cpc" onClick={onPick}>
          <span className={'im' + (p.img ? '' : ' cmpx-noimg')} style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} />
          <span className="tx"><b>{p.name}</b><em className={p.price > 0 ? '' : 'rq'}>{p.price > 0 ? fmt(p.price) : 'Price on request'}</em><small>{p.stock > 0 ? 'In stock' : 'Out of stock'}</small></span>
        </Link>
      ))}
    </div>
  );
}
