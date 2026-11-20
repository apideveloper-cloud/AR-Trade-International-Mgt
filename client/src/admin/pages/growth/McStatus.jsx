import { Msg, Section } from './parts.jsx';
import { why } from './mcApi.js';

const Card = ({ title, big, children }) => (
  <div className="admc-card"><div className="admc-k">{title}</div><div className="admc-big">{big}</div>{children}</div>
);

/** A. Status strip + reasons table. */
export default function McStatus({ q, go, filterBy }) {
  if (q.error) return <Section title="Google Shopping"><Msg m={{ ok: false, text: q.error }} /></Section>;
  const d = q.data;
  if (!d) return <Section title="Google Shopping"><p className="adseo-hint">Loading...</p></Section>;
  const f = d.feed || {}, c = d.api?.counts || {};
  const skipped = f.skipped || [], warnings = f.warnings || [];
  const total = list => list.reduce((s, x) => s + (x.count || 0), 0);
  const rows = [...skipped.map(x => ({ ...x, kind: 'Left out' })), ...warnings.map(x => ({ ...x, kind: 'Warning' }))];
  return (
    <>
      {!d.flagEnabled && (
        <div className="a-card admc-banner" role="alert">
          <span>The product feed is switched off. Turn on Merchant feed in SEO &gt; Settings &gt; Automation.</span>
          <button type="button" className="a-btn sm" onClick={() => go('seo')}>Open SEO settings</button>
        </div>
      )}
      <div className="admc-cards">
        <Card title="Products in the feed" big={f.itemCount ?? 0} />
        <Card title="Left out" big={total(skipped)}>
          <div className="admc-sm">{skipped.slice(0, 3).map(x => `${why(x.reason)} (${x.count})`).join(', ') || 'Nothing left out'}</div>
        </Card>
        <Card title="Warnings" big={total(warnings)}>
          <div className="admc-sm">{warnings.slice(0, 3).map(x => `${why(x.reason)} (${x.count})`).join(', ') || 'No warnings'}</div>
        </Card>
        <Card title="Synced to Google" big={c.synced ?? 0}>
          <div className="admc-sm">{c.pending ?? 0} waiting, {c.errors ?? 0} with errors{c.deleted ? ', ' + c.deleted + ' removed' : ''}</div>
        </Card>
      </div>
      {rows.length > 0 && (
        <Section title="Why products are left out or have warnings" what="Press a product name to find it in the product list below.">
          <div className="adgr-scroll">
            <table className="adgr-tbl">
              <thead><tr><th>Type</th><th>Reason</th><th>Products</th><th>Examples</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.kind + r.reason + i}>
                    <td>{r.kind}</td><td className="adgr-wrap">{why(r.reason)}</td><td>{r.count}</td>
                    <td className="adgr-wrap">{(r.sample || []).slice(0, 5).map(p => (
                      <button key={p.id} type="button" className="admc-chip" title={'Find #' + p.id} onClick={() => filterBy(String(p.id))}>{p.name || '#' + p.id}</button>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
