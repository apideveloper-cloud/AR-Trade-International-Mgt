import { useEffect, useState } from 'react';
import { fld } from '../../adminApi.js';
import { Modal, Summary } from '../../ui.jsx';
import { Facts, Notice, usePaged } from '../../fieldKit.jsx';
import { hhmm, hours, Av, Chip, osm } from './shared.jsx';
import '../../field.css';

const ATT = { Present: 'ok', 'On duty': 'blue', 'On leave': 'violet', Absent: 'bad', 'Weekly off': 'off', '—': 'off' };

export function FieldAttendance() {
  const [date, setDate] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState('all');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  useEffect(() => {
    let stale = false;
    setErr('');
    fld.get('/attendance/report' + (date ? '?date=' + date : '')).then(r => { if (!stale) setD(r); }).catch(e => { if (!stale) setErr(e.message); });
    return () => { stale = true; };
  }, [date]);
  const shift = n => setDate(new Date(Date.parse((d?.date || '') + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10));
  const rows = (d?.rows || []).filter(r => (f === 'all' || r.status === f) && (!q.trim() || (r.name + ' ' + r.roleLabel).toLowerCase().includes(q.trim().toLowerCase())));
  const pg = usePaged(rows);
  const n = st => (d?.rows || []).filter(r => r.status === st).length;
  const exportCsv = () => {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = ['Name,Role,Phone,Status,Clock in,Clock out,Hours,Days this month', ...rows.map(r => [r.name, r.roleLabel, r.phone, r.status, hhmm(r.firstIn), hhmm(r.lastOut), hours(r.minutes), r.monthDays].map(esc).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: `attendance-${d.date}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  if (err && !d) return <Notice err={err} />;
  if (!d) return <span className="spin" />;
  return (
    <>
      <Summary items={[
        ['Present', n('Present') + n('On duty'), 'clocked in this day', 'green', 'check'],
        ['On duty now', n('On duty'), 'not clocked out yet', 'blue', 'clock'],
        ['On leave', n('On leave'), 'approved leave', 'violet', 'users'],
        ['Absent', n('Absent'), d.weeklyOff ? 'Friday is the weekly off' : 'no clock-in', 'red', 'alert']
      ]} />
      <Notice err={err} />
      <section className="a-card">
        <div className="fd-bar">
          <div className="fd-date">
            <button type="button" className="a-mini" onClick={() => shift(-1)} aria-label="Previous day">‹</button>
            <input type="date" className="a-input" value={d.date} max={d.today} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Day" />
            <button type="button" className="a-mini" onClick={() => shift(1)} disabled={d.date >= d.today} aria-label="Next day">›</button>
            {d.date !== d.today && <button type="button" className="a-mini" onClick={() => setDate('')}>Today</button>}
          </div>
          <input className="a-input fd-q" placeholder="Search name or role…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the team" />
          <button type="button" className="a-mini" onClick={exportCsv}>⤓ CSV</button>
        </div>
        <div className="fd-filters">{['all', 'Present', 'On duty', 'On leave', 'Absent', 'Weekly off'].map(k => <button key={k} type="button" className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'all' ? 'All' : k}</button>)}</div>
        <div className="fd-tbl" role="table">
          <div className="fd-th att" role="row"><span>SL</span><span>Staff</span><span>Role</span><span>Phone</span><span>Status</span><span>Clock in</span><span>Clock out</span><span>Hours</span><span>Days this month</span></div>
          {pg.items.map((r, i) => (
            <div className="fd-tr att click" role="row" key={r.id} tabIndex={0} title="Click to see the details" onClick={() => setSel(r)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(r))}>
              <span className="mono">{pg.start + i + 1}</span>
              <span className="fd-who"><Av name={r.name} /><span><b>{r.name}</b></span></span>
              <span>{r.roleLabel}</span>
              <span>{r.phone ? <a href={"tel:" + r.phone}>{r.phone}</a> : "—"}</span>
              <span><Chip tone={ATT[r.status] || 'off'}>{r.status}</Chip></span>
              <span>{hhmm(r.firstIn)}</span><span>{hhmm(r.lastOut)}</span><span>{hours(r.minutes)}</span><span>{r.monthDays}</span>
            </div>
          ))}
          {!rows.length && <div className="a-empty">No one matches.</div>}
        </div>
        {pg.bar}
        <small className="fd-sub">Times are Bangladesh time. A person counts as present once they hold-to-clock-in on the phone. Click a row for the details.</small>
      </section>
      {sel && (
        <Modal kicker="Attendance" title={sel.name} narrow cls="att-modal" onClose={() => setSel(null)} footer={<button type="button" className="a-btn" onClick={() => setSel(null)}>Close</button>}>
          <div className="att-hd"><Av name={sel.name} /><div><b>{sel.name}</b><small>{sel.roleLabel} · {d.date}</small></div><Chip tone={ATT[sel.status] || "off"}>{sel.status}</Chip></div>
          <Facts cols="att-facts" items={[['Clock in', hhmm(sel.firstIn)], ['Clock out', hhmm(sel.lastOut)], ['Hours', hours(sel.minutes)], ['Days this month', sel.monthDays]]} />
          {sel.phone && <div className="att-call"><a className="a-mini" href={"tel:" + sel.phone}>Call {sel.phone}</a><a className="a-mini" href={"sms:" + sel.phone}>Message</a></div>}
          <h4 className="att-h4">Clock-in and clock-out on {d.date}</h4>
          {sel.punches.length ? (
            <ol className="att-log">{sel.punches.map((p, i) => (
              <li key={i} className={p.type === "Clocked In" ? "in" : "out"}><b>{hhmm(p.at)}</b><span>{p.type}</span>{p.lat != null ? <a href={osm(p.lat, p.lng)} target="_blank" rel="noreferrer">Location ↗</a> : <em>no location</em>}</li>
            ))}</ol>
          ) : <p className="fd-sub">{sel.status === "On leave" ? "On approved leave this day." : "No clock-in or clock-out this day."}</p>}
        </Modal>
      )}
    </>
  );
}
