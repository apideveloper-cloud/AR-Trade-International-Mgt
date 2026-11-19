import '../../dash.css';
import './dashboard.css';

/** The "▲ 5% vs previous 30 days" line under a figure. */
export const Delta = ({ v, suffix = 'vs previous 30 days' }) => (v == null ? <span className="dl flat">no earlier data</span> : <span className={'dl ' + (v > 0 ? 'up' : v < 0 ? 'down' : 'flat')}>{v > 0 ? '▲' : v < 0 ? '▼' : '■'} {Math.abs(v)}% {suffix}</span>);

/** The grey one-line caption used under many dashboard figures. */
export const Flat = ({ children }) => <span className="dl flat">{children}</span>;

/** A dashboard card: heading, optional sub-line and chip, then the body. */
export function Card({ title, sub, chip, children, cls = '' }) {
  return (
    <div className={'a-card db-card ' + cls}>
      <div className="card-hd"><div className="db-t"><h3>{title}</h3>{sub && <small>{sub}</small>}</div>{chip}</div>
      {children}
    </div>
  );
}

/** "1 order" / "3 orders". */
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
