import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './careers.css';
import { useStore } from '../../store.jsx';
import { NotFound } from '../info/NotFound.jsx';
import { useJobs } from './jobs.js';
import Loading from './Loading.jsx';
import JobCard from './JobCard.jsx';
import JobHeader from './JobHeader.jsx';
import JobBody from './JobBody.jsx';
import ApplyForm from './ApplyForm.jsx';

/** Right-hand column: confirmation, "closed" notice or the application form. */
function ApplyAside({ j, user, doneId, setDoneId }) {
  if (doneId) {
    return (
      <div className="cr-done">
        <span className="cr-done-ico">✓</span>
        <b className="cr-done-h">Application received</b>
        <span className="cr-done-p">Your reference is <b className="mono">{doneId}</b>. Our HR team will call you if you're shortlisted.</span>
        <Link to="/careers" className="cr-done-link">See other roles →</Link>
      </div>
    );
  }
  if (!j.open) return <div className="cr-closed"><b className="cr-closed-h">Applications closed</b>This role is no longer accepting applications.</div>;
  return <ApplyForm key={j.id} j={j} user={user} onDone={setDoneId} />;
}

/** /careers/:id: job description with the application form. */
export function Job() {
  const { id } = useParams();
  const all = useJobs();
  const { user } = useStore();
  const [doneId, setDoneId] = useState('');
  useEffect(() => { setDoneId(''); }, [id]);
  if (!all) return <Loading />;
  const j = all.find(x => x.id === id);
  if (!j) return <NotFound />;
  const more = all.filter(x => x.open && x.id !== j.id).slice(0, 3);
  return (
    <section className="cr cr-job">
      <Link to="/careers" className="cr-back">← All open roles</Link>
      <div className="cr-cols">
        <article className="cr-main"><JobHeader j={j} /><JobBody j={j} /></article>
        <aside className="cr-side"><ApplyAside j={j} user={user} doneId={doneId} setDoneId={setDoneId} /></aside>
      </div>
      {more.length > 0 && (
        <>
          <b className="cr-more-h">Other open roles</b>
          <div className="jobs">{more.map(x => <JobCard key={x.id} j={x} />)}</div>
        </>
      )}
    </section>
  );
}
