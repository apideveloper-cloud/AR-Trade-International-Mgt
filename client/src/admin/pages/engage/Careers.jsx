import { useState } from 'react';
import { adm, dateF, downloadFile } from '../../adminApi.js';
import { Modal, Pill, Summary, alertBox, confirmBox } from '../../ui.jsx';
import { IconBtn } from '../../IconBtn.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';
import { withAlert } from '../../hooks/withAlert.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/shell.js';
import './engage.css';

const STAGES = ['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'];

function JobForm({ job, onClose, onSaved }) {
  const tr = useT();
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
    <Modal side kicker={tr('Careers')} title={tr(job ? 'Edit job' : 'Post a job')} onClose={onClose} onSubmit={submit} footer={<><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className="a-btn grad" disabled={busy}>{tr(busy ? 'Saving…' : 'Save job')}</button></>}>
      <div className="eg-job-form">
        {err && <div className="a-msg err">{tr(err)}</div>}
        <label className="a-lbl">{tr('Job title')}<input className="a-input" name="title" required defaultValue={job?.title} /></label>
        <div className="a-fields">
          <label className="a-lbl">{tr('Department')}<input className="a-input" name="dept" required defaultValue={job?.dept} /></label>
          <label className="a-lbl">{tr('Type')}<select className="a-input" name="type" defaultValue={job?.type || 'Full-time'}>{['Full-time', 'Part-time', 'Contract', 'Internship'].map(x => <option key={x} value={x}>{tr(x)}</option>)}</select></label>
          <label className="a-lbl">{tr('Location')}<input className="a-input" name="loc" defaultValue={job?.loc} /></label>
          <label className="a-lbl">{tr('Experience')}<input className="a-input" name="exp" defaultValue={job?.exp} /></label>
          <label className="a-lbl">{tr('Salary')}<input className="a-input" name="salary" defaultValue={job?.salary} /></label>
          <label className="a-lbl">{tr('Vacancies')}<input className="a-input" type="number" min="1" name="vacancies" defaultValue={job?.vacancies || 1} /></label>
          <label className="a-lbl">{tr('Deadline')}<input className="a-input" type="date" name="deadline" defaultValue={job ? String(job.deadline).slice(0, 10) : ''} /></label>
          <label className="a-lbl eg-job-open"><input type="checkbox" name="open" defaultChecked={job ? job.open : true} />{tr('Accepting applications')}</label>
        </div>
        <label className="a-lbl">{tr('About the role')}<textarea className="a-input" name="about" rows={2} defaultValue={job?.about} /></label>
        <div className="a-fields">
          <label className="a-lbl">{tr("What you'll do (one per line)")}<textarea className="a-input" name="resp" rows={4} defaultValue={L(job?.resp)} /></label>
          <label className="a-lbl">{tr('Requirements (one per line)')}<textarea className="a-input" name="req" rows={4} defaultValue={L(job?.req)} /></label>
          <label className="a-lbl">{tr('Benefits (one per line)')}<textarea className="a-input" name="perks" rows={4} defaultValue={L(job?.perks)} /></label>
        </div>
      </div>
    </Modal>
  );
}

export function Careers() {
  const tr = useT();
  const jobsQ = useApiData(() => adm.get('/jobs'), [], []);
  const appsQ = useApiData(() => adm.get('/applications'), [], []);
  const jobs = jobsQ.data, apps = appsQ.data;
  const [tab, setTab] = useState('apps');
  const [edit, setEdit] = useState(null);
  const [stage, setStage] = useState('');
  const load = () => Promise.all([jobsQ.reload(), appsQ.reload()]);
  const setSt = withAlert(async (id, s) => { await adm.put('/applications/' + id, { stage: s }); load(); });
  const delJob = withAlert(async j => { if (await confirmBox(tr('Delete "{title}" and its {n} applications?', { title: j.title, n: j.apps }), { danger: true, confirmLabel: tr('Delete') })) { await adm.del('/jobs/' + j.id); load(); } });
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
      {(jobsQ.error || appsQ.error) && <div className="a-msg err">{tr(jobsQ.error || appsQ.error)}</div>}
      <div className="eg-tabs-row">
        {[['apps', 'Applications'], ['jobs', 'Jobs']].map(([k, l]) => <button key={k} className={'a-chip eg-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{tr(l)}</button>)}
        <span className="eg-grow" /><button className="a-btn sm grad eg-post" onClick={() => setEdit('new')}>{tr('+ Post a job')}</button>
      </div>
      {tab === 'apps' && (
        <>
          <div className="a-chips">
            <button className={'a-chip' + (!stage ? ' on' : '')} onClick={() => setStage('')}>{tr('All')} · {apps.length}</button>
            {STAGES.map(s => <button key={s} className={'a-chip' + (stage === s ? ' on' : '')} onClick={() => setStage(s)}>{tr(s)} · {apps.filter(a => a.stage === s).length}</button>)}
          </div>
          {!shown.length && <div className="a-empty">{tr('No applications here yet.')}</div>}
          {shown.map(a => (
            <div key={a.id} className="a-card eg-row-card eg-gap14">
              <div className="eg-stack3">
                <b className="eg-title">{a.name} <span className="mono eg-app-id">{a.id}</span></b>
                <span>{a.jobTitle} · {a.exp || '—'} · {tr('expects ৳{n}', { n: a.salary || '—' })}</span>
                <span><a href={'tel:' + a.phone}>{a.phone}</a>{a.email && <> · {a.email}</>}{a.link && <> · <a href={a.link} target="_blank" rel="noreferrer">{tr('link')}</a></>}</span>
                {a.note && <span className="eg-app-note">“{a.note}”</span>}
                <span className="eg-app-cv">{tr('CV:')} <button type="button" className="a-btn sm ghost eg-cv-btn" onClick={() => downloadFile('/applications/' + a.id + '/cv', a.cv).catch(e => alertBox(e.message))}>{a.cv || tr('Download')}</button> · {tr('applied {date}', { date: dateF(a.at) })}</span>
              </div>
              <select className="a-input eg-stage-select" value={a.stage} onChange={e => setSt(a.id, e.target.value)}>{STAGES.map(s => <option key={s} value={s}>{tr(s)}</option>)}</select>
            </div>
          ))}
        </>
      )}
      {tab === 'jobs' && (
        <div className="a-table"><div className="eg-jobs-wrap">
          <div className="head eg-job-cols"><span>{tr('SL')}</span><span>{tr('Role')}</span><span>{tr('Department')}</span><span>{tr('Deadline')}</span><span>{tr('Open')}</span><span>{tr('Applied')}</span><span /></div>
          {jobs.map((j, i) => (
            <div key={j.id} className="row eg-job-cols">
              <span className="sl">{i + 1}</span>
              <span className="eg-job-name"><b>{j.title}</b><span className="eg-job-sub">{j.id} · {tr(j.type)} · {j.salary}</span></span>
              <span>{j.dept}</span><span>{dateF(j.deadline)}</span><Pill s={isOpen(j) ? 'Active' : 'Disabled'} label={isOpen(j) ? 'Open' : 'Closed'} /><b>{j.apps}</b>
              <span className="ic-row"><IconBtn icon="edit" title={tr('Edit the job')} onClick={() => setEdit(j)} /><IconBtn icon="trash" tone="bad" title={tr('Delete the job and its applications')} onClick={() => delJob(j)} /></span>
            </div>
          ))}
        </div></div>
      )}
      {edit && <JobForm job={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={load} />}
    </>
  );
}
