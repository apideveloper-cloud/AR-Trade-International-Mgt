import { shareLinks } from './productHelpers.js';
import './product-extra.css';

/** "Share" label and the social buttons (background colour is per network, so it stays inline). */
export default function ShareRow({ name }) {
  return (
    <div className="pfx-share-row">
      <span className="mono pfx-share-label">Share</span>
      <div className="pfx-share-btns">{shareLinks(name).map(s => <a key={s.i} className="share" href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} style={{ background: s.bg }}>{s.i}</a>)}</div>
    </div>
  );
}
