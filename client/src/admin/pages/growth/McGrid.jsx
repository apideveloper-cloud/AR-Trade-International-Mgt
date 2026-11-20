import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import { send, mcMsg, why, STATUS_FILTERS } from './mcApi.js';

const FIELDS = ['excluded', 'itemGroupId', 'googleCategory'];

/** D. Product grid with staged edits and a sticky save bar. */
export default function McGrid({ q, setQ, canEdit, tick, onSaved }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [edits, setEdits] = useState({});
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(1), [q, status]);
  const res = useApiData(() => adm.get('/growth/merchant/products?q=' + encodeURIComponent(q) + '&status=' + encodeURIComponent(status) + '&page=' + page + '&limit=15'), [q, status, page, tick]);
  const d = res.data;
  const rows = d?.rows || [];
  const val = (r, k) => (edits[r.id] && k in edits[r.id] ? edits[r.id][k] : (k === 'excluded' ? !!r[k] : r[k] || ''));
  const stage = (r, k, v) => setEdits(e => {
    const cur = { ...(e[r.id] || {}), [k]: v };
    if (FIELDS.every(f => !(f in cur) || cur[f] === (f === 'excluded' ? !!r[f] : r[f] || ''))) { const n = { ...e }; delete n[r.id]; return n; }
    return { ...e, [r.id]: cur };
  });
  const count = Object.keys(edits).length;
  const save = async () => {
    setBusy(true);
    const r = await send('/growth/merchant/products', { changes: Object.entries(edits).map(([id, c]) => ({ id: isNaN(id) ? id : Number(id), ...c })) });
    setBusy(false);
    setM(mcMsg(r, 'Saved ' + count + ' product' + (count === 1 ? '' : 's') + '.'));
    if (r.ok) { setEdits({}); onSaved(); }
  };
  return (
    <Section id="admc-grid" title="Products" what="See every product and whether it goes to Google. You can leave a product out, group variants together, or set its Google category.">
      {!canEdit && <p className="adseo-hint">You can look, but only people who can manage products can change these.</p>}
      <div className="admc-row">
        <select className="a-in admc-sel" value={status} onChange={e => setStatus(e.target.value)} aria-label="Show">
          {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="a-in admc-search" type="search" placeholder="Search by name, SKU or number" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Msg m={res.error ? { ok: false, text: res.error } : m} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Product</th><th>In feed?</th><th>Why / warnings</th><th>Picture</th><th>Exclude</th><th>Group ID</th><th>Google category</th><th>Google status</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td className="adgr-wrap"><b>{r.name}</b> <span className="adgr-dim">#{r.id}{r.sku ? ' · ' + r.sku : ''}</span></td>
                <td><span className={'admc-badge ' + (r.included ? 'admc-yes' : 'admc-no')}>{r.included ? '✔ In feed' : '✖ Left out'}</span></td>
                <td className="adgr-wrap">{r.reason ? why(r.reason) : ''}{(r.warnings || []).length ? <span className="adgr-dim"> {(r.warnings || []).map(why).join(', ')}</span> : null}{!r.reason && !(r.warnings || []).length ? '-' : ''}</td>
                <td>{r.imgW > 0 && r.imgH > 0 ? r.imgW + '×' + r.imgH : 'unknown'}</td>
                <td><input type="checkbox" disabled={!canEdit} checked={val(r, 'excluded')} onChange={e => stage(r, 'excluded', e.target.checked)} aria-label={'Exclude ' + r.name} /></td>
                <td><input className="a-in admc-grp" maxLength={50} disabled={!canEdit} value={val(r, 'itemGroupId')} onChange={e => stage(r, 'itemGroupId', e.target.value)} aria-label={'Group ID for ' + r.name} /></td>
                <td><input className="a-in admc-cat" maxLength={250} disabled={!canEdit} value={val(r, 'googleCategory')} onChange={e => stage(r, 'googleCategory', e.target.value)} aria-label={'Google category for ' + r.name} /></td>
                <td className="adgr-wrap">{r.syncStatus || '-'}{r.issues && r.issues[0] ? <div className="adgr-dim">{typeof r.issues[0] === 'string' ? r.issues[0] : r.issues[0].description || r.issues[0].message || r.issues[0].code}</div> : null}</td>
              </tr>
            ))}
            {!res.loading && !res.error && !rows.length && <tr><td colSpan={8} className="adgr-empty">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
      {count > 0 && (
        <div className="admc-bar">
          <b>{count} unsaved change{count === 1 ? '' : 's'}</b>
          <button type="button" className="a-btn" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Save'}</button>
          <button type="button" className="a-btn ghost" disabled={busy} onClick={() => setEdits({})}>Discard</button>
        </div>
      )}
    </Section>
  );
}
