import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Fact, Grid, Notice, Skeleton, Tabs, fDate, taka, todayBd } from '../../fieldKit.jsx';
import { useInv, num, AddBtn, Foot, ProductPick, Lines, linesBody, VendorSelect, useVendors, vendorOptions } from './shared.jsx';

function DamageForm({ vendors, onClose, onSaved }) {
  const [p, setP] = useState(null); const [f, setF] = useState({ qty: 1, reason: '', vendorId: '', date: todayBd() });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); if (!p) { setErr('Choose the damaged product'); return; }
    setBusy(true); setErr('');
    try { await invApi.post('/damages', { ...f, productId: p.id, qty: num(f.qty) }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal narrow kicker="Damage" title="Record damaged stock" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Save & remove from stock" />}>
      <div className="iv-form"><Notice err={err} />
        {p ? <div className="iv-chosen"><b>{p.name}</b><small>in stock {p.stock}</small><button type="button" className="a-x" onClick={() => setP(null)}>✕</button></div> : <ProductPick onPick={setP} placeholder="Search the damaged product…" />}
        <div className="a-fields">
          <label className="a-lbl">Quantity damaged<input className="a-input" type="number" min="1" max={p?.stock} required value={f.qty} onChange={set('qty')} /></label>
          <label className="a-lbl">Date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
        </div>
        <label className="a-lbl">What happened<input className="a-input" required value={f.reason} onChange={set('reason')} placeholder="Broken in transit, expired, water damage…" /></label>
        <label className="a-lbl">Vendor at fault <small>(optional)</small><VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v }))} required={false} /></label>
        <small className="fd-sub">The loss is valued at the last buying price. To get credit from the vendor, also record a return to vendor.</small>
      </div>
    </Modal>
  );
}
function ReturnForm({ vendors, onClose, onSaved }) {
  const [f, setF] = useState({ vendorId: '', receiptId: '', reason: '', date: todayBd() }); const [lines, setLines] = useState([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const bills = useInv(f.vendorId ? '/receipts?vendor=' + f.vendorId : null);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await invApi.post('/returns', { ...f, lines: linesBody(lines) }); onSaved(); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  const total = lines.reduce((t, l) => t + num(l.qty) * num(l.unitCost), 0);
  return (
    <Modal side kicker="Return" title="Return goods to a vendor" onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Save & remove from stock" />}>
      <div className="iv-form"><Notice err={err} />
        <div className="a-fields">
          <label className="a-lbl">Vendor<VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v, receiptId: '' }))} /></label>
          <label className="a-lbl">Original purchase <small>(optional)</small><select className="a-input" value={f.receiptId} onChange={set('receiptId')} disabled={!f.vendorId}><option value="">—</option>{(bills.data?.items || []).map(b => <option key={b.id} value={b.id}>{b.id} · {fDate(b.date)} · {taka(b.total)}</option>)}</select></label>
          <label className="a-lbl">Date<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
        </div>
        <Lines lines={lines} setLines={setLines} costLabel="Credit price" maxStock />
        <label className="a-lbl">Reason<input className="a-input" required value={f.reason} onChange={set('reason')} placeholder="Wrong model, defective, excess…" /></label>
        <small className="fd-sub">Saving takes the quantities out of stock and reduces what you owe this vendor by {taka(total)}.</small>
      </div>
    </Modal>
  );
}
function ReturnDrawer({ r, onClose }) {
  const d = useInv('/returns/' + r.id);
  return (
    <Drawer title={r.id} sub={`${r.vendor} · ${taka(r.total)}`} onClose={onClose}>
      <div className="fd-facts"><Fact k="Vendor">{r.vendor}</Fact><Fact k="Date">{fDate(r.date)}</Fact><Fact k="Original purchase">{r.receiptId}</Fact><Fact k="Reason">{r.reason}</Fact><Fact k="Entered by">{r.by}</Fact></div>
      {!d.data ? <Skeleton rows={3} /> : <div className="fd-sub-row">{d.data.lines.map((l, i) => <div key={i}><span>{l.name}</span><em>{l.qty} × {taka(l.unitCost)}</em><b>{taka(l.total)}</b></div>)}<div className="fd-sub-sum">Credit from vendor <b>{taka(r.total)}</b></div></div>}
    </Drawer>
  );
}
export function InvDamage({ staff }) {
  const [tab, setTab] = useState('damage');
  const dm = useTable('/damages', { q: '', vendor: '', from: '', to: '' }, [], invApi);
  const rt = useTable('/returns', { q: '', vendor: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const vendors = useVendors();
  const [modal, setModal] = useState(null); const [ret, setRet] = useState(null);
  const canEdit = can(staff, 'inventory.manage');
  const t = tab === 'damage' ? dm : rt;
  return (
    <>
      <Summary items={[
        ['Damage records', dm.data.total, 'matching your filters', 'red', 'alert'],
        ['Units damaged', dm.data.totals?.qty ?? 0, 'taken out of stock', 'amber', 'box'],
        ['Damage loss', taka(dm.data.totals?.loss), 'at the last buying price', 'blue', 'tag'],
        ['Returned to vendors', taka(rt.data.totals?.total), `${rt.data.total} return${rt.data.total === 1 ? '' : 's'}`, 'violet', 'truck']
      ]} />
      {tab === 'damage'
        ? <ListFilter t={dm} noun="record" title="Search damaged stock" search={{ placeholder: 'Product, reason, vendor or record no.' }} selects={[{ key: 'vendor', label: 'Vendor at fault', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Damaged' }} />
        : <ListFilter t={rt} noun="return" title="Search returns to vendors" search={{ placeholder: 'Return no., vendor, reason or purchase' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Returned' }} amount={{ label: 'Credit' }} />}
      <Toolbar t={t} search={false} />
      <Notice err={dm.error || rt.error} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Damage & returns</h3><small className="fd-sub">Both take the goods out of stock</small></div>
          <div className="bk-acts">{canEdit && <><button type="button" className="a-mini" onClick={() => setModal('damage')}>＋ Record damage</button><AddBtn onClick={() => setModal('return')}>＋ Return to vendor</AddBtn></>}</div></div>
        <Tabs value={tab} onChange={setTab} items={[['damage', 'Damaged stock', dm.data.total], ['returns', 'Returns to vendors', rt.data.total]]} />
        {tab === 'damage' ? (
          <Grid server={dm} cols="44px 100px minmax(220px,2fr) 70px 110px minmax(160px,1.3fr) 140px" head={['SL', 'Record', 'Product', 'Qty', 'Loss', 'What happened', 'Date']} empty="No damaged stock matches."
            rows={dm.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(dm, i), <b key="i" className="mono">{x.id}</b>, <span key="n"><b>{x.name}</b>{x.vendor && <small style={{ display: 'block', color: '#6b7388' }}>vendor: {x.vendor}</small>}</span>, x.qty, taka(x.loss), x.reason, fDate(x.date)] }))} />
        ) : (
          <Grid server={rt} cols="44px 100px minmax(180px,1.5fr) 80px 120px minmax(160px,1.3fr) 130px" head={['SL', 'Return', 'Vendor', 'Qty', 'Credit', 'Reason', 'Date']} onRow={setRet} empty="No return to a vendor matches."
            rows={rt.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(rt, i), <b key="i" className="mono">{x.id}</b>, x.vendor, x.pcs, taka(x.total), x.reason, fDate(x.date)] }))} />
        )}
      </section>
      {modal === 'damage' && <DamageForm vendors={vendors} onClose={() => setModal(null)} onSaved={dm.reload} />}
      {modal === 'return' && <ReturnForm vendors={vendors} onClose={() => setModal(null)} onSaved={() => { rt.reload(); setTab('returns'); }} />}
      {ret && <ReturnDrawer r={ret} onClose={() => setRet(null)} />}
    </>
  );
}
