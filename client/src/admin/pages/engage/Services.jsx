import { adm, dateF, dateTimeF, useTable } from '../../adminApi.js';
import { Empty, Pager, Toolbar, ViewToggle, useView } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { withAlert } from '../../hooks/withAlert.js';

export function Services() {
  const t = useTable('/services', { status: '', from: '', to: '' });
  const [view, setView] = useView('services');
  const set = withAlert(async (id, status) => { await adm.put('/services/' + id, { status }); t.reload(); });
  return (
    <>
      <ListFilter t={t} noun="request" title="Search service requests" search={{ placeholder: 'Request no., name, phone or model' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['New', 'Scheduled', 'In progress', 'Completed'] }]} range={{ label: 'Requested' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw ' + view} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center', padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <b style={{ fontSize: 14 }}>{v.id} · {v.type}</b>
              <span>{v.name} · <a href={'tel:' + v.phone} style={{ fontWeight: 600 }}>{v.phone}</a></span>
              <span>{v.model} — {v.issue}</span>
              <span style={{ color: '#5d6270' }}>Preferred {dateF(v.date)} · received {dateTimeF(v.created)}</span>
            </div>
            <select className="a-input" value={v.status} onChange={e => set(v.id, e.target.value)} style={{ borderRadius: 999, fontWeight: 700, width: 'auto' }}>{['New', 'Scheduled', 'In progress', 'Completed'].map(s => <option key={s}>{s}</option>)}</select>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
