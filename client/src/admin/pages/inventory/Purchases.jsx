import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar, alertBox, confirmBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { Chip, Grid, Notice, Skeleton, downloadCsv, fDate, fDateTime, taka, todayBd } from '../../fieldKit.jsx';
import { VendorForm, initials } from './Vendors.jsx';
import { useInv, ProdThumb, lineTotal, num, AddBtn, Foot, Lines, linesBody, VendorSelect, PayForm, fetchAll, vendorOptions, balTone, balText } from './shared.jsx';

const STAGE_TONE = { Pending: 'amber', Approved: 'blue', Stocked: 'ok', Rejected: 'bad' };
const Stage = ({ s }) => <Chip tone={STAGE_TONE[s] || 'off'}>{s}</Chip>;

/** Step 1 of 3: record the purchase. Nothing touches stock or the vendor's account until it is approved and stocked in. */
function ReceiveForm({ vendors, onVendorAdded, onClose, onSaved }) {
  const [f, setF] = useState({ vendorId: '', poId: '', referenceNo: '', date: todayBd(), note: '' });
  const nextNo = useInv('/next-invoice?date=' + f.date);
  const sel = vendors.find(v => String(v.id) === String(f.vendorId));
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [newVendor, setNewVendor] = useState(false);
  const pos = useInv('/open-orders');
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const pickPo = async id => {
    const po = (pos.data?.items || []).find(p => p.id === id);
    setF(v => ({ ...v, poId: id, vendorId: po ? String(po.vendorId) : v.vendorId }));
    if (!po) return;
    try { const r = await invApi.get('/open-orders/' + id); setLines(r.lines.map(l => ({ ...l, stock: '—' }))); } catch (e) { setErr(e.message); }
  };
  const total = lines.reduce((t, l) => t + lineTotal(l), 0);
  const discount = lines.reduce((t, l) => t + Math.min(num(l.discount), num(l.qty) * num(l.unitCost)), 0);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await invApi.post('/receipts', { vendorId: f.vendorId, poId: f.poId, referenceNo: f.referenceNo, date: f.date, note: f.note, lines: linesBody(lines) });
      onSaved(); onClose();
    } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <>
      <Modal side kicker="Purchase · step 1 of 3" title="Add a purchase" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Save purchase" />}>
        <div className="pu-form">
          <div className="pu-main">
            <Notice err={err} />
            {!!(pos.data?.items || []).length && (
              <label className="a-lbl">Against an approved purchase order <small>(optional: fills in the vendor and products)</small>
                <select className="a-input" value={f.poId} onChange={e => pickPo(e.target.value)}><option value="">No purchase order</option>{pos.data.items.map(p => <option key={p.id} value={p.id}>{p.id} · {p.vendor} · {taka(p.total)}</option>)}</select></label>
            )}
            <section className="pu-card">
              <header className="iv-lhd"><b>Purchase details</b><span>Who sold it, and when</span></header>
              <div className="pu-fields">
                <div className="a-lbl">Vendor
                  <span className="iv-paid"><VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v }))} /><button type="button" className="a-mini" onClick={() => setNewVendor(true)}>＋ New</button></span></div>
                <label className="a-lbl"><span className="pu-lbl">Vendor invoice no. <i className="pu-auto">auto</i></span><input className="a-input pu-locked" readOnly tabIndex={-1} value={nextNo.data?.invoiceNo || '…'} title="Given automatically when you save" /></label>
                <label className="a-lbl"><span className="pu-lbl">Reference no. <i className="pu-opt">optional</i></span><input className="a-input" maxLength={60} value={f.referenceNo} onChange={set('referenceNo')} placeholder="Vendor's bill, challan or PO no." /></label>
                <label className="a-lbl">Purchase date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
              </div>
              {sel && (
                <div className="pu-vinfo">
                  <span className="vd-av sm" aria-hidden="true">{initials(sel.name)}</span>
                  <div className="pu-vmain">
                    <b>{sel.name}</b>
                    <span className="pu-vtags"><i className="vd-id mono">{sel.code || '—'}</i><Chip tone={sel.vtype === 'Foreign' ? 'blue' : 'ok'}>{sel.vtype}</Chip>{!sel.active && <Chip tone="off">Inactive</Chip>}{sel.kind && <em>{sel.kind}</em>}</span>
                    <Chip tone={balTone(sel.balance)}>{balText(sel.balance)}</Chip>
                  </div>
                  <dl className="pu-vdl">
                    <div><dt>PIC</dt><dd>{[sel.contact, sel.picDesig].filter(Boolean).join(' · ') || '—'}</dd></div>
                    <div><dt>PIC mobile</dt><dd>{sel.picPhone || '—'}</dd></div>
                    <div><dt>Phone</dt><dd>{sel.phone || '—'}</dd></div>
                    <div><dt>Email</dt><dd>{sel.email || '—'}</dd></div>
                    <div className="wide"><dt>Address</dt><dd>{sel.address || '—'}</dd></div>
                  </dl>
                </div>
              )}
            </section>
            <Lines lines={lines} setLines={setLines} withDiscount newProduct />
          </div>
          <aside className="pu-side">
            <div className="pu-sum">
              <small>Purchase total</small>
              <b>{taka(total)}</b>
              <div className="pu-sum-row"><span>Products</span><em>{lines.length}</em></div>
              {discount > 0 && <div className="pu-sum-row"><span>Discount given</span><em>−{taka(discount)}</em></div>}
              <div className="pu-sum-row"><span>Units</span><em>{lines.reduce((t, l) => t + num(l.qty), 0)}</em></div>
            </div>
            <label className="a-lbl">Note<textarea className="a-input" rows={3} maxLength={300} value={f.note} onChange={set('note')} placeholder="Challan no., condition on arrival…" /></label>
            <ol className="pu-steps">
              <li className="now"><i>1</i><div><b>Add</b><small>You are here. Save the purchase.</small></div></li>
              <li><i>2</i><div><b>Approve</b><small>A Master Admin or Admin approves it. It becomes a bill on the vendor's account.</small></div></li>
              <li><i>3</i><div><b>Stock in</b><small>Set each selling price and remarks, then add to stock.</small></div></li>
            </ol>
          </aside>
        </div>
      </Modal>
      {newVendor && <VendorForm onClose={() => setNewVendor(false)} onSaved={res => { onVendorAdded(String(res?.id || '')); if (res?.id) setF(x => ({ ...x, vendorId: String(res.id) })); }} />}
    </>
  );
}

/** Step 3 of 3: put the approved goods into stock, with each product's selling price and a remark. */
function StockInForm({ d, onClose, onSaved }) {
  const [rows, setRows] = useState(d.lines.map(l => ({ productId: l.productId, name: l.name, qty: l.qty, cost: l.unitCost, salePrice: l.salePrice || l.currentPrice || '', current: l.currentPrice, remarks: l.remarks || '' })));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setRows(r => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await invApi.post('/receipts/' + d.id + '/stock-in', { lines: rows.map(r => ({ productId: r.productId, salePrice: num(r.salePrice), remarks: r.remarks })) }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side kicker={d.id + ' · step 3 of 3'} title="Stock in" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Add to stock" />}>
      <div className="iv-form">
        <Notice err={err} />
        <div className="iv-flow"><span>1 Add</span><i className="on" /><span>2 Approve</span><i className="on" /><b>3 Stock in</b></div>
        <small className="fd-sub">Set the selling price for each product. It replaces the current price in the product list when you save.</small>
        <div className="iv-si">
          {rows.map((r, i) => {
            const sale = num(r.salePrice); const gain = sale - num(r.cost);
            return (
              <div key={r.productId} className="iv-si-row">
                <div className="iv-si-hd"><b>{r.name}</b><span>{r.qty} × buying {taka(r.cost)}</span></div>
                <div className="iv-si-in">
                  <label className="a-lbl">Selling price ৳<input className="a-input" type="number" min="1" required value={r.salePrice} onChange={e => set(i, 'salePrice', e.target.value)} placeholder={r.current ? String(r.current) : '0'} /></label>
                  <label className="a-lbl">Remarks <small>(optional)</small><input className="a-input" maxLength={200} value={r.remarks} onChange={e => set(i, 'remarks', e.target.value)} placeholder="Batch, shelf, condition…" /></label>
                </div>
                <small className="iv-si-note">{r.current ? 'Current price ' + taka(r.current) + ' · ' : ''}{sale ? (gain >= 0 ? 'margin ' + taka(gain) + ' per unit' : <b className="bad-t">below buying price by {taka(-gain)}</b>) : 'enter the price'}</small>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function RejectForm({ id, onClose, onSaved }) {
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await invApi.post('/receipts/' + id + '/reject', { note }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal narrow kicker={id} title="Reject this purchase" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Reject purchase" />}>
      <div className="iv-form"><Notice err={err} />
        <label className="a-lbl">Reason<textarea className="a-input" rows={3} required maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Why is this purchase being rejected?" /></label>
      </div>
    </Modal>
  );
}

/** Step 2 of 3: the approver sets every product's selling price and a remark (both required), then approves. */
function ApproveForm({ d, onClose, onSaved }) {
  const [rows, setRows] = useState(d.lines.map(l => ({ productId: l.productId, name: l.name, img: l.img, qty: l.qty, cost: Math.round((l.qty * l.unitCost - (l.discount || 0)) / l.qty), salePrice: l.salePrice || l.currentPrice || '', current: l.currentPrice, remarks: l.remarks || '' })));
  const [note, setNote] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (i, k, v) => setRows(r => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = async e => {
    e.preventDefault(); setErr('');
    const bad = rows.find(r => num(r.salePrice) <= 0 || r.remarks.trim().length < 2);
    if (bad) { setErr(num(bad.salePrice) <= 0 ? `Enter the selling price of "${bad.name}".` : `Write the remarks for "${bad.name}".`); return; }
    setBusy(true);
    try { await invApi.post('/receipts/' + d.id + '/approve', { note, lines: rows.map(r => ({ productId: r.productId, salePrice: num(r.salePrice), remarks: r.remarks.trim() })) }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side kicker={d.id + ' · step 2 of 3'} title="Approve this purchase" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Approve purchase" />}>
      <div className="iv-form">
        <Notice err={err} />
        <div className="iv-flow"><span>1 Add</span><i className="on" /><b>2 Approve</b><i /><span>3 Stock in</span></div>
        <small className="fd-sub">Set the <b>selling price</b> and write <b>remarks</b> for every product before approving. Both are required. The price goes live in the product list when the goods are stocked in.</small>
        <div className="iv-si">
          {rows.map((r, i) => {
            const sale = num(r.salePrice); const gain = sale - num(r.cost);
            return (
              <div key={r.productId} className="iv-si-row">
                <div className="iv-si-hd"><span className="pd-nm"><ProdThumb src={r.img} name={r.name} size={34} /><b>{r.name}</b></span><span>{r.qty} × buying {taka(r.cost)}</span></div>
                <div className="iv-si-in">
                  <label className="a-lbl"><span className="pu-lbl">Selling price ৳ <i className="pu-req">required</i></span><input className="a-input" type="number" min="1" value={r.salePrice} onChange={e => set(i, 'salePrice', e.target.value)} placeholder={r.current ? String(r.current) : '0'} /></label>
                  <label className="a-lbl"><span className="pu-lbl">Remarks <i className="pu-req">required</i></span><input className="a-input" maxLength={200} value={r.remarks} onChange={e => set(i, 'remarks', e.target.value)} placeholder="Batch, quality check, shelf, price reason…" /></label>
                </div>
                <small className="iv-si-note">{r.current ? 'Current price ' + taka(r.current) + ' · ' : ''}{sale ? (gain >= 0 ? 'margin ' + taka(gain) + ' per unit' : <b className="bad-t">below buying price by {taka(-gain)}</b>) : 'enter the price'}</small>
              </div>
            );
          })}
        </div>
        <label className="a-lbl">Approval note <small>(optional)</small><textarea className="a-input" rows={2} maxLength={300} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the team should know" /></label>
      </div>
    </Modal>
  );
}

function ReceiptDrawer({ id, canEdit, canApprove, vendors, onClose, onChanged }) {
  const r = useInv('/receipts/' + id); const [pay, setPay] = useState(false); const [stock, setStock] = useState(false); const [reject, setReject] = useState(false); const [appr, setAppr] = useState(false);
  const d = r.data;
  const after = () => { r.reload(); onChanged(); };
  const remove = async () => {
    if (!(await confirmBox(`Delete ${id}? Nothing has gone into stock, so nothing else changes.`, { danger: true, confirmLabel: 'Delete' }))) return;
    try { await invApi.del('/receipts/' + id); onChanged(); onClose(); } catch (e) { alertBox(e.message); }
  };
  const billed = d && (d.status === 'Approved' || d.status === 'Stocked');
  const units = d ? d.lines.reduce((t, l) => t + l.qty, 0) : 0;
  const when = v => (v ? fDateTime(v) : '');
  const node = (cls, mark, title, who, at) => <li className={cls}><i>{mark}</i><b>{title}</b><small>{who}</small>{at && <small className="pd-at">{at}</small>}</li>;
  return (
    <Drawer title={id} sub={d ? `${d.vendor} · ${taka(d.total)}` : 'Loading…'} onClose={onClose}>
      {!d ? <Skeleton rows={6} /> : (
        <>
          <section className="pd-hero pd-top">
            <div className="pd-h-l">
              <span className="pd-h-av" aria-hidden="true">{initials(d.vendor)}</span>
              <div className="pd-h-v"><b>{d.vendor}</b><span>{d.vendorCode && <i className="mono">{d.vendorCode}</i>}<i className="mono">{d.invoiceNo || '—'}</i></span></div>
            </div>
            <div className="pd-h-r"><small>Purchase total</small><strong>{taka(d.total)}</strong><Stage s={d.status} /></div>
            <div className="pd-h-meta">
              <span><small>Purchase date</small>{fDate(d.date)}</span>
              <span><small>Reference no.</small>{d.referenceNo || '—'}</span>
              <span><small>Entered by</small>{d.by}</span>
              <span><small>Purchase order</small>{d.poId || '—'}</span>
            </div>
          </section>
          <ol className="pd-flow">
            {node('done', '✓', 'Added', d.by, when(d.createdAt))}
            {node(d.status === 'Rejected' ? 'bad' : d.status === 'Pending' ? 'now' : 'done', d.status === 'Rejected' ? '✕' : d.status === 'Pending' ? 2 : '✓', d.status === 'Rejected' ? 'Rejected' : 'Approval', d.status === 'Pending' ? 'Waiting for approval' : d.decidedBy, when(d.decidedAt))}
            {node(d.status === 'Stocked' ? 'done' : d.status === 'Approved' ? 'now' : '', d.status === 'Stocked' ? '✓' : 3, 'Stock in', d.status === 'Stocked' ? d.stockedBy : d.status === 'Approved' ? 'Ready to stock in' : '—', when(d.stockedAt))}
          </ol>
          {d.decisionNote && <div className={'pd-note ' + (d.status === 'Rejected' ? 'bad' : '')}><b>{d.status === 'Rejected' ? 'Rejected' : 'Approval note'}</b>{d.decisionNote}</div>}
          <div className="vd-stats pd-stats3">
            <div><small>Units</small><b>{units}</b></div>
            <div><small>Paid</small><b>{billed ? taka(d.paid) : '—'}</b></div>
            <div className={'vd-bal ' + (!billed ? '' : d.due ? 'bad' : 'ok')}><small>{billed ? 'Balance' : 'Not billed yet'}</small><b>{billed ? (d.due ? taka(d.due) + ' due' : 'Fully paid') : '—'}</b></div>
          </div>
          {d.note && <div className="pd-note"><b>Note</b>{d.note}</div>}
          <section className="vd-card pd-lines">
            <header className="iv-lhd"><b>Products</b><span>{d.lines.length} product{d.lines.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}</span></header>
            <div className="pd-lh"><span /><span>Product</span><span>Qty × buying price</span><span>Total</span></div>
            {d.lines.map((l, i) => {
              const margin = l.salePrice ? l.salePrice - Math.round(l.total / l.qty) : null;
              return (
                <div key={i} className="pd-line">
                  <ProdThumb src={l.img} name={l.name} size={42} />
                  <div className="pd-ln"><b>{l.name}</b>
                    {l.salePrice
                      ? <span className="pd-sp"><em>Sells at <strong>{taka(l.salePrice)}</strong></em>{margin !== null && <em className={margin >= 0 ? 'up' : 'down'}>{margin >= 0 ? '+' : '−'}{taka(Math.abs(margin))} / unit</em>}</span>
                      : <small className="pd-pend">Selling price not set yet</small>}
                    {l.remarks && <small className="pd-rm">“{l.remarks}”</small>}</div>
                  <span className="pd-q">{l.qty} × {taka(l.unitCost)}{l.discount ? <em>− {taka(l.discount)} discount</em> : null}</span>
                  <b className="pd-t">{taka(l.total)}</b>
                </div>
              );
            })}
            <div className="iv-lt-sum"><span>Total</span><b>{taka(d.total)}</b></div>
          </section>
          {!!d.payments.length && (
            <section className="vd-card">
              <header className="iv-lhd"><b>Payments on this bill</b><span>{d.payments.length}</span></header>
              <div className="fd-sub-row" style={{ padding: '4px 12px 8px' }}>{d.payments.map(p => <div key={p.id}><span>{fDate(p.date)} · {p.method}{p.reference ? ' · ' + p.reference : ''}</span><em className="mono">{p.id}</em><b>{taka(p.amount)}</b></div>)}</div>
            </section>
          )}
          <div className="pd-bar">
            {d.status === 'Pending' && canApprove && <button type="button" className="a-btn sm grad" onClick={() => setAppr(true)}>Approve…</button>}
            {d.status === 'Pending' && canApprove && <button type="button" className="a-btn sm ghost pd-rej" onClick={() => setReject(true)}>Reject</button>}
            {d.status === 'Pending' && !canApprove && <small className="fd-sub">Waiting for a Master Admin or Admin to approve.</small>}
            {d.status === 'Approved' && canEdit && <button type="button" className="a-btn sm grad" onClick={() => setStock(true)}>Stock in</button>}
            {d.status === 'Approved' && !canEdit && <small className="fd-sub">Approved. Waiting to be stocked in.</small>}
            {billed && canEdit && d.due > 0 && <button type="button" className="a-btn sm ghost" onClick={() => setPay(true)}>Record payment</button>}
            <span className="vd-sp" />
            {(d.status === 'Pending' || d.status === 'Rejected') && canEdit && <IconBtn icon="trash" tone="bad" title="Delete this purchase" onClick={remove} />}
          </div>
        </>
      )}
      {pay && d && <PayForm vendors={vendors} vendor={String(d.vendorId)} receipt={d.id} due={d.due} onClose={() => setPay(false)} onSaved={after} />}
      {appr && d && <ApproveForm d={d} onClose={() => setAppr(false)} onSaved={after} />}
      {stock && d && <StockInForm d={d} onClose={() => setStock(false)} onSaved={after} />}
      {reject && <RejectForm id={id} onClose={() => setReject(false)} onSaved={after} />}
    </Drawer>
  );
}

export function InvPurchases({ staff }) {
  const t = useTable('/receipts', { q: '', vendor: '', stage: '', status: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const vl = useInv('/vendors'); const vendors = vl.data?.items || [];
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false);
  const canEdit = can(staff, 'inventory.manage'); const canApprove = can(staff, 'inventory.approve');
  const m = t.data.totals || {};
  const exportCsv = async () => { const list = await fetchAll('/receipts', t.params).catch(e => { alertBox(e.message); return []; }); if (list.length) downloadCsv('purchases.csv', ['Purchase', 'Date', 'Vendor', 'Vendor invoice no.', 'Reference no.', 'Qty', 'Total', 'Paid', 'Due'], list.map(x => [x.id, x.date, x.vendor, x.invoiceNo, x.referenceNo, x.pcs, x.total, x.paid, x.due])); };
  return (
    <>
      <Summary items={[
        ['Purchases', m.bills ?? '…', 'matching your filters', 'blue', 'cart'],
        ['Bought', taka(m.total), 'value of these bills', 'violet', 'box'],
        ['Unpaid', taka(m.due), `${m.dueCount ?? 0} bill${m.dueCount === 1 ? '' : 's'} with a balance`, 'amber', 'clock'],
        ['Needs action', (m.pending ?? 0) + (m.approved ?? 0), `${m.pending ?? 0} to approve · ${m.approved ?? 0} to stock in`, 'green', 'check']
      ]} />
      <ListFilter t={t} noun="purchase" title="Search purchases" search={{ placeholder: 'Purchase no., invoice or reference no., vendor or PO' }}
        selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'stage', label: 'Stage', all: 'Every stage', icon: 'status', options: [{ v: 'Pending', t: 'Waiting approval' }, { v: 'Approved', t: 'Approved, to stock in' }, { v: 'Stocked', t: 'In stock' }, { v: 'Rejected', t: 'Rejected' }] }, { key: 'status', label: 'Payment', all: 'Paid & unpaid', icon: 'card', options: [{ v: 'due', t: 'Unpaid' }, { v: 'paid', t: 'Paid' }] }]}
        range={{ label: 'Received' }} amount={{ label: 'Bill total' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Purchases</h3><small className="fd-sub">Add → approve → stock in. Stock and the vendor's account change only after approval</small></div>
          <div className="bk-acts"><button type="button" className="a-mini" onClick={exportCsv} disabled={!t.data.total}>⤓ CSV</button>{canEdit && <AddBtn onClick={() => setAdd(true)}>＋ Add purchase</AddBtn>}</div></div>
        <Grid server={t} cols="44px 100px minmax(170px,1.4fr) 100px 110px 60px 110px 130px 110px" head={['SL', 'Purchase', 'Vendor', 'Date', 'Invoice', 'Qty', 'Total', 'Stage', 'Due']} onRow={x => setOpen(x.id)} empty="No purchase matches. Press Add purchase when goods are bought."
          rows={t.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <b key="i" className="mono">{x.id}</b>, x.vendor, fDate(x.date), <span key="inv" className="pu-inv"><span className="mono">{x.invoiceNo || '—'}</span>{x.referenceNo && <small>Ref {x.referenceNo}</small>}</span>, x.pcs, taka(x.total), <Stage key="s" s={x.status} />, x.status === 'Pending' || x.status === 'Rejected' ? '—' : x.due ? <Chip key="d" tone="bad">{taka(x.due)}</Chip> : <Chip key="d" tone="ok">Paid</Chip>] }))} />
      </section>
      {open && <ReceiptDrawer id={open} canEdit={canEdit} canApprove={canApprove} vendors={vendors} onClose={() => setOpen(null)} onChanged={t.reload} />}
      {add && <ReceiveForm vendors={vendors} onVendorAdded={vl.reload} onClose={() => setAdd(false)} onSaved={t.reload} />}
    </>
  );
}
