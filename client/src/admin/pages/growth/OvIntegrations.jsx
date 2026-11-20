import { NA } from './ovApi.js';

const NAMES = [['google', 'Google'], ['bing', 'Bing'], ['merchant', 'Google Shopping sync']];

/** (4) Compact connection row. */
export default function OvIntegrations({ integ }) {
  return (
    <section className="a-card adov-sec" aria-label="Connections">
      <h3>Connections</h3>
      <div className="adov-integ">
        {NAMES.map(([key, name]) => {
          const x = integ?.[key];
          const st = String(x?.status || '').toLowerCase();
          const err = st === 'error' || st === 'failed';
          const ok = st === 'connected' || st === 'ok';
          const label = !x ? NA : err ? 'Error' : ok ? 'Connected' : 'Not connected';
          const cls = err ? 'adov-high' : ok ? 'adov-okb' : 'adov-low';
          return (
            <div key={key} className="adov-int">
              <b>{name}</b>
              <span className={'adov-badge ' + cls}><span aria-hidden="true">{err ? '✖' : ok ? '✔' : '○'}</span> {label}</span>
              {x?.lastError && <span className="adov-sub">{x.lastError}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
