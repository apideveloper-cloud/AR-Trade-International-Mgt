import { adm, dateF, dateTimeF, useTable } from '../../adminApi.js';
import { Empty, Pager, Toolbar, ViewToggle, useView } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { withAlert } from '../../hooks/withAlert.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/shell.js';
import './engage.css';

export function Services() {
  const tr = useT();
  const t = useTable('/services', { status: '', from: '', to: '' });
  const [view, setView] = useView('services');
  const set = withAlert(async (id, status) => { await adm.put('/services/' + id, { status }); t.reload(); });
  return (
    <>
      <ListFilter t={t} noun="request" title="Search service requests" search={{ placeholder: 'Request no., name, phone or model' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['New', 'Scheduled', 'In progress', 'Completed'] }]} range={{ label: 'Requested' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw eg-list ' + view} style={{ opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card eg-row-card">
            <div className="eg-stack3">
              <b className="eg-title">{v.id} · {v.type}</b>
              <span>{v.name} · <a href={'tel:' + v.phone} className="eg-svc-tel">{v.phone}</a></span>
              <span>{v.model} — {v.issue}</span>
              <span className="eg-svc-meta">{tr('Preferred {date} · received {time}', { date: dateF(v.date), time: dateTimeF(v.created) })}</span>
            </div>
            <select className="a-input eg-stage-select" value={v.status} onChange={e => set(v.id, e.target.value)}>{['New', 'Scheduled', 'In progress', 'Completed'].map(s => <option key={s} value={s}>{tr(s)}</option>)}</select>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
