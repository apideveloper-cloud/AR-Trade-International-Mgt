import { useT } from '../../i18n/lang.jsx';
import { Section } from './parts.jsx';
import { nf, pct, pos, dt, change } from './gsApi.js';

function Card({ k, big, c }) {
  const tr = useT();
  return (
    <div className="adgs-card">
      <div className="adgs-k">{k}</div>
      <div className="adgs-big">{big}</div>
      <div className="adgs-chg"><span aria-hidden="true">{c.arrow}</span> {c.text} <span className="adgs-sm">{tr('vs the 28 days before')}</span></div>
    </div>
  );
}

/** A. Four headline numbers, or a friendly empty state when Google is not connected. */
export default function GsCards({ q, go, onRefresh, busy }) {
  const tr = useT();
  if (q.error) return <Section title={tr('Search performance')}><p className="adgr-msg adgr-msg-err" role="status">{tr(q.error)}</p></Section>;
  const d = q.data;
  if (!d) return <Section title={tr('Search performance')}><p className="adseo-hint">{tr('Loading...')}</p></Section>;
  if (!d.connected) {
    return (
      <Section title={tr('Search performance')}>
        <p>{tr('Connect Google in Search & Growth > Search engines to see how people find you.')}</p>
        <button type="button" className="a-btn" onClick={() => go('growth')}>{tr('Go to Search engines')}</button>
      </Section>
    );
  }
  const { cur = {}, delta = {} } = d;
  return (
    <Section title={tr('How people find you on Google')} what={tr('The last 28 days of Google searches, compared with the 28 days before. Google reports about 2 days late, so the newest days are missing.')}
      right={<button type="button" className="a-btn ghost sm" disabled={busy} onClick={onRefresh}>{busy ? tr('Refreshing...') : tr('Refresh data')}</button>}>
      <div className="adgs-cards">
        <Card k={tr('Clicks (last 28 days)')} big={nf(cur.clicks)} c={change(delta.clicks, { tr })} />
        <Card k={tr('Impressions (last 28 days)')} big={nf(cur.impressions)} c={change(delta.impressions, { tr })} />
        <Card k={tr('Average click rate')} big={pct(cur.ctr)} c={change(delta.ctr, { ratio: true, tr })} />
        <Card k={tr('Average position (lower is better)')} big={pos(cur.position)} c={change(delta.position, { lowerBetter: true, tr })} />
      </div>
      <p className="adgs-sm">{tr('Last updated: {when}. Site: {site}', { when: dt(d.lastSyncAt, tr), site: d.siteUrl })}</p>
    </Section>
  );
}
