import { useState } from 'react';
import { Tabs } from '../../fieldKit.jsx';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { run, when } from './growthModel.js';

const SIZE = 15;
const SERVICES = [['', 'All services'], ['google', 'Google'], ['bing', 'Bing'], ['indexnow', 'IndexNow']];

function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="a-pager">
      <span>Page {page} of {pages}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
    </div>
  );
}

function Logs() {
  const [svc, setSvc] = useState('');
  const [fails, setFails] = useState(false);
  const [page, setPage] = useState(1);
  const q = useApiData(() => adm.get('/growth/logs?integration=' + encodeURIComponent(svc) + '&ok=' + (fails ? '0' : '') + '&limit=200'), [svc, fails]);
  const rows = q.data?.rows || [];
  const pages = Math.max(1, Math.ceil(rows.length / SIZE));
  const cur = Math.min(page, pages);
  const slice = rows.slice((cur - 1) * SIZE, cur * SIZE);
  return (
    <>
      <div className="adgr-filters">
        <select className="a-in" value={svc} onChange={e => { setSvc(e.target.value); setPage(1); }} aria-label="Service">{SERVICES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="adgr-chk"><input type="checkbox" checked={fails} onChange={e => { setFails(e.target.checked); setPage(1); }} /> Failures only</label>
        <button type="button" className="a-btn ghost sm" onClick={q.reload}>Refresh</button>
        {q.loading && <span className="spin" />}
      </div>
      <Msg m={q.error ? { ok: false, text: q.error } : null} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Time</th><th>Service</th><th>Action</th><th>Status</th><th>ms</th><th>Result</th><th>Error</th></tr></thead>
          <tbody>
            {slice.map(r => (
              <tr key={r.id}><td>{when(r.at)}</td><td>{r.integration}</td><td>{r.action}</td><td>{r.status ?? '-'}</td><td>{r.ms ?? '-'}</td>
                <td><span className={'adgr-badge ' + (r.ok ? 'adgr-badge-ok' : 'adgr-badge-err')}>{r.ok ? 'OK' : 'Failed'}</span></td><td className="adgr-wrap">{r.error || ''}</td></tr>
            ))}
            {!q.loading && !q.error && !rows.length && <tr><td colSpan={7} className="adgr-empty">Nothing has been sent to a search engine yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={cur} pages={pages} setPage={setPage} />
    </>
  );
}

function Jobs() {
  const q = useApiData(() => adm.get('/growth/jobs'));
  const [page, setPage] = useState(1);
  const [m, setM] = useState(null);
  const [busyId, setBusyId] = useState(0);
  const rows = q.data?.rows || [];
  const pages = Math.max(1, Math.ceil(rows.length / SIZE));
  const cur = Math.min(page, pages);
  const retry = async id => {
    if (busyId) return;
    setBusyId(id); setM(null);
    const r = await run('POST', '/growth/jobs/' + id + '/retry');
    setM(r.ok ? { ok: true, text: 'The job will run again shortly.' } : { ok: false, text: r.error });
    setBusyId(0); q.reload();
  };
  return (
    <>
      <div className="adgr-filters"><button type="button" className="a-btn ghost sm" onClick={q.reload}>Refresh</button>{q.loading && <span className="spin" />}</div>
      <Msg m={q.error ? { ok: false, text: q.error } : m} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Type</th><th>Status</th><th>Tries</th><th>Next run</th><th>Last error</th><th /></tr></thead>
          <tbody>
            {rows.slice((cur - 1) * SIZE, cur * SIZE).map(r => (
              <tr key={r.id}><td>{r.type}</td><td>{r.status}</td><td>{r.attempts}{r.max_attempts ? ' / ' + r.max_attempts : ''}</td><td>{r.run_at ? when(r.run_at) : '-'}</td><td className="adgr-wrap">{r.last_error || ''}</td>
                <td>{String(r.status).toLowerCase() === 'failed' && <button type="button" className="a-btn ghost sm" disabled={!!busyId} onClick={() => retry(r.id)}>{busyId === r.id ? 'Working…' : 'Retry'}</button>}</td></tr>
            ))}
            {!q.loading && !q.error && !rows.length && <tr><td colSpan={6} className="adgr-empty">No background jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={cur} pages={pages} setPage={setPage} />
    </>
  );
}

export default function ActivityTabs() {
  const [tab, setTab] = useState('logs');
  return (
    <Section id="adgr-activity" title="Activity" what="A record of everything this console asked Google, Bing and IndexNow, and the tasks that run in the background. Open it when something looks wrong.">
      <Tabs value={tab} onChange={setTab} items={[['logs', 'API log'], ['jobs', 'Background jobs']]} />
      {tab === 'logs' ? <Logs /> : <Jobs />}
    </Section>
  );
}
