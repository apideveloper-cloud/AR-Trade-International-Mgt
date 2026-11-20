import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { when } from './growthModel.js';

export function Pager({ page, pages, setPage }) {
  if (pages <= 1) return null;
  return (
    <div className="a-pager">
      <span>Page {page} of {pages}</span>
      <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
      <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button>
    </div>
  );
}

/** "Needs attention": the problems found by the last check, 15 per page. */
export default function IssueList({ tick, code, fix }) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [code]);
  const q = useApiData(() => adm.get('/growth/price-checks?code=' + encodeURIComponent(code) + '&page=' + page + '&limit=15'), [code, page, tick]);
  const d = q.data;
  return (
    <Section id="adgp-issues" title="Needs attention" what="Products with a problem. Press Fix in grid to jump to the product and correct it below.">
      <Msg m={q.error ? { ok: false, text: q.error } : null} />
      <div className="adgr-scroll">
        <table className="adgr-tbl">
          <thead><tr><th>Product</th><th>Problem</th><th>Details</th><th>Found</th><th /></tr></thead>
          <tbody>
            {(d?.rows || []).map((r, i) => (
              <tr key={r.productId + r.code + i}>
                <td className="adgr-wrap"><b>{r.name}</b> <span className="adgr-dim">#{r.productId}</span></td>
                <td className="adgr-wrap">{r.label || String(r.code || 'Unknown problem').replace(/_/g, ' ')}</td>
                <td className="adgr-wrap">{r.detail || ''}</td>
                <td>{when(r.foundAt)}</td>
                <td><button type="button" className="a-btn ghost sm" onClick={() => fix(r.productId)}>Fix in grid</button></td>
              </tr>
            ))}
            {!q.loading && !q.error && !(d?.rows || []).length && <tr><td colSpan={5} className="adgr-empty">Nothing needs attention.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={d?.page || page} pages={d?.pages || 1} setPage={setPage} />
    </Section>
  );
}
