import { Link } from 'react-router-dom';
import Deadline from './Deadline.jsx';
import { vacancyLabel } from './jobs.js';

/** One job in the list grid. */
export default function JobCard({ j }) {
  return (
    <Link to={'/careers/' + j.id} className="jcard">
      <div className="top"><span className="dept">{j.dept}</span><Deadline j={j} /></div>
      <b className="cr-card-title">{j.title}</b>
      <div className="tags">{[j.type, j.loc, j.exp].map(x => <span key={x}>{x}</span>)}</div>
      <div className="ft"><span className="cr-pay"><b>{j.salary}</b><span>{vacancyLabel(j)}</span></span><span className="cta">View &amp; apply →</span></div>
    </Link>
  );
}
