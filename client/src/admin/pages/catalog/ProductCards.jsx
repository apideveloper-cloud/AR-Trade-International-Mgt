import { slNo } from '../../adminApi.js';
import { FlagChips, LiveSwitch, NumCell } from './ProductControls.jsx';

/** Grid view of the product list: one card per product, same inline editing as the table. */
export function ProductCards({ t, patch, catName, setEdit, canWrite }) {
  return (
    <div className="pg-grid" style={{ opacity: t.loading ? .6 : 1 }}>
      {t.data.rows.map((p, i) => (
        <div key={p.id} className="pg-card" style={{ opacity: p.active ? 1 : .6 }}>
          <span className="pg-sl">{slNo(t, i)}</span>
          <button type="button" className="pg-img" disabled={!canWrite} style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} onClick={() => setEdit(p)} aria-label={canWrite ? 'Edit ' + p.name : p.name}>{!p.img && <small>No photo</small>}</button>
          <button type="button" className="pg-name" disabled={!canWrite} onClick={() => setEdit(p)}>{p.name}</button>
          <span className="pg-meta">{p.brand} · #{p.id} · {catName(p.cat)}</span>
          <div className="pg-nums">
            {[['price', 'Price'], ['old', 'Regular'], ['stock', 'Stock']].map(([k, l]) => (
              <label key={k}><small>{l}</small><NumCell p={p} k={k} canWrite={canWrite && k !== 'stock'} patch={patch} Plain="b" /></label>
            ))}
          </div>
          <div className="pg-foot">
            <FlagChips p={p} canWrite={canWrite} patch={patch} />
            <LiveSwitch p={p} canWrite={canWrite} patch={patch} />
          </div>
        </div>
      ))}
    </div>
  );
}
