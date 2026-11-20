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
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/inventory.js';

/** Name cell of the vendor grid: name, foreign/inactive chips and the ID with what they supply. */
function VendorCell({ r }) {
  const tr = useT();
  const sub = [r.kind, r.contact].filter(Boolean).join(' · ');
  return (
    <span><b>{r.name}</b>{r.vtype === 'Foreign' && <Chip tone="blue"> {tr('foreign')}</Chip>}{!r.active && <Chip tone="off"> {tr('inactive')}</Chip>}
      <small className="iv-subline"><span className="mono vd-code">{r.code}</span>{sub ? ' · ' + sub : ''}</small></span>
  );
}

/** The vendor list with its summary, filters, CSV export and the statement drawer. */
export function VendorList({ staff }) {
  const tr = useT();
  const t = useTable('/vendors', { q: '', status: '', vtype: '' }, [], invApi);
  const s = useInv('/summary'); const all = useVendors();
  const [open, setOpen] = useState(null); const [add, setAdd] = useState(false);
  const canEdit = can(staff, 'inventory.manage');
  const reload = () => { t.reload(); s.reload(); };
  const download = () => exportCsv('/vendors', t.params, 'vendors.csv', ['Vendor ID', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance'], r => [r.code, r.name, r.phone, r.bills, r.returns, r.paid, r.balance], tr);
  return (
    <>
      <Summary items={[
        [tr('Vendors'), s.data?.vendors ?? '…', tr('{n} we owe money to', { n: s.data?.owedCount ?? 0 }), 'blue', 'truck'],
        [tr('We owe vendors'), taka(s.data?.payable), tr('unpaid bills minus returns'), 'red', 'alert'],
        [tr('Bought this month'), taka(s.data?.purchased), tr('{n} purchases', { n: s.data?.purchases ?? 0 }), 'violet', 'cart'],
        [tr('Paid this month'), taka(s.data?.paid), tr('to vendors'), 'green', 'check']
      ]} />
      <ListFilter t={t} noun="vendor" title="Search vendors" search={{ placeholder: 'ID, name, phone, contact person or what they supply' }}
        selects={[{ key: 'vtype', label: 'Type', all: 'Local & foreign', icon: 'status', options: [{ v: 'Local', t: 'Local' }, { v: 'Foreign', t: 'Foreign' }] }, { key: 'status', label: 'Show', all: 'All vendors', icon: 'status', options: [{ v: 'active', t: 'Active' }, { v: 'inactive', t: 'Inactive' }, { v: 'owing', t: 'We owe money' }, { v: 'advance', t: 'Paid in advance' }] }]} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Vendors & suppliers')}</h3><small className="fd-sub">{tr('Click a vendor for its account statement · owing {a} across these {n}', { a: taka(t.data.totals?.payable), n: t.data.total })}</small></div>
          <div className="bk-acts"><CsvButton onClick={download} disabled={!t.data.total} />{canEdit && <AddBtn onClick={() => setAdd(true)}>{tr('＋ Add vendor')}</AddBtn>}</div></div>
        <Grid server={t} cols="44px minmax(200px,1.6fr) 150px 120px 120px 120px 160px" head={['SL', 'Vendor', 'Phone', 'Bills', 'Returns', 'Paid', 'Balance'].map(h => tr(h))} onRow={r => setOpen(r.id)} empty={tr('No vendor matches.')}
          rows={t.data.rows.map((r, i) => ({ key: r.id, item: r, cells: [slNo(t, i), <VendorCell key="n" r={r} />, r.phone || '—', taka(r.bills), taka(r.returns), taka(r.paid), <Chip key="b" tone={balTone(r.balance)}>{balText(r.balance, tr)}</Chip>] }))} />
      </section>
      {open && <VendorDrawer id={open} canEdit={canEdit} vendors={all} onClose={() => setOpen(null)} onChanged={reload} />}
      {add && <VendorForm onClose={() => setAdd(false)} onSaved={reload} />}
    </>
  );
}
