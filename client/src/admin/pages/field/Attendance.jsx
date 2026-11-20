import { useEffect, useState } from 'react';
import { fld } from '../../adminApi.js';
import { Summary } from '../../ui.jsx';
import { Notice, usePaged } from '../../fieldKit.jsx';
import { saveTextFile } from '../../hooks/download.js';
import { hhmm, hours, Av, Chip } from './shared.jsx';
import { ATT, AttendanceModal } from './attendance/AttendanceModal.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/field.js';
import '../../field.css';

/** Daily attendance report: pick a day, filter by status, export CSV, open a person for the clock-in log. */
export function FieldAttendance() {
  const tr = useT();
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
  const shift = n => setDate(new Date(Date.parse((date || d?.date || '') + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10));
  const rows = (d?.rows || []).filter(r => (f === 'all' || r.status === f) && (!q.trim() || (r.name + ' ' + r.roleLabel).toLowerCase().includes(q.trim().toLowerCase())));
  const pg = usePaged(rows);
  const n = st => (d?.rows || []).filter(r => r.status === st).length;
  const exportCsv = () => {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = ['Name,Role,Phone,Status,Clock in,Clock out,Hours,Days this month', ...rows.map(r => [r.name, r.roleLabel, r.phone, r.status, hhmm(r.firstIn), hhmm(r.lastOut), hours(r.minutes), r.monthDays].map(esc).join(','))].join('\n');
    saveTextFile(`attendance-${d.date}.csv`, '﻿' + csv);
  };
  if (err && !d) return <Notice err={tr(err)} />;
  if (!d) return <span className="spin" />;
  return (
    <>
      <Summary items={[
        [tr('Present'), n('Present') + n('On duty'), tr('clocked in this day'), 'green', 'check'],
        [tr('On duty now'), n('On duty'), tr('not clocked out yet'), 'blue', 'clock'],
        [tr('On leave'), n('On leave'), tr('approved leave'), 'violet', 'users'],
        [tr('Absent'), n('Absent'), d.weeklyOff ? tr('Friday is the weekly off') : tr('no clock-in'), 'red', 'alert']
      ]} />
      <Notice err={err && tr(err)} />
      <section className="a-card">
        <div className="fd-bar">
          <div className="fd-date">
            <button type="button" className="a-mini" onClick={() => shift(-1)} aria-label={tr('Previous day')}>‹</button>
            <input type="date" className="a-input" value={d.date} max={d.today} onChange={e => e.target.value && setDate(e.target.value)} aria-label={tr('Day')} />
            <button type="button" className="a-mini" onClick={() => shift(1)} disabled={d.date >= d.today} aria-label={tr('Next day')}>›</button>
            {d.date !== d.today && <button type="button" className="a-mini" onClick={() => setDate('')}>{tr('Today')}</button>}
          </div>
          <input className="a-input fd-q" placeholder={tr('Search name or role…')} value={q} onChange={e => setQ(e.target.value)} aria-label={tr('Search the team')} />
          <button type="button" className="a-mini" onClick={exportCsv}>⤓ CSV</button>
        </div>
        <div className="fd-filters">{['all', 'Present', 'On duty', 'On leave', 'Absent', 'Weekly off'].map(k => <button key={k} type="button" className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'all' ? tr('All') : tr(k)}</button>)}</div>
        <div className="fd-tbl" role="table">
          <div className="fd-th att" role="row"><span>{tr('SL')}</span><span>{tr('Staff')}</span><span>{tr('Role')}</span><span>{tr('Phone')}</span><span>{tr('Status')}</span><span>{tr('Clock in')}</span><span>{tr('Clock out')}</span><span>{tr('Hours')}</span><span>{tr('Days this month')}</span></div>
          {pg.items.map((r, i) => (
            <div className="fd-tr att click" role="row" key={r.id} tabIndex={0} title={tr('Click to see the details')} onClick={() => setSel(r)} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(r))}>
              <span className="mono">{pg.start + i + 1}</span>
              <span className="fd-who"><Av name={r.name} /><span><b>{r.name}</b></span></span>
              <span>{tr(r.roleLabel)}</span>
              <span>{r.phone ? <a href={"tel:" + r.phone}>{r.phone}</a> : "—"}</span>
              <span><Chip tone={ATT[r.status] || 'off'}>{tr(r.status)}</Chip></span>
              <span>{hhmm(r.firstIn)}</span><span>{hhmm(r.lastOut)}</span><span>{hours(r.minutes)}</span><span>{r.monthDays}</span>
            </div>
          ))}
          {!rows.length && <div className="a-empty">{tr('No one matches.')}</div>}
        </div>
        {pg.bar}
        <small className="fd-sub">{tr('Times are Bangladesh time. A person counts as present once they hold-to-clock-in on the phone. Click a row for the details.')}</small>
      </section>
      {sel && <AttendanceModal sel={sel} date={d.date} onClose={() => setSel(null)} />}
    </>
  );
}
