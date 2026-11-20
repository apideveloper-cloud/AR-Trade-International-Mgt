import { sevOf } from './ovApi.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthE.js';

/** The server builds titles like "1216 products have no price" or "Search clicks dropped 45% ...": the number is cut out so the sentence can be translated as a whole. */
function titleOf(title, tr) {
  const m = /^(\d[\d,]*) (.+)$/.exec(title);
  if (m) return tr('{n} ' + m[2], { n: m[1] });
  const d = /^Search clicks dropped (\d+)% against the previous 28 days$/.exec(title);
  if (d) return tr('Search clicks dropped {n}% against the previous 28 days', { n: d[1] });
  return tr(title);
}

/** (1) What needs your attention. */
export default function OvActions({ actions, go }) {
  const tr = useT();
  const list = Array.isArray(actions) ? actions : null;
  return (
    <section className="a-card adov-sec" aria-label={tr('What needs your attention')}>
      <h3>{tr('What needs your attention')}</h3>
      {list === null && <p className="adseo-hint">{tr('Not available yet')}</p>}
      {list && list.length === 0 && <p className="adov-ok">✔ {tr('All good: nothing needs your attention')}</p>}
      {list && list.length > 0 && (
        <ul className="adov-list">
          {list.map((a, i) => {
            const s = sevOf(a.severity);
            return (
              <li key={a.id || i} className="adov-item">
                <span className={'adov-badge ' + s.cls}><span aria-hidden="true">{s.icon}</span> {tr(s.label)}</span>
                <div className="adov-txt">
                  <b>{titleOf(a.title, tr)}{a.count > 0 && <span className="adov-count">{a.count}</span>}</b>
                  {a.detail && <span className="adov-sub">{tr(a.detail)}</span>}
                </div>
                {a.page && <button type="button" className="a-btn sm" onClick={() => go(a.page)}>{tr('Open')}</button>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
