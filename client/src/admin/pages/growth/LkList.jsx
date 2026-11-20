import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { confirmBox } from '../../ui.jsx';
import { Msg } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { useT } from '../../i18n/lang.jsx';
import { when } from './growthModel.js';
import { send, sendPut, sendDelete, mcMsg, trMsg, KINDS, KIND_TEXT, STATUSES, STATUS_TEXT, STATUS_ICON } from './lkApi.js';

function Found({ r }) {
  const tr = useT();
  if (!r.lastChecked) return <span className="adlk-dim">{tr('not checked')}</span>;
  return <span className={r.linkFound ? 'adlk-yes' : 'adlk-no'}>{r.linkFound ? tr('✔ Found') : tr('✖ Not found')}{r.rel ? <span className="adlk-dim"> ({r.rel})</span> : null}</span>;
}

/** The list of links and listings, 15 per page, with filters and row actions. */
export default function LkList({ status, setStatus, canEdit, tick, onChanged, onData }) {
  const tr = useT();
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(0);
  useEffect(() => setPage(1), [status, kind, q]);
  const res = useApiData(() => adm.get('/growth/backlinks?status=' + status + '&kind=' + kind + '&q=' + encodeURIComponent(q) + '&page=' + page + '&limit=15'), [status, kind, q, page, tick]);
  const d = res.data;
  useEffect(() => { if (d) onData(d); }, [d]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = (d?.rows || []).map(r => ({ ...r, status: String(r.status || '').toLowerCase() })); // the server writes 'Live', the UI keys are lower case
  const save = async r => {
    setBusy(r.id);
    const x = await sendPut('/growth/backlinks/' + r.id, { status: edit.status, url: edit.url, notes: edit.notes });
    setBusy(0); setM(mcMsg(x, 'Saved.'));
    if (x.ok) { setEdit(null); onChanged(); }
  };
  const check = async r => {
    setBusy(r.id); setM(null);
    const x = await send('/growth/backlinks/check', { id: r.id });
    setBusy(0);
    setM(mcMsg(x, x.body?.result?.note || x.body?.result?.message || 'Checked.'));
    if (x.ok) onChanged();
  };
  const del = async r => {
    if (!(await confirmBox(tr('Remove "{name}" from your list? This only removes it here, not from the other website.', { name: r.name }), { danger: true, confirmLabel: tr('Delete') }))) return;
    setBusy(r.id);
    const x = await sendDelete('/growth/backlinks/' + r.id);
    setBusy(0); setM(mcMsg(x, 'Deleted.'));
    if (x.ok) onChanged();
  };
  return (
    <div className="adlk-list">
      <h4>{tr('Your links and listings')}</h4>
      <div className="adlk-filters">
        <select className="a-in" value={status} onChange={e => setStatus(e.target.value)} aria-label={tr('Status')}><option value="">{tr('All statuses')}</option>{STATUSES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select>
        <select className="a-in" value={kind} onChange={e => setKind(e.target.value)} aria-label={tr('Type')}><option value="">{tr('All types')}</option>{KINDS.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select>
        <input className="a-in" type="search" placeholder={tr('Search name or address')} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Msg m={res.error ? { ok: false, text: tr(res.error) } : trMsg(tr, m)} />
      <div className="adgr-scroll">
        <table className="adgr-tbl adlk-tbl">
          <thead><tr><th>{tr('Name')}</th><th>{tr('Their page')}</th><th>{tr('Status')}</th><th>{tr('Link found')}</th><th>HTTP</th><th>{tr('Last checked')}</th><th>{tr('Notes')}</th><th /></tr></thead>
          <tbody>
            {rows.map(r => {
              const e = edit && edit.id === r.id ? edit : null;
              return (
                <tr key={r.id}>
                  <td className="adgr-wrap"><b>{r.name}</b><div className="adlk-dim">{tr(KIND_TEXT[r.kind] || r.kind)}</div></td>
                  <td className="adgr-wrap">{e ? <input className="a-in" aria-label={tr('Their page')} maxLength={500} value={e.url} onChange={ev => setEdit({ ...e, url: ev.target.value })} /> : r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.url.replace(/^https?:\/\//, '').slice(0, 40)}</a> : '-'}</td>
                  <td>{e ? <select className="a-in" aria-label={tr('Status')} value={e.status} onChange={ev => setEdit({ ...e, status: ev.target.value })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select> : <span className={'adlk-badge adlk-b-' + r.status}>{STATUS_ICON[r.status]} {tr(STATUS_TEXT[r.status] || r.status)}</span>}</td>
                  <td><Found r={r} /></td>
                  <td>{r.httpStatus || '-'}</td>
                  <td>{r.lastChecked ? when(r.lastChecked) : tr('Never')}</td>
                  <td className="adgr-wrap">{e ? <input className="a-in" aria-label={tr('Notes')} maxLength={500} value={e.notes} onChange={ev => setEdit({ ...e, notes: ev.target.value })} /> : r.notes || ''}</td>
                  <td className="adlk-acts">
                    {e ? (<><button type="button" className="a-btn sm" disabled={busy === r.id} onClick={() => save(r)}>{tr('Save')}</button><button type="button" className="a-btn ghost sm" onClick={() => setEdit(null)}>{tr('Cancel')}</button></>) : (<>
                      <button type="button" className="a-btn ghost sm" disabled={!canEdit} onClick={() => setEdit({ id: r.id, status: r.status, url: r.url || '', notes: r.notes || '' })}>{tr('Edit')}</button>
                      <button type="button" className="a-btn ghost sm" disabled={!canEdit || busy === r.id || !r.url} onClick={() => check(r)}>{busy === r.id ? tr('Checking...') : tr('Check now')}</button>
                      <button type="button" className="a-btn ghost sm" disabled={!canEdit || busy === r.id} onClick={() => del(r)}>{tr('Delete')}</button></>)}
                  </td>
                </tr>
              );
            })}
            {!res.loading && !res.error && !rows.length && <tr><td colSpan={8} className="adgr-empty">{tr('Nothing here yet. Add a listing above or use the starter checklist.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </div>
  );
}
