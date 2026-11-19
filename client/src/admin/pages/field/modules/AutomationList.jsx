import { Switch } from '../../../ui.jsx';

/** The automations card: one pause / run switch per automation. */
export function AutomationList({ autos, onToggle }) {
  return (
    <section className="a-card">
      <div className="card-hd"><h3>Automations</h3></div>
      <div className="fd-autos">
        {autos.map(a => (
          <div key={a.key} className="fd-auto">
            <span className="fd-mt"><b>{a.title}</b><small>{a.bn}</small><em className={a.enabled ? 'on' : ''}>{a.status}</em></span>
            <Switch on={a.enabled} onChange={() => onToggle(a)} title={a.enabled ? 'Pause' : 'Run'} />
          </div>
        ))}
      </div>
    </section>
  );
}
