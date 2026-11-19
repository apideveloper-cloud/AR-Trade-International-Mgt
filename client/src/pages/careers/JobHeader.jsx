import { fmtDate } from '../../api.js';

/** Gradient title block of the job detail page. */
export default function JobHeader({ j }) {
  const facts = [['Salary', j.salary], ['Location', j.loc], ['Job type', j.type], ['Experience', j.exp], ['Deadline', fmtDate(j.deadline)]];
  return (
    <div className="cr-head">
      <div className="cr-head-meta"><span className="mono cr-dept">{j.dept}</span><span className="mono cr-ref">{j.id}</span></div>
      <h1 className="cr-h1">{j.title}</h1>
      <div className="cr-facts">{facts.map(([k, v]) => <span key={k} className="cr-fact"><span className="cr-fact-k">{k}</span><b className="cr-fact-v">{v}</b></span>)}</div>
    </div>
  );
}
