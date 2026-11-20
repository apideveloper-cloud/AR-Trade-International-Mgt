import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { Pager } from './IssueList.jsx';
import { useT } from '../../i18n/lang.jsx';
import { when } from './growthModel.js';
import { RvMsg } from './rvApi.jsx';

/** People who asked us not to contact them again. Collapsible. */
export default function RvOptouts({ tick, onChanged }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [m, setM] = useState(null);
  const q = useApiData(() => (open ? adm.get('/growth/review-optouts?page=' + page) : Promise.resolve(null)), [open, page, tick]);
  const d = q.data;
  const del = async r => {
    if (!(await confirmBox(tr('Allow review requests to {contact} again?', { contact: r.contact }), { confirmLabel: tr('Allow again') }))) return;
    try { await adm.del('/growth/review-optouts/' + r.id); setM({ ok: true, text: tr('Removed from the list.') }); q.reload(); onChanged?.(); } catch (e) { setM({ ok: false, text: tr(e.message) }); }
  };
  return (
    <details className="a-card adrv-sec" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary><b>{tr('People who opted out')}</b> <span className="adrv-dim">{tr('(we never send them requests)')}</span></summary>
      <RvMsg m={q.error ? { ok: false, text: tr(q.error) } : m} />
      {open && (
        <div className="adrv-scroll"><table className="adrv-tbl">
          <thead><tr><th>{tr('Contact')}</th><th>{tr('Type')}</th><th>{tr('Date')}</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => <tr key={r.id}><td className="adrv-wrap">{r.contact}</td><td>{r.kind === 'phone' ? '💬 ' + tr('Phone') : '✉ ' + tr('E-mail')}</td><td>{when(r.createdAt)}</td><td><button type="button" className="a-btn ghost sm" onClick={() => del(r)}>{tr('Allow again')}</button></td></tr>)}
            {!q.loading && !(d?.rows || []).length && <tr><td colSpan={4} className="adrv-dim">{tr('Nobody has opted out.')}</td></tr>}
          </tbody>
        </table></div>
      )}
      {open && <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />}
    </details>
  );
}
