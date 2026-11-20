import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { Pager } from './IssueList.jsx';
import { when } from './growthModel.js';
import { RvMsg } from './rvApi.jsx';

/** People who asked us not to contact them again. Collapsible. */
export default function RvOptouts({ tick, onChanged }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [m, setM] = useState(null);
  const q = useApiData(() => (open ? adm.get('/growth/review-optouts?page=' + page) : Promise.resolve(null)), [open, page, tick]);
  const d = q.data;
  const del = async r => {
    if (!(await confirmBox(`Allow review requests to ${r.contact} again?`, { confirmLabel: 'Allow again' }))) return;
    try { await adm.del('/growth/review-optouts/' + r.id); setM({ ok: true, text: 'Removed from the list.' }); q.reload(); onChanged?.(); } catch (e) { setM({ ok: false, text: e.message }); }
  };
  return (
    <details className="a-card adrv-sec" onToggle={e => setOpen(e.currentTarget.open)}>
      <summary><b>People who opted out</b> <span className="adrv-dim">(we never send them requests)</span></summary>
      <RvMsg m={q.error ? { ok: false, text: q.error } : m} />
      {open && (
        <div className="adrv-scroll"><table className="adrv-tbl">
          <thead><tr><th>Contact</th><th>Type</th><th>Date</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => <tr key={r.id}><td className="adrv-wrap">{r.contact}</td><td>{r.kind === 'phone' ? '💬 Phone' : '✉ E-mail'}</td><td>{when(r.createdAt)}</td><td><button type="button" className="a-btn ghost sm" onClick={() => del(r)}>Allow again</button></td></tr>)}
            {!q.loading && !(d?.rows || []).length && <tr><td colSpan={4} className="adrv-dim">Nobody has opted out.</td></tr>}
          </tbody>
        </table></div>
      )}
      {open && <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />}
    </details>
  );
}
