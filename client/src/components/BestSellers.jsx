import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmt, offPct } from '../api.js';
import { useStore } from '../store.jsx';

const MEDAL = ['🥇', '🥈', '🥉'];

/** Ranked "Best selling products" list: rank, thumbnail, name, price, units sold and a quick add button. */
export default function BestSellers({ exclude, limit = 6 }) {
  const { addToCart } = useStore();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/bestsellers?limit=' + (limit + 1)).then(d => setRows(d.products)).catch(() => setRows([])); }, [limit]);
  if (!rows || !rows.length) return null;
  const list = rows.filter(p => p.id !== exclude).slice(0, limit);
  const top = Math.max(1, ...list.map(p => p.sold));
  return (
    <section className="bs">
      <div className="bs-hd"><h2>🔥 Best selling products</h2><Link to="/shop/all">View all →</Link></div>
      <ol>
        {list.map((p, n) => {
          const off = offPct(p);
          const can = p.price && p.stock > 0;
          return (
            <li key={p.id} style={{ animationDelay: n * 0.06 + 's' }}>
              <span className={'rk r' + (n + 1)}>{n < 3 ? MEDAL[n] : n + 1}</span>
              <Link to={'/product/' + p.id} className="th" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} aria-label={p.name} />
              <Link to={'/product/' + p.id} className="nm">
                <b>{p.name}</b>
                <small>{p.brand}{p.tech ? ' · ' + p.tech : ''}</small>
                {p.sold > 0 && <span className="sold"><i style={{ width: Math.max(8, (p.sold / top) * 100) + '%' }} /><em>{p.sold} sold</em></span>}
              </Link>
              <span className="pr">
                {p.price ? <><b>{fmt(p.price)}</b>{off > 0 && <s>{fmt(p.old)}</s>}</> : <b>On request</b>}
              </span>
              {can ? <button onClick={() => addToCart(p, 1)}>+ Add</button> : <Link to={'/product/' + p.id} className="ask">{p.price ? 'Notify' : 'Ask price'}</Link>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
