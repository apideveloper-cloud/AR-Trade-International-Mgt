import { useState } from 'react';
import { adm, dateTimeF } from '../../adminApi.js';
import { Summary, confirmBox } from '../../ui.jsx';
import { Av, Chip, Tabs, usePaged } from '../../fieldKit.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { ChatLeads } from '../ChatLeads.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/shell.js';
import './engage.css';

const MSG_TONE = { New: 'amber', Read: 'blue', Replied: 'ok', Closed: 'off' };
const waLink = c => { const d = String(c || '').replace(/\D/g, ''); return /^01\d{9}$/.test(d) ? 'https://wa.me/88' + d : null; };

/** One contact-form message: read it, reply by email / WhatsApp / phone, set its status and keep a private note. */
function MessageCard({ m, onSaved, onError }) {
  const tr = useT();
  const [note, setNote] = useState(m.note);
  const [busy, setBusy] = useState(false);
  const isMail = /@/.test(m.contact), wa = waLink(m.contact), isPhone = !isMail && /\d{6,}/.test(m.contact);
  const save = async patch => {
    setBusy(true);
    try { await adm.put('/messages/' + m.id, patch); await onSaved(); } catch (e) { onError(e.message); }
    setBusy(false);
  };
  const remove = async () => {
    if (!(await confirmBox(tr('Delete the message from {name} permanently?', { name: m.name }), { danger: true, confirmLabel: tr('Delete message') }))) return;
    try { await adm.del('/messages/' + m.id); await onSaved(); } catch (e) { onError(e.message); }
  };
  return (
    <div className={'ib-msg' + (m.status === 'New' ? ' new' : '')}>
      <Av name={m.name} />
      <div className="ib-body">
        <div className="ib-head"><b>{m.name}</b><Chip tone={MSG_TONE[m.status]}>{tr(m.status)}</Chip><small>{dateTimeF(m.at)}</small></div>
        <div className="ib-meta">{[m.contact, m.company].filter(Boolean).join(' · ')}{m.subject ? ' · ' + m.subject : ''}</div>
        <p className="ib-text">{m.body}</p>
        {m.handledBy && m.status !== 'New' && <small className="ib-by">{tr('{status} by {name}', { status: tr(m.status), name: m.handledBy })}{m.handledAt ? ' · ' + dateTimeF(m.handledAt) : ''}</small>}
        <textarea className="a-input" rows={2} placeholder={tr('Private note for the team (customers never see this)')} value={note} onChange={e => setNote(e.target.value)} onBlur={() => note !== m.note && save({ note })} aria-label={tr('Private note')} />
        <div className="ib-acts">
          {isMail && <a className="a-mini" href={'mailto:' + m.contact + '?subject=' + encodeURIComponent('Re: your message to AR Trade International') + '&body=' + encodeURIComponent('Dear ' + m.name + ',\n\n')} onClick={() => m.status === 'New' && save({ status: 'Read' })}>{tr('✉ Reply by email')}</a>}
          {wa && <a className="a-mini" href={wa} target="_blank" rel="noreferrer" onClick={() => m.status === 'New' && save({ status: 'Read' })}>WhatsApp</a>}
          {isPhone && <a className="a-mini" href={'tel:' + m.contact.replace(/[^\d+]/g, '')} onClick={() => m.status === 'New' && save({ status: 'Read' })}>{tr('☎ Call')}</a>}
          {m.status === 'New' && <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'Read' })}>{tr('Mark read')}</button>}
          {m.status !== 'Replied' && m.status !== 'Closed' && <button type="button" className="a-mini ok" disabled={busy} onClick={() => save({ status: 'Replied' })}>{tr('Mark replied')}</button>}
          {m.status !== 'Closed' ? <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'Closed' })}>{tr('Close')}</button> : <button type="button" className="a-mini" disabled={busy} onClick={() => save({ status: 'New' })}>{tr('Reopen')}</button>}
          <button type="button" className="a-mini bad-o" onClick={remove}>{tr('Delete')}</button>
        </div>
      </div>
    </div>
  );
}

export function Inbox() {
  const tr = useT();
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
      {err && <div className="a-msg err">{tr(err)}</div>}
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Messages and quote requests')}</h3><small className="eg-inbox-sub">{tr('Sent from the storefront Contact page. Saved in the database and handled here.')}</small></div></div>
        <div className="fd-bar">
          <Tabs value={tab} onChange={setTab} items={[['open', 'To answer', n('New') + n('Read')], ['New', 'New', n('New')], ['Replied', 'Replied', n('Replied')], ['Closed', 'Closed', n('Closed')], ['all', 'All', d.contact.length]]} />
          <input className="a-input fd-q" placeholder={tr('Search name, contact or text…')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Search messages')} />
        </div>
        <div className="ib-list">
          {pg.items.map(m => <MessageCard key={m.id + m.status + m.note} m={m} onSaved={load} onError={setErr} />)}
          {!list.length && <div className="a-empty">{tr(d.contact.length ? 'Nothing in this view.' : 'No messages yet. Submissions from the storefront Contact page appear here.')}</div>}
        </div>
        {pg.bar}
      </section>
      <section className="a-card">
        <h3>{tr('Live chat · storefront visitors')}</h3>
        <div className="eg-chat-box">
          {!d.chat.length && <span className="eg-chat-empty">{tr('No chat yet. Messages from the storefront chat widget appear here.')}</span>}
          {d.chat.map(m => <div key={m.id} className="eg-chat-item"><div className="eg-chat-bubble">{m.text}</div><small className="eg-chat-time">{m.name ? <><b>{m.name}</b>{m.contact ? ' · ' + m.contact : ''} · </> : null}{dateTimeF(m.at)}</small></div>)}
        </div>
        <span className="eg-chat-foot">{tr('Replies are not sent from here yet: call or WhatsApp the visitor.')}</span>
      </section>
      <ChatLeads />
    </>
  );
}
