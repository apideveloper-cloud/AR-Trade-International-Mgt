import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Summary } from '../../ui.jsx';
import VisibilityCard from './dashboard/VisibilityCard.jsx';
import { BrandsCard, DuplicatesCard, IssuesCard, RedirectsCard, SitemapCard } from './dashboard/Cards.jsx';
import { n0, recalcAll, scoreTone, whenOf } from './dashboard/dashModel.js';
import './dashboard/dashboard.css';

/** Admin > SEO > Overview: scores, problems, duplicates, brands, sitemap and redirects. onGoto(tabKey, filterKey?) switches tab. */
export default function Dashboard({ onGoto }) {
  const q = useApiData(() => adm.get('/seo/dashboard'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const d = q.data;
  const recalc = async () => {
    setBusy(true); setErr('');
    const r = await recalcAll();
    if (!r.ok) setErr(r.error);
    await q.reload();
    setBusy(false);
  };
  if (!d) return q.error ? <div className="a-empty">Could not load the SEO dashboard: {q.error}</div> : <span className="spin" />;
  const p = d.products || {};
  const avg = p.avgScore == null ? null : Math.round(Number(p.avgScore));
  return (
    <div className="adds">
      <div className="a-card adds-head">
        <div className={'adds-ring tone-' + scoreTone(avg)} title="Average SEO score"><b>{avg == null ? '–' : avg}</b><small>avg score</small></div>
        <div className="adds-headtxt">
          <button type="button" className="a-btn grad" disabled={busy} onClick={recalc}>{busy ? 'Recalculating…' : 'Recalculate all scores'}</button>
          <span className="adseo-hint">Last scored: {whenOf(d.lastScoredAt)}</span>
          {p.unscored > 0 && <span className="adseo-hint adds-warn">{n0(p.unscored)} products have no score yet. Recalculate to score them.</span>}
          {err && <span className="a-msg err">{err}</span>}
        </div>
      </div>
      <VisibilityCard onGoto={onGoto} />
      <Summary items={[
        ['Average score', avg == null ? '–' : avg + ' / 100', 'Across scored products', avg == null ? 'blue' : avg >= 80 ? 'green' : avg >= 50 ? 'amber' : 'red', 'tag'],
        ['Products scored', n0(p.scored) + ' of ' + n0(p.total), n0(p.live) + ' live', 'blue', 'box'],
        ['Noindex products', n0(p.noindex), 'Hidden from search engines', 'amber', 'alert'],
        ['Duplicate titles', n0(d.duplicates?.titles), 'Products sharing a title', 'red', 'alert'],
        ['Duplicate descriptions', n0(d.duplicates?.descriptions), 'Products sharing a description', 'red', 'alert'],
        ['Redirects', n0(d.redirects?.total), n0(d.redirects?.auto) + ' automatic', 'violet', 'tag']
      ]} />
      <div className="adds-grid">
        <IssuesCard issues={d.issues} onGoto={onGoto} />
        <DuplicatesCard dup={d.duplicates} />
        <BrandsCard brands={d.brands} onGoto={onGoto} />
        <SitemapCard sitemap={d.sitemap} note={d.sitemapNote} />
        <RedirectsCard redirects={d.redirects} />
      </div>
    </div>
  );
}
