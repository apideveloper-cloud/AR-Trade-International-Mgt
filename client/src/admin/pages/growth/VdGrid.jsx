import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { send, mcMsg, trMsg } from './lkApi.js';
import { useT } from '../../i18n/lang.jsx';

const FIELDS = ['videoUrl', 'videoTitle', 'videoDate'];
const FILTERS = [['', 'All'], ['with', 'With video'], ['without', 'Without video']];

/** Product videos grid: staged edits and a sticky save bar. */
export default function VdGrid({ canEdit }) {
  const tr = useT();
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState({});
  const [errs, setErrs] = useState({});
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => setPage(1), [filter, q]);
  const res = useApiData(() => adm.get('/growth/videos?q=' + encodeURIComponent(q) + '&filter=' + filter + '&page=' + page + '&limit=15'), [q, filter, page, tick]);
  const d = res.data;
  const rows = d?.rows || [];
  const orig = (r, k) => (k === 'videoDate' ? String(r[k] || '').slice(0, 10) : r[k] || '');
  const val = (r, k) => (edits[r.id] && k in edits[r.id] ? edits[r.id][k] : orig(r, k));
  const stage = (r, k, v) => setEdits(e => {
    const cur = { ...(e[r.id] || {}), [k]: v };
    if (FIELDS.every(f => !(f in cur) || cur[f] === orig(r, f))) { const n = { ...e }; delete n[r.id]; return n; }
    return { ...e, [r.id]: cur };
  });
  const count = Object.keys(edits).length;
  const save = async () => {
    setBusy(true); setErrs({}); setM(null);
    const r = await send('/growth/videos', { changes: Object.entries(edits).map(([id, c]) => ({ id: isNaN(id) ? id : Number(id), ...c })) });
    setBusy(false);
    if (r.status === 400 && Array.isArray(r.body?.errors)) {
      const e = {};
      r.body.errors.forEach(x => { (e[x.id] = e[x.id] || []).push((x.field ? x.field + ': ' : '') + x.message); });
      setErrs(e); setM({ ok: false, text: tr('Some rows could not be saved. Fix the lines marked below. Nothing was saved.') });
      return;
    }
    setM(mcMsg(r, tr(count === 1 ? 'Saved {n} product.' : 'Saved {n} products.', { n: count })));
    if (r.ok) { setEdits({}); setTick(t => t + 1); }
  };
  return (
    <div className="adlk-vd">
      <p className="adseo-hint">{tr('Add a YouTube link to a product. Customers see the video on the product page and Google can show it in search. Google needs the upload date, so fill it in; without a date the page shows the video but sends no video data to Google.')}</p>
      {!canEdit && <p className="adseo-hint">{tr('Only the Master Admin or Admin can change this.')}</p>}
      <div className="adlk-filters">
        <select className="a-in" value={filter} onChange={e => setFilter(e.target.value)} aria-label={tr('Show')}>{FILTERS.map(([v, l]) => <option key={v} value={v}>{tr(l)}{d?.counts && v ? ' (' + (d.counts[v] || 0) + ')' : ''}</option>)}</select>
        <input className="a-in" type="search" placeholder={tr('Search by name or SKU')} value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Msg m={res.error ? { ok: false, text: tr(res.error) } : trMsg(tr, m)} />
      <div className="adgr-scroll">
        <table className="adgr-tbl adlk-tbl">
          <thead><tr><th>{tr('Product')}</th><th>{tr('YouTube link')}</th><th>{tr('Video title (max 120)')}</th><th>{tr('Upload date')}</th><th /></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="adgr-wrap"><b>{r.name}</b> <span className="adlk-dim">#{r.id}{r.sku ? ' · ' + r.sku : ''}</span>
                  {(errs[r.id] || []).map((t, i) => <div key={i} className="adlk-err">✖ {tr(t)}</div>)}</td>
                <td><input className="a-in" type="url" disabled={!canEdit} maxLength={300} placeholder="https://www.youtube.com/watch?v=..." value={val(r, 'videoUrl')} onChange={e => stage(r, 'videoUrl', e.target.value)} aria-label={tr('YouTube link for {name}', { name: r.name })} /></td>
                <td><input className="a-in" disabled={!canEdit} maxLength={120} value={val(r, 'videoTitle')} onChange={e => stage(r, 'videoTitle', e.target.value)} aria-label={tr('Video title for {name}', { name: r.name })} /></td>
                <td><input className="a-in" type="date" disabled={!canEdit} value={val(r, 'videoDate')} onChange={e => stage(r, 'videoDate', e.target.value)} aria-label={tr('Upload date for {name}', { name: r.name })} /></td>
                <td>{val(r, 'videoUrl') ? <a href={val(r, 'videoUrl')} target="_blank" rel="noreferrer">{tr('Preview')}</a> : null}</td>
              </tr>
            ))}
            {!res.loading && !res.error && !rows.length && <tr><td colSpan={5} className="adgr-empty">{tr('No products match.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
      {count > 0 && (
        <div className="adlk-bar">
          <b>{tr(count === 1 ? '{n} unsaved change' : '{n} unsaved changes', { n: count })}</b>
          <button type="button" className="a-btn" disabled={busy || !canEdit} onClick={save}>{busy ? tr('Saving...') : tr('Save')}</button>
          <button type="button" className="a-btn ghost" disabled={busy} onClick={() => { setEdits({}); setErrs({}); }}>{tr('Discard')}</button>
        </div>
      )}
    </div>
  );
}
