import { useState } from 'react';
import { IconBtn } from '../../../IconBtn.jsx';
import { taka } from '../../../fieldKit.jsx';
import { ProductPick } from './ProductPick.jsx';
import { lineTotal, num } from './invKit.jsx';

/** Products with quantity and price. An entry row (product, qty, price, discount, Add) adds to the list below it.
 *  costLabel: what the price column means. maxStock: cap the quantity at stock on hand. withDiscount: a discount (৳, for the whole line) per product. */
export function Lines({ lines, setLines, costLabel = 'Buying price', maxStock, withDiscount = false, newProduct = false }) {
  const set = (i, k, v) => setLines(l => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const [pick, setPick] = useState(null);
  const [e, setE] = useState({ qty: 1, cost: '', disc: '' });
  const setEntry = k => ev => setE(x => ({ ...x, [k]: ev.target.value }));
  const total = lines.reduce((t, l) => t + lineTotal(l), 0);
  const gross = lines.reduce((t, l) => t + num(l.qty) * num(l.unitCost), 0);
  const units = lines.reduce((t, l) => t + num(l.qty), 0);
  const choose = p => { setPick(p); setE(x => ({ ...x, qty: x.qty || 1, cost: p.lastCost || x.cost })); };
  const ready = pick && num(e.qty) > 0 && (!maxStock || num(e.qty) <= pick.stock);
  const add = () => {
    if (!ready) return;
    const row = { productId: pick.id, name: pick.name, stock: pick.stock, qty: num(e.qty), unitCost: e.cost, discount: e.disc };
    setLines(l => (l.some(x => x.productId === pick.id) ? l.map(x => (x.productId === pick.id ? { ...x, qty: num(x.qty) + row.qty, unitCost: e.cost || x.unitCost, discount: withDiscount ? num(x.discount) + num(e.disc) : x.discount } : x)) : [...l, row]));
    setPick(null); setE({ qty: 1, cost: '', disc: '' });
  };
  const onKey = ev => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } };
  const cols = withDiscount ? 'iv-c5' : 'iv-c4';
  return (
    <section className="iv-lines">
      <header className="iv-lhd"><b>Products</b><span>{lines.length ? `${lines.length} product${lines.length === 1 ? '' : 's'} · ${units} unit${units === 1 ? '' : 's'}` : 'Add one or more'}</span></header>
      <div className={'iv-entry ' + cols}>
        <ProductPick allowNew={newProduct} selected={pick} onClear={() => setPick(null)} onPick={choose} placeholder={lines.length ? 'Search and add another product…' : 'Search a product to add…'} />
        <input className="a-input" type="number" min="1" max={maxStock && pick ? pick.stock : undefined} value={e.qty} onChange={setEntry('qty')} onKeyDown={onKey} placeholder="Qty" aria-label="Quantity" />
        <input className="a-input" type="number" min="0" value={e.cost} onChange={setEntry('cost')} onKeyDown={onKey} placeholder={costLabel} aria-label={costLabel} />
        {withDiscount && <input className="a-input" type="number" min="0" value={e.disc} onChange={setEntry('disc')} onKeyDown={onKey} placeholder="Discount ৳" aria-label="Discount in taka" />}
        <output className="iv-etot" title="Total for this product"><small>Total</small><b>{taka(Math.max(0, num(e.qty) * num(e.cost) - (withDiscount ? num(e.disc) : 0)))}</b></output>
        <button type="button" className="a-btn grad sm iv-add" disabled={!ready} onClick={add}>＋ Add</button>
      </div>
      {lines.length ? (
        <div className="iv-lt">
          <div className={'iv-lh ' + cols}><span>Product</span><span>Qty</span><span>{costLabel} ৳</span>{withDiscount && <span>Discount ৳</span>}<span>Total</span><span /></div>
          {lines.map((l, i) => (
            <div key={l.productId} className={'iv-lr ' + cols}>
              <span title={l.name}><b>{l.name}</b><small>in stock {l.stock}</small></span>
              <input className="a-input" type="number" min="1" max={maxStock ? l.stock : undefined} value={l.qty} onChange={ev => set(i, 'qty', ev.target.value)} aria-label="Quantity" />
              <input className="a-input" type="number" min="0" value={l.unitCost} onChange={ev => set(i, 'unitCost', ev.target.value)} aria-label={costLabel} placeholder="0" />
              {withDiscount && <input className="a-input" type="number" min="0" value={l.discount ?? ''} onChange={ev => set(i, 'discount', ev.target.value)} aria-label="Discount in taka" placeholder="0" />}
              <strong>{taka(lineTotal(l))}</strong>
              <IconBtn icon="trash" tone="bad" title="Remove this product" onClick={() => setLines(x => x.filter((_, j) => j !== i))} />
            </div>
          ))}
          <div className="iv-lt-sum">
            <span>{withDiscount && gross !== total ? `Subtotal ${taka(gross)} · Discount −${taka(gross - total)}` : 'Total'}</span><b>{taka(total)}</b>
          </div>
        </div>
      ) : <div className="iv-lempty">No products added yet. Search above, set the quantity and price, then press Add.</div>}
    </section>
  );
}
