import { useState } from 'react';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';
import { useTable } from '../../adminApi.js';
import { Summary, Toolbar, Pager, confirmBox, alertBox } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { AddRedirectModal } from './redirects/AddRedirectModal.jsx';
import { RedirectsTable } from './redirects/RedirectsTable.jsx';
import { sendJson } from './redirects/redirectModel.js';
import './redirects/redirects.css';

const SORTS = [['hits', 'Most hits'], ['last_hit', 'Last hit'], ['created', 'Newest'], ['source', 'Source A-Z']];

/** The Redirects tab of Admin > SEO. */
export function Redirects() {
  const tr = useT();
  const t = useTable('/seo/redirects', { kind: '', sort: 'hits', dir: 'desc' });
  const [form, setForm] = useState(null); // 'new' or the row being edited
  const [msg, setMsg] = useState('');
  const [busy, run] = useBusy();
  const s = t.data.summary || {};
  const warn = n => (n > 0 ? 'amber' : 'green');

  const remove = async r => {
    if (!(await confirmBox(tr('Delete the redirect from {source}? Visitors of that address will see a 404 page again.', { source: r.source }), { danger: true, confirmLabel: tr('Delete redirect') }))) return;
    run(async () => {
      const x = await sendJson('DELETE', '/seo/redirects/' + r.id);
      if (!x.ok) alertBox(tr(x.error)); else t.reload();
    });
  };
  const flatten = () => run(async () => {
    setMsg('');
    const x = await sendJson('POST', '/seo/redirects/flatten');
    if (!x.ok) { alertBox(tr(x.error)); return; }
    const d = x.data || {};
    setMsg((d.fixed === 1 ? tr('1 chain fixed.') : tr('{n} chains fixed.', { n: d.fixed || 0 })) + (d.loops ? ' ' + (d.loops === 1 ? tr('1 loop still needs a manual fix.') : tr('{n} loops still need a manual fix.', { n: d.loops })) : ''));
    t.reload();
  });

  return (
    <div className="adrd">
      <p className="adrd-intro">{tr('A redirect sends visitors (and Google) from an old address to a new one. Add one whenever a page is moved or deleted so nobody lands on a 404.')}</p>
      <Summary items={[
        [tr('Total'), s.total ?? 0, tr('redirects'), 'blue', 'repeat'],
        [tr('Automatic'), s.auto ?? 0, tr('made by the system'), 'violet', 'check'],
        [tr('Manual'), s.manual ?? (s.total || 0) - (s.auto || 0), tr('added by staff'), 'blue', 'tag'],
        [tr('Total hits'), (s.hits ?? 0).toLocaleString('en-US'), tr('visitors moved'), 'green', 'users'],
        [tr('Chains'), s.chains ?? 0, tr('more than one step'), warn(s.chains), 'alert'],
        [tr('Loops'), s.loops ?? 0, tr('never end'), s.loops > 0 ? 'red' : 'green', 'alert'],
        [tr('Dead targets'), s.deadTargets ?? 0, tr('target is gone'), s.deadTargets > 0 ? 'red' : 'green', 'alert']
      ]} />
      <ListFilter t={t} noun="redirect" title="Search redirects" search={{ placeholder: 'Source or target', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'kind', label: 'Kind', all: 'All redirects', icon: 'status', span: 'c3', options: [{ v: 'auto', t: 'Automatic' }, { v: 'manual', t: 'Manual' }] },
          { key: 'sort', label: 'Sort by', all: SORTS[0][1], icon: 'tag', span: 'c2', options: SORTS.slice(1).map(([v, l]) => ({ v, t: l })) },
          { key: 'dir', label: 'Direction', all: 'Descending', icon: 'tag', span: 'c2', options: [{ v: 'asc', t: 'Ascending' }] }
        ]} />
      <Toolbar t={t} search={false}>
        <button type="button" className="a-btn grad sm" onClick={() => setForm('new')}>＋ {tr('Add redirect')}</button>
        <button type="button" className="a-btn ghost sm" disabled={busy || !(s.chains > 0)} onClick={flatten} title={tr('Make every chain go straight to its final page')}>{tr('Fix chains')}</button>
      </Toolbar>
      {msg && <div className="a-msg ok adrd-gap">{msg}</div>}
      {t.error && <div className="a-empty">{tr(t.error)}</div>}
      <RedirectsTable rows={t.data.rows || []} loading={t.loading} onEdit={setForm} onDelete={remove} />
      <Pager t={t} />
      {form && <AddRedirectModal edit={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={t.reload} />}
    </div>
  );
}
