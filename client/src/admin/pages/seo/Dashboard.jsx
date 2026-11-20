import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Summary } from '../../ui.jsx';
import VisibilityCard from './dashboard/VisibilityCard.jsx';
import { BrandsCard, DuplicatesCard, IssuesCard, RedirectsCard, SitemapCard } from './dashboard/Cards.jsx';
import { n0, recalcAll, scoreTone, whenOf } from './dashboard/dashModel.js';
import './dashboard/dashboard.css';

/** Admin > SEO > Overview: scores, problems, duplicates, brands, sitemap and redirects. onGoto(tabKey, filterKey?) switches tab. */
export default function Dashboard({ onGoto }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/seo/dashboard'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const d = q.data;
  const recalc = async () => {
    setBusy(true); setErr('');
    const r = await recalcAll();
    if (!r.ok) setErr(tr(r.error));
    await q.reload();
    setBusy(false);
  };
  if (!d) return q.error ? <div className="a-empty">{tr('Could not load the SEO dashboard: {e}', { e: q.error })}</div> : <span className="spin" />;
  const p = d.products || {};
  const avg = p.avgScore == null ? null : Math.round(Number(p.avgScore));
  return (
    <div className="adds">
      <div className="a-card adds-head">
        <div className={'adds-ring tone-' + scoreTone(avg)} title={tr('Average SEO score')}><b>{avg == null ? '–' : avg}</b><small>{tr('avg score')}</small></div>
        <div className="adds-headtxt">
          <button type="button" className="a-btn grad" disabled={busy} onClick={recalc}>{busy ? tr('Recalculating…') : tr('Recalculate all scores')}</button>
          <span className="adseo-hint">{tr('Last scored: {when}', { when: whenOf(d.lastScoredAt, tr) })}</span>
          {p.unscored > 0 && <span className="adseo-hint adds-warn">{tr('{n} products have no score yet. Recalculate to score them.', { n: n0(p.unscored) })}</span>}
          {err && <span className="a-msg err">{err}</span>}
        </div>
      </div>
      <VisibilityCard onGoto={onGoto} />
      <Summary items={[
        [tr('Average score'), avg == null ? '–' : avg + ' / 100', tr('Across scored products'), avg == null ? 'blue' : avg >= 80 ? 'green' : avg >= 50 ? 'amber' : 'red', 'tag'],
        [tr('Products scored'), tr('{a} of {b}', { a: n0(p.scored), b: n0(p.total) }), tr('{n} live', { n: n0(p.live) }), 'blue', 'box'],
        [tr('Noindex products'), n0(p.noindex), tr('Hidden from search engines'), 'amber', 'alert'],
        [tr('Duplicate titles'), n0(d.duplicates?.titles), tr('Products sharing a title'), 'red', 'alert'],
        [tr('Duplicate descriptions'), n0(d.duplicates?.descriptions), tr('Products sharing a description'), 'red', 'alert'],
        [tr('Redirects'), n0(d.redirects?.total), tr('{n} automatic', { n: n0(d.redirects?.auto) }), 'violet', 'tag']
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
