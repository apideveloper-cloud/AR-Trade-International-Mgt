import { useEffect, useState } from 'react';
import { fld, useTable } from '../../adminApi.js';
import { periodOf } from '../../ListFilter.jsx';
import { Notice, Tabs, useFld } from '../../fieldKit.jsx';
import { VisitsTab } from './VisitsTab.jsx';
import { FollowupsTab } from './FollowupsTab.jsx';

/** Visits and follow-ups of one salesperson (a manager picks whose). */
export function FieldVisits() {
  const team = useFld('/team');
  const people = (team.data?.members || []).filter(m => ['rm', 'manager'].includes(m.role));
  const [sid, setSid] = useState('');
  const [tab, setTab] = useState('visits');
  const staff = sid || (people.find(p => p.role === 'rm')?.id ?? people[0]?.id ?? '');
  // visits open on today; the period is a day or a range, and `date` keeps the week strip on the first day of the period
  const day = periodOf('today');
  const v = useTable('/visits', { q: '', status: '', staff_id: '', date: day.from, ...day, size: 25 }, [], fld);
  const f = useTable('/followups', { q: '', bucket: 'all', status: '', staff_id: '', from: '', to: '', size: 25 }, [], fld);
  const who = staff ? String(staff) : '';
  useEffect(() => {
    if (v.params.staff_id !== who) v.set({ staff_id: who });
    if (f.params.staff_id !== who) f.set({ staff_id: who });
  }, [who]); // eslint-disable-line react-hooks/exhaustive-deps
  const vt = { ...v, set: patch => v.set('from' in patch ? { ...patch, date: patch.from || '' } : patch) };
  const [msg, setMsg] = useState('');
  /** Marks a follow-up done or reopens it; resolves true when the server accepted it. */
  const act = async (id, what, body) => {
    setMsg('');
    try { await fld.put(`/followups/${id}/${what}`, body); f.reload(); return true; } catch (e) { setMsg(e.message); return false; }
  };
  const fc = f.data.counts || {};
  return (
    <>
      <Notice err={v.error || f.error || msg} />
      <section className="a-card">
        <div className="fd-bar">
          <label className="fd-sel">Salesperson
            <select className="a-input" value={staff} onChange={e => setSid(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.roleLabel}</option>)}{!people.length && <option value="">Me</option>}</select>
          </label>
          <Tabs value={tab} onChange={setTab} items={[['visits', 'Visits'], ['follow', 'Follow-ups', fc.open]]} />
        </div>
      </section>
      {tab === 'visits' && <VisitsTab v={v} vt={vt} />}
      {tab === 'follow' && <FollowupsTab f={f} act={act} />}
    </>
  );
}
