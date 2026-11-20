import '../../dash.css';
import './dashboard.css';
import { useT } from '../../i18n/lang.jsx';
import { locFor } from './dashText.jsx';
import '../../i18n/dict/catalog.js';

/** The "▲ 5% vs previous 30 days" line under a figure. */
export const Delta = ({ v, suffix = 'vs previous 30 days' }) => {
  const tr = useT();
  const L = locFor(tr);
  return (v == null ? <span className="dl flat">{tr('no earlier data')}</span> : <span className={'dl ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')}>{v > 0 ? '▲' : v < 0 ? '▼' : '■'} {Math.abs(v)}% {L.period(suffix)}</span>);
};

/** The grey one-line caption used under many dashboard figures. */
export const Flat = ({ children }) => <span className="dl flat">{children}</span>;

/** A dashboard card: heading, optional sub-line and chip, then the body. `title` and `sub` are English text (translated here); other nodes pass through. */
export function Card({ title, sub, chip, children, cls = '' }) {
  const tr = useT();
  const x = v => (typeof v === 'string' ? tr(v) : v);
  return (
    <div className={'a-card db-card ' + cls}>
      <div className="card-hd"><div className="db-t"><h3>{x(title)}</h3>{sub && <small>{x(sub)}</small>}</div>{chip}</div>
      {children}
    </div>
  );
}

/** "1 order" / "3 orders": English text. Use <Plural n word /> or L.pl in components to get it translated. */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1 order" / "3 orders" in the chosen language (keys '{n} order' and '{n} orders'). */
export const Plural = ({ n, word }) => locFor(useT()).pl(n, word);
