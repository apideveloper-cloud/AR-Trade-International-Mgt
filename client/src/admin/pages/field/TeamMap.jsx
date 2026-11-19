import { useMemo, useState } from 'react';
import { Summary } from '../../ui.jsx';
import { Notice } from '../../fieldKit.jsx';
import { hhmm, STATE, DOT } from './shared.jsx';
import { TeamMapSvg } from './teamMap/TeamMapSvg.jsx';
import { LiveMap } from './teamMap/LiveMap.jsx';
import { MemberRow } from './teamMap/MemberRow.jsx';
import { MemberModal } from './teamMap/MemberModal.jsx';
import { useFullscreen } from './teamMap/useFullscreen.js';
import { useTeam } from './teamMap/useTeam.js';
import '../../field.css';

/** Live team map (street map or distance view), the searchable team list and a details popup. */
export function FieldTeamMap() {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState('all');
  const [view, setView] = useState('street'); // street map or the distance diagram (works without internet)
  const [info, setInfo] = useState(null); // the team member open in the details popup
  const { ref: cardRef, full, toggle: toggleFull } = useFullscreen();
  const { d, err, route, load } = useTeam(sel);

  const members = useMemo(() => d?.members || [], [d]);
  const count = st => members.filter(m => m.status === st).length;
  const list = useMemo(() => members
    .filter(m => (flt === 'all' || m.status === flt) && (!q.trim() || (m.name + ' ' + m.roleLabel).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name)), [members, flt, q]);
  const picked = members.find(m => m.id === sel);
  const who = info && members.find(m => m.id === info);
  const pickToggle = id => setSel(sel === id ? null : id);

  if (err && !d) return <Notice err={err} onRetry={load} />;
  if (!d) return <span className="spin" />;
  return (
    <>
      <Summary items={[
        ['On duty now', members.filter(m => m.online).length, 'clocked in on the phone', 'green', 'check'],
        ['In office', count('In office'), 'at the head office', 'blue', 'box'],
        ['At a client', count('At client'), 'visit in progress', 'violet', 'users'],
        ['Off route', count('Off route'), 'outside the work zone', 'red', 'alert'],
        ['Offline', count('Offline'), 'not clocked in', 'amber', 'clock']
      ]} />
      <Notice err={err} />
      <div className="fd-split">
        <section ref={cardRef} className={'a-card fd-mapcard' + (full ? ' full' : '')}>
          <div className="card-hd"><div><h3>Live team map</h3><small className="fd-sub">Around the head office · updates every 30 seconds · last update {hhmm(d.updatedAt)}</small></div><div className="fd-vt"><div className="fd-seg" role="group" aria-label="Map type"><button type="button" className={view === 'street' ? 'on' : ''} onClick={() => setView('street')}>Street map</button><button type="button" className={view === 'radar' ? 'on' : ''} onClick={() => setView('radar')}>Distance view</button></div><button type="button" className="a-mini" onClick={load}>↻ Refresh</button><button type="button" className="a-mini" onClick={toggleFull} aria-pressed={full}>{full ? '✕ Exit full screen' : '⛶ Full screen'}</button></div></div>
          {view === 'street' ? <LiveMap office={d.office} members={members} route={route} sel={sel} onPick={setSel} /> : <TeamMapSvg office={d.office} members={members} route={route} sel={sel} onPick={setSel} />}
          <small className="fd-attr">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors</small>
          {full && (
            <div className="fd-fulllist" aria-label="People on the map">
              {members.filter(m => m.lat != null).map(m => <button key={m.id} type="button" className={sel === m.id ? 'on' : ''} onClick={() => pickToggle(m.id)}><i style={{ background: DOT[STATE[m.status] || 'off'] }} />{m.name}<small>{m.status}</small></button>)}
            </div>
          )}
          <div className="fd-legend">{Object.entries(STATE).map(([k, t]) => <span key={k}><i style={{ background: DOT[t] }} />{k}</span>)}<span className="fd-note">{view === 'street' ? 'Click a person to see today\'s route. The dashed circle is the 10 km work zone.' : 'Distance view: how far each person is from the head office. Switch to Street map for roads.'}</span></div>
          {picked && <div className="fd-picked"><b>{picked.name}</b> · {picked.place || (picked.lat != null ? 'position known' : 'no position yet')} · {route.length ? `${route.length} GPS points today` : 'no route points today'}</div>}
        </section>
        <section className="a-card fd-listcard">
          <div className="card-hd"><h3>Team</h3><span className="chip">{list.length}</span></div>
          <input className="a-input" placeholder="Search name or role…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search the team" />
          <div className="fd-filters">{['all', ...Object.keys(STATE)].map(k => <button key={k} type="button" className={flt === k ? 'on' : ''} onClick={() => setFlt(k)}>{k === 'all' ? 'All' : k}</button>)}</div>
          <div className="fd-list">
            {list.map(m => <MemberRow key={m.id} m={m} selected={sel === m.id} onSelect={() => pickToggle(m.id)} onInfo={() => setInfo(m.id)} />)}
            {!list.length && <div className="a-empty">No one matches.</div>}
          </div>
        </section>
      </div>
      {who && <MemberModal who={who} onShow={id => { setSel(id); setInfo(null); }} onClose={() => setInfo(null)} />}
    </>
  );
}
