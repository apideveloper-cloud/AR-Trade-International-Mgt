import { useCallback, useEffect, useRef, useState } from 'react';
import { invApi } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { Notice, fDate, taka, todayBd, useDebounced } from '../../fieldKit.jsx';

// Small pieces shared by the Purchasing & stock pages: the data hook, product picker, line editor and the vendor payment form.

// Purchasing & stock: vendors, purchases (goods received), stock, damage & returns, vendor payments.
export function useInv(path) {
  const [st, setSt] = useState({ data: null, err: '', loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (path == null) { setSt({ data: null, err: '', loading: false }); return undefined; }
    let stale = false;
    invApi.get(path).then(d => { if (!stale) setSt({ data: d, err: '', loading: false }); }).catch(e => { if (!stale) setSt({ data: null, err: e.message, loading: false }); });
    return () => { stale = true; };
  }, [path, n]);
  return { ...st, reload: useCallback(() => setN(x => x + 1), []) };
}
/** All rows of a server-paged list that match the current filters (for CSV export): pages of 200, at most 5,000 rows. */
export async function fetchAll(path, params) {
  const base = Object.fromEntries(Object.entries(params).filter(([k, v]) => v !== '' && v != null && k !== 'page' && k !== 'size'));
  const out = [];
  for (let page = 1; page <= 25; page++) {
    const r = await invApi.get(`${path}?${new URLSearchParams({ ...base, page, size: 200 })}`);
    out.push(...r.rows);
    if (out.length >= r.total || !r.rows.length) break;
  }
  return out;
}
/** Options for a vendor drop-down in a ListFilter. */
export const vendorOptions = list => list.map(v => ({ v: v.id, t: v.name }));
export const METHODS = ['Cash', 'Bank transfer', 'bKash', 'Nagad', 'Cheque'];
export const num = v => Math.max(0, Math.round(Number(v) || 0));
export const AddBtn = ({ children, ...p }) => <button type="button" className="a-btn sm grad" {...p}>{children}</button>;
export const Foot = ({ onClose, busy, label }) => <><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : label}</button></>;
export const balTone = b => (b > 0 ? 'bad' : b < 0 ? 'blue' : 'ok');
export const balText = b => (b > 0 ? taka(b) + ' due' : b < 0 ? taka(-b) + ' advance' : 'Settled');

/** A small product picture; when there is none (or it fails to load) the first letter of the name sits on a soft tile instead. */
export function ProdThumb({ src, name, size = 38 }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img className="pt" src={src} alt="" loading="lazy" width={size} height={size} onError={() => setBad(true)} />;
  return <span className="pt none" style={{ width: size, height: size }} aria-hidden="true">{String(name || '?').trim().charAt(0).toUpperCase()}</span>;
}

/** Search box that lists products; picking one calls onPick(product). With `selected` it shows that product (and a clear button) instead. */
export function ProductPick({ onPick, selected, onClear, placeholder = 'Search product to add…' }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250); const box = useRef(null);
  const r = useInv(!selected && dq.trim().length >= 2 ? '/products?q=' + encodeURIComponent(dq.trim()) : null);
  if (selected) return <div className="iv-sel" title={selected.name}><b>{selected.name}</b><small>in stock {selected.stock}</small><button type="button" onClick={() => { onClear?.(); setTimeout(() => box.current?.focus(), 0); }} aria-label="Choose another product">✕</button></div>;
  return (
    <div className="iv-pick">
      <input ref={box} className="a-input" value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label="Search products" />
      {q.trim().length >= 2 && (
        <div className="iv-res">
          {r.loading && !r.data ? <small>Searching…</small> : !(r.data?.items || []).length ? <small>No product found.</small> : r.data.items.map(p => (
            <button key={p.id} type="button" onClick={() => { onPick(p); setQ(''); }}><span>{p.name}</span><em>stock {p.stock}</em></button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One line's amount after its own discount. */
export const lineTotal = l => Math.max(0, num(l.qty) * num(l.unitCost) - num(l.discount));
/** Products with quantity and price. An entry row (product, qty, price, discount, Add) adds to the list below it.
 *  costLabel: what the price column means. maxStock: cap the quantity at stock on hand. withDiscount: a discount (৳, for the whole line) per product. */
export function Lines({ lines, setLines, costLabel = 'Buying price', maxStock, withDiscount = false }) {
  const set = (i, k, v) => setLines(l => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const [pick, setPick] = useState(null);
  const [e, setE] = useState({ qty: 1, cost: '', disc: '' });
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
        <ProductPick selected={pick} onClear={() => setPick(null)} onPick={choose} placeholder={lines.length ? 'Search and add another product…' : 'Search a product to add…'} />
        <input className="a-input" type="number" min="1" max={maxStock && pick ? pick.stock : undefined} value={e.qty} onChange={ev => setE(x => ({ ...x, qty: ev.target.value }))} onKeyDown={onKey} placeholder="Qty" aria-label="Quantity" />
        <input className="a-input" type="number" min="0" value={e.cost} onChange={ev => setE(x => ({ ...x, cost: ev.target.value }))} onKeyDown={onKey} placeholder={costLabel} aria-label={costLabel} />
        {withDiscount && <input className="a-input" type="number" min="0" value={e.disc} onChange={ev => setE(x => ({ ...x, disc: ev.target.value }))} onKeyDown={onKey} placeholder="Discount ৳" aria-label="Discount in taka" />}
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
export const linesBody = lines => lines.map(l => ({ productId: l.productId, qty: num(l.qty), unitCost: num(l.unitCost), discount: num(l.discount) }));
export const VendorSelect = ({ vendors, value, onChange, required = true }) => (
  <select className="a-input" value={value} onChange={e => onChange(e.target.value)} required={required}>
    <option value="">Choose vendor…</option>{vendors.filter(v => v.active || String(v.id) === String(value)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
  </select>
);

/* ---------------- payment form (used from vendors, purchases and the payments page) ---------------- */
export function PayForm({ vendors, vendor, receipt, due, onClose, onSaved }) {
  const [f, setF] = useState({ vendorId: vendor || '', receiptId: receipt || '', amount: due || '', method: 'Cash', reference: '', date: todayBd(), note: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const bills = useInv(f.vendorId ? '/receipts?vendor=' + f.vendorId : null);
  const open = (bills.data?.items || []).filter(b => b.due > 0 && (b.status === 'Approved' || b.status === 'Stocked'));
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await invApi.post('/payments', { ...f, amount: num(f.amount) }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal narrow kicker="Vendor payment" title="Pay vendor" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Save payment" />}>
      <div className="iv-form">
        <Notice err={err} />
        <label className="a-lbl">Vendor<VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v, receiptId: '' }))} /></label>
        <label className="a-lbl">Against purchase <small>(optional, leave empty for an advance or part payment on the account)</small>
          <select className="a-input" value={f.receiptId} onChange={e => { const b = open.find(x => x.id === e.target.value); setF(x => ({ ...x, receiptId: e.target.value, amount: b ? b.due : x.amount })); }} disabled={!f.vendorId}>
            <option value="">On account</option>{open.map(b => <option key={b.id} value={b.id}>{b.id} · {b.invoiceNo || fDate(b.date)} · due {taka(b.due)}</option>)}
          </select></label>
        <div className="a-fields">
          <label className="a-lbl">Amount ৳<input className="a-input" type="number" min="1" required value={f.amount} onChange={set('amount')} /></label>
          <label className="a-lbl">Date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
          <label className="a-lbl">Method<select className="a-input" value={f.method} onChange={set('method')}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="a-lbl">Reference <small>(txn / cheque no.)</small><input className="a-input" value={f.reference} onChange={set('reference')} /></label>
        </div>
        <label className="a-lbl">Note<input className="a-input" value={f.note} onChange={set('note')} /></label>
      </div>
    </Modal>
  );
}


export function useVendors() { const v = useInv('/vendors'); return v.data?.items || []; }
