import { fmt } from '../../api.js';
import { useStore } from '../../store.jsx';
import { H2, Thumb } from './shared.jsx';

export default function Compare() {
  const { compare, setCompare, products, find, cats } = useStore();
  const slots = [0, 1, 2].map(i => compare[i] || '');
  const pick = (i, v) => { const n = [...slots]; n[i] = v ? Number(v) : ''; setCompare(n.filter(Boolean).filter((x, k, a) => a.indexOf(x) === k)); };
  const items = compare.map(find).filter(Boolean);
  const specOf = p => Object.fromEntries([['Brand', p.brand], ['Part no.', p.part], ['Technology', p.tech], ['Colour', p.color], ['Yield', p.yield], ['Compatible', p.compat], ...(p.extra || [])].filter(r => r[1] && r[1] !== '—'));
  const sp = items.map(specOf);
  const keys = ['Price', 'Category', 'Stock', ...new Set(sp.flatMap(o => Object.keys(o)))];
  const val = (k, p, j) => (k === 'Price' ? (p.price ? fmt(p.price) : 'Ask') : k === 'Category' ? cats.find(c => c.id === p.cat)?.t || '—' : k === 'Stock' ? (p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock') : sp[j][k] || '—');
  return (
    <>
      <H2 right={<button className="ac-btn ghost" onClick={() => setCompare([])}>Clear all</button>}>Compare products</H2>
      <span className="ac-s71">Pick 2 or 3 products to see their specs side by side.</span>
      <div className="ac-s72">
        {slots.map((v, i) => { const p = find(v); return (
          <div key={i} className="ac-card ac-s73">
            <span className="mono ac-s74">PRODUCT {i + 1}</span>
            <select className="ac-input" value={v} onChange={e => pick(i, e.target.value)}><option value="">Select a product…</option>{products.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            {p && <div className="ac-s75"><Thumb src={p.img} size={64} /><span className="ac-s35"><b className="ac-s76">{p.name}</b><b className="ac-s77">{p.price ? fmt(p.price) : 'Ask price'}</b></span></div>}
          </div>
        ); })}
      </div>
      {items.length >= 2 ? (
        <div className="ac-s78">
          <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${items.length},minmax(200px,1fr))`, minWidth: 600 }}>
            {keys.map((k, i) => (
              <div key={k} className="ac-s79">
                <div style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#5d6270', background: i % 2 ? '#fafbfd' : '#fff', borderBottom: '1px solid #f1f3f7' }}>{k}</div>
                {items.map((p, j) => <div key={p.id} style={{ padding: '12px 16px', fontSize: 13.5, background: i % 2 ? '#fafbfd' : '#fff', borderLeft: '1px solid #f1f3f7', borderBottom: '1px solid #f1f3f7', fontWeight: k === 'Price' ? 800 : 400 }}>{val(k, p, j)}</div>)}
              </div>
            ))}
          </div>
        </div>
      ) : <div className="ac-s80">Select at least 2 products to compare.</div>}
    </>
  );
}
