import { useState } from 'react';
import { adm, dateF, downloadFile } from '../../adminApi.js';
import { Modal, Pill, Summary, alertBox, confirmBox } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';
import { withAlert } from '../../hooks/withAlert.js';

const STAGES = ['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'];

function JobForm({ job, onClose, onSaved }) {
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    await run(async () => {
      try { await adm.post('/jobs', { ...d, id: job?.id, open: d.open === 'on', deadline: d.deadline }); onSaved(); onClose(); } catch (er) { setErr(er.message); }
    });
  };
  const L = a => (a || []).join('\n');
  return (
    <Modal side kicker="Careers" title={job ? 'Edit job' : 'Post a job'} onClose={onClose} onSubmit={submit} footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : 'Save job'}</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {err && <div className="a-msg err">{err}</div>}
        <label className="a-lbl">Job title<input className="a-input" name="title" required defaultValue={job?.title} /></label>
        <div className="a-fields">
          <label className="a-lbl">Department<input className="a-input" name="dept" required defaultValue={job?.dept} /></label>
          <label className="a-lbl">Type<select className="a-input" name="type" defaultValue={job?.type || 'Full-time'}>{['Full-time', 'Part-time', 'Contract', 'Internship'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="a-lbl">Location<input className="a-input" name="loc" defaultValue={job?.loc} /></label>
          <label className="a-lbl">Experience<input className="a-input" name="exp" defaultValue={job?.exp} /></label>
          <label className="a-lbl">Salary<input className="a-input" name="salary" defaultValue={job?.salary} /></label>
          <label className="a-lbl">Vacancies<input className="a-input" type="number" min="1" name="vacancies" defaultValue={job?.vacancies || 1} /></label>
          <label className="a-lbl">Deadline<input className="a-input" type="date" name="deadline" defaultValue={job ? String(job.deadline).slice(0, 10) : ''} /></label>
          <label className="a-lbl" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 22 }}><input type="checkbox" name="open" defaultChecked={job ? job.open : true} />Accepting applications</label>
        </div>
        <label className="a-lbl">About the role<textarea className="a-input" name="about" rows={2} defaultValue={job?.about} /></label>
        <div className="a-fields">
          <label className="a-lbl">What you'll do (one per line)<textarea className="a-input" name="resp" rows={4} defaultValue={L(job?.resp)} /></label>
          <label className="a-lbl">Requirements (one per line)<textarea className="a-input" name="req" rows={4} defaultValue={L(job?.req)} /></label>
          <label className="a-lbl">Benefits (one per line)<textarea className="a-input" name="perks" rows={4} defaultValue={L(job?.perks)} /></label>
        </div>
      </div>
    </Modal>
  );
}

export function Careers() {
  const jobsQ = useApiData(() => adm.get('/jobs'), [], []);
  const appsQ = useApiData(() => adm.get('/applications'), [], []);
  const jobs = jobsQ.data, apps = appsQ.data;
  const [tab, setTab] = useState('apps');
  const [edit, setEdit] = useState(null);
  const [stage, setStage] = useState('');
  const load = () => Promise.all([jobsQ.reload(), appsQ.reload()]);
  const setSt = withAlert(async (id, s) => { await adm.put('/applications/' + id, { stage: s }); load(); });
  const delJob = withAlert(async j => { if (await confirmBox(`Delete "${j.title}" and its ${j.apps} applications?`, { danger: true, confirmLabel: 'Delete' })) { await adm.del('/jobs/' + j.id); load(); } });
  const isOpen = j => j.open && new Date(j.deadline) > new Date();
  const shown = apps.filter(a => !stage || a.stage === stage);
  return (
    <>
      <Summary items={[
        ['Open roles', jobs.filter(isOpen).length, 'accepting applications', 'blue', 'tag'],
        ['Applications', apps.length, 'received in total', 'violet', 'users'],
        ['New', apps.filter(a => a.stage === 'New').length, 'not reviewed yet', 'amber', 'plus'],
        ['Interview', apps.filter(a => a.stage === 'Interview').length, 'in progress', 'blue', 'clock'],
        ['Hired', apps.filter(a => a.stage === 'Hired').length, 'joined the team', 'green', 'check']
      ]} />
      {(jobsQ.error || appsQ.error) && <div className="a-msg err">{jobsQ.error || appsQ.error}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['apps', 'Applications'], ['jobs', 'Jobs']].map(([k, l]) => <button key={k} className={'a-chip' + (tab === k ? ' on' : '')} style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setTab(k)}>{l}</button>)}
        <span style={{ flex: 1 }} /><button className="a-btn sm grad" style={{ padding: '10px 16px', borderRadius: 10 }} onClick={() => setEdit('new')}>+ Post a job</button>
      </div>
      {tab === 'apps' && (
        <>
          <div className="a-chips">
            <button className={'a-chip' + (!stage ? ' on' : '')} onClick={() => setStage('')}>All · {apps.length}</button>
            {STAGES.map(s => <button key={s} className={'a-chip' + (stage === s ? ' on' : '')} onClick={() => setStage(s)}>{s} · {apps.filter(a => a.stage === s).length}</button>)}
          </div>
          {!shown.length && <div className="a-empty">No applications here yet.</div>}
          {shown.map(a => (
            <div key={a.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '16px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <b style={{ fontSize: 14 }}>{a.name} <span className="mono" style={{ color: '#8a8f9b', fontWeight: 500, fontSize: 11 }}>{a.id}</span></b>
                <span>{a.jobTitle} · {a.exp || '—'} · expects ৳{a.salary || '—'}</span>
                <span><a href={'tel:' + a.phone}>{a.phone}</a>{a.email && <> · {a.email}</>}{a.link && <> · <a href={a.link} target="_blank" rel="noreferrer">link</a></>}</span>
                {a.note && <span style={{ color: '#5d6270' }}>“{a.note}”</span>}
                <span style={{ color: '#8a8f9b', fontSize: 12 }}>CV: <button type="button" className="a-btn sm ghost" style={{ padding: '2px 8px' }} onClick={() => downloadFile('/applications/' + a.id + '/cv', a.cv).catch(e => alertBox(e.message))}>{a.cv || 'Download'}</button> · applied {dateF(a.at)}</span>
              </div>
              <select className="a-input" value={a.stage} onChange={e => setSt(a.id, e.target.value)} style={{ borderRadius: 999, fontWeight: 700, width: 'auto' }}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>
            </div>
          ))}
        </>
      )}
      {tab === 'jobs' && (
        <div className="a-table"><div style={{ minWidth: 744 }}>
          <div className="head" style={{ gridTemplateColumns: '44px minmax(200px,1fr) 120px 110px 90px 90px 140px' }}><span>SL</span><span>Role</span><span>Department</span><span>Deadline</span><span>Open</span><span>Applied</span><span /></div>
          {jobs.map((j, i) => (
            <div key={j.id} className="row" style={{ gridTemplateColumns: '44px minmax(200px,1fr) 120px 110px 90px 90px 140px' }}>
              <span className="sl">{i + 1}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b>{j.title}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{j.id} · {j.type} · {j.salary}</span></span>
              <span>{j.dept}</span><span>{dateF(j.deadline)}</span><Pill s={isOpen(j) ? 'Active' : 'Disabled'} label={isOpen(j) ? 'Open' : 'Closed'} /><b>{j.apps}</b>
              <span className="ic-row"><IconBtn icon="edit" title="Edit the job" onClick={() => setEdit(j)} /><IconBtn icon="trash" tone="bad" title="Delete the job and its applications" onClick={() => delJob(j)} /></span>
            </div>
          ))}
        </div></div>
      )}
      {edit && <JobForm job={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={load} />}
    </>
  );
}
