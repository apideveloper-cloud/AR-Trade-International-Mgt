/** Search box, department chips and job-type select. */
export default function CareersFilter({ open, depts, types, q, setQ, dept, setDept, type, setType }) {
  return (
    <div className="job-filter">
      <label className="q"><span className="cr-q-icon">⌕</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search job title or location" /></label>
      <div className="cr-chips">{depts.map(d => <button key={d} className={'dchip' + (d === dept ? ' on' : '')} onClick={() => setDept(d)}>{d}<small>{d === 'All' ? open.length : open.filter(j => j.dept === d).length}</small></button>)}</div>
      <select className="cr-type" value={type} onChange={e => setType(e.target.value)}>{types.map(x => <option key={x} value={x}>{x === 'All' ? 'All job types' : x}</option>)}</select>
    </div>
  );
}
