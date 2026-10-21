import { useEffect, useState } from 'react';
import { adm, dateF, dateTimeF, mktApi, useTable } from '../adminApi.js';
import { Empty, Modal, Pager, Pill, Toolbar } from '../ui.jsx';

export function Services() {
  const t = useTable('/services', { status: '' });
  const set = async (id, status) => { await adm.put('/services/' + id, { status }); t.reload(); };
  return (
    <>
      <Toolbar t={t} filters={[{ key: 'status', label: 'All statuses', options: ['New', 'Scheduled', 'In progress', 'Completed'] }]} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'center', padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <b style={{ fontSize: 14 }}>{v.id} · {v.type}</b>
              <span>{v.name} · <a href={'tel:' + v.phone} style={{ fontWeight: 600 }}>{v.phone}</a></span>
              <span>{v.model} — {v.issue}</span>
              <span style={{ color: '#5d6270' }}>Preferred {dateF(v.date)} · received {dateTimeF(v.created)}</span>
            </div>
            <select className="a-input" value={v.status} onChange={e => set(v.id, e.target.value)} style={{ borderRadius: 999, fontWeight: 700, width: 'auto' }}>{['New', 'Scheduled', 'In progress', 'Completed'].map(s => <option key={s}>{s}</option>)}</select>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}

export function Reviews() {
  const t = useTable('/reviews', { status: '' });
  const set = async (id, status) => { await adm.put('/reviews/' + id, { status }); t.reload(); };
  const del = async id => { if (window.confirm('Delete this review permanently?')) { await adm.del('/reviews/' + id); t.reload(); } };
  const btn = (bg, fg) => ({ border: 0, borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, background: bg, color: fg, cursor: 'pointer' });
  return (
    <>
      {t.data.pending > 0 && <div className="a-msg" style={{ background: 'oklch(0.96 0.04 85)', color: 'oklch(0.4 0.12 70)' }}>{t.data.pending} review{t.data.pending > 1 ? 's' : ''} waiting for your approval. Reviews appear on the product page only after you approve them.</div>}
      <Toolbar t={t} filters={[{ key: 'status', label: 'All statuses', options: ['Pending', 'Approved', 'Rejected'] }]} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(v => (
          <div key={v.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 16, alignItems: 'start', padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: 'oklch(0.72 0.17 70)', letterSpacing: 2, fontSize: 15 }}>{'★'.repeat(v.rating)}<span style={{ color: '#d5d8e0' }}>{'★'.repeat(5 - v.rating)}</span></span>
                <b style={{ fontSize: 14 }}>{v.title || 'Review'}</b>
                <Pill s={v.status} />
                {v.verified && <span className="a-pill" style={{ background: 'oklch(0.95 0.05 150)', color: 'oklch(0.4 0.12 150)' }}>✓ Verified purchase</span>}
              </div>
              <span style={{ lineHeight: 1.55 }}>{v.body}</span>
              <span style={{ color: '#5d6270', fontSize: 12.5 }}>{v.name} on <b>{v.product}</b> · {dateTimeF(v.created)}{v.reviewed ? ` · reviewed ${dateTimeF(v.reviewed)}` : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {v.status !== 'Approved' && <button style={btn('oklch(0.55 0.15 150)', '#fff')} onClick={() => set(v.id, 'Approved')}>Approve</button>}
              {v.status !== 'Rejected' && <button style={btn('#fff', 'oklch(0.5 0.18 25)')} onClick={() => set(v.id, 'Rejected')}>Reject</button>}
              <button style={btn('#f1f3f7', '#5d6270')} onClick={() => del(v.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}

export function Inbox() {
  const [d, setD] = useState({ chat: [], contact: [] });
  const load = () => adm.get('/messages').then(setD);
  useEffect(() => { load(); }, []);
  const archive = async id => { await adm.del('/messages/' + id); load(); };
  return (
    <div className="grid2">
      <div className="a-card">
        <h3>Live chat · storefront visitors</h3>
        <div style={{ maxHeight: 420, overflow: 'auto', background: '#f6f5f2', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!d.chat.length && <span style={{ color: '#5d6270' }}>No chat yet. Messages from the storefront chat widget appear here.</span>}
          {d.chat.map(m => <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: 12, background: '#fff', lineHeight: 1.45 }}>{m.text}</div><span style={{ fontSize: 10, color: '#8a8f9b' }}>Visitor · {dateTimeF(m.at)}</span></div>)}
        </div>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Replies are not sent from here yet — call or WhatsApp the visitor.</span>
      </div>
      <div className="a-card">
        <h3>Contact messages</h3>
        {!d.contact.length && <span style={{ color: '#5d6270' }}>No messages. Submissions from the storefront Contact page appear here.</span>}
        {d.contact.map(m => (
          <div key={m.id} style={{ borderTop: '1px solid #efede8', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{m.name} · {m.contact}</b><button onClick={() => archive(m.id)} style={{ border: 0, background: 'transparent', color: '#5d6270', fontSize: 12, textDecoration: 'underline' }}>Archive</button></div>
            <span style={{ color: '#5d6270', fontSize: 12 }}>{m.company} {dateTimeF(m.at)}</span><span style={{ lineHeight: 1.5 }}>{m.body}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Marketing() {
  const subs = useTable('/subscribers');
  const consents = useTable('/consents', { status: '' });
  const [camps, setCamps] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const loadCamps = () => mktApi.get('/campaigns').then(setCamps).catch(() => setCamps([]));
  useEffect(() => { loadCamps(); }, []);

  const add = async e => { e.preventDefault(); try { await adm.post('/subscribers', { email: e.target.email.value }); e.target.reset(); subs.reload(); } catch (er) { setErr(er.message); } };
  const remove = async email => { await adm.del('/subscribers/' + encodeURIComponent(email)); subs.reload(); consents.reload(); };
  const confirm = async id => { await adm.put(`/consents/${id}/confirm`); consents.reload(); subs.reload(); };
  const exportCsv = rows => {
    const csv = ['email,subscribed_at', ...rows.map(r => `${r.email},${r.created_at}`)].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'subscribers.csv'; a.click();
  };

  return (
    <>
      <div className="kpis">
        {[['Subscribers', subs.data.total], ['Consent records', consents.data.total], ['Campaigns sent', camps.length]].map(([l, v]) => <div className="kpi" key={l}><small>{l}</small><b>{v}</b></div>)}
      </div>
      <div className="grid2">
        <a href="/email" className="a-card" style={{ background: 'linear-gradient(135deg,#0b1631,oklch(0.42 0.14 255))', color: '#fff', gap: 6, justifyContent: 'center' }}>
          <b style={{ fontSize: 17 }}>Email Center →</b>
          <span style={{ fontSize: 13, color: '#b9c6e2' }}>Campaigns with A/B subjects, automations, templates, preference center &amp; reports.</span>
          {err && <div className="a-msg err">{err}</div>}{msg && <div className="a-msg ok">{msg}</div>}
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Toolbar t={subs} sizes={[10, 25]} />
          <div className="a-card" style={{ padding: 0, gap: 0 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef0f4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 15 }}>Subscriber list</b><button className="a-btn sm ghost" onClick={() => exportCsv(subs.data.rows)}>Export CSV</button></div>
            <form onSubmit={add} style={{ display: 'flex', gap: 8, padding: '12px 20px', borderBottom: '1px solid #f3f4f7' }}><input className="a-input" name="email" type="email" required placeholder="Add an email" style={{ padding: '8px 10px' }} /><button className="a-btn sm">Add</button></form>
            {subs.data.rows.map(x => <div key={x.email} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 20px', borderBottom: '1px solid #f3f4f7' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.email}</span><button onClick={() => remove(x.email)} style={{ border: 0, background: 'transparent', color: 'oklch(0.5 0.18 25)', fontWeight: 700 }}>Remove</button></div>)}
            {!subs.data.rows.length && <div style={{ padding: 20, color: '#6b7080' }}>No subscribers yet.</div>}
          </div>
          <Pager t={subs} />
        </div>
      </div>
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4' }}><b style={{ fontSize: 15 }}>Consent log · {consents.data.total}</b><div style={{ fontSize: 12, color: '#6b7080' }}>Double opt-in records — date, time, source and IP for every signup.</div></div>
        <div style={{ padding: 12 }}><Toolbar t={consents} filters={[{ key: 'status', label: 'All statuses', options: ['Pending', 'Confirmed', 'Unsubscribed'] }]} /></div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f7f8fa' }}><tr>{['Email', 'Status', 'Source', 'Consent at', 'Confirmed at', 'IP', ''].map(h => <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7080', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>{consents.data.rows.map(c => (
              <tr key={c.id}>{[<b key="e">{c.email}</b>, <Pill key="s" s={c.status === 'Confirmed' ? 'Hired' : c.status === 'Pending' ? 'New' : 'Cancelled'} label={c.status} />, c.source, dateTimeF(c.at), dateTimeF(c.confirmedAt), <span key="ip" className="mono" style={{ fontSize: 11.5 }}>{c.ip}</span>,
                c.status !== 'Confirmed' ? <button key="b" onClick={() => confirm(c.id)} style={{ border: 0, background: 'transparent', color: 'oklch(0.48 0.16 254)', fontWeight: 700 }}>Confirm</button> : null]
                .map((cell, i) => <td key={i} style={{ padding: '11px 14px', borderTop: '1px solid #f1f2f6', whiteSpace: 'nowrap', fontSize: 12.5 }}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ padding: 12 }}><Pager t={consents} /></div>
      </div>
      <div className="a-card" style={{ padding: 0, gap: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef0f4' }}><b style={{ fontSize: 15 }}>Sent campaigns</b></div>
        {!camps.length && <div style={{ padding: 20, color: '#6b7080' }}>No campaigns yet.</div>}
        {camps.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid #f3f4f7', flexWrap: 'wrap' }}><div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}><b>{c.name}</b><span style={{ fontSize: 12, color: '#5d6270' }}>{c.code} · {c.audience} · {dateF(c.at)}</span></div><Pill s={c.status === 'Sent' ? 'Hired' : 'New'} label={c.status === 'Sent' ? 'Sent to ' + c.sent : 'Scheduled'} /></div>)}
      </div>
    </>
  );
}

const STAGES = ['New', 'Shortlisted', 'Interview', 'Offered', 'Hired', 'Rejected'];

function JobForm({ job, onClose, onSaved }) {
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await adm.post('/jobs', { ...d, id: job?.id, open: d.open === 'on', deadline: d.deadline }); onSaved(); onClose(); } catch (er) { setErr(er.message); }
  };
  const L = a => (a || []).join('\n');
  return (
    <Modal kicker="Careers" title={job ? 'Edit job' : 'Post a job'} onClose={onClose} onSubmit={submit} footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad">Save job</button></>}>
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
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);
  const [tab, setTab] = useState('apps');
  const [edit, setEdit] = useState(null);
  const [stage, setStage] = useState('');
  const load = () => { adm.get('/jobs').then(setJobs); adm.get('/applications').then(setApps); };
  useEffect(() => { load(); }, []);
  const setSt = async (id, s) => { await adm.put('/applications/' + id, { stage: s }); load(); };
  const delJob = async j => { if (window.confirm(`Delete "${j.title}" and its ${j.apps} applications?`)) { await adm.del('/jobs/' + j.id); load(); } };
  const shown = apps.filter(a => !stage || a.stage === stage);
  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {[['Open roles', jobs.filter(j => j.open && new Date(j.deadline) > new Date()).length], ['Applications', apps.length], ['New', apps.filter(a => a.stage === 'New').length], ['Interview', apps.filter(a => a.stage === 'Interview').length], ['Hired', apps.filter(a => a.stage === 'Hired').length]]
          .map(([l, n]) => <div key={l} style={{ background: 'linear-gradient(135deg,#0b1631,#173a7a)', color: '#fff', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontSize: 11.5, color: '#a9bbe0', fontWeight: 700 }}>{l}</span><b style={{ fontFamily: 'var(--disp)', fontSize: 24 }}>{n}</b></div>)}
      </div>
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
                <span style={{ color: '#8a8f9b', fontSize: 12 }}>CV: {a.cv} · applied {dateF(a.at)}</span>
              </div>
              <select className="a-input" value={a.stage} onChange={e => setSt(a.id, e.target.value)} style={{ borderRadius: 999, fontWeight: 700, width: 'auto' }}>{STAGES.map(s => <option key={s}>{s}</option>)}</select>
            </div>
          ))}
        </>
      )}
      {tab === 'jobs' && (
        <div className="a-table"><div style={{ minWidth: 700 }}>
          <div className="head" style={{ gridTemplateColumns: 'minmax(200px,1fr) 120px 110px 90px 90px 140px' }}><span>Role</span><span>Department</span><span>Deadline</span><span>Open</span><span>Applied</span><span /></div>
          {jobs.map(j => (
            <div key={j.id} className="row" style={{ gridTemplateColumns: 'minmax(200px,1fr) 120px 110px 90px 90px 140px' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b>{j.title}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{j.id} · {j.type} · {j.salary}</span></span>
              <span>{j.dept}</span><span>{dateF(j.deadline)}</span><Pill s={j.open && new Date(j.deadline) > new Date() ? 'Active' : 'Disabled'} label={j.open && new Date(j.deadline) > new Date() ? 'Open' : 'Closed'} /><b>{j.apps}</b>
              <span style={{ display: 'flex', gap: 6 }}><button className="a-btn sm ghost" onClick={() => setEdit(j)}>Edit</button><button className="a-btn sm ghost" style={{ color: 'oklch(0.5 0.18 25)' }} onClick={() => delJob(j)}>Delete</button></span>
            </div>
          ))}
        </div></div>
      )}
      {edit && <JobForm job={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={load} />}
    </>
  );
}
