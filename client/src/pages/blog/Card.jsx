import { Link } from 'react-router-dom';
import { fmtDate } from '../../api.js';

/** Article card used in the list grid (`big` for the featured one) and in "More from the blog". */
export default function Card({ p, big }) {
  return (
    <Link to={'/blog/' + p.slug} className={'bl-card' + (big ? ' big' : '')}>
      <span className="im" style={p.cover ? { backgroundImage: `url('${p.cover}')` } : undefined}>{!p.cover && <b>AR</b>}</span>
      <span className="bd">
        <span className="meta"><em>{p.category}</em><time>{fmtDate(p.date)}</time></span>
        <strong>{p.title}</strong>
        <span className="ex">{p.excerpt}</span>
        <span className="more">Read article →</span>
      </span>
    </Link>
  );
}
