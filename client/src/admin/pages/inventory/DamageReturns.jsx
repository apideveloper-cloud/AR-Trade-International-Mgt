import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Fact, Grid, Notice, Skeleton, Tabs, fDate, taka, todayBd } from '../../fieldKit.jsx';
import { useInv, useSaveForm, num, AddBtn, Foot, ProductPick, Lines, linesBody, VendorSelect, useVendors, vendorOptions } from './shared.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/inventory.js';

/** Record damaged stock; it is taken out of stock. */
function DamageForm({ vendors, onClose, onSaved }) {
  const tr = useT();
  const [p, setP] = useState(null); const [f, setF] = useState({ qty: 1, reason: '', vendorId: '', date: todayBd() });
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const save = () => {
    if (!p) throw new Error(tr('Choose the damaged product'));
    return invApi.post('/damages', { ...f, productId: p.id, qty: num(f.qty) });
  };
  return (
    <Modal narrow kicker={tr('Damage')} title={tr('Record damaged stock')} onClose={onClose} onSubmit={submit(save)} footer={<Foot onClose={onClose} busy={busy} label="Save & remove from stock" />}>
      <div className="iv-form"><Notice err={err && tr(err)} />
        {p ? <div className="iv-chosen"><b>{p.name}</b><small>{tr('in stock {n}', { n: p.stock })}</small><button type="button" className="a-x" onClick={() => setP(null)}>✕</button></div> : <ProductPick onPick={setP} placeholder="Search the damaged product…" />}
        <div className="a-fields">
          <label className="a-lbl">{tr('Quantity damaged')}<input className="a-input" type="number" min="1" max={p?.stock} required value={f.qty} onChange={set('qty')} /></label>
          <label className="a-lbl">{tr('Date')}<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
        </div>
        <label className="a-lbl">{tr('What happened')}<input className="a-input" required value={f.reason} onChange={set('reason')} placeholder={tr('Broken in transit, expired, water damage…')} /></label>
        <label className="a-lbl">{tr('Vendor at fault')} <small>{tr('(optional)')}</small><VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v }))} required={false} /></label>
        <small className="fd-sub">{tr('The loss is valued at the last buying price. To get credit from the vendor, also record a return to vendor.')}</small>
      </div>
    </Modal>
  );
}
/** Return goods to a vendor; takes them out of stock and reduces what is owed. */
function ReturnForm({ vendors, onClose, onSaved }) {
  const tr = useT();
  const [f, setF] = useState({ vendorId: '', receiptId: '', reason: '', date: todayBd() }); const [lines, setLines] = useState([]);
  const { busy, err, submit } = useSaveForm(onSaved, onClose);
  const bills = useInv(f.vendorId ? '/receipts?vendor=' + f.vendorId : null);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const total = lines.reduce((t, l) => t + num(l.qty) * num(l.unitCost), 0);
  return (
    <Modal side kicker={tr('Return')} title={tr('Return goods to a vendor')} onClose={onClose} onSubmit={submit(() => invApi.post('/returns', { ...f, lines: linesBody(lines) }))} footer={<Foot onClose={onClose} busy={busy} label="Save & remove from stock" />}>
      <div className="iv-form"><Notice err={err && tr(err)} />
        <div className="a-fields">
          <label className="a-lbl">{tr('Vendor')}<VendorSelect vendors={vendors} value={f.vendorId} onChange={v => setF(x => ({ ...x, vendorId: v, receiptId: '' }))} /></label>
          <label className="a-lbl">{tr('Original purchase')} <small>{tr('(optional)')}</small><select className="a-input" value={f.receiptId} onChange={set('receiptId')} disabled={!f.vendorId}><option value="">—</option>{(bills.data?.items || []).map(b => <option key={b.id} value={b.id}>{b.id} · {fDate(b.date)} · {taka(b.total)}</option>)}</select></label>
          <label className="a-lbl">{tr('Date')}<input className="a-input" type="date" required value={f.date} onChange={set('date')} /></label>
        </div>
        <Lines lines={lines} setLines={setLines} costLabel="Credit price" maxStock />
        <label className="a-lbl">{tr('Reason')}<input className="a-input" required value={f.reason} onChange={set('reason')} placeholder={tr('Wrong model, defective, excess…')} /></label>
        <small className="fd-sub">{tr('Saving takes the quantities out of stock and reduces what you owe this vendor by {a}.', { a: taka(total) })}</small>
      </div>
    </Modal>
  );
}
/** One return to a vendor with its lines. */
function ReturnDrawer({ r, onClose }) {
  const tr = useT();
  const d = useInv('/returns/' + r.id);
  return (
    <Drawer title={r.id} sub={`${r.vendor} · ${taka(r.total)}`} onClose={onClose}>
      <div className="fd-facts"><Fact k={tr('Vendor')}>{r.vendor}</Fact><Fact k={tr('Date')}>{fDate(r.date)}</Fact><Fact k={tr('Original purchase')}>{r.receiptId}</Fact><Fact k={tr('Reason')}>{r.reason}</Fact><Fact k={tr('Entered by')}>{r.by}</Fact></div>
      {!d.data ? <Skeleton rows={3} /> : <div className="fd-sub-row">{d.data.lines.map((l, i) => <div key={i}><span>{l.name}</span><em>{l.qty} × {taka(l.unitCost)}</em><b>{taka(l.total)}</b></div>)}<div className="fd-sub-sum">{tr('Credit from vendor')} <b>{taka(r.total)}</b></div></div>}
    </Drawer>
  );
}
/** Damage and returns page. */
export function InvDamage({ staff }) {
  const tr = useT();
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
        [tr('Damage records'), dm.data.total, tr('matching your filters'), 'red', 'alert'],
        [tr('Units damaged'), dm.data.totals?.qty ?? 0, tr('taken out of stock'), 'amber', 'box'],
        [tr('Damage loss'), taka(dm.data.totals?.loss), tr('at the last buying price'), 'blue', 'tag'],
        [tr('Returned to vendors'), taka(rt.data.totals?.total), tr(rt.data.total === 1 ? '{n} return' : '{n} returns', { n: rt.data.total }), 'violet', 'truck']
      ]} />
      {tab === 'damage'
        ? <ListFilter t={dm} noun="record" title="Search damaged stock" search={{ placeholder: 'Product, reason, vendor or record no.' }} selects={[{ key: 'vendor', label: 'Vendor at fault', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Damaged' }} />
        : <ListFilter t={rt} noun="return" title="Search returns to vendors" search={{ placeholder: 'Return no., vendor, reason or purchase' }} selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }]} range={{ label: 'Returned' }} amount={{ label: 'Credit' }} />}
      <Toolbar t={t} search={false} />
      <Notice err={(dm.error || rt.error) && tr(dm.error || rt.error)} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Damage & returns')}</h3><small className="fd-sub">{tr('Both take the goods out of stock')}</small></div>
          <div className="bk-acts">{canEdit && <><button type="button" className="a-mini" onClick={() => setModal('damage')}>{tr('＋ Record damage')}</button><AddBtn onClick={() => setModal('return')}>{tr('＋ Return to vendor')}</AddBtn></>}</div></div>
        <Tabs value={tab} onChange={setTab} items={[['damage', tr('Damaged stock'), dm.data.total], ['returns', tr('Returns to vendors'), rt.data.total]]} />
        {tab === 'damage' ? (
          <Grid server={dm} cols="44px 100px minmax(220px,2fr) 70px 110px minmax(160px,1.3fr) 140px" head={['SL', 'Record', 'Product', 'Qty', 'Loss', 'What happened', 'Date'].map(h => tr(h))} empty={tr('No damaged stock matches.')}
            rows={dm.data.rows.map((x, i) => ({ key: x.id, cells: [slNo(dm, i), <b key="i" className="mono">{x.id}</b>, <span key="n"><b>{x.name}</b>{x.vendor && <small className="iv-subline">{tr('vendor: {name}', { name: x.vendor })}</small>}</span>, x.qty, taka(x.loss), x.reason, fDate(x.date)] }))} />
        ) : (
          <Grid server={rt} cols="44px 100px minmax(180px,1.5fr) 80px 120px minmax(160px,1.3fr) 130px" head={['SL', 'Return', 'Vendor', 'Qty', 'Credit', 'Reason', 'Date'].map(h => tr(h))} onRow={setRet} empty={tr('No return to a vendor matches.')}
            rows={rt.data.rows.map((x, i) => ({ key: x.id, item: x, cells: [slNo(rt, i), <b key="i" className="mono">{x.id}</b>, x.vendor, x.pcs, taka(x.total), x.reason, fDate(x.date)] }))} />
        )}
      </section>
      {modal === 'damage' && <DamageForm vendors={vendors} onClose={() => setModal(null)} onSaved={dm.reload} />}
      {modal === 'return' && <ReturnForm vendors={vendors} onClose={() => setModal(null)} onSaved={() => { rt.reload(); setTab('returns'); }} />}
      {ret && <ReturnDrawer r={ret} onClose={() => setRet(null)} />}
    </>
  );
}
