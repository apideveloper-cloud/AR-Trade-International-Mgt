import { useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { Drawer, Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Av, Chip, Fact, Notice, Tabs, fDate, taka, toneOf } from '../../fieldKit.jsx';
import { Rows } from './Rows.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import './fieldSales.css';

/** Field customers (CRM): searchable list with a details drawer. */
export function FieldCustomers() {
  const tr = useT();
  const t = useTable('/customers', { kind: 'all', q: '', from: '', to: '', size: 25 }, [], fld);
  const [open, setOpen] = useState(null);
  const items = t.data.rows || [], c = t.data.counts || {};
  return (
    <>
      <Summary items={[
        [tr('Field customers'), c.all ?? '…', tr('in the CRM'), 'blue', 'users'],
        [tr('Active'), c.active ?? '…', tr('have ordered'), 'green', 'check'],
        [tr('Upcoming'), c.upcoming ?? '…', tr('leads to win'), 'violet', 'plus'],
        [tr('Dues (matching)'), taka(t.data.dueTotal), tr('unpaid invoices'), 'red', 'money']
      ]} />
      <Notice err={t.error && tr(t.error)} onRetry={t.reload} />
      <ListFilter t={t} noun="customer" title="Search customers" search={{ placeholder: 'Name, contact, area or phone' }} range={{ label: 'Added' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.kind} onChange={k => t.set({ kind: k })} items={[['all', tr('All'), c.all], ['active', tr('Active'), c.active], ['upcoming', tr('Upcoming'), c.upcoming]]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="44px minmax(220px,2fr) 140px 130px 110px 110px 120px" head={['SL', 'Customer', 'Phone', 'Area', 'Type', 'Status', 'Due']} onRow={setOpen}
          rows={items.map((x, i) => ({ key: x.id, item: x, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b><small>{[x.contact, x.contactRole].filter(Boolean).join(' · ')}</small></span></span>, x.phone, x.area || '—', x.type ? tr(x.type) : '—', <Chip key="s" tone={toneOf(x.kind)}>{tr(x.kind)}</Chip>, x.due ? <b key="d" className="fd-due">{taka(x.due)}</b> : '—'] }))} />
        <Empty t={t} /><Pager t={t} />
      </section>
      {open && (
        <Drawer title={open.name} sub={`${tr(open.kind)} · ${tr(open.type || 'Customer')}`} onClose={() => setOpen(null)}>
          <div className="fd-facts">
            <Fact k={tr('Contact person')}>{[open.contact, open.contactRole].filter(Boolean).join(' · ')}</Fact><Fact k={tr('Phone')}>{open.phone && <a href={'tel:' + open.phone}>{open.phone}</a>}</Fact>
            <Fact k={tr('Email')}>{open.email}</Fact><Fact k={tr('Address')}>{open.address}</Fact><Fact k={tr('Area')}>{open.area}</Fact>
            <Fact k={tr('Interested in')}>{open.interest}</Fact><Fact k={tr('Expected value')}>{open.monthlyValue}</Fact><Fact k={tr('Source')}>{open.source}</Fact>
            <Fact k={tr('Next step')}>{open.nextStep}</Fact><Fact k={tr('Notes')}>{open.note}</Fact><Fact k={tr('Open dues')}>{open.due ? taka(open.due) : ''}</Fact><Fact k={tr('Added')}>{fDate(open.createdAt)}</Fact>
            {open.lat != null && <Fact k={tr('Location')}><a href={`https://www.openstreetmap.org/?mlat=${open.lat}&mlon=${open.lng}#map=16/${open.lat}/${open.lng}`} target="_blank" rel="noreferrer">{tr('Open on the map')} ↗</a></Fact>}
          </div>
        </Drawer>
      )}
    </>
  );
}
