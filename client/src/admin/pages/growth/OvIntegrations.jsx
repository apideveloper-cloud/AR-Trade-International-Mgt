import { NA } from './ovApi.js';
import { useT } from '../../i18n/lang.jsx';

const NAMES = [['google', 'Google'], ['bing', 'Bing'], ['merchant', 'Google Shopping sync']];

/** (4) Compact connection row. */
export default function OvIntegrations({ integ }) {
  const tr = useT();
  return (
    <section className="a-card adov-sec" aria-label={tr('Connections')}>
      <h3>{tr('Connections')}</h3>
      <div className="adov-integ">
        {NAMES.map(([key, name]) => {
          const x = integ?.[key];
          const st = String(x?.status || '').toLowerCase();
          const err = st === 'error' || st === 'failed';
          const ok = st === 'connected' || st === 'ok';
          const label = !x ? tr(NA) : err ? tr('Error') : ok ? tr('Connected') : tr('Not connected');
          const cls = err ? 'adov-high' : ok ? 'adov-okb' : 'adov-low';
          return (
            <div key={key} className="adov-int">
              <b>{tr(name)}</b>
              <span className={'adov-badge ' + cls}><span aria-hidden="true">{err ? '✖' : ok ? '✔' : '○'}</span> {label}</span>
              {x?.lastError && <span className="adov-sub">{tr(x.lastError)}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
