import { Link, useLocation } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import './overlays.css';

/** Floating bar listing the products picked for comparison (hidden on the compare page itself). */
export default function CompareBar() {
  const { compare, setCompare, find } = useStore();
  const { pathname } = useLocation();
  const items = compare.map(find).filter(Boolean);
  if (!items.length || pathname === '/compare') return null;
  return (
    <div className="cmp-bar">
      <b className="ov-cmp-title">Compare</b>
      <div className="ov-cmp-thumbs">{items.map(p => <span className="th" key={p.id}>{p.img && <img src={p.img} alt="" />}</span>)}</div>
      <Link to="/compare" className="go">Compare {items.length} →</Link>
      <button className="x" title="Clear" aria-label="Clear compare list" onClick={() => setCompare([])}>×</button>
    </div>
  );
}
