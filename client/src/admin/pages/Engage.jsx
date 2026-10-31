import { useEffect, useState } from 'react';
import { adm, downloadFile, dateF, dateTimeF, mktApi, slNo, useTable } from '../adminApi.js';
import { Empty, Modal, Pager, Pill, Toolbar, Summary, ViewToggle, alertBox, confirmBox, hueOf, useView } from '../ui.jsx';
import { Av, Chip, Tabs, usePaged } from '../fieldKit.jsx';
import { ListFilter } from '../ListFilter.jsx';
import { IconBtn } from '../IconBtn.jsx';

export function Services() {
  const t = useTable('/services', { status: '', from: '', to: '' });
  const [view, setView] = useView('services');
  const set = async (id, status) => { await adm.put('/services/' + id, { status }); t.reload(); };
  return (
    <>
      <ListFilter t={t} noun="request" title="Search service requests" search={{ placeholder: 'Request no., name, phone or model' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['New', 'Scheduled', 'In progress', 'Completed'] }]} range={{ label: 'Requested' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw ' + view} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
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
  const t = useTable('/reviews', { status: '', from: '', to: '' });
  const [view, setView] = useView('reviews');
  const set = async (id, status) => { await adm.put('/reviews/' + id, { status }); t.reload(); };
  const del = async id => { if (await confirmBox('Delete this review permanently?', { danger: true, confirmLabel: 'Delete' })) { await adm.del('/reviews/' + id); t.reload(); } };
  const btn = (bg, fg) => ({ border: 0, borderRadius: 999, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, background: bg, color: fg, cursor: 'pointer' });
  return (
    <>
      {t.data.pending > 0 && <div className="a-msg" style={{ background: 'oklch(0.96 0.04 85)', color: 'oklch(0.4 0.12 70)' }}>{t.data.pending} review{t.data.pending > 1 ? 's' : ''} waiting for your approval. Reviews appear on the product page only after you approve them.</div>}
      <ListFilter t={t} noun="review" title="Search reviews" search={{ placeholder: 'Reviewer, product or text' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Pending', 'Approved', 'Rejected'] }]} range={{ label: 'Posted' }} />
      <Toolbar t={t} search={false}><ViewToggle view={view} setView={setView} /></Toolbar>
      <div className={'vw ' + view} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
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

const MSG_TONE = { New: 'amber', Read: 'blue', Replied: 'ok', Closed: 'off' };
const waLink = c => { const d = String(c || '').replace(/\D/g, ''); return /^01\d{9}$/.test(d) ? 'https://wa.me/88' + d : null; };

/** One contact-form message: read it, reply by email / WhatsApp / phone, set its status and keep a private note. */
function MessageCard({ m, onSaved, onError }) {
  const [note, setNote] = useState(m.note);
  const [busy, setBusy] = useState(false);
  const isMail = /@/.test(m.contact), wa = waLink(m.contact), isPhone = !isMail && /\d{6,}/.test(m.contact);
  const save = async patch => {
    setBusy(true);
    try { await adm.put('/messages/' + m.id, patch); await onSaved(); } catch (e) { onError(e.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirmBox('Delete the message from ' + m.name + ' permanently?', { danger: true, confirmLabel: 'Delete message' }))) return;
    try { await adm.del('/messages/' + m.id); await onSaved(); } catch (e) { onError(e.message); }
  };
  return (
    <div className={'ib-msg' + (m.status === 'New' ? ' new' : '')}>
      <Av name={m.name} />
      <div className="ib-body">
        <div className="ib-head"><b>{m.name}</b><Chip tone={MSG_TONE[m.status]}>{m.status}</Chip><small>{dateTimeF(m.at)}</small></div>
        <div className="ib-meta">{[m.contact, m.company].filter(Boolean).join(' · ')}{m.subject ? ' · ' + m.subject : ''}</div>
        <p className="ib-text">{m.body}</p>
        {m.handledBy && m.status !== 'New' && <small className="ib-by">{m.status} by {m.handledBy}{m.handledAt ? ' · ' + dateTimeF(m.handledAt) : ''}</small>}
        <textarea className="a-input" rows={2} placeholder="Private note for the team (customers never see this)" value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== m.note && save({ note })} aria-label="Private note" />
        <div className="ib-acts">
          {isMail && <a className="a-mini" href={'mailto:' + m.contact + '?subject=' + encodeURIComponent('Re: your message to AR Trade International') + '&body=' + encodeURIComponent('Dear ' + m.name + ',\n\n')} onClick={() => m.status === 'New' && save({ status: 'Read' })}>✉ Reply by email</a>}
          {wa && <a className="a-mini" href={wa} target="_blank" rel="noreferrer" onClick={() => m.status === 'New' && save({ status: 'Read' })}>WhatsApp</a>}
          {isPhone && <a className="a-mini" href={'tel:' + m.contact.replace(/[^\d+]/g, '')} onClick={() => m.status === 'New' && save({ status: 'Read' })}>☎ Call</a>}
          {m.status === 'New' && <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'Read' })}>Mark read</button>}
          {m.status !== 'Replied' && m.status !== 'Closed' && <button type="button" className="a-mini ok" disabled={busy} onClick={() => save({ status: 'Replied' })}>Mark replied</button>}
          {m.status !== 'Closed' ? <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'Closed' })}>Close</button> : <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'New' })}>Reopen</button>}
          <button type="button" className="a-mini bad-o" onClick={remove}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export function Inbox() {
  const [d, setD] = useState({ chat: [], contact: [] });
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const load = () => adm.get('/messages').then(r => { setD(r); setErr(''); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const n = s => d.contact.filter(m => m.status === s).length;
  const list = d.contact.filter(m => (tab === 'all' || (tab === 'open' ? ['New', 'Read'].includes(m.status) : m.status === tab)) && (!q.trim() || (m.name + ' ' + m.contact + ' ' + m.company + ' ' + m.body).toLowerCase().includes(q.trim().toLowerCase())));
  const pg = usePaged(list);
  return (
    <>
      <Summary items={[
        ['New', n('New'), 'not opened yet', 'amber', 'mail'],
        ['Waiting for a reply', n('New') + n('Read'), 'new or read', 'blue', 'clock'],
        ['Replied', n('Replied'), 'answered', 'green', 'check'],
        ['Closed', n('Closed'), 'finished', 'violet', 'tag'],
        ['Chat messages', d.chat.length, 'from the shop chat', 'blue', 'users']
      ]} />
      {err && <div className="a-msg err">{err}</div>}
      <section className="a-card">
        <div className="card-hd"><div><h3>Messages and quote requests</h3><small style={{ color: '#6b7388' }}>Sent from the storefront Contact page. Saved in the database and handled here.</small></div></div>
        <div className="fd-bar">
          <Tabs value={tab} onChange={setTab} items={[['open', 'To answer', n('New') + n('Read')], ['New', 'New', n('New')], ['Replied', 'Replied', n('Replied')], ['Closed', 'Closed', n('Closed')], ['all', 'All', d.contact.length]]} />
          <input className="a-input fd-q" placeholder="Search name, contact or text…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search messages" />
        </div>
        <div className="ib-list">
          {pg.items.map(m => <MessageCard key={m.id + m.status + m.note} m={m} onSaved={load} onError={setErr} />)}
          {!list.length && <div className="a-empty">{d.contact.length ? 'Nothing in this view.' : 'No messages yet. Submissions from the storefront Contact page appear here.'}</div>}
        </div>
        {pg.bar}
      </section>
      <section className="a-card">
        <h3>Live chat · storefront visitors</h3>
        <div style={{ maxHeight: 360, overflow: 'auto', background: '#f6f5f2', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!d.chat.length && <span style={{ color: '#5d6270' }}>No chat yet. Messages from the storefront chat widget appear here.</span>}
          {d.chat.map(m => <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: 12, background: '#fff', lineHeight: 1.45 }}>{m.text}</div><small style={{ color: '#6b7388', fontSize: 11 }}>{dateTimeF(m.at)}</small></div>)}
        </div>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Replies are not sent from here yet: call or WhatsApp the visitor.</span>
      </section>
    </>
  );
}

export function Marketing() {
  const subs = useTable('/subscribers', { from: '', to: '' });
  const consents = useTable('/consents', { status: '', from: '', to: '' });
  const [camps, setCamps] = useState([]);
  const [err, setErr] = useState('');
  const loadCamps = () => mktApi.get('/campaigns').then(setCamps).catch(() => setCamps([]));
  useEffect(() => { loadCamps(); }, []);

  const add = async e => { e.preventDefault(); try { await adm.post('/subscribers', { email: e.target.email.value }); e.target.reset(); setErr(''); subs.reload(); } catch (er) { setErr(er.message); } };
  const remove = async email => { await adm.del('/subscribers/' + encodeURIComponent(email)); subs.reload(); consents.reload(); };
  const confirm = async id => { await adm.put(`/consents/${id}/confirm`); consents.reload(); subs.reload(); };
  const exportCsv = rows => {
    const csv = ['email,subscribed_at', ...rows.map(r => `${r.email},${r.created_at}`)].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'subscribers.csv'; a.click();
  };
  const sent = camps.filter(c => c.status === 'Sent').length;

  return (
    <>
      <Summary items={[
        ['Subscribers', subs.data.total, 'People who confirmed by email', 'blue', 'users'],
        ['Consent records', consents.data.total, 'Double opt-in log entries', 'green', 'check'],
        ['Campaigns sent', sent, 'Delivered to subscribers', 'violet', 'mail'],
        ['Scheduled', camps.length - sent, 'Waiting to go out', 'amber', 'clock']
      ]} />
      {err && <div className="a-msg err">{err}</div>}
      <div className="mk-grid">
        <div className="mk-left">
          <a href="/email" className="mk-hero">
            <span className="mk-hero-ic">✉</span>
            <div><b>Email Center →</b><span>Campaigns with A/B subjects, automations, templates, preference center &amp; reports.</span></div>
            <div className="mk-chips"><i>A/B subjects</i><i>Automations</i><i>Templates</i><i>Reports</i></div>
          </a>
          <div className="a-card mk-card">
            <div className="mk-hd"><b>Campaigns</b><span className="chip">{camps.length}</span></div>
            {!camps.length && <div className="muted" style={{ padding: '4px 0 8px' }}>No campaigns yet. Create one in the Email Center.</div>}
            {camps.map(c => (
              <div key={c.id} className="mk-camp">
                <span className="mk-dot" style={{ '--h': c.status === 'Sent' ? 160 : 70 }}>{c.status === 'Sent' ? '✓' : '⏱'}</span>
                <div><b>{c.name}</b><span>{c.code} · {c.audience} · {dateF(c.at)}</span></div>
                <Pill s={c.status === 'Sent' ? 'Hired' : 'New'} label={c.status === 'Sent' ? 'Sent to ' + c.sent : 'Scheduled'} />
              </div>
            ))}
          </div>
        </div>
        <div className="mk-right">
          <ListFilter t={subs} noun="subscriber" title="Search subscribers" search={{ placeholder: 'Email address' }} range={{ label: 'Joined' }} />
          <Toolbar t={subs} sizes={[10, 25]} search={false} />
          <div className="a-card mk-card" style={{ padding: 0 }}>
            <div className="mk-hd" style={{ padding: '12px 16px' }}><b>Subscriber list</b><span className="chip">{subs.data.total}</span><span style={{ flex: 1 }} /><button className="a-btn sm ghost" onClick={() => exportCsv(subs.data.rows)}>⤓ Export CSV</button></div>
            <form onSubmit={add} className="mk-add"><input className="a-input" name="email" type="email" required placeholder="Add an email address" /><button className="a-btn sm grad">＋ Add</button></form>
            {subs.data.rows.map((x, i) => (
              <div key={x.email} className="mk-sub">
                <span className="mk-av" style={{ '--h': hueOf(x.email) }}>{x.email[0].toUpperCase()}</span>
                <span className="sl">{slNo(subs, i)}</span>
                <span className="mk-mail">{x.email}</span>
                <button type="button" className="mk-rm" onClick={() => remove(x.email)}>Remove</button>
              </div>
            ))}
            {!subs.data.rows.length && <div className="muted" style={{ padding: 16 }}>No subscribers yet.</div>}
          </div>
          <Pager t={subs} />
        </div>
      </div>
      <div className="a-card mk-card" style={{ padding: 0 }}>
        <div className="mk-hd" style={{ padding: '14px 18px 4px' }}><b>Consent log</b><span className="chip">{consents.data.total}</span></div>
        <div style={{ padding: '0 18px 8px', fontSize: 12, color: '#6b7388' }}>Double opt-in records: date, time, source and IP for every signup.</div>
        <div style={{ padding: '0 12px 8px' }}><ListFilter t={consents} noun="record" title="Search consent log" search={{ placeholder: 'Email or source' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Pending', 'Confirmed', 'Unsubscribed'] }]} range={{ label: 'Consent' }} /><div style={{ height: 8 }} /><Toolbar t={consents} search={false} /></div>
        <div style={{ overflow: 'auto' }}>
          <table className="dt">
            <thead><tr>{['SL', 'Email', 'Status', 'Source', 'Consent at', 'Confirmed at', 'IP', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{consents.data.rows.map((c, i) => (
              <tr key={c.id}>
                <td><span className="sl">{slNo(consents, i)}</span></td>
                <td><b>{c.email}</b></td>
                <td><Pill s={c.status === 'Confirmed' ? 'Hired' : c.status === 'Pending' ? 'New' : 'Cancelled'} label={c.status} /></td>
                <td>{c.source}</td><td>{dateTimeF(c.at)}</td><td>{dateTimeF(c.confirmedAt)}</td>
                <td><span className="mono" style={{ fontSize: 11.5 }}>{c.ip}</span></td>
                <td>{c.status !== 'Confirmed' ? <button type="button" className="a-btn sm ghost" onClick={() => confirm(c.id)}>Confirm</button> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ padding: 12 }}><Pager t={consents} /></div>
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
    <Modal side kicker="Careers" title={job ? 'Edit job' : 'Post a job'} onClose={onClose} onSubmit={submit} footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad">Save job</button></>}>
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
  const delJob = async j => { if (await confirmBox(`Delete "${j.title}" and its ${j.apps} applications?`, { danger: true, confirmLabel: 'Delete' })) { await adm.del('/jobs/' + j.id); load(); } };
  const shown = apps.filter(a => !stage || a.stage === stage);
  return (
    <>
      <Summary items={[
        ['Open roles', jobs.filter(j => j.open && new Date(j.deadline) > new Date()).length, 'accepting applications', 'blue', 'tag'],
        ['Applications', apps.length, 'received in total', 'violet', 'users'],
        ['New', apps.filter(a => a.stage === 'New').length, 'not reviewed yet', 'amber', 'plus'],
        ['Interview', apps.filter(a => a.stage === 'Interview').length, 'in progress', 'blue', 'clock'],
        ['Hired', apps.filter(a => a.stage === 'Hired').length, 'joined the team', 'green', 'check']
      ]} />
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
              <span>{j.dept}</span><span>{dateF(j.deadline)}</span><Pill s={j.open && new Date(j.deadline) > new Date() ? 'Active' : 'Disabled'} label={j.open && new Date(j.deadline) > new Date() ? 'Open' : 'Closed'} /><b>{j.apps}</b>
              <span className="ic-row"><IconBtn icon="edit" title="Edit the job" onClick={() => setEdit(j)} /><IconBtn icon="trash" tone="bad" title="Delete the job and its applications" onClick={() => delJob(j)} /></span>
            </div>
          ))}
        </div></div>
      )}
      {edit && <JobForm job={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={load} />}
    </>
  );
}
