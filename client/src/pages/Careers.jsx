import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { useStore } from '../store.jsx';
import { NotFound } from './Info.jsx';

const daysLeft = j => Math.ceil((new Date(j.deadline) - Date.now()) / 864e5);
const dl = j => { const d = daysLeft(j); return d <= 0 ? 'Closed' : d === 1 ? 'Closes tomorrow' : d + ' days left'; };
const dlColor = j => (daysLeft(j) < 7 ? 'oklch(0.55 0.17 40)' : 'oklch(0.45 0.12 150)');
const vac = j => j.vacancies + (j.vacancies > 1 ? ' vacancies' : ' vacancy');

function useJobs() {
  const [jobs, setJobs] = useState(null);
  useEffect(() => { api.get('/jobs').then(setJobs).catch(() => setJobs([])); }, []);
  return jobs;
}

function JobCard({ j }) {
  return (
    <Link to={'/careers/' + j.id} className="jcard">
      <div className="top"><span className="dept">{j.dept}</span><span style={{ fontSize: 12, fontWeight: 800, color: dlColor(j), whiteSpace: 'nowrap' }}>{dl(j)}</span></div>
      <b style={{ fontFamily: 'var(--disp)', fontSize: 19, lineHeight: 1.25, letterSpacing: '-.01em' }}>{j.title}</b>
      <div className="tags">{[j.type, j.loc, j.exp].map(x => <span key={x}>{x}</span>)}</div>
      <div className="ft"><span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><b style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{j.salary}</b><span style={{ fontSize: 12, color: '#6b7080' }}>{vac(j)}</span></span><span className="cta">View &amp; apply →</span></div>
    </Link>
  );
}

export function Careers() {
  const all = useJobs();
  const [dept, setDept] = useState('All');
  const [type, setType] = useState('All');
  const [q, setQ] = useState('');
  if (!all) return <div style={{ padding: 60, textAlign: 'center' }}><span className="spin" /></div>;
  const open = all.filter(j => j.open);
  const depts = ['All', ...new Set(open.map(j => j.dept))];
  const types = ['All', ...new Set(open.map(j => j.type))];
  const t = q.trim().toLowerCase();
  const jobs = open.filter(j => (dept === 'All' || j.dept === dept) && (type === 'All' || j.type === type) && (!t || `${j.title} ${j.dept} ${j.loc}`.toLowerCase().includes(t)));
  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="job-hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 620 }}>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.16em', color: 'oklch(0.82 0.1 225)' }}>CAREERS AT AR TRADE</span>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(30px,4vw,50px)', lineHeight: 1.05, letterSpacing: '-.03em', textWrap: 'balance' }}>Build your career with Bangladesh's trusted printing partner</h1>
          <p style={{ margin: 0, color: '#c3cfe8', fontSize: 15.5, lineHeight: 1.6 }}>Join our sales, service, marketing and logistics teams in Dhaka. Apply online in two minutes — no account needed.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="job-stat"><b>{open.length}</b><span>Open roles</span></div>
          <div className="job-stat"><b>{open.reduce((a, j) => a + j.vacancies, 0)}</b><span>Vacancies</span></div>
          <div className="job-stat"><b>{new Set(open.map(j => j.dept)).size}</b><span>Departments</span></div>
        </div>
      </div>
      <div className="job-filter">
        <label className="q"><span style={{ color: '#8a8f9b' }}>⌕</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search job title or location" /></label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{depts.map(d => <button key={d} className={'dchip' + (d === dept ? ' on' : '')} onClick={() => setDept(d)}>{d}<small>{d === 'All' ? open.length : open.filter(j => j.dept === d).length}</small></button>)}</div>
        <select value={type} onChange={e => setType(e.target.value)} style={{ height: 44, border: '1px solid #d9dfea', borderRadius: 12, padding: '0 12px', fontSize: 13, fontWeight: 700, background: '#fff', color: '#0b1631' }}>{types.map(x => <option key={x} value={x}>{x === 'All' ? 'All job types' : x}</option>)}</select>
      </div>
      <div className="jobs">{jobs.map(j => <JobCard key={j.id} j={j} />)}</div>
      {!jobs.length && <div className="empty2" style={{ background: '#fff', display: 'block', padding: 32 }}>No open roles match. Send your CV to <a href="mailto:hr@artradeinternational.com" style={{ fontWeight: 800 }}>hr@artradeinternational.com</a> and we'll keep it on file.</div>}
    </section>
  );
}

export function Job() {
  const { id } = useParams();
  const all = useJobs();
  const { user } = useStore();
  const [cv, setCv] = useState(null);
  const [err, setErr] = useState('');
  const [doneId, setDoneId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCv(null); setErr(''); setDoneId(''); }, [id]);
  if (!all) return <div style={{ padding: 60, textAlign: 'center' }}><span className="spin" /></div>;
  const j = all.find(x => x.id === id);
  if (!j) return <NotFound />;

  const more = all.filter(x => x.open && x.id !== j.id).slice(0, 3);
  const onCv = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1048576) { setErr('CV must be under 2 MB.'); return; }
    const r = new FileReader();
    r.onload = () => { setCv({ name: f.name, data: r.result }); setErr(''); };
    r.readAsDataURL(f);
  };
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    if (!/^01[3-9]\d{8}$/.test(String(d.phone).replace(/\D/g, '').slice(-11))) { setErr('Enter a valid Bangladeshi mobile number.'); return; }
    if (!cv) { setErr('Please attach your CV (PDF or Word).'); return; }
    setBusy(true);
    try {
      const r = await api.post(`/jobs/${j.id}/apply`, { ...d, cvName: cv.name, cvData: cv.data });
      setDoneId(r.id); setCv(null); setErr(''); window.scrollTo(0, 0);
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  const li = { display: 'flex', gap: 10 };
  const check = { color: 'oklch(0.55 0.15 245)', fontWeight: 800 };

  return (
    <section style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 28px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Link to="/careers" style={{ fontSize: 13.5, fontWeight: 800, color: 'oklch(0.45 0.15 250)', alignSelf: 'flex-start' }}>← All open roles</Link>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <article style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'linear-gradient(135deg,#0b1631,#173a7a)', color: '#fff', borderRadius: 22, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', background: 'rgba(255,255,255,.12)', padding: '4px 10px', borderRadius: 999 }}>{j.dept}</span><span className="mono" style={{ fontSize: 11, color: '#a9bbe0' }}>{j.id}</span></div>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: 'clamp(26px,3vw,38px)', lineHeight: 1.1, letterSpacing: '-.02em', textWrap: 'balance' }}>{j.title}</h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginTop: 4 }}>
              {[['Salary', j.salary], ['Location', j.loc], ['Job type', j.type], ['Experience', j.exp], ['Deadline', fmtDate(j.deadline)]].map(([k, v]) => <span key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 11.5, color: '#a9bbe0' }}>{k}</span><b style={{ fontSize: 14 }}>{v}</b></span>)}
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e6e9f0', borderRadius: 20, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18, fontSize: 14.5, lineHeight: 1.65, color: '#2b2e36' }}>
            <p style={{ margin: 0, fontSize: 15.5, color: '#0b1631' }}>{j.about}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><b style={{ fontSize: 15, color: '#0b1631' }}>What you'll do</b>{j.resp.map(r => <span key={r} style={li}><span style={check}>✓</span>{r}</span>)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><b style={{ fontSize: 15, color: '#0b1631' }}>What we're looking for</b>{j.req.map(r => <span key={r} style={li}><span style={check}>•</span>{r}</span>)}</div>
            {j.perks.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><b style={{ fontSize: 15, color: '#0b1631' }}>Benefits</b><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{j.perks.map(r => <span key={r} style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.4 0.12 150)', background: 'oklch(0.96 0.04 150)', borderRadius: 999, padding: '6px 12px' }}>{r}</span>)}</div></div>}
          </div>
        </article>
        <aside style={{ flex: '1 1 360px', minWidth: 0, maxWidth: 460, position: 'sticky', top: 120, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {doneId ? (
            <div style={{ background: '#fff', border: '1px solid oklch(0.85 0.06 150)', borderRadius: 22, padding: '26px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'oklch(0.95 0.06 150)', color: 'oklch(0.45 0.13 150)', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 800 }}>✓</span>
              <b style={{ fontFamily: 'var(--disp)', fontSize: 21, color: '#0b1631' }}>Application received</b>
              <span style={{ fontSize: 14, color: '#4b5263', lineHeight: 1.55 }}>Your reference is <b className="mono">{doneId}</b>. Our HR team will call you if you're shortlisted.</span>
              <Link to="/careers" style={{ marginTop: 6, fontSize: 13.5, fontWeight: 800, color: 'oklch(0.45 0.15 250)' }}>See other roles →</Link>
            </div>
          ) : !j.open ? (
            <div style={{ background: '#fff', border: '1px solid #e6e9f0', borderRadius: 22, padding: 22, fontSize: 14, color: '#4b5263', textAlign: 'center' }}><b style={{ display: 'block', fontSize: 17, color: '#0b1631', marginBottom: 6 }}>Applications closed</b>This role is no longer accepting applications.</div>
          ) : (
            <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e6e9f0', borderRadius: 22, padding: 22, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 24px 48px -32px rgba(11,22,49,.45)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}><b style={{ fontFamily: 'var(--disp)', fontSize: 21, color: '#0b1631' }}>Apply for this job</b><span style={{ fontSize: 12, fontWeight: 800, color: dlColor(j), whiteSpace: 'nowrap' }}>{dl(j)}</span></div>
              <label className="jlbl">Full name<input className="jfield" name="name" required defaultValue={user?.name} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <label className="jlbl">Mobile<input className="jfield" name="phone" required defaultValue={user?.phone} placeholder="01XXXXXXXXX" /></label>
                <label className="jlbl">Email<input className="jfield" type="email" name="email" defaultValue={user?.email} /></label>
                <label className="jlbl">Experience<input className="jfield" name="exp" placeholder="e.g. 2 years" /></label>
                <label className="jlbl">Expected salary (৳)<input className="jfield" type="number" name="salary" /></label>
              </div>
              <label className="jlbl">LinkedIn / portfolio (optional)<input className="jfield" name="link" placeholder="https://" /></label>
              {!cv ? (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, border: '1.5px dashed #b9c4da', borderRadius: 14, padding: 16, background: '#f7f9fc', cursor: 'pointer', textAlign: 'center' }}>
                  <span style={{ fontSize: 22, color: 'oklch(0.5 0.15 250)' }}>⤒</span><b style={{ fontSize: 13.5, color: '#0b1631' }}>Upload your CV</b><span style={{ fontSize: 12, color: '#6b7080' }}>PDF or Word · max 2 MB</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={onCv} style={{ display: 'none' }} />
                </label>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid oklch(0.85 0.06 150)', background: 'oklch(0.97 0.03 150)', borderRadius: 12, padding: '10px 12px' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: 'oklch(0.5 0.2 25)' }}>CV</span>
                  <b style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cv.name}</b>
                  <button type="button" onClick={() => setCv(null)} style={{ border: 0, background: 'transparent', color: '#6b7080', fontSize: 16 }}>×</button>
                </div>
              )}
              <label className="jlbl">Cover note (optional)<textarea name="note" rows={3} placeholder="Why are you a good fit?" style={{ border: '1px solid #d9dfea', borderRadius: 12, padding: '10px 14px', fontSize: 14, lineHeight: 1.5, resize: 'vertical' }} /></label>
              {err && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.5 0.2 25)' }}>{err}</span>}
              <button disabled={busy} className="btn btn-grad" style={{ height: 50, borderRadius: 14, fontSize: 15 }}>{busy ? 'Submitting…' : 'Submit application'}</button>
              <span style={{ fontSize: 11.5, color: '#8a8f9b', textAlign: 'center' }}>Your details are only used for recruitment.</span>
            </form>
          )}
        </aside>
      </div>
      {more.length > 0 && (
        <>
          <b style={{ fontFamily: 'var(--disp)', fontSize: 22, color: '#0b1631', marginTop: 10 }}>Other open roles</b>
          <div className="jobs">{more.map(x => <JobCard key={x.id} j={x} />)}</div>
        </>
      )}
    </section>
  );
}
