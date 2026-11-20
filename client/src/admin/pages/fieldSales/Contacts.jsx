import { useEffect, useState } from 'react';
import { fld, slNo, useTable } from '../../adminApi.js';
import { Empty, Pager, Summary, Toolbar } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { Av, Chip, Notice, Tabs } from '../../fieldKit.jsx';
import { Rows } from './Rows.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import './fieldSales.css';

/** Contact directory: team, customers and vendors, plus the shared head-office lines. */
export function FieldContacts() {
  const tr = useT();
  const t = useTable('/contacts', { type: 'all', q: '', size: 25 }, [], fld);
  const [off, setOff] = useState([]);
  useEffect(() => { fld.get('/contacts/office').then(setOff).catch(() => {}); }, []);
  const data = t.data, ready = data.online !== undefined;
  return (
    <>
      <Summary items={[
        [tr('Contacts'), ready ? data.total : '…', tr('team, customers, vendors'), 'blue', 'users'],
        [tr('Online now'), data.online ?? '…', tr('clocked in'), 'green', 'check'],
        [tr('Head office lines'), off.length, tr('shared numbers'), 'violet', 'tag']
      ]} />
      <Notice err={t.error && tr(t.error)} />
      <ListFilter t={t} noun="contact" title="Search contacts" search={{ placeholder: 'Name, company or phone' }} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={t.params.type} onChange={k => t.set({ type: k })} items={[['all', tr('All')], ['team', tr('Team')], ['customer', tr('Customers')], ['vendor', tr('Vendors')]]} /></div>
        <Toolbar t={t} search={false} />
        <Rows t={t} cols="40px minmax(170px,1.3fr) 100px minmax(170px,1.3fr) 120px minmax(250px,1.6fr)" head={['SL', 'Name', 'Type', 'Company / title', 'Phone', 'Email']}
          rows={(data.rows || []).map((x, i) => ({ key: x.key, cells: [slNo(t, i), <span className="fd-who" key="n"><Av name={x.name} /><span><b>{x.name}</b>{x.online && <small className="fd-online">● {tr('online')}</small>}</span></span>, <Chip key="t" tone={x.type === 'team' ? 'blue' : x.type === 'vendor' ? 'violet' : 'ok'}>{tr(x.type)}</Chip>, [x.title, x.org].filter(Boolean).join(' · ') || '—', x.phone ? <a key="p" href={'tel:' + x.phone}>{x.phone}</a> : '—', x.email ? <a key="e" href={'mailto:' + x.email}>{x.email}</a> : '—'] }))} />
        <Empty t={t} /><Pager t={t} />
        {off.length > 0 && <small className="fd-sub">{tr('Head office: {list}', { list: off.map(o => `${o.name} ${o.phone || ''}`.trim()).join(' · ') })}</small>}
      </section>
    </>
  );
}
