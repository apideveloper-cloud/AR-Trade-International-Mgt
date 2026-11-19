import { useState } from 'react';
import { can, invApi, slNo, useTable } from '../../../adminApi.js';
import { Summary, Toolbar } from '../../../ui.jsx';
import { ListFilter } from '../../../ListFilter.jsx';
import { Chip, Grid, Notice, taka } from '../../../fieldKit.jsx';
import { useInv, useVendors } from '../kit/useInv.js';
import { CsvButton, exportCsv } from '../kit/csvExport.jsx';
import { AddBtn, balText, balTone } from '../kit/invKit.jsx';
import { VendorDrawer } from './VendorDrawer.jsx';
import { VendorForm } from './VendorForm.jsx';

/** Name cell of the vendor grid: name, foreign/inactive chips and the ID with what they supply. */
function VendorCell({ r }) {
  const sub = [r.kind, r.contact].filter(Boolean).join(' · ');
  return (
    <span><b>{r.name}</b>{r.vtype === 'Foreign' && <Chip tone="blue"> foreign</Chip>}{!r.active && <Chip tone="off"> inactive</Chip>}
      <small className="iv-subline"><span className="mono vd-code">{r.code}</span>{sub ? ' · ' + sub : ''}</small></span>
  );
}

/** The vendor list with its summary, filters, CSV export and the statement drawer. */
export function VendorList({ staff }) {
  const t = useTable('/vendors', { q: '', status: '', vtype: '' }, [], invApi);
  const s = useInv('/summary'); const all = useVendors();
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false);
  const canEdit = can(staff, 'inventory.manage');
  const reload = () => { t.reload(); s.reload(); };
  const download = () => exportCsv('/vendors', t.params, 'vendors.csv', ['Vendor ID', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance'], r => [r.code, r.name, r.phone, r.bills, r.returns, r.paid, r.balance]);
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
          <div className="bk-acts"><CsvButton onClick={download} disabled={!t.data.total} />{canEdit && <AddBtn onClick={() => setAdd(true)}>＋ Add vendor</AddBtn>}</div></div>
        <Grid server={t} cols="44px minmax(200px,1.6fr) 150px 120px 120px 120px 160px" head={['SL', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance']} onRow={r => setOpen(r.id)} empty="No vendor matches."
          rows={t.data.rows.map((r, i) => ({ key: r.id, item: r, cells: [slNo(t, i), <VendorCell key="n" r={r} />, r.phone || '—', taka(r.bills), taka(r.returns), taka(r.paid), <Chip key="b" tone={balTone(r.balance)}>{balText(r.balance)}</Chip>] }))} />
      </section>
      {open && <VendorDrawer id={open} canEdit={canEdit} vendors={all} onClose={() => setOpen(null)} onChanged={reload} />}
      {add && <VendorForm onClose={() => setAdd(false)} onSaved={reload} />}
    </>
  );
}
