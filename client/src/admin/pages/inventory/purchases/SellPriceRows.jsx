import { taka } from '../../../fieldKit.jsx';
import { ProdThumb } from '../kit/ProdThumb.jsx';
import { num } from '../kit/invKit.jsx';

/** Starting rows of the approve / stock-in forms from a purchase's lines. `cost` is the buying price per unit. */
export const sellRowsOf = (lines, costOf) => lines.map(l => ({ productId: l.productId, name: l.name, img: l.img, qty: l.qty, cost: costOf(l), salePrice: l.salePrice || l.currentPrice || '', current: l.currentPrice, remarks: l.remarks || '' }));

/** The "margin per unit" line under a product's selling price. */
function MarginNote({ r }) {
  const sale = num(r.salePrice); const gain = sale - num(r.cost);
  return <small className="iv-si-note">{r.current ? 'Current price ' + taka(r.current) + ' · ' : ''}{sale ? (gain >= 0 ? 'margin ' + taka(gain) + ' per unit' : <b className="bad-t">below buying price by {taka(-gain)}</b>) : 'enter the price'}</small>;
}

/** One row per product to set its selling price and remarks. `approve`: the approval step (picture, both fields marked required); otherwise the stock-in step. */
export function SellPriceRows({ rows, set, approve = false }) {
  return (
    <div className="iv-si">
      {rows.map((r, i) => (
        <div key={r.productId} className="iv-si-row">
          <div className="iv-si-hd">
            {approve ? <span className="pd-nm"><ProdThumb src={r.img} name={r.name} size={34} /><b>{r.name}</b></span> : <b>{r.name}</b>}
            <span>{r.qty} × buying {taka(r.cost)}</span>
          </div>
          <div className="iv-si-in">
            {approve ? (
              <>
                <label className="a-lbl"><span className="pu-lbl">Selling price ৳ <i className="pu-req">required</i></span><input className="a-input" type="number" min="1" value={r.salePrice} onChange={e => set(i, 'salePrice', e.target.value)} placeholder={r.current ? String(r.current) : '0'} /></label>
                <label className="a-lbl"><span className="pu-lbl">Remarks <i className="pu-req">required</i></span><input className="a-input" maxLength={200} value={r.remarks} onChange={e => set(i, 'remarks', e.target.value)} placeholder="Batch, quality check, shelf, price reason…" /></label>
              </>
            ) : (
              <>
                <label className="a-lbl">Selling price ৳<input className="a-input" type="number" min="1" required value={r.salePrice} onChange={e => set(i, 'salePrice', e.target.value)} placeholder={r.current ? String(r.current) : '0'} /></label>
                <label className="a-lbl">Remarks <small>(optional)</small><input className="a-input" maxLength={200} value={r.remarks} onChange={e => set(i, 'remarks', e.target.value)} placeholder="Batch, shelf, condition…" /></label>
              </>
            )}
          </div>
          <MarginNote r={r} />
        </div>
      ))}
    </div>
  );
}
