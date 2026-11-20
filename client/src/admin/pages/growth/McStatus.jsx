import { useT } from '../../i18n/lang.jsx';
import { Msg, Section } from './parts.jsx';
import { why } from './mcApi.js';

const Card = ({ title, big, children }) => (
  <div className="admc-card"><div className="admc-k">{title}</div><div className="admc-big">{big}</div>{children}</div>
);

/** A. Status strip + reasons table. */
export default function McStatus({ q, go, filterBy }) {
  const tr = useT();
  if (q.error) return <Section title={tr('Google Shopping')}><Msg m={{ ok: false, text: q.error }} /></Section>;
  const d = q.data;
  if (!d) return <Section title={tr('Google Shopping')}><p className="adseo-hint">{tr('Loading...')}</p></Section>;
  const f = d.feed || {}, c = d.api?.counts || {};
  const skipped = f.skipped || [], warnings = f.warnings || [];
  const total = list => list.reduce((s, x) => s + (x.count || 0), 0);
  const rows = [...skipped.map(x => ({ ...x, kind: 'Left out' })), ...warnings.map(x => ({ ...x, kind: 'Warning' }))];
  return (
    <>
      {!d.flagEnabled && (
        <div className="a-card admc-banner" role="alert">
          <span>{tr('The product feed is switched off. Turn on Merchant feed in SEO > Settings > Automation.')}</span>
          <button type="button" className="a-btn sm" onClick={() => go('seo')}>{tr('Open SEO settings')}</button>
        </div>
      )}
      <div className="admc-cards">
        <Card title={tr('Products in the feed')} big={f.itemCount ?? 0} />
        <Card title={tr('Left out')} big={total(skipped)}>
          <div className="admc-sm">{skipped.slice(0, 3).map(x => `${why(x.reason, tr)} (${x.count})`).join(', ') || tr('Nothing left out')}</div>
        </Card>
        <Card title={tr('Warnings')} big={total(warnings)}>
          <div className="admc-sm">{warnings.slice(0, 3).map(x => `${why(x.reason, tr)} (${x.count})`).join(', ') || tr('No warnings')}</div>
        </Card>
        <Card title={tr('Synced to Google')} big={c.synced ?? 0}>
          <div className="admc-sm">{c.deleted ? tr('{a} waiting, {b} with errors, {c} removed', { a: c.pending ?? 0, b: c.errors ?? 0, c: c.deleted }) : tr('{a} waiting, {b} with errors', { a: c.pending ?? 0, b: c.errors ?? 0 })}</div>
        </Card>
      </div>
      {rows.length > 0 && (
        <Section title={tr('Why products are left out or have warnings')} what={tr('Press a product name to find it in the product list below.')}>
          <div className="adgr-scroll">
            <table className="adgr-tbl">
              <thead><tr><th>{tr('Type')}</th><th>{tr('Reason')}</th><th>{tr('Products')}</th><th>{tr('Examples')}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.kind + r.reason + i}>
                    <td>{tr(r.kind)}</td><td className="adgr-wrap">{why(r.reason, tr)}</td><td>{r.count}</td>
                    <td className="adgr-wrap">{(r.sample || []).slice(0, 5).map(p => (
                      <button key={p.id} type="button" className="admc-chip" title={tr('Find #{id}', { id: p.id })} onClick={() => filterBy(String(p.id))}>{p.name || '#' + p.id}</button>
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
