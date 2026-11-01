// "New order": staff take an order for a customer (phone call, walk-in, field sale). The server prices it exactly like the website checkout.
import { useEffect, useState } from 'react';
import { adm, fmtMoney } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { useDebounced } from '../../fieldKit.jsx';
import { AREA, PAYMENTS } from './constants.js';
import { SOURCES, sourceFor } from './sources.js';
import '../inventory/inventory.css';
import './orderCreate.css';

/** Search the catalogue and hand the chosen product back. */
function Pick({ onPick }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim(), 250); const [rows, setRows] = useState(null);
  useEffect(() => {
    if (dq.length < 2) { setRows(null); return undefined; }
    let stale = false;
    adm.get(`/products?q=${encodeURIComponent(dq)}&size=8&page=1`).then(r => { if (!stale) setRows((r.rows || r.items || []).filter(p => p.price > 0)); }).catch(() => { if (!stale) setRows([]); });
    return () => { stale = true; };
  }, [dq]);
  return (
    <div className="iv-pick">
      <input className="a-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search a product to add…" aria-label="Search products" />
      {dq.length >= 2 && (
        <div className="iv-res">
          {rows === null ? <small>Searching…</small> : !rows.length ? <small>No product found.</small> : rows.map(p => (
            <button key={p.id} type="button" onClick={() => { onPick(p); setQ(''); }}><span>{p.name}</span><em>{fmtMoney(p.price)} · stock {p.stock}</em></button>
          ))}
        </div>
      )}
    </div>
  );
}

const CUSTOMER_KINDS = [['Existing', 'Existing customer'], ['Upcoming', 'Upcoming customer'], ['New', 'New customer']];

/** Search the field app's customers (Existing or Upcoming) and hand the chosen one back. */
function CustomerPick({ type, selected, onPick, onClear, bad }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim(), 250);
  const [items, setItems] = useState(null); const [openList, setOpenList] = useState(false);
  useEffect(() => {
    if (selected) return undefined;
    let stale = false;
    adm.get(`/order-customers?type=${type}&q=${encodeURIComponent(dq)}`).then(r => { if (!stale) setItems(r.items); }).catch(() => { if (!stale) setItems([]); });
    return () => { stale = true; };
  }, [type, dq, selected]);
  if (selected) return <div className="iv-sel" title={selected}><b>{selected}</b><small>{type}</small><button type="button" onClick={onClear} aria-label="Choose another customer">✕</button></div>;
  return (
    <div className="iv-pick">
      <input className={'a-input' + (bad ? ' bad' : '')} value={q} onChange={e => { setQ(e.target.value); setOpenList(true); }} onFocus={() => setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)} placeholder={`Search ${type.toLowerCase()} customers by name, phone or area…`} aria-label="Search customers" />
      {openList && (
        <div className="iv-res">
          {items === null ? <small>Searching…</small> : !items.length ? <small>{q.trim() ? 'No customer found.' : `No ${type.toLowerCase()} customers yet.`} Use "New customer" to type one in.</small> : items.map(c => (
            <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(c); setQ(''); setOpenList(false); }}><span>{c.name}{c.contact ? ' · ' + c.contact : ''}</span><em>{c.phone}</em></button>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderCreate({ staff, onClose, onCreated }) {
  const [kind, setKind] = useState('Existing'); const [picked, setPicked] = useState(false); const [custErr, setCustErr] = useState('');
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', area: 'inside', payment: 'Cash on delivery', note: '', source: sourceFor(staff.role) });
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const need = kind === 'New' || picked; // for Existing / Upcoming the "choose a customer" message comes first
  const sub = lines.reduce((t, l) => t + l.price * l.qty, 0);
  const setQty = (id, qty) => setLines(ls => ls.map(l => (l.id === id ? { ...l, qty: Math.max(1, Math.min(999, parseInt(qty, 10) || 1)) } : l)));
  const add = p => setLines(ls => (ls.some(l => l.id === p.id) ? ls.map(l => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { id: p.id, name: p.name, price: p.price, stock: p.stock, qty: 1 }]));
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (kind !== 'New' && !picked) { setCustErr(`Choose ${kind === 'Upcoming' ? 'an upcoming' : 'an existing'} customer from the list, or switch to "New customer" to type one in.`); return; }
    if (!lines.length) { setErr('Add at least one product.'); return; }
    setBusy(true);
    try {
      const o = await adm.post('/orders', { source: f.source, customer: { name: f.name, phone: f.phone, email: f.email }, address: f.address, area: f.area, payment: f.payment, note: f.note, items: lines.map(l => ({ id: l.id, qty: l.qty })) });
      onCreated(o); onClose();
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal side cls="oc" kicker="Orders" title="New order" onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : 'Create order'}</button></>}>
      <div className="oc-form">
        <div className="oc-main">
          {err && <div className="a-msg err">{err}</div>}
          <section className="pu-card">
            <header className="iv-lhd"><b>Customer</b>
              <div className="iv-seg" role="radiogroup" aria-label="Customer type">
                {CUSTOMER_KINDS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => { if (kind === k) return; setCustErr(''); setPicked(false); setKind(k); setF(v => ({ ...v, name: '', phone: '', email: '', address: '' })); }}>{label}</button>)}
              </div>
            </header>
            <div className="oc-grid">
              {kind !== 'New' && (
                <div className="a-lbl oc-w2">{kind === 'Upcoming' ? 'Upcoming customer' : 'Existing customer'}
                  <CustomerPick type={kind} bad={!!custErr} selected={picked ? f.name : ''} onClear={() => { setPicked(false); setF(v => ({ ...v, name: '', phone: '', email: '', address: '' })); }}
                    onPick={c => { setCustErr(''); setPicked(true); setF(v => ({ ...v, name: c.name, phone: c.phone || v.phone, email: c.email || v.email, address: c.address || v.address })); }} />
                  {custErr && <small className="qt-err" role="alert">{custErr}</small>}
                </div>
              )}
              <label className="a-lbl">Name<input className="a-input" required={need} value={f.name} onChange={set('name')} /></label>
              <label className="a-lbl">Mobile<input className="a-input" required={need} value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" /></label>
              <label className="a-lbl"><span>Email <small>(optional)</small></span><input className="a-input" type="email" value={f.email} onChange={set('email')} /></label>
              <label className="a-lbl">Delivery area<select className="a-input" value={f.area} onChange={set('area')}>{Object.entries(AREA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className="a-lbl oc-span2">Delivery address<textarea className="a-input" required={need} rows={2} maxLength={500} value={f.address} onChange={set('address')} /></label>
            </div>
          </section>
          <section className="iv-lines">
            <header className="iv-lhd"><b>Products</b><span>{lines.length ? `${lines.length} product${lines.length === 1 ? '' : 's'}` : 'Add one or more'}</span></header>
            <div className="oc-add"><Pick onPick={add} /></div>
            {lines.length ? (
              <div className="oc-lt">
                {lines.map(l => (
                  <div key={l.id} className="oc-lr">
                    <span title={l.name}><b>{l.name}</b><small>{fmtMoney(l.price)} · stock {l.stock}</small></span>
                    <input className="a-input r" type="number" min="1" max="999" value={l.qty} onChange={e => setQty(l.id, e.target.value)} aria-label="Quantity" />
                    <strong>{fmtMoney(l.price * l.qty)}</strong>
                    <IconBtn icon="trash" tone="bad" title="Remove this product" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} />
                  </div>
                ))}
                <div className="iv-lt-sum"><span>Subtotal (delivery and any discount are added when you save)</span><b>{fmtMoney(sub)}</b></div>
              </div>
            ) : <div className="iv-lempty">No products added yet. Search above and pick as many as the customer wants.</div>}
          </section>
        </div>
        <aside className="oc-side">
          <div className="pu-sum"><small>Subtotal</small><b>{fmtMoney(sub)}</b><div className="pu-sum-row"><span>Products</span><em>{lines.length}</em></div><div className="pu-sum-row"><span>Units</span><em>{lines.reduce((t, l) => t + l.qty, 0)}</em></div></div>
          <section className="pu-card oc-box">
            <div className="a-lbl">Order generated by
              <div className="oc-src" role="radiogroup" aria-label="Order generated by">
                {SOURCES.filter(s => s.staff).map(s => (
                  <button key={s.key} type="button" role="radio" aria-checked={f.source === s.key} className={f.source === s.key ? 'on' : ''} onClick={() => setF(v => ({ ...v, source: s.key }))}><i>{s.icon}</i><b>{s.key}</b><small>{s.hint}</small></button>
                ))}
              </div>
            </div>
            <label className="a-lbl">Payment<select className="a-input" value={f.payment} onChange={set('payment')}>{PAYMENTS.map(p => <option key={p}>{p}</option>)}</select></label>
            <label className="a-lbl"><span>Note <small>(optional)</small></span><textarea className="a-input" rows={3} maxLength={500} value={f.note} onChange={set('note')} placeholder="Delivery time, gate pass, special request…" /></label>
          </section>
        </aside>
      </div>
    </Modal>
  );
}
