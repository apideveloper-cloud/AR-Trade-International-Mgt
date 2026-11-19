import { useEffect, useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Av, Chip, Notice, Tabs } from '../../fieldKit.jsx';
import { Rows } from './Rows.jsx';
import './fieldSales.css';

/** Contact directory: team, customers and vendors, plus the shared head-office lines. */
export function FieldContacts() {
  const t = useTable('/contacts', { type: 'all', q: '', size: 25 }, [], fld);
  const [off, setOff] = useState([]);
  useEffect(() => { fld.get('/contacts/office').then(setOff).catch(() => {}); }, []);
  const data = t.data, ready = data.online !== undefined;
  return (
    <>
      <Summary items={[
        ['Contacts', ready ? data.total : '…', 'team, customers, vendors', 'blue', 'users'],
        ['Online now', data.online ?? '…', 'clocked in', 'green', 'check'],
        ['Head office lines', off.length, 'shared numbers', 'violet', 'tag']
      ]} />
      <Notice err={t.error} />
      <ListFilter t={t} noun="contact" title="Search contacts" search={{ placeholder: 'Name, company or phone' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.type} onChange={k => t.set({ type: k })} items={[['all', 'All'], ['team', 'Team'], ['customer', 'Customers'], ['vendor', 'Vendors']]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="40px minmax(170px,1.3fr) 100px minmax(170px,1.3fr) 120px minmax(250px,1.6fr)" head={['SL', 'Name', 'Type', 'Company / title', 'Phone', 'Email']}
          rows={(data.rows || []).map((x, i) => ({ key: x.key, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b>{x.online && <small className="fd-online">● online</small>}</span></span>, <Chip key="t" tone={x.type === 'team' ? 'blue' : x.type === 'vendor' ? 'violet' : 'ok'}>{x.type}</Chip>, [x.title, x.org].filter(Boolean).join(' · ') || '—', x.phone ? <a key="p" href={'tel:' + x.phone}>{x.phone}</a> : '—', x.email ? <a key="e" href={'mailto:' + x.email}>{x.email}</a> : '—'] }))} />
        <Empty t={t} /><Pager t={t} />
        {off.length > 0 && <small className="fd-sub">Head office: {off.map(o => `${o.name} ${o.phone || ''}`.trim()).join(' · ')}</small>}
      </section>
    </>
  );
}
