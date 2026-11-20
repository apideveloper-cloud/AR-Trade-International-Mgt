import { Spark } from '../../charts.jsx';
import { KPI_ICONS } from './icons.jsx';
import { useT } from '../../i18n/lang.jsx';
import { locFor } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

/** The row of KPI tiles (1 to 8), 4 across at most. */
export function KpiGrid({ kpis }) {
  const tr = useT();
  const L = locFor(tr);
  return (
    <div className="kpis kp2" style={{ '--cols': kpis.length <= 4 ? kpis.length : kpis.length <= 6 ? 3 : 4 }}>
      {kpis.map(c => (
        <div className={'kpi tone-' + c.tone} key={c.t}>
          <span className="kic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{KPI_ICONS[c.ic]}</svg></span>
          <small>{L.title(c.t)}</small><b>{c.v}</b>{c.sub}
          {c.spark && <Spark values={c.spark} hue={c.hue} />}
        </div>
      ))}
    </div>
  );
}
