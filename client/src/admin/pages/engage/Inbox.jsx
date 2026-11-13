import { useState } from 'react';
import { adm, dateTimeF } from '../../adminApi.js';
import { Summary, confirmBox } from '../../ui.jsx';
import { Av, Chip, Tabs, usePaged } from '../../fieldKit.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { ChatLeads } from '../ChatLeads.jsx';

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
  const inbox = useApiData(() => adm.get('/messages'), [], { chat: [], contact: [] });
  const d = inbox.data;
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [actionErr, setErr] = useState('');
  const err = actionErr || inbox.error;
  const load = () => inbox.reload().then(() => setErr(''));
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
          {d.chat.map(m => <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ maxWidth: '85%', padding: '9px 12px', borderRadius: 12, background: '#fff', lineHeight: 1.45 }}>{m.text}</div><small style={{ color: '#6b7388', fontSize: 11 }}>{m.name ? <><b>{m.name}</b>{m.contact ? ' · ' + m.contact : ''} · </> : null}{dateTimeF(m.at)}</small></div>)}
        </div>
        <span style={{ fontSize: 12, color: '#6b7080' }}>Replies are not sent from here yet: call or WhatsApp the visitor.</span>
      </section>
      <ChatLeads />
    </>
  );
}
