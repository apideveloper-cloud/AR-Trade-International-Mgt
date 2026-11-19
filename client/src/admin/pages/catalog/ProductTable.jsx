import { slNo } from '../../adminApi.js';
import { FlagChips, LiveSwitch, NumCell } from './ProductControls.jsx';

/** Table view of the product list with inline price editing. */
export function ProductTable({ t, patch, catName, setEdit, canWrite }) {
  return (
    <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
      <div className="prod-wrap">
        <div className="head prod-cols"><span>SL</span><span /><span>Product</span><span>Category</span><span>Price</span><span>Regular</span><span>Stock</span><span>Flags</span><span>Live</span></div>
        {t.data.rows.map((p, i) => (
          <div key={p.id} className="row prod-cols" style={{ opacity: p.active ? 1 : .55 }}>
            <span className="sl">{slNo(t, i)}</span>
            <div className="a-thumb" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
            <button className="prod-name" disabled={!canWrite} onClick={() => setEdit(p)}><b>{p.name}</b><span className="prod-sub">{p.brand} · #{p.id} · Edit</span></button>
            <span className="prod-cat">{catName(p.cat)}</span>
            <NumCell p={p} k="price" canWrite={canWrite} patch={patch} />
            <NumCell p={p} k="old" canWrite={canWrite} patch={patch} />
            <NumCell p={p} k="stock" canWrite={false} patch={patch} plainClass={'ro-val' + (p.price && p.stock <= 5 ? ' prod-low' : '')} />
            <FlagChips p={p} canWrite={canWrite} patch={patch} />
            <LiveSwitch p={p} canWrite={canWrite} patch={patch} />
          </div>
        ))}
      </div>
    </div>
  );
}
