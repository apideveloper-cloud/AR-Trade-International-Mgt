import { useState } from 'react';
import { adm, dateF, dateTimeF, mktApi, slNo, useTable } from '../../adminApi.js';
import { Pager, Pill, Summary, Toolbar, hueOf } from '../../ui.jsx';
import { ListFilter } from '../../ListFilter.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { useBusy } from '../../hooks/useBusy.js';
import { saveTextFile } from '../../hooks/download.js';
import { withAlert } from '../../hooks/withAlert.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/shell.js';
import './engage.css';

export function Marketing() {
  const tr = useT();
  const subs = useTable('/subscribers', { from: '', to: '' });
  const consents = useTable('/consents', { status: '', from: '', to: '' });
  const { data: camps } = useApiData(() => mktApi.get('/campaigns').catch(() => []), [], []);
  const [err, setErr] = useState('');
  const [adding, runAdd] = useBusy();

  const add = async e => {
    e.preventDefault();
    const form = e.target;
    await runAdd(async () => { try { await adm.post('/subscribers', { email: form.email.value }); form.reset(); setErr(''); subs.reload(); } catch (er) { setErr(er.message); } });
  };
  const remove = withAlert(async email => { await adm.del('/subscribers/' + encodeURIComponent(email)); subs.reload(); consents.reload(); });
  const confirm = withAlert(async id => { await adm.put(`/consents/${id}/confirm`); consents.reload(); subs.reload(); });
  const exportCsv = rows => saveTextFile('subscribers.csv', ['email,subscribed_at', ...rows.map(r => `${r.email},${r.created_at}`)].join('\n'));
  const sent = camps.filter(c => c.status === 'Sent').length;

  return (
    <>
      <Summary items={[
        ['Subscribers', subs.data.total, 'People who confirmed by email', 'blue', 'users'],
        ['Consent records', consents.data.total, 'Double opt-in log entries', 'green', 'check'],
        ['Campaigns sent', sent, 'Delivered to subscribers', 'violet', 'mail'],
        ['Scheduled', camps.length - sent, 'Waiting to go out', 'amber', 'clock']
      ]} />
      {err && <div className="a-msg err">{tr(err)}</div>}
      <div className="mk-grid">
        <div className="mk-left">
          <a href="/email" className="mk-hero">
            <span className="mk-hero-ic">✉</span>
            <div><b>{tr('Email Center →')}</b><span>{tr('Campaigns with A/B subjects, automations, templates, preference center & reports.')}</span></div>
            <div className="mk-chips"><i>{tr('A/B subjects')}</i><i>{tr('Automations')}</i><i>{tr('Templates')}</i><i>{tr('Reports')}</i></div>
          </a>
          <div className="a-card mk-card">
            <div className="mk-hd"><b>{tr('Campaigns')}</b><span className="chip">{camps.length}</span></div>
            {!camps.length && <div className="muted eg-empty-sm">{tr('No campaigns yet. Create one in the Email Center.')}</div>}
            {camps.map(c => (
              <div key={c.id} className="mk-camp">
                <span className="mk-dot" style={{ '--h': c.status === 'Sent' ? 160 : 70 }}>{c.status === 'Sent' ? '✓' : '⏱'}</span>
                <div><b>{c.name}</b><span>{c.code} · {c.audience} · {dateF(c.at)}</span></div>
                <Pill s={c.status === 'Sent' ? 'Hired' : 'New'} label={c.status === 'Sent' ? tr('Sent to {n}', { n: c.sent }) : 'Scheduled'} />
              </div>
            ))}
          </div>
        </div>
        <div className="mk-right">
          <ListFilter t={subs} noun="subscriber" title="Search subscribers" search={{ placeholder: 'Email address' }} range={{ label: 'Joined' }} />
          <Toolbar t={subs} sizes={[10, 25]} search={false} />
          <div className="a-card mk-card eg-flush">
            <div className="mk-hd eg-hd-md"><b>{tr('Subscriber list')}</b><span className="chip">{subs.data.total}</span><span className="eg-grow" /><button className="a-btn sm ghost" onClick={() => exportCsv(subs.data.rows)}>{tr('⤓ Export CSV')}</button></div>
            <form onSubmit={add} className="mk-add"><input className="a-input" name="email" type="email" required placeholder={tr('Add an email address')} /><button className="a-btn sm grad" disabled={adding}>{tr('＋ Add')}</button></form>
            {subs.data.rows.map((x, i) => (
              <div key={x.email} className="mk-sub">
                <span className="mk-av" style={{ '--h': hueOf(x.email) }}>{x.email[0].toUpperCase()}</span>
                <span className="sl">{slNo(subs, i)}</span>
                <span className="mk-mail">{x.email}</span>
                <button type="button" className="mk-rm" onClick={() => remove(x.email)}>{tr('Remove')}</button>
              </div>
            ))}
            {!subs.data.rows.length && <div className="muted eg-empty-md">{tr('No subscribers yet.')}</div>}
          </div>
          <Pager t={subs} />
        </div>
      </div>
      <div className="a-card mk-card eg-flush">
        <div className="mk-hd eg-hd-lg"><b>{tr('Consent log')}</b><span className="chip">{consents.data.total}</span></div>
        <div className="eg-hint">{tr('Double opt-in records: date, time, source and IP for every signup.')}</div>
        <div className="eg-filter"><ListFilter t={consents} noun="record" title="Search consent log" search={{ placeholder: 'Email or source' }} selects={[{ key: 'status', label: 'Status', all: 'All statuses', icon: 'status', options: ['Pending', 'Confirmed', 'Unsubscribed'] }]} range={{ label: 'Consent' }} /><div className="eg-gap8" /><Toolbar t={consents} search={false} /></div>
        <div className="eg-scroll">
          <table className="dt">
            <thead><tr>{['SL', 'Email', 'Status', 'Source', 'Consent at', 'Confirmed at', 'IP', ''].map(h => <th key={h}>{tr(h)}</th>)}</tr></thead>
            <tbody>{consents.data.rows.map((c, i) => (
              <tr key={c.id}>
                <td><span className="sl">{slNo(consents, i)}</span></td>
                <td><b>{c.email}</b></td>
                <td><Pill s={c.status === 'Confirmed' ? 'Hired' : c.status === 'Pending' ? 'New' : 'Cancelled'} label={c.status} /></td>
                <td>{c.source}</td><td>{dateTimeF(c.at)}</td><td>{dateTimeF(c.confirmedAt)}</td>
                <td><span className="mono eg-ip">{c.ip}</span></td>
                <td>{c.status !== 'Confirmed' ? <button type="button" className="a-btn sm ghost" onClick={() => confirm(c.id)}>{tr('Confirm')}</button> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="eg-pad12"><Pager t={consents} /></div>
      </div>
    </>
  );
}
