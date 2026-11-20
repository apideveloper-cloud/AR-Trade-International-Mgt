import { Section } from './parts.jsx';
import { nf, pct, pos, dt, change } from './gsApi.js';

function Card({ k, big, c }) {
  return (
    <div className="adgs-card">
      <div className="adgs-k">{k}</div>
      <div className="adgs-big">{big}</div>
      <div className="adgs-chg"><span aria-hidden="true">{c.arrow}</span> {c.text} <span className="adgs-sm">vs the 28 days before</span></div>
    </div>
  );
}

/** A. Four headline numbers, or a friendly empty state when Google is not connected. */
export default function GsCards({ q, go, onRefresh, busy }) {
  if (q.error) return <Section title="Search performance"><p className="adgr-msg adgr-msg-err" role="status">{q.error}</p></Section>;
  const d = q.data;
  if (!d) return <Section title="Search performance"><p className="adseo-hint">Loading...</p></Section>;
  if (!d.connected) {
    return (
      <Section title="Search performance">
        <p>Connect Google in Search &amp; Growth &gt; Search engines to see how people find you.</p>
        <button type="button" className="a-btn" onClick={() => go('growth')}>Go to Search engines</button>
      </Section>
    );
  }
  const { cur = {}, delta = {} } = d;
  return (
    <Section title="How people find you on Google" what="The last 28 days of Google searches, compared with the 28 days before. Google reports about 2 days late, so the newest days are missing."
      right={<button type="button" className="a-btn ghost sm" disabled={busy} onClick={onRefresh}>{busy ? 'Refreshing...' : 'Refresh data'}</button>}>
      <div className="adgs-cards">
        <Card k="Clicks (last 28 days)" big={nf(cur.clicks)} c={change(delta.clicks)} />
        <Card k="Impressions (last 28 days)" big={nf(cur.impressions)} c={change(delta.impressions)} />
        <Card k="Average click rate" big={pct(cur.ctr)} c={change(delta.ctr, { ratio: true })} />
        <Card k="Average position (lower is better)" big={pos(cur.position)} c={change(delta.position, { lowerBetter: true })} />
      </div>
      <p className="adgs-sm">Last updated: {dt(d.lastSyncAt)}. Site: {d.siteUrl}</p>
    </Section>
  );
}
