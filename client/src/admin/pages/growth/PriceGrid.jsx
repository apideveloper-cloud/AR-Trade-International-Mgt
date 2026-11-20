import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import HistoryModal from './HistoryModal.jsx';
import { ISSUES, STOCK_STATUS, jumpText, send } from './pricesApi.js';

const num = v => (v === '' || v == null ? 0 : Number(v));
const day = v => (v ? String(v).slice(0, 10) : '');

/** Row hint shown before saving: the old (crossed-out) price must be 0 or at least the price. */
function hint(r, e) {
  const price = 'price' in e ? num(e.price) : r.price, old = 'old' in e ? num(e.old) : r.old;
  if (price < 0 || old < 0) return 'Price cannot be negative.';
  if (old > 0 && old < price) return 'Old price must be 0 or at least the price.';
  return '';
}

export default function PriceGrid({ canEdit, filter, setFilter, tick, onSaved }) {
  const [page, setPage] = useState(1);
  const [text, setText] = useState(filter.q);
  const [edits, setEdits] = useState({});
  const [errs, setErrs] = useState({});
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(null);
  useEffect(() => { setText(filter.q); setPage(1); }, [filter.q, filter.issue]);
  useEffect(() => { const t = setTimeout(() => text !== filter.q && setFilter(f => ({ ...f, q: text })), 350); return () => clearTimeout(t); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const qs = `q=${encodeURIComponent(filter.q)}&cat=${encodeURIComponent(filter.cat)}&brand=${encodeURIComponent(filter.brand)}&issue=${filter.issue}&page=${page}&limit=15`;
  const q = useApiData(() => adm.get('/growth/prices?' + qs), [qs, tick]);
  const d = q.data;
  const ids = Object.keys(edits);
  const set = (id, k, v) => setEdits(s => ({ ...s, [id]: { ...s[id], [k]: v } }));
  const val = (r, k) => (edits[r.id] && k in edits[r.id] ? edits[r.id][k] : r[k] ?? '');
  const bad = (d?.rows || []).some(r => edits[r.id] && hint(r, edits[r.id]));

  const changes = () => ids.map(id => {
    const c = { id: Number(id) };
    Object.entries(edits[id]).forEach(([k, v]) => { c[k] = k === 'saleEnds' || k === 'stockStatus' ? (v || null) : num(v); });
    return c;
  });
  const save = async confirmJump => {
    setBusy(true); setM(null); setErrs({});
    const r = await send('/growth/prices/bulk', { changes: changes(), confirmJump: !!confirmJump });
    setBusy(false);
    if (r.ok) { setEdits({}); setM({ ok: true, text: `Saved. ${r.body.updated ?? ids.length} product(s) updated.` }); onSaved(); return; }
    if (r.status === 400 && r.body.errors) {
      const e = {}; r.body.errors.forEach(x => { (e[x.id] = e[x.id] || []).push((x.field ? x.field + ': ' : '') + x.message); });
      setErrs(e); setM({ ok: false, text: 'Nothing was saved. Fix the marked rows and try again.' }); return;
    }
    if (r.status === 409 && r.body.needsConfirm) {
      if (await confirmBox(jumpText(r.body.needsConfirm), { confirmLabel: 'Yes, save' })) save(true);
      return;
    }
    setM({ ok: false, text: r.body.error || 'Could not save. Please try again.' });
  };
  const edited = (r, k) => (edits[r.id] && k in edits[r.id] ? ' adgp-edited' : '');
  const inp = (r, k, type = 'number', extra = {}) => (
    <input className={'a-in adgp-in' + edited(r, k)} type={type} value={type === 'date' ? day(val(r, k)) : val(r, k)} disabled={!canEdit} aria-label={k + ' of ' + r.name}
      onChange={e => set(r.id, k, e.target.value)} {...extra} />
  );
  return (
    <Section id="adgp-grid" title="Price & stock grid" what="Change prices, sale end dates and stock here. Edits are kept on this page until you press Save all.">
      {!canEdit && <div className="adgr-note">Only the Master Admin or Admin can change prices.</div>}
      <div className="adgr-filters">
        <input className="a-in" placeholder="Search ID, SKU, name or part no." value={text} onChange={e => setText(e.target.value)} aria-label="Search products" />
        <select className="a-in" value={filter.issue} onChange={e => setFilter(f => ({ ...f, issue: e.target.value }))} aria-label="Problem">
          <option value="">All products</option>
          {ISSUES.map(([k, l]) => <option key={k} value={k}>{l}{d?.counts?.[k] != null ? ` (${d.counts[k]})` : ''}</option>)}
        </select>
        {(filter.q || filter.issue) && <button type="button" className="a-btn ghost sm" onClick={() => { setText(''); setFilter({ q: '', cat: '', brand: '', issue: '' }); }}>Clear filters</button>}
        {q.loading && <span className="spin" />}
      </div>
      <Msg m={q.error ? { ok: false, text: q.error } : m} />
      <div className="adgr-scroll">
        <table className="adgr-tbl adgp-tbl">
          <thead><tr><th>ID</th><th>SKU</th><th>Name</th><th>Price (৳)</th><th>Old price (৳)</th><th>Sale ends</th><th>Stock</th><th>Stock status</th><th>History</th></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => {
              const h = edits[r.id] ? hint(r, edits[r.id]) : '', er = errs[r.id];
              return (
                <tr key={r.id} className={er || h ? 'adgp-rowbad' : ''}>
                  <td>{r.id}</td><td>{r.sku || <span className="adgr-dim">none</span>}</td>
                  <td className="adgr-wrap">{r.name}{!r.active && <span className="adgr-dim"> (hidden)</span>}
                    {(h || er) && <div className="adgp-err" role="alert">⚠ {h || er.join('; ')}</div>}</td>
                  <td>{inp(r, 'price', 'number', { min: 0, step: 'any' })}</td>
                  <td>{inp(r, 'old', 'number', { min: 0, step: 'any' })}</td>
                  <td>{inp(r, 'saleEnds', 'date')}</td>
                  <td>{inp(r, 'stock', 'number', { min: 0, step: 1 })}</td>
                  <td><select className={'a-in adgp-in' + edited(r, 'stockStatus')} disabled={!canEdit} value={val(r, 'stockStatus') || ''} aria-label={'Stock status of ' + r.name} onChange={e => set(r.id, 'stockStatus', e.target.value)}>
                    {STOCK_STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                  <td><button type="button" className="a-btn ghost sm" onClick={() => setHist(r)}>History</button></td>
                </tr>
              );
            })}
            {!q.loading && !q.error && !(d?.rows || []).length && <tr><td colSpan={9} className="adgr-empty">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
      {ids.length > 0 && (
        <div className="adgp-bar" role="status">
          <b>{ids.length} unsaved change{ids.length > 1 ? 's' : ''}</b>{bad && <span> (fix the marked rows first)</span>}
          <button type="button" className="a-btn sm" disabled={busy || bad} onClick={() => save(false)}>{busy ? 'Saving…' : 'Save all'}</button>
          <button type="button" className="a-btn ghost sm" disabled={busy} onClick={() => { setEdits({}); setErrs({}); }}>Discard</button>
        </div>
      )}
      {hist && <HistoryModal product={hist} onClose={() => setHist(null)} />}
    </Section>
  );
}
