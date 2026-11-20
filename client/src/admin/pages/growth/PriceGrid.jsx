import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { confirmBox } from '../../ui.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useT } from '../../i18n/lang.jsx';
import { Msg, Section } from './parts.jsx';
import { Pager } from './IssueList.jsx';
import HistoryModal from './HistoryModal.jsx';
import { ISSUES, STOCK_STATUS, jumpText, send } from './pricesApi.js';

const num = v => (v === '' || v == null ? 0 : Number(v));
const FIELD_NAME = { price: 'Price', old: 'Old price', saleEnds: 'Sale ends', stock: 'Stock', stockStatus: 'Stock status' };
const day = v => (v ? String(v).slice(0, 10) : '');

/** Row hint shown before saving: the old (crossed-out) price must be 0 or at least the price. */
function hint(r, e, tr) {
  const price = 'price' in e ? num(e.price) : r.price, old = 'old' in e ? num(e.old) : r.old;
  if (price < 0 || old < 0) return tr('Price cannot be negative.');
  if (old > 0 && old < price) return tr('Old price must be 0 or at least the price.');
  return '';
}

export default function PriceGrid({ canEdit, filter, setFilter, tick, onSaved }) {
  const tr = useT();
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
  const bad = (d?.rows || []).some(r => edits[r.id] && hint(r, edits[r.id], tr));

  const changes = () => ids.map(id => {
    const c = { id: Number(id) };
    Object.entries(edits[id]).forEach(([k, v]) => { c[k] = k === 'saleEnds' || k === 'stockStatus' ? (v || null) : num(v); });
    return c;
  });
  const save = async confirmJump => {
    setBusy(true); setM(null); setErrs({});
    const r = await send('/growth/prices/bulk', { changes: changes(), confirmJump: !!confirmJump });
    setBusy(false);
    if (r.ok) { setEdits({}); setM({ ok: true, text: tr('Saved. {n} product(s) updated.', { n: r.body.updated ?? ids.length }) }); onSaved(); return; }
    if (r.status === 400 && r.body.errors) {
      const e = {}; r.body.errors.forEach(x => { (e[x.id] = e[x.id] || []).push((x.field ? tr(FIELD_NAME[x.field] || x.field) + ': ' : '') + tr(x.message)); });
      setErrs(e); setM({ ok: false, text: tr('Nothing was saved. Fix the marked rows and try again.') }); return;
    }
    if (r.status === 409 && r.body.needsConfirm) {
      if (await confirmBox(jumpText(r.body.needsConfirm, tr), { confirmLabel: tr('Yes, save') })) save(true);
      return;
    }
    setM({ ok: false, text: tr(r.body.error || 'Could not save. Please try again.') });
  };
  const edited = (r, k) => (edits[r.id] && k in edits[r.id] ? ' adgp-edited' : '');
  const inp = (r, k, type = 'number', extra = {}) => (
    <input className={'a-in adgp-in' + edited(r, k)} type={type} value={type === 'date' ? day(val(r, k)) : val(r, k)} disabled={!canEdit} aria-label={tr('{field} of {name}', { field: tr(FIELD_NAME[k] || k), name: r.name })}
      onChange={e => set(r.id, k, e.target.value)} {...extra} />
  );
  return (
    <Section id="adgp-grid" title={tr('Price & stock grid')} what={tr('Change prices, sale end dates and stock here. Edits are kept on this page until you press Save all.')}>
      {!canEdit && <div className="adgr-note">{tr('Only the Master Admin or Admin can change prices.')}</div>}
      <div className="adgr-filters">
        <input className="a-in" placeholder={tr('Search ID, SKU, name or part no.')} value={text} onChange={e => setText(e.target.value)} aria-label={tr('Search products')} />
        <select className="a-in" value={filter.issue} onChange={e => setFilter(f => ({ ...f, issue: e.target.value }))} aria-label={tr('Problem')}>
          <option value="">{tr('All products')}</option>
          {ISSUES.map(([k, l]) => <option key={k} value={k}>{tr(l)}{d?.counts?.[k] != null ? ` (${d.counts[k]})` : ''}</option>)}
        </select>
        {(filter.q || filter.issue) && <button type="button" className="a-btn ghost sm" onClick={() => { setText(''); setFilter({ q: '', cat: '', brand: '', issue: '' }); }}>{tr('Clear filters')}</button>}
        {q.loading && <span className="spin" />}
      </div>
      <Msg m={q.error ? { ok: false, text: tr(q.error) } : m} />
      <div className="adgr-scroll">
        <table className="adgr-tbl adgp-tbl">
          <thead><tr><th>ID</th><th>SKU</th><th>{tr('Name')}</th><th>{tr('Price (৳)')}</th><th>{tr('Old price (৳)')}</th><th>{tr('Sale ends')}</th><th>{tr('Stock')}</th><th>{tr('Stock status')}</th><th>{tr('History')}</th></tr></thead>
          <tbody>
            {(d?.rows || []).map(r => {
              const h = edits[r.id] ? hint(r, edits[r.id], tr) : '', er = errs[r.id];
              return (
                <tr key={r.id} className={er || h ? 'adgp-rowbad' : ''}>
                  <td>{r.id}</td><td>{r.sku || <span className="adgr-dim">{tr('none')}</span>}</td>
                  <td className="adgr-wrap">{r.name}{!r.active && <span className="adgr-dim"> {tr('(hidden)')}</span>}
                    {(h || er) && <div className="adgp-err" role="alert">⚠ {h || er.join('; ')}</div>}</td>
                  <td>{inp(r, 'price', 'number', { min: 0, step: 'any' })}</td>
                  <td>{inp(r, 'old', 'number', { min: 0, step: 'any' })}</td>
                  <td>{inp(r, 'saleEnds', 'date')}</td>
                  <td>{inp(r, 'stock', 'number', { min: 0, step: 1 })}</td>
                  <td><select className={'a-in adgp-in' + edited(r, 'stockStatus')} disabled={!canEdit} value={val(r, 'stockStatus') || ''} aria-label={tr('Stock status of {name}', { name: r.name })} onChange={e => set(r.id, 'stockStatus', e.target.value)}>
                    {STOCK_STATUS.map(([k, l]) => <option key={k} value={k}>{tr(l)}</option>)}</select></td>
                  <td><button type="button" className="a-btn ghost sm" onClick={() => setHist(r)}>{tr('History')}</button></td>
                </tr>
              );
            })}
            {!q.loading && !q.error && !(d?.rows || []).length && <tr><td colSpan={9} className="adgr-empty">{tr('No products match.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
      {ids.length > 0 && (
        <div className="adgp-bar" role="status">
          <b>{ids.length > 1 ? tr('{n} unsaved changes', { n: ids.length }) : tr('1 unsaved change')}</b>{bad && <span> {tr('(fix the marked rows first)')}</span>}
          <button type="button" className="a-btn sm" disabled={busy || bad} onClick={() => save(false)}>{busy ? tr('Saving…') : tr('Save all')}</button>
          <button type="button" className="a-btn ghost sm" disabled={busy} onClick={() => { setEdits({}); setErrs({}); }}>{tr('Discard')}</button>
        </div>
      )}
      {hist && <HistoryModal product={hist} onClose={() => setHist(null)} />}
    </Section>
  );
}
