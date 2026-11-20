import { useState } from 'react';
import { useTable } from '../../adminApi.js';
import { Summary, Toolbar, Pager, confirmBox, alertBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { AddRedirectModal } from './redirects/AddRedirectModal.jsx';
import { NotFoundTable } from './redirects/NotFoundTable.jsx';
import { sendJson } from './redirects/redirectModel.js';
import './redirects/redirects.css';

const SORTS = [['hits', 'Most hits'], ['last_seen', 'Last seen'], ['first_seen', 'First seen']];

/** The 404s tab of Admin > SEO: addresses visitors asked for that do not exist. */
export function NotFound404() {
  const t = useTable('/seo/404', { status: 'open', sort: 'hits', dir: 'desc' });
  const [pre, setPre] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, run] = useBusy();
  const s = t.data.summary || {};

  const act = (r, fn) => run(async () => {
    setBusyId(r.id);
    const x = await fn();
    setBusyId(null);
    if (!x.ok) alertBox(x.error); else t.reload();
  });
  const ignore = r => act(r, () => sendJson('PUT', '/seo/404/' + r.id, { ignored: !r.ignored }));
  const remove = async r => {
    if (!(await confirmBox('Delete the 404 record for ' + r.path + '? It comes back if a visitor asks for it again.', { danger: true, confirmLabel: 'Delete' }))) return;
    act(r, () => sendJson('DELETE', '/seo/404/' + r.id));
  };
  const clear = async () => {
    if (!(await confirmBox('Delete every ignored 404 record that was last seen more than 30 days ago?', { danger: true, confirmLabel: 'Clear them' }))) return;
    run(async () => {
      setMsg('');
      const x = await sendJson('DELETE', '/seo/404?olderThanDays=30&ignoredOnly=1');
      if (!x.ok) { alertBox(x.error); return; }
      setMsg(`${x.data?.deleted || 0} old ignored record${x.data?.deleted === 1 ? '' : 's'} deleted.`);
      t.reload();
    });
  };

  return (
    <div className="adrd">
      <p className="adrd-intro">Addresses that visitors or Google asked for and did not find. Create a redirect for the ones that matter, ignore the junk.</p>
      <Summary items={[
        ['Open', s.open ?? 0, 'not handled yet', s.open > 0 ? 'amber' : 'green', 'alert'],
        ['Ignored', s.ignored ?? 0, 'hidden from the open list', 'violet', 'box'],
        ['Total hits', (s.hits ?? 0).toLocaleString('en-US'), 'failed visits', 'blue', 'users'],
        ['Last 24 h', s.last24h ?? 0, 'new misses', 'blue', 'clock']
      ]} />
      <ListFilter t={t} noun="missing page" title="Search missing pages" search={{ placeholder: 'Path or referrer', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'status', label: 'Status', all: 'Open', icon: 'status', span: 'c3', options: [{ v: 'ignored', t: 'Ignored' }, { v: 'all', t: 'All' }] },
          { key: 'sort', label: 'Sort by', all: SORTS[0][1], icon: 'tag', span: 'c2', options: SORTS.slice(1).map(([v, l]) => ({ v, t: l })) },
          { key: 'dir', label: 'Direction', all: 'Descending', icon: 'tag', span: 'c2', options: [{ v: 'asc', t: 'Ascending' }] }
        ]} />
      <Toolbar t={t} search={false}>
        <button type="button" className="a-btn ghost sm" disabled={busy} onClick={clear}>Clear ignored older than 30 days</button>
      </Toolbar>
      {msg && <div className="a-msg ok adrd-gap">{msg}</div>}
      {t.error && <div className="a-empty">{t.error}</div>}
      <NotFoundTable rows={t.data.rows || []} loading={t.loading} busyId={busyId} onRedirect={setPre} onIgnore={ignore} onDelete={remove} />
      <Pager t={t} />
      {pre && <AddRedirectModal source={pre.path} focusTarget onClose={() => setPre(null)} onSaved={t.reload} />}
    </div>
  );
}
