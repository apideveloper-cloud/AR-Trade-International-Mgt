import { PERIODS } from './useOverview.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';

/** Greeting banner with the day's summary line and the "to do" shortcuts. */
export function DashHero({ o, first, summary, go }) {
  const tr = useT();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <section className="dash-hero compact">
      <div>
        <small>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {tr(o.person.role)}</small>
        <h2>{tr(greet)}{first ? ', ' + first : ''} 👋</h2>
        <p>{summary}</p>
      </div>
      <div className="qa">
        {o.todo.length === 0 && <span className="qa-ok">✓ {tr('Nothing is waiting for you right now')}</span>}
        {o.todo.map(t => <button key={t.label} type="button" className={'td td-' + t.tone} onClick={() => go(t.page)}><b>{t.n}</b> {tr(t.label)} <i>→</i></button>)}
      </div>
    </section>
  );
}

/** The period picker above the KPI tiles. */
export function PeriodBar({ range, busy, onPick }) {
  const tr = useT();
  return (
    <div className={'pbar' + (busy ? ' busy' : '')} role="group" aria-label={tr('Period')}>
      <span className="pb-l"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>{tr('Period')}</span>
      {PERIODS.map(([v, t]) => <button type="button" key={v} className={v === range ? 'on' : ''} aria-pressed={v === range} onClick={() => onPick(v)}>{tr(t)}</button>)}
      <small title={tr('Sales figures follow this period; the forecast always uses the last 8 weeks')}>{busy ? tr('Updating…') : tr('Forecast always uses the last 8 weeks')}</small>
    </div>
  );
}
