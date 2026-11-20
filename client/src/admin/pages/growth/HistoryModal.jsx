import { useEffect } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg } from './parts.jsx';
import { when } from './growthModel.js';
import { money } from './pricesApi.js';

const chg = (a, b, f = money) => (a === b || (a == null && b == null) ? <span className="adgr-dim">-</span> : <>{a == null ? '-' : f(a)} → <b>{b == null ? '-' : f(b)}</b></>);
const dt = v => String(v).slice(0, 10);

/** Who changed what and when, for one product. */
export default function HistoryModal({ product, onClose }) {
  const q = useApiData(() => adm.get('/growth/prices/' + product.id + '/history'), [product.id]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const rows = q.data?.rows || [];
  return (
    <div className="adgp-ovl" onClick={onClose}>
      <div className="adgp-dlg" role="dialog" aria-modal="true" aria-label="Price history" onClick={e => e.stopPropagation()}>
        <div className="adgr-hd"><h3>Price history: {product.name}</h3><button type="button" className="a-btn ghost sm" onClick={onClose}>Close</button></div>
        <p className="adgr-dim">Who changed what and when.</p>
        {q.data?.health?.trigger === false && <div className="adgr-warn">Price history is not recording: ask your developer.</div>}
        <Msg m={q.error ? { ok: false, text: q.error } : null} />
        {q.loading && <span className="spin" />}
        <div className="adgr-scroll">
          <table className="adgr-tbl">
            <thead><tr><th>When</th><th>Price</th><th>Old price</th><th>Sale ends</th><th>Changed by</th></tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}><td>{when(r.at)}</td><td>{chg(r.priceOld, r.priceNew)}</td><td>{chg(r.oldOld, r.oldNew)}</td><td>{chg(r.saleEndsOld, r.saleEndsNew, dt)}</td><td>{r.by || 'Unknown (script or system)'}</td></tr>)}
              {!q.loading && !q.error && !rows.length && <tr><td colSpan={5} className="adgr-empty">No changes recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
