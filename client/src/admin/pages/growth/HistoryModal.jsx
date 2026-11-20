import { useEffect } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { useT } from '../../i18n/lang.jsx';
import { Msg } from './parts.jsx';
import { when } from './growthModel.js';
import { money } from './pricesApi.js';

const chg = (a, b, f = money) => (a === b || (a == null && b == null) ? <span className="adgr-dim">-</span> : <>{a == null ? '-' : f(a)} → <b>{b == null ? '-' : f(b)}</b></>);
const dt = v => String(v).slice(0, 10);

/** Who changed what and when, for one product. */
export default function HistoryModal({ product, onClose }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/prices/' + product.id + '/history'), [product.id]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const rows = q.data?.rows || [];
  return (
    <div className="adgp-ovl" onClick={onClose}>
      <div className="adgp-dlg" role="dialog" aria-modal="true" aria-label={tr('Price history')} onClick={e => e.stopPropagation()}>
        <div className="adgr-hd"><h3>{tr('Price history: {name}', { name: product.name })}</h3><button type="button" className="a-btn ghost sm" onClick={onClose}>{tr('Close')}</button></div>
        <p className="adgr-dim">{tr('Who changed what and when.')}</p>
        {q.data?.health?.trigger === false && (q.data.health.mode === 'snapshot' ? <div className="adgr-hint">{tr('Price changes are recorded every 10 minutes, so very quick changes may appear as one.')}</div> : <div className="adgr-warn">{tr('Price history is not recording: ask your developer.')}</div>)}
        <Msg m={q.error ? { ok: false, text: tr(q.error) } : null} />
        {q.loading && <span className="spin" />}
        <div className="adgr-scroll">
          <table className="adgr-tbl">
            <thead><tr><th>{tr('When')}</th><th>{tr('Price')}</th><th>{tr('Old price')}</th><th>{tr('Sale ends')}</th><th>{tr('Changed by')}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}><td>{when(r.at)}</td><td>{chg(r.priceOld, r.priceNew)}</td><td>{chg(r.oldOld, r.oldNew)}</td><td>{chg(r.saleEndsOld, r.saleEndsNew, dt)}</td><td>{r.by || tr('Unknown (script or system)')}</td></tr>)}
              {!q.loading && !q.error && !rows.length && <tr><td colSpan={5} className="adgr-empty">{tr('No changes recorded yet.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
