import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../adminApi.js';
import { Drawer, Modal, Summary, Toolbar, alertBox, confirmBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { Chip, Grid, Notice, Skeleton, Tabs, downloadCsv, fDate, taka } from '../../fieldKit.jsx';
import { useInv, AddBtn, Foot, balTone, balText, PayForm, fetchAll, useVendors, vendorOptions } from './shared.jsx';

export function VendorForm({ vendor, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', vtype: 'Local', kind: '', contact: '', picDesig: '', picPhone: '', phone: '', email: '', address: '', note: '', opening: 0, active: true, ...(vendor || {}) });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const res = vendor ? await invApi.put('/vendors/' + vendor.id, f) : await invApi.post('/vendors', f); onSaved(res); onClose(); } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side kicker="Vendor / supplier" title={vendor ? 'Edit vendor' : 'Add vendor'} onClose={onClose} onSubmit={submit} footer={<Foot onClose={onClose} busy={busy} label="Save vendor" />}>
      <div className="vf">
        <Notice err={err} />
        <section className="pu-card">
          <header className="iv-lhd"><b>Vendor</b><span>The company we buy from</span></header>
          <div className="vf-grid">
            <div className="iv-top vf-w3">
              <label className="a-lbl">Vendor name<input className="a-input" required value={f.name} onChange={set('name')} placeholder="e.g. Global Toner BD" /></label>
              <div className="a-lbl">Vendor type
                <div className="iv-seg" role="radiogroup" aria-label="Vendor type">
                  {['Local', 'Foreign'].map(v => <button key={v} type="button" role="radio" aria-checked={f.vtype === v} className={f.vtype === v ? 'on' : ''} onClick={() => setF(x => ({ ...x, vtype: v }))}>{v}</button>)}
                </div>
              </div>
            </div>
            <label className="a-lbl">Supplies<input className="a-input" value={f.kind} onChange={set('kind')} placeholder="Toner, ink, paper…" /></label>
            <label className="a-lbl">Phone<input className="a-input" value={f.phone} onChange={set('phone')} /></label>
            <label className="a-lbl">Email<input className="a-input" type="email" value={f.email} onChange={set('email')} /></label>
          </div>
        </section>
        <section className="pu-card">
          <header className="iv-lhd"><b>Vendor PIC</b><span>Person in charge at the vendor</span></header>
          <div className="vf-grid">
            <label className="a-lbl">PIC name<input className="a-input" value={f.contact} onChange={set('contact')} placeholder="Who we deal with" /></label>
            <label className="a-lbl">Designation<input className="a-input" value={f.picDesig} onChange={set('picDesig')} placeholder="e.g. Sales manager" /></label>
            <label className="a-lbl">PIC mobile<input className="a-input" value={f.picPhone} onChange={set('picPhone')} placeholder="01XXXXXXXXX" /></label>
          </div>
        </section>
        <section className="pu-card">
          <header className="iv-lhd"><b>Address & remarks</b><span>Where they are, and anything worth remembering</span></header>
          <div className="vf-2">
            <label className="a-lbl">Address<textarea className="a-input" rows={3} maxLength={300} value={f.address} onChange={set('address')} placeholder="Street, area, city" /></label>
            <label className="a-lbl">Remarks<textarea className="a-input" rows={3} maxLength={300} value={f.note} onChange={set('note')} placeholder="Payment terms, delivery time, quality notes…" /></label>
          </div>
        </section>
        <section className="pu-card">
          <header className="iv-lhd"><b>Account</b><span>Money we owed before using this system</span></header>
          <div className="vf-acc">
            <label className="a-lbl">Opening balance ৳ <small>(negative if they owe us)</small><input className="a-input r" type="number" value={f.opening} onChange={set('opening')} /></label>
            <label className="vf-active"><input type="checkbox" checked={f.active} onChange={e => setF(v => ({ ...v, active: e.target.checked }))} /><span><b>Active</b><small>Shown when choosing a vendor</small></span></label>
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Two letters for the avatar: the first letters of the first two words ("Global Toner BD" -> GT), or the first two letters of a single word. */
export const initials = name => {
  const words = String(name || '').trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).map(w => Array.from(w.replace(/^[^\p{L}\p{N}]+/u, '')));
  if (!words.length) return '?';
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2).join('')).toUpperCase();
};

function VendorDrawer({ id, canEdit, onClose, onChanged, vendors }) {
  const led = useInv('/vendors/' + id + '/ledger');
  const [pay, setPay] = useState(false); const [edit, setEdit] = useState(false);
  const d = led.data;
  const after = () => { led.reload(); onChanged(); };
  const remove = async () => {
    if (!(await confirmBox(`Delete ${d.vendor.name}? Only vendors with no purchases or payments can be deleted.`, { danger: true, confirmLabel: 'Delete' }))) return;
    try { await invApi.del('/vendors/' + id); onChanged(); onClose(); } catch (e) { alertBox(e.message); }
  };
  return (
    <Drawer title={d?.vendor.name || 'Vendor'} sub={d ? balText(d.balance) : 'Loading…'} onClose={onClose}>
      {!d ? <Skeleton rows={6} /> : (
        <>
          <div className="vd-top">
            <span className="vd-av" aria-hidden="true">{initials(d.vendor.name)}</span>
            <div className="vd-chips">
              <span className="vd-id mono" title="Vendor profile ID">{d.vendor.code || '—'}</span>
              <Chip tone={d.vendor.vtype === 'Foreign' ? 'blue' : 'ok'}>{d.vendor.vtype}</Chip>
              <Chip tone={d.vendor.active ? 'ok' : 'off'}>{d.vendor.active ? 'Active' : 'Inactive'}</Chip>
              {d.vendor.kind && <span className="vd-kind">{d.vendor.kind}</span>}
            </div>
          </div>
          <div className="vd-stats">
            <div><small>Bills</small><b>{taka(d.items.reduce((t, r) => t + r.credit, 0))}</b></div>
            <div><small>Returned</small><b>{taka(d.items.filter(r => r.type === 'Return').reduce((t, r) => t + r.debit, 0))}</b></div>
            <div><small>Paid</small><b>{taka(d.items.filter(r => r.type === 'Payment').reduce((t, r) => t + r.debit, 0))}</b></div>
            <div className={'vd-bal ' + balTone(d.balance)}><small>Balance</small><b>{balText(d.balance)}</b></div>
          </div>
          <section className="vd-card">
            <header className="iv-lhd"><b>Contact</b><span>{d.vendor.picDesig || 'Vendor details'}</span></header>
            <dl className="vd-dl">
              <div><dt>PIC</dt><dd>{d.vendor.contact || '—'}</dd></div>
              <div><dt>PIC mobile</dt><dd>{d.vendor.picPhone ? <a href={'tel:' + d.vendor.picPhone}>{d.vendor.picPhone}</a> : '—'}</dd></div>
              <div><dt>Phone</dt><dd>{d.vendor.phone ? <a href={'tel:' + d.vendor.phone}>{d.vendor.phone}</a> : '—'}</dd></div>
              <div><dt>Email</dt><dd>{d.vendor.email ? <a href={'mailto:' + d.vendor.email}>{d.vendor.email}</a> : '—'}</dd></div>
              <div className="wide"><dt>Address</dt><dd>{d.vendor.address || '—'}</dd></div>
              {d.vendor.note && <div className="wide"><dt>Remarks</dt><dd>{d.vendor.note}</dd></div>}
            </dl>
          </section>
          {canEdit && (
            <div className="vd-acts">
              <button type="button" className="a-btn sm grad" onClick={() => setPay(true)}>Pay vendor</button>
              <span className="vd-sp" />
              <IconBtn icon="edit" tone="pri" title="Edit this vendor" onClick={() => setEdit(true)} />
              <IconBtn icon="trash" tone="bad" title="Delete this vendor" onClick={remove} />
            </div>
          )}
          <section className="vd-card">
            <header className="iv-lhd"><b>Account statement</b><span>{d.items.length} entr{d.items.length === 1 ? 'y' : 'ies'}</span></header>
            <div className="vd-led">
              <div className="vd-lrow head"><span>Date</span><span>Entry</span><span>Bill</span><span>Paid / returned</span><span>Balance</span></div>
              {!!d.opening && <div className="vd-lrow"><span>—</span><span><b>Opening balance</b></span><span>{taka(d.opening)}</span><span /><b>{taka(d.opening)}</b></div>}
              {d.items.map(r => <div key={r.ref} className="vd-lrow"><span>{fDate(r.d)}</span><span><b>{r.type}</b> <span className="mono">{r.ref}</span><small>{r.text}</small></span><span>{r.credit ? taka(r.credit) : ''}</span><span className="pd">{r.debit ? taka(r.debit) : ''}</span><b>{taka(r.balance)}</b></div>)}
              {!d.items.length && !d.opening && <div className="iv-lempty">No purchases or payments yet.</div>}
            </div>
          </section>
        </>
      )}
      {pay && <PayForm vendors={vendors} vendor={id} onClose={() => setPay(false)} onSaved={after} />}
      {edit && d && <VendorForm vendor={{ ...d.vendor, opening: d.opening }} onClose={() => setEdit(false)} onSaved={after} />}
    </Drawer>
  );
}

function VendorList({ staff }) {
  const t = useTable('/vendors', { q: '', status: '', vtype: '' }, [], invApi);
  const s = useInv('/summary'); const all = useVendors();
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false);
  const canEdit = can(staff, 'inventory.manage');
  const rows = t.data.rows;
  const reload = () => { t.reload(); s.reload(); };
  const exportCsv = async () => { const list = await fetchAll('/vendors', t.params).catch(e => { alertBox(e.message); return []; }); if (list.length) downloadCsv('vendors.csv', ['Vendor ID', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance'], list.map(r => [r.code, r.name, r.phone, r.bills, r.returns, r.paid, r.balance])); };
  return (
    <>
      <Summary items={[
        ['Vendors', s.data?.vendors ?? '…', `${s.data?.owedCount ?? 0} we owe money to`, 'blue', 'truck'],
        ['We owe vendors', taka(s.data?.payable), 'unpaid bills minus returns', 'red', 'alert'],
        ['Bought this month', taka(s.data?.purchased), `${s.data?.purchases ?? 0} purchases`, 'violet', 'cart'],
        ['Paid this month', taka(s.data?.paid), 'to vendors', 'green', 'check']
      ]} />
      <ListFilter t={t} noun="vendor" title="Search vendors" search={{ placeholder: 'ID, name, phone, contact person or what they supply' }}
        selects={[{ key: 'vtype', label: 'Type', all: 'Local & foreign', icon: 'status', options: [{ v: 'Local', t: 'Local' }, { v: 'Foreign', t: 'Foreign' }] }, { key: 'status', label: 'Show', all: 'All vendors', icon: 'status', options: [{ v: 'active', t: 'Active' }, { v: 'inactive', t: 'Inactive' }, { v: 'owing', t: 'We owe money' }, { v: 'advance', t: 'Paid in advance' }] }]} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Vendors & suppliers</h3><small className="fd-sub">Click a vendor for its account statement · owing {taka(t.data.totals?.payable)} across these {t.data.total}</small></div>
          <div className="bk-acts"><button type="button" className="a-mini" onClick={exportCsv} disabled={!t.data.total}>⤓ CSV</button>{canEdit && <AddBtn onClick={() => setAdd(true)}>＋ Add vendor</AddBtn>}</div></div>
        <Grid server={t} cols="44px minmax(200px,1.6fr) 150px 120px 120px 120px 160px" head={['SL', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance']} onRow={r => setOpen(r.id)} empty="No vendor matches."
          rows={rows.map((r, i) => ({ key: r.id, item: r, cells: [slNo(t, i), <span key="n"><b>{r.name}</b>{r.vtype === 'Foreign' && <Chip tone="blue"> foreign</Chip>}{!r.active && <Chip tone="off"> inactive</Chip>}<small style={{ display: 'block', color: '#6b7388' }}><span className="mono vd-code">{r.code}</span>{[r.kind, r.contact].filter(Boolean).join(' · ') ? ' · ' + [r.kind, r.contact].filter(Boolean).join(' · ') : ''}</small></span>, r.phone || '—', taka(r.bills), taka(r.returns), taka(r.paid), <Chip key="b" tone={balTone(r.balance)}>{balText(r.balance)}</Chip>] }))} />
      </section>
      {open && <VendorDrawer id={open} canEdit={canEdit} vendors={all} onClose={() => setOpen(null)} onChanged={reload} />}
      {add && <VendorForm onClose={() => setAdd(false)} onSaved={reload} />}
    </>
  );
}

const TX_TONE = { Bill: 'amber', Return: 'blue', Payment: 'ok' };

/** Every bill, return and payment of every vendor in one list. */
function VendorTransactions() {
  const t = useTable('/transactions', { q: '', vendor: '', type: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const vendors = useVendors();
  const m = t.data.totals || {};
  const exportCsv = async () => { const list = await fetchAll('/transactions', t.params).catch(e => { alertBox(e.message); return []; }); if (list.length) downloadCsv('vendor-transactions.csv', ['Date', 'Vendor', 'Type', 'Reference', 'Details', 'Bill', 'Paid / returned'], list.map(x => [x.date, x.vendor, x.type, x.ref, x.info, x.bill, x.settled])); };
  return (
    <>
      <Summary items={[
        ['Transactions', t.data.total ?? '…', 'matching your filters', 'blue', 'cart'],
        ['Bills', taka(m.bills), 'approved purchases', 'amber', 'box'],
        ['Returned', taka(m.returns), 'goods sent back', 'violet', 'truck'],
        ['Paid', taka(m.paid), 'to vendors', 'green', 'check']
      ]} />
      <ListFilter t={t} noun="transaction" title="Search transactions" search={{ placeholder: 'Reference, vendor, invoice or method' }}
        selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'type', label: 'Type', all: 'Bills, returns & payments', icon: 'status', options: [{ v: 'Bill', t: 'Bills' }, { v: 'Return', t: 'Returns' }, { v: 'Payment', t: 'Payments' }] }]}
        range={{ label: 'Date' }} amount={{ label: 'Amount' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Vendor transactions</h3><small className="fd-sub">Bills add to what we owe, returns and payments reduce it</small></div>
          <div className="bk-acts"><button type="button" className="a-mini" onClick={exportCsv} disabled={!t.data.total}>⤓ CSV</button></div></div>
        <Grid server={t} cols="44px 110px minmax(170px,1.3fr) 100px 150px minmax(140px,1.2fr) 120px 130px" head={['SL', 'Date', 'Vendor', 'Type', 'Reference', 'Details', 'Bill', 'Paid / returned']} empty="No transaction matches."
          rows={t.data.rows.map((x, i) => ({ key: x.type + x.ref, item: x, cells: [slNo(t, i), fDate(x.date), <b key="v">{x.vendor}</b>, <Chip key="t" tone={TX_TONE[x.type]}>{x.type}</Chip>, <span key="r" className="mono">{x.ref}</span>, <span key="i" className="qt-clip">{x.info || '—'}</span>, x.bill ? <b key="b">{taka(x.bill)}</b> : '—', x.settled ? <b key="s" style={{ color: '#17784a' }}>{taka(x.settled)}</b> : '—'] }))} />
      </section>
    </>
  );
}

/** Vendors page: the vendor list, or every vendor transaction in one grid. */
export function InvVendors({ staff }) {
  const [tab, setTab] = useState('vendors');
  return (
    <>
      <Tabs items={[['vendors', 'Vendors'], ['transactions', 'Transactions']]} value={tab} onChange={setTab} />
      {tab === 'vendors' ? <VendorList staff={staff} /> : <VendorTransactions />}
    </>
  );
}
