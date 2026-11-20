import { useT } from '../../i18n/lang.jsx';

/** (2) Get set up checklist: open only while some step is not done. */
export default function OvSetup({ setup, go }) {
  const tr = useT();
  const steps = Array.isArray(setup?.steps) ? setup.steps : null;
  if (!steps || steps.length === 0) return null;
  const left = steps.filter(s => !s.done).length;
  return (
    <details className="a-card adov-sec adov-setup" open={left > 0}>
      <summary><h3>{tr('Get set up')}</h3><span className="adov-sub">{left > 0 ? tr('{n} of {total} steps still to do', { n: left, total: steps.length }) : tr('All steps done')}</span></summary>
      <ul className="adov-list">
        {steps.map((s, i) => (
          <li key={s.id || i} className="adov-item">
            <span className={'adov-tick ' + (s.done ? 'adov-good' : 'adov-flat')} aria-hidden="true">{s.done ? '✔' : '○'}</span>
            <div className="adov-txt"><b>{tr(s.label)}</b><span className="adov-sub">{s.done ? tr('Done') : tr('Not done yet')}</span></div>
            {!s.done && s.page && <button type="button" className="a-btn sm" onClick={() => go(s.page)}>{tr('Open')}</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}
