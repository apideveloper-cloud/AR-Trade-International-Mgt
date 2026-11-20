import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';
import { when } from './growthModel.js';

export function Pager({ page, pages, setPage }) {
  const tr = useT();
  if (pages <= 1) return null;
  return (
    <div className="a-pager">
      <span>{tr('Page {page} of {pages}', { page, pages })}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>{tr('‹ Prev')}</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>{tr('Next ›')}</button>
    </div>
  );
}

/** "Needs attention": the problems found by the last check, 15 per page. */
export default function IssueList({ tick, code, fix }) {
  const tr = useT();
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [code]);
  const q = useApiData(() => adm.get('/growth/price-checks?code=' + encodeURIComponent(code) + '&page=' + page + '&limit=15'), [code, page, tick]);
  const d = q.data;
  return (
    <Section id="adgp-issues" title={tr('Needs attention')} what={tr('Products with a problem. Press Fix in grid to jump to the product and correct it below.')}>
      <Msg m={q.error ? { ok: false, text: tr(q.error) } : null} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>{tr('Product')}</th><th>{tr('Problem')}</th><th>{tr('Details')}</th><th>{tr('Found')}</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map((r, i) => (
              <tr key={r.productId + r.code + i}>
                <td className="adgr-wrap"><b>{r.name}</b> <span className="adgr-dim">#{r.productId}</span></td>
                <td className="adgr-wrap">{tr(r.label || String(r.code || 'Unknown problem').replace(/_/g, ' '))}</td>
                <td className="adgr-wrap">{r.detail ? tr(r.detail) : ''}</td>
                <td>{when(r.foundAt)}</td>
                <td><button type="button" className="a-btn ghost sm" onClick={() => fix(r.productId)}>{tr('Fix in grid')}</button></td>
              </tr>
            ))}
            {!q.loading && !q.error && !(d?.rows || []).length && <tr><td colSpan={5} className="adgr-empty">{tr('Nothing needs attention.')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </Section>
  );
}
