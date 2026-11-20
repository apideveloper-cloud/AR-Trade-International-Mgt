import { sevOf } from './ovApi.js';

/** (1) What needs your attention. */
export default function OvActions({ actions, go }) {
  const list = Array.isArray(actions) ? actions : null;
  return (
    <section className="a-card adov-sec" aria-label="What needs your attention">
      <h3>What needs your attention</h3>
      {list === null && <p className="adseo-hint">Not available yet</p>}
      {list && list.length === 0 && <p className="adov-ok">✔ All good: nothing needs your attention</p>}
      {list && list.length > 0 && (
        <ul className="adov-list">
          {list.map((a, i) => {
            const s = sevOf(a.severity);
            return (
              <li key={a.id || i} className="adov-item">
                <span className={'adov-badge ' + s.cls}><span aria-hidden="true">{s.icon}</span> {s.label}</span>
                <div className="adov-txt">
                  <b>{a.title}{a.count > 0 && <span className="adov-count">{a.count}</span>}</b>
                  {a.detail && <span className="adov-sub">{a.detail}</span>}
                </div>
                {a.page && <button type="button" className="a-btn sm" onClick={() => go(a.page)}>Open</button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
