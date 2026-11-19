import { useState } from 'react';
import './careers.css';
import { useJobs } from './jobs.js';
import Loading from './Loading.jsx';
import CareersHero from './CareersHero.jsx';
import CareersFilter from './CareersFilter.jsx';
import JobCard from './JobCard.jsx';

/** /careers: open roles with search and filters. */
export function Careers() {
  const all = useJobs();
  const [dept, setDept] = useState('All');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  if (!all) return <Loading />;
  const open = all.filter(j => j.open);
  const depts = ['All', ...new Set(open.map(j => j.dept))];
  const types = ['All', ...new Set(open.map(j => j.type))];
  const t = q.trim().toLowerCase();
  const jobs = open.filter(j => (dept === 'All' || j.dept === dept) && (type === 'All' || j.type === type) && (!t || `${j.title} ${j.dept} ${j.loc}`.toLowerCase().includes(t)));
  return (
    <section className="cr cr-list">
      <CareersHero open={open} />
      <CareersFilter {...{ open, depts, types, q, setQ, dept, setDept, type, setType }} />
      <div className="jobs">{jobs.map(j => <JobCard key={j.id} j={j} />)}</div>
      {!jobs.length && <div className="empty2 cr-empty">No open roles match. Send your CV to <a className="cr-mail" href="mailto:hr@artradeinternational.com">hr@artradeinternational.com</a> and we'll keep it on file.</div>}
    </section>
  );
}
