/** (2) Get set up checklist: open only while some step is not done. */
export default function OvSetup({ setup, go }) {
  const steps = Array.isArray(setup?.steps) ? setup.steps : null;
  if (!steps || steps.length === 0) return null;
  const left = steps.filter(s => !s.done).length;
  return (
    <details className="a-card adov-sec adov-setup" open={left > 0}>
      <summary><h3>Get set up</h3><span className="adov-sub">{left > 0 ? left + ' of ' + steps.length + ' steps still to do' : 'All steps done'}</span></summary>
      <ul className="adov-list">
        {steps.map((s, i) => (
          <li key={s.id || i} className="adov-item">
            <span className={'adov-tick ' + (s.done ? 'adov-good' : 'adov-flat')} aria-hidden="true">{s.done ? '✔' : '○'}</span>
            <div className="adov-txt"><b>{s.label}</b><span className="adov-sub">{s.done ? 'Done' : 'Not done yet'}</span></div>
            {!s.done && s.page && <button type="button" className="a-btn sm" onClick={() => go(s.page)}>Open</button>}
          </li>
        ))}
      </ul>
    </details>
  );
}
