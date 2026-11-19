import { useState } from 'react';
import { adm, dateTimeF, slNo, useTable } from '../adminApi.js';
import { Pill, Summary, Toolbar, Pager, confirmBox } from '../ui.jsx';
import { ListFilter } from '../ListFilter.jsx';
import { saveTextFile } from '../hooks/download.js';
import './engage/engage.css';

const STATUSES = ['New', 'Contacted', 'Customer', 'Not interested'];
const PILL = { New: 'New', Contacted: 'Scheduled', Customer: 'Hired', 'Not interested': 'Cancelled' };
const wa = p => 'https://wa.me/88' + p;
const csvCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';

/** People who filled in the chat's start form (name, mobile, location): the upcoming-customer list for sellers and marketing. */
export function ChatLeads() {
  const t = useTable('/chat-leads', { size: 15, status: '', marketing: '' });
  const [err, setErr] = useState('');
  const s = t.data.stats || { total: 0, fresh: 0, customers: 0, marketing: 0, week: 0 };
  const save = async (id, patch) => { try { await adm.put('/chat-leads/' + id, patch); setErr(''); t.reload(); } catch (e) { setErr(e.message); } };
  const remove = async l => {
    if (!(await confirmBox('Delete ' + l.name + ' (' + l.phone + ') from the chat leads list?', { danger: true, confirmLabel: 'Delete lead' }))) return;
    try { await adm.del('/chat-leads/' + l.id); setErr(''); t.reload(); } catch (e) { setErr(e.message); }
  };
  const exportCsv = async () => {
    try {
      const { rows } = await adm.get('/chat-leads/export');
      const head = ['Name', 'Mobile', 'Usage', 'Location', 'Latitude', 'Longitude', 'Accuracy (m)', 'Device', 'System', 'Browser', 'IP address', 'IP place', 'Language', 'Time zone', 'Screen', 'Came from', 'Campaign', 'First page', 'Interested in', 'Last message', 'Offers OK', 'Status', 'Note', 'First chat', 'Last seen'];
      const csv = '\ufeff' + [head.join(','), ...rows.map(r => [r.name, r.phone, r.usage, r.location, r.lat, r.lng, r.accuracy, r.device, r.os, r.browser, r.ip, r.ipPlace, r.tech?.lang, r.tech?.tz, r.tech?.screen, r.tech?.ref, [r.tech?.utm_source, r.tech?.utm_medium, r.tech?.utm_campaign].filter(Boolean).join(' / '), r.tech?.landing, r.interest, r.lastMessage, r.marketing ? 'Yes' : 'No', r.status, r.note, r.created, r.seen].map(csvCell).join(','))].join('\r\n');
      saveTextFile('chat-leads.csv', csv, 'text/csv;charset=utf-8');
    } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Chat leads', s.total, 'people who started a chat', 'blue', 'users'],
        ['New this week', s.week, 'first chat in 7 days', 'green', 'clock'],
        ['Not contacted', s.fresh, 'status New: follow up', 'amber', 'mail'],
        ['Became customers', s.customers, 'marked Customer', 'violet', 'check'],
        ['Agreed to offers', s.marketing, 'ticked the offers box', 'blue', 'tag']
      ]} />
      {(err || t.error) && <div className="a-msg err">{err || t.error}</div>}
      <div className="a-card mk-card eg-flush">
        <div className="mk-hd eg-hd-lg"><b>Chat leads · upcoming customers</b><span className="chip">{t.data.total}</span>
          <button type="button" className="a-btn sm ghost eg-push" onClick={exportCsv}>Export CSV</button></div>
        <div className="eg-hint">Everyone who gave their details to start the website chat. Call or WhatsApp them, set the status, and use "Agreed to offers" for marketing.</div>
        <div className="eg-filter">
          <ListFilter t={t} noun="lead" title="Search chat leads" search={{ placeholder: 'Name, mobile, location or message' }} selects={[
            { key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: STATUSES },
            { key: 'marketing', label: 'Offers', all: 'Everyone', icon: 'status', options: [{ v: '1', t: 'Agreed to offers' }] }
          ]} />
          <div className="eg-gap8" /><Toolbar t={t} search={false} sizes={[15, 25, 50, 100]} />
        </div>
        <div className="eg-scroll">
          <table className="dt">
            <thead><tr>{['SL', 'Name', 'Mobile', 'Usage', 'Location', 'Device & place', 'Asked about', 'Offers', 'Status', 'Last chat', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{t.data.rows.map((l, i) => (
              <tr key={l.id}>
                <td><span className="sl">{slNo(t, i)}</span></td>
                <td><b>{l.name}</b>{l.handledBy && <div className="eg-sub-11">by {l.handledBy}</div>}</td>
                <td><a href={'tel:' + l.phone}>{l.phone}</a> · <a href={wa(l.phone)} target="_blank" rel="noreferrer">WhatsApp</a></td>
                <td>{l.usage || '—'}</td>
                <td>{l.location}</td>
                <td className="eg-device">
                  {l.device ? <b>{l.device}</b> : '—'}{l.os ? ' · ' + l.os : ''}
                  {l.browser && <div>{l.browser}</div>}
                  {l.ip && <div className="eg-muted">IP {l.ip}{l.ipPlace ? ' · near ' + l.ipPlace : ''}</div>}
                  {l.lat != null && <a href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=16/${l.lat}/${l.lng}`} target="_blank" rel="noreferrer">Map ↗ {l.lat.toFixed(4)}, {l.lng.toFixed(4)}</a>}
                  {(l.tech?.utm_source || l.tech?.ref) && <div className="eg-muted" title={l.tech.ref || ''}>from {l.tech.utm_source || (l.tech.ref || '').replace(/^https?:\/\//, '').split('/')[0]}</div>}
                </td>
                <td title={l.lastMessage}>{l.interest ? <b>{l.interest}</b> : '—'}<div className="eg-snippet">{l.lastMessage}</div></td>
                <td>{l.marketing ? <Pill s="Hired" label="Yes" /> : <span className="eg-no">No</span>}</td>
                <td><select className="a-input eg-lead-status" aria-label={'Status of ' + l.name} value={l.status} onChange={e => save(l.id, { status: e.target.value })}>{STATUSES.map(x => <option key={x}>{x}</option>)}</select></td>
                <td>{dateTimeF(l.seen)}<div className="eg-sub-115">{l.messages} message{l.messages === 1 ? '' : 's'}</div></td>
                <td><button type="button" className="a-btn sm ghost" onClick={() => remove(l)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
          {!t.data.rows.length && <div className="a-empty">{t.loading ? 'Loading…' : 'No chat leads yet. When a visitor fills the start form in the website chat, they appear here.'}</div>}
        </div>
        <div className="eg-pad12"><Pager t={t} /></div>
      </div>
    </>
  );
}
