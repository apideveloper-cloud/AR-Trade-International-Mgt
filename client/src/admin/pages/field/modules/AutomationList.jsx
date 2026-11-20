import { Switch } from '../../../ui.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/field.js';

/** The automations card: one pause / run switch per automation. */
export function AutomationList({ autos, onToggle }) {
  const tr = useT();
  return (
    <section className="a-card">
      <div className="card-hd"><h3>{tr('Automations')}</h3></div>
      <div className="fd-autos">
        {autos.map(a => (
          <div key={a.key} className="fd-auto">
            <span className="fd-mt"><b>{tr(a.title)}</b><small>{a.bn}</small><em className={a.enabled ? 'on' : ''}>{tr(a.status)}</em></span>
            <Switch on={a.enabled} onChange={() => onToggle(a)} title={a.enabled ? tr('Pause') : tr('Run')} />
          </div>
        ))}
      </div>
    </section>
  );
}
