import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fld, fmtMoney, viewFieldFile } from '../adminApi.js';
import { Summary, Switch, hueOf } from '../ui.jsx';
import { Notice, usePaged } from '../fieldKit.jsx';
import '../field.css';

// Web views of the field app: live team map, attendance, approvals and the module switches. They talk to /api/field with the staff token.
const BD = 'Asia/Dhaka';
const hhmm = iso => (iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: BD, hour: '2-digit', minute: '2-digit' }) : '—');
const dayTime = iso => (iso ? new Date(iso).toLocaleString('en-GB', { timeZone: BD, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const hours = m => (m > 0 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '—');
const ago = sec => (sec == null ? 'no signal yet' : sec < 90 ? 'just now' : sec < 3600 ? Math.round(sec / 60) + ' min ago' : sec < 86400 ? Math.round(sec / 3600) + ' h ago' : Math.round(sec / 86400) + ' d ago');
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const Av = ({ name }) => <span className="fd-av" style={{ '--h': hueOf(name) }}>{initials(name)}</span>;
const Ic = ({ d }) => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICON_CALL = <path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 0 0 5 5l1.3-2 4 1.6V17a2 2 0 0 1-2 2A13 13 0 0 1 3 6a2 2 0 0 1 2-2z" />;
const ICON_MSG = <><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M7.5 10h9M7.5 13h5.5" /></>;
const ICON_PIN = <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.4" /></>;
const Chip = ({ tone, children }) => <span className={'fd-chip ' + tone}>{children}</span>;
const osm = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
const STATE = { 'In office': 'ok', 'On duty': 'blue', 'At client': 'violet', 'Off route': 'bad', Offline: 'off' };
const DOT = { ok: '#1fa463', blue: '#2f7de1', violet: '#7a5af0', bad: '#e0483c', off: '#9aa3b5' };


/* ---------------- 1. live team map ---------------- */
function TeamMapSvg({ office, members, route, sel, onPick }) {
  const W = 640, H = 460, cx = W / 2, cy = H / 2;
  const kmX = lng => (lng - office.lng) * Math.cos((office.lat * Math.PI) / 180) * 111.32;
  const kmY = lat => (lat - office.lat) * 110.57;
  const placed = members.filter(m => m.lat != null);
  const far = Math.max(10, ...placed.map(m => Math.hypot(kmX(m.lng), kmY(m.lat))), ...route.map(p => Math.hypot(kmX(p.lng), kmY(p.lat)))) * 1.12;
  const s = (Math.min(W, H) / 2 - 22) / far; // pixels per km
  const px = p => [cx + kmX(p.lng) * s, cy - kmY(p.lat) * s];
  // people standing in the same spot would hide each other: fan them out around it (the map is schematic, so this is only for display)
  const spot = new Map(), seen = new Map();
  for (const m of placed) { const [x, y] = px(m), k = Math.round(x / 22) + ':' + Math.round(y / 22); spot.set(k, (spot.get(k) || 0) + 1); }
  const place = m => {
    const [x, y] = px(m), k = Math.round(x / 22) + ':' + Math.round(y / 22), n = spot.get(k);
    if (n < 2) return [x, y];
    const i = seen.get(k) || 0; seen.set(k, i + 1);
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [x + Math.cos(a) * 15, y + Math.sin(a) * 15];
  };
  const step = far > 40 ? 10 : far > 20 ? 5 : 2.5;
  const rings = []; for (let r = step; r <= far; r += step) rings.push(r);
  const line = route.map(p => px(p).map(n => n.toFixed(1)).join(',')).join(' ');
  const end = route.length ? px(route[route.length - 1]) : null, start = route.length ? px(route[0]) : null;
  return (
    <svg className="fd-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Where the team is, around the head office">
      <rect width={W} height={H} rx="16" fill="#f3f7fd" />
      {[...Array(9)].map((_, i) => <line key={'v' + i} x1={(W / 8) * i} x2={(W / 8) * i} y1="0" y2={H} stroke="#e4ebf6" />)}
      {[...Array(7)].map((_, i) => <line key={'h' + i} y1={(H / 6) * i} y2={(H / 6) * i} x1="0" x2={W} stroke="#e4ebf6" />)}
      {rings.map(r => <g key={r}><circle cx={cx} cy={cy} r={r * s} fill="none" stroke={r === 10 ? '#e0483c' : '#c9d6ea'} strokeDasharray={r === 10 ? '6 5' : '3 5'} strokeWidth={r === 10 ? 1.6 : 1} /><text x={cx} y={cy - r * s - 4} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={r === 10 ? '#c23a2f' : '#7d8aa1'} stroke="#f3f7fd" strokeWidth="3.5" paintOrder="stroke">{r} km{r === 10 ? ' · work zone' : ''}</text></g>)}
      {line && <polyline points={line} fill="none" stroke="#2f7de1" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity=".85" />}
      {start && <circle cx={start[0]} cy={start[1]} r="5" fill="#fff" stroke="#2f7de1" strokeWidth="3" />}
      {end && <circle cx={end[0]} cy={end[1]} r="4" fill="#2f7de1" />}
      <g transform={`translate(${cx - 12} ${cy - 12})`}><rect width="24" height="24" rx="7" fill="#0b1631" /><path d="M6 17V8l6-3 6 3v9M9.5 17v-4h5v4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" /></g>
      <text x={cx} y={cy + 44} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0b1631" stroke="#f3f7fd" strokeWidth="3.5" paintOrder="stroke">Head office</text>
      {[...placed].sort((a, b) => (a.id === sel) - (b.id === sel)).map(m => {
        const [x, y] = place(m), tone = STATE[m.status] || 'off', on = sel === m.id;
        return (
          <g key={m.id} className="fd-pin" transform={`translate(${x} ${y})`} onClick={() => onPick(on ? null : m.id)} style={{ cursor: 'pointer' }}>
            <title>{m.name} · {m.status}</title>
            {m.online && <circle r="15" fill={DOT[tone]} opacity=".16"><animate attributeName="r" values="11;19;11" dur="2.4s" repeatCount="indefinite" /></circle>}
            <circle r={on ? 12 : 10} fill={DOT[tone]} stroke="#fff" strokeWidth={on ? 3.2 : 2.4} />
            <text textAnchor="middle" y="3.6" fontSize="9.5" fontWeight="800" fill="#fff">{initials(m.name)}</text>
            {on && <text y="-17" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#0b1631" stroke="#fff" strokeWidth="3.5" paintOrder="stroke">{m.name}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** The real street map (OpenStreetMap tiles through Leaflet): head office, the 10 km work zone, every person on the map and the picked person's route. */
function LiveMap({ office, members, route, sel, onPick }) {
  const box = useRef(null), map = useRef(null), layer = useRef(null), fitted = useRef(false), lastSel = useRef(null), pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const m = L.map(box.current, { scrollWheelZoom: true, attributionControl: false }).setView([office.lat, office.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const t = setTimeout(() => m.invalidateSize(), 50);
    const ro = new ResizeObserver(() => m.invalidateSize()); // full screen and window resizes
    ro.observe(box.current);
    return () => { clearTimeout(t); ro.disconnect(); m.remove(); map.current = null; fitted.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = map.current, g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    L.circle([office.lat, office.lng], { radius: 10000, color: '#e0483c', weight: 2, dashArray: '8 6', fillColor: '#e0483c', fillOpacity: 0.035 }).addTo(g);
    L.marker([office.lat, office.lng], { icon: L.divIcon({ className: 'fd-lw', html: '<div class="fd-lpin office">HQ</div>', iconSize: [38, 38], iconAnchor: [19, 19] }), zIndexOffset: 500 }).bindTooltip('Head office', { direction: 'top', offset: [0, -18] }).addTo(g);
    const pts = [[office.lat, office.lng]];
    for (const p of members.filter(x => x.lat != null)) {
      const tone = STATE[p.status] || 'off';
      const card = document.createElement('div');
      const nm = document.createElement('b'); nm.textContent = p.name; card.appendChild(nm);
      for (const line of [p.roleLabel + ' · ' + p.status, p.place || '', (p.km || 0) + ' km today' + (p.visits ? ' · ' + p.visits.done + '/' + p.visits.total + ' visits' : ''), 'Seen ' + ago(p.ageSec)]) { if (!line) continue; const d = document.createElement('div'); d.textContent = line; card.appendChild(d); }
      const mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'fd-lw', html: '<div class="fd-lpin' + (p.online ? ' live' : '') + (sel === p.id ? ' sel' : '') + '" style="--c:' + DOT[tone] + '">' + initials(p.name).replace(/[^A-Za-z0-9ঀ-৿]/g, '') + '</div>', iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: sel === p.id ? 900 : 100 })
        .bindPopup(card, { offset: [0, -14] }).on('click', () => pick.current(sel === p.id ? null : p.id)).addTo(g);
      if (sel === p.id) mk.openPopup();
      pts.push([p.lat, p.lng]);
    }
    if (route.length > 1) {
      const line = route.map(r => [r.lat, r.lng]);
      L.polyline(line, { color: '#2f7de1', weight: 5, opacity: 0.85 }).addTo(g);
      L.circleMarker(line[0], { radius: 6, color: '#2f7de1', weight: 3, fillColor: '#fff', fillOpacity: 1 }).bindTooltip('Start of the day').addTo(g);
    }
    if (!fitted.current) { m.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); fitted.current = true; }
    if (sel !== lastSel.current) {
      lastSel.current = sel;
      const me = members.find(x => x.id === sel);
      if (sel && route.length > 1) m.fitBounds(route.map(r => [r.lat, r.lng]), { padding: [50, 50], maxZoom: 16 });
      else if (me && me.lat != null) m.setView([me.lat, me.lng], Math.max(m.getZoom(), 14));
    }
  }, [office, members, route, sel]);
  return <div ref={box} className="fd-lmap" role="application" aria-label="Street map of the team" />;
}

export function FieldTeamMap() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [route, setRoute] = useState([]);
  const [q, setQ] = useState('');
  const [flt, setFlt] = useState('all');
  const [view, setView] = useState('street'); // street map or the distance diagram (works without internet)
  const [full, setFull] = useState(false);
  const cardRef = useRef(null);
  const toggleFull = () => {
    if (full) { setFull(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); return; }
    setFull(true);
    cardRef.current?.requestFullscreen?.().catch(() => {}); // the page-wide overlay below still works where the browser refuses
  };
  useEffect(() => {
    if (!full) return undefined;
    const key = e => { if (e.key === 'Escape') setFull(false); };
    const fs = () => { if (!document.fullscreenElement) setFull(false); };
    window.addEventListener('keydown', key); document.addEventListener('fullscreenchange', fs);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fs); };
  }, [full]);
  const load = useCallback(() => fld.get('/team').then(r => { setD(r); setErr(''); }).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!sel) { setRoute([]); return undefined; }
    let stale = false;
    fld.get('/team/' + sel + '/route').then(r => { if (!stale) setRoute(r); }).catch(() => { if (!stale) setRoute([]); });
    return () => { stale = true; };
  }, [sel, d?.updatedAt]);

  const members = d?.members || [];
  const count = st => members.filter(m => m.status === st).length;
  const list = useMemo(() => members
    .filter(m => (flt === 'all' || m.status === flt) && (!q.trim() || (m.name + ' ' + m.roleLabel).toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name)), [members, flt, q]);
  const picked = members.find(m => m.id === sel);

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
              {members.filter(m => m.lat != null).map(m => <button key={m.id} type="button" className={sel === m.id ? 'on' : ''} onClick={() => setSel(sel === m.id ? null : m.id)}><i style={{ background: DOT[STATE[m.status] || 'off'] }} />{m.name}<small>{m.status}</small></button>)}
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
            {list.map(m => (
              <div key={m.id} className={'fd-m' + (sel === m.id ? ' sel' : '') + (m.online ? '' : ' idle')} style={{ '--c': DOT[STATE[m.status] || 'off'] }}>
                <button type="button" className="fd-mhead" onClick={() => setSel(sel === m.id ? null : m.id)}>
                  <Av name={m.name} />
                  <span className="fd-mt"><b>{m.name}{m.me && <em> you</em>}</b><small>{m.roleLabel}</small></span>
                  <Chip tone={STATE[m.status] || 'off'}>{m.status}</Chip>
                </button>
                <div className="fd-mrow">
                  <span className="fd-mmeta">
                    <span title="Distance today">🛣 {m.km} km</span>
                    {m.visits && <span title="Visits done / planned">📍 {m.visits.done}/{m.visits.total}</span>}
                    <span title="Clock-in time">⏱ {m.clockIn ? hhmm(m.clockIn) : '—'}</span>
                    {m.online && <span title="Last signal">● {ago(m.ageSec)}</span>}
                  </span>
                  <span className="fd-macts">
                    {m.phone && <a className="fd-ib call" href={'tel:' + m.phone} title={'Call ' + m.name + ' (' + m.phone + ')'} aria-label={'Call ' + m.name}><Ic d={ICON_CALL} /></a>}
                    {m.phone && <a className="fd-ib msg" href={'sms:' + m.phone} title={'Send ' + m.name + ' a text message'} aria-label={'Message ' + m.name}><Ic d={ICON_MSG} /></a>}
                    {m.lat != null && <a className="fd-ib pin" href={osm(m.lat, m.lng)} target="_blank" rel="noreferrer" title="Open this position on OpenStreetMap" aria-label={'Open ' + m.name + ' on the map'}><Ic d={ICON_PIN} /></a>}
                  </span>
                </div>
                {m.place && <div className="fd-place">{m.place}</div>}
              </div>
            ))}
            {!list.length && <div className="a-empty">No one matches.</div>}
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------------- 2. attendance ---------------- */
const ATT = { Present: 'ok', 'On duty': 'blue', 'On leave': 'violet', Absent: 'bad', 'Weekly off': 'off', '—': 'off' };

export function FieldAttendance() {
  const [date, setDate] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState('all');
  const [q, setQ] = useState('');
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
    const csv = ['Name,Role,Status,Clock in,Clock out,Hours,Days this month', ...rows.map(r => [r.name, r.roleLabel, r.status, hhmm(r.firstIn), hhmm(r.lastOut), hours(r.minutes), r.monthDays].map(esc).join(','))].join('\n');
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
          <div className="fd-th" role="row"><span>SL</span><span>Staff</span><span>Status</span><span>Clock in</span><span>Clock out</span><span>Hours</span><span>Days this month</span></div>
          {pg.items.map((r, i) => (
            <div className="fd-tr" role="row" key={r.id}>
              <span className="mono">{pg.start + i + 1}</span>
              <span className="fd-who"><Av name={r.name} /><span><b>{r.name}</b><small>{r.roleLabel}</small></span></span>
              <span><Chip tone={ATT[r.status] || 'off'}>{r.status}</Chip></span>
              <span>{hhmm(r.firstIn)}</span><span>{hhmm(r.lastOut)}</span><span>{hours(r.minutes)}</span><span>{r.monthDays}</span>
            </div>
          ))}
          {!rows.length && <div className="a-empty">No one matches.</div>}
        </div>
        {pg.bar}
        <small className="fd-sub">Times are Bangladesh time. A person counts as present once they hold-to-clock-in on the phone.</small>
      </section>
    </>
  );
}

/* ---------------- 3. approvals: expenses and leave ---------------- */
export function FieldApprovals({ staff }) {
  const [sum, setSum] = useState(null);
  const [tab, setTab] = useState('expenses');
  const [exp, setExp] = useState(null);
  const [lv, setLv] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [rej, setRej] = useState(null);
  const load = useCallback(async () => {
    try {
      const s = await fld.get('/approvals/summary');
      setSum(s);
      if (s.kinds.includes('expenses')) setExp((await fld.get('/approvals/expenses')).items);
      if (s.kinds.includes('leave')) setLv((await fld.get('/leave/pending')).items);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const [aq, setAq] = useState('');
  const listNow = (!sum ? [] : ((sum.kinds.includes(tab) ? tab : sum.kinds.includes('expenses') ? 'expenses' : 'leave') === 'leave' ? lv : exp) || []).filter(it => !aq.trim() || JSON.stringify(it).toLowerCase().includes(aq.trim().toLowerCase()));
  const pgA = usePaged(listNow);
  const decide = async (kind, id, status, remarks = '') => {
    setBusy(kind + id); setErr('');
    try { await fld.put(`/${kind === 'expenses' ? 'expenses' : 'leave'}/${id}/decision`, { status, remarks }); setRej(null); await load(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  if (err && !sum) return <Notice err={err} />;
  if (!sum) return <span className="spin" />;
  const kinds = sum.kinds.filter(k => k === 'expenses' || k === 'leave');
  if (!kinds.length) return <div className="a-empty">Your role does not approve expenses or leave.</div>;
  const active = kinds.includes(tab) ? tab : kinds[0];
  const items = active === 'expenses' ? exp : lv;
  const other = [['purchase', 'purchase orders'], ['orders', 'sales orders']].filter(([k]) => sum.kinds.includes(k) && sum.counts[k] > 0);
  const form = (kind, id) => (rej && rej.kind === kind && rej.id === id ? (
    <div className="fd-rej">
      <textarea className="a-input" rows={2} placeholder="Reason for rejecting (the person will see this)" value={rej.text} onChange={e => setRej({ ...rej, text: e.target.value })} autoFocus />
      <div><button type="button" className="a-mini" onClick={() => setRej(null)}>Cancel</button><button type="button" className="a-mini bad" disabled={!rej.text.trim() || busy} onClick={() => decide(kind, id, 'rejected', rej.text.trim())}>Confirm reject</button></div>
    </div>
  ) : null);
  return (
    <>
      <Summary items={[
        ['Expenses waiting', sum.counts.expenses, 'claims to decide', 'amber', 'money'],
        ['Leave waiting', sum.counts.leave, 'requests to decide', 'violet', 'clock'],
        ['Purchase orders', sum.counts.purchase, 'in the mobile app', 'blue', 'cart'],
        ['Sales orders', sum.counts.orders, 'in the mobile app', 'green', 'box']
      ]} />
      <Notice err={err} />
      <section className="a-card">
        <div className="fd-tabs">{kinds.map(k => <button key={k} type="button" className={active === k ? 'on' : ''} onClick={() => setTab(k)}>{k === 'expenses' ? 'Expense claims' : 'Leave requests'}{sum.counts[k] > 0 && <em>{sum.counts[k]}</em>}</button>)}</div>
        {!items && <span className="spin" />}
        {items && !items.length && <div className="a-empty">Nothing here yet.</div>}
        <input className="a-input fd-q" type="search" placeholder="Search by name, title or reason…" value={aq} onChange={e => setAq(e.target.value)} aria-label="Search approvals" />
        <div className="fd-appr">
          {pgA.items.map(it => {
            const pending = active === 'expenses' ? it.status === 'pending' : it.status === 'open';
            const tone = pending ? 'amber' : it.status === 'approved' ? 'ok' : it.status === 'rejected' ? 'bad' : 'off';
            return (
              <div key={it.id} className={'fd-ap' + (pending ? ' open' : '')}>
                <Av name={it.employeeName || it.name} />
                <div className="fd-apb">
                  <div className="fd-aph"><b>{it.employeeName || it.name}</b><Chip tone={tone}>{pending ? 'Waiting' : it.status}</Chip></div>
                  {active === 'expenses'
                    ? <><div className="fd-aps">{it.title} · <em>{it.category}</em></div><div className="fd-apm"><strong>{fmtMoney(it.amount)}</strong><span>{dayTime(it.date)}</span>{it.voucher && <button type="button" className="fd-lnk" onClick={() => viewFieldFile(it.voucher).catch(e => setErr(e.message))}>View voucher</button>}</div></>
                    : <><div className="fd-aps">{it.type} leave · <em>{it.dates}</em> · {it.days} day{it.days === 1 ? '' : 's'}</div><div className="fd-apm"><span>{it.reason}</span></div></>}
                  {!pending && (it.decidedBy || it.remarks) && <div className="fd-apd">{it.decidedBy && <>Decided by {it.decidedBy}. </>}{it.remarks}</div>}
                  {form(active, it.id)}
                </div>
                {pending && !(rej && rej.kind === active && rej.id === it.id) && (
                  <div className="fd-apa">
                    <button type="button" className="a-mini ok" disabled={!!busy} onClick={() => decide(active, it.id, 'approved')}>{busy === active + it.id ? '…' : 'Approve'}</button>
                    <button type="button" className="a-mini" disabled={!!busy} onClick={() => setRej({ kind: active, id: it.id, text: '' })}>Reject</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {pgA.bar}
        {other.length > 0 && <small className="fd-sub">Also waiting: {other.map(([k, l]) => `${sum.counts[k]} ${l}`).join(', ')}. Those are decided in the mobile app.</small>}
        {staff && <small className="fd-sub">You cannot decide your own claims or leave.</small>}
      </section>
    </>
  );
}

/* ---------------- 4. field app module switches ---------------- */
const ROLES = [['manager', 'Manager'], ['accountant', 'Accountant'], ['purchase', 'Purchase'], ['rm', 'RM'], ['field', 'Field Officer']];
const ROLE_H = { manager: 160, accountant: 300, purchase: 45, rm: 20, field: 195 };
const MOD_GROUPS = [
  ['Attendance and tracking', 230, ['attendance', 'tracking', 'team', 'leave']],
  ['Sales and customers', 160, ['customers', 'visits', 'sales', 'delivery', 'collection']],
  ['Money and approvals', 75, ['expenses', 'approvals', 'purchase', 'reports']],
  ['Communication', 300, ['notifications', 'contacts']]
];
const MOD_ICON = { attendance: '⏱', tracking: '📍', team: '🗺', leave: '🌴', notifications: '🔔', expenses: '🧾', approvals: '✅', customers: '👥', visits: '📅', sales: '🛒', delivery: '🚚', collection: '💵', purchase: '📦', reports: '📊', contacts: '📞' };

export function FieldModules() {
  const [cfg, setCfg] = useState(null);
  const [autos, setAutos] = useState(null);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState('');
  const load = useCallback(async () => {
    try { const [c, a] = await Promise.all([fld.get('/modules/config'), fld.get('/admin/automation')]); setCfg(c); setAutos(a); setErr(''); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const saveModule = async (m, patch) => {
    const before = cfg;
    setCfg({ ...cfg, modules: cfg.modules.map(x => (x.key === m.key ? { ...x, ...patch } : x)) });
    try { await fld.put('/modules/config/' + m.key, patch); setSaved(`${m.label} saved`); setErr(''); } catch (e) { setCfg(before); setErr(e.message); }
  };
  const toggleRole = (m, r) => saveModule(m, { roles: m.roles.includes(r) ? m.roles.filter(x => x !== r) : [...m.roles, r] });
  const toggleAuto = async a => {
    const before = autos;
    setAutos(autos.map(x => (x.key === a.key ? { ...x, enabled: !a.enabled } : x)));
    try { await fld.put('/admin/automation/' + a.key, { enabled: !a.enabled }); setSaved(`${a.title} ${a.enabled ? 'paused' : 'running'}`); await load(); } catch (e) { setAutos(before); setErr(e.message); }
  };
  if (err && !cfg) return <Notice err={err} />;
  if (!cfg) return <span className="spin" />;
  return (
    <>
      <Notice err={err} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Mobile app modules</h3><small className="fd-sub">Switch a module off for everyone, or choose which roles see it. Admins always keep every module. Changes reach the phones within a few seconds.</small></div>{saved && <span className="fd-saved">✓ {saved}</span>}</div>
        <div className="fm" role="table" aria-label="Which role sees which module">
          <div className="fm-head" role="row"><span>Module</span><span>On</span>{ROLES.map(([k, l]) => <span key={k} style={{ '--h': ROLE_H[k] }}>{l}</span>)}<span className="fm-end">Quick set</span></div>
          {MOD_GROUPS.map(([gname, hue, keys]) => {
            const rows = cfg.modules.filter(m => keys.includes(m.key));
            if (!rows.length) return null;
            return (
              <div key={gname} className="fm-grp" style={{ '--g': hue }}>
                <div className="fm-gh"><b>{gname}</b><small>{rows.filter(m => m.enabled).length} of {rows.length} on</small></div>
                {rows.map(m => (
                  <div key={m.key} className={'fm-row' + (m.enabled ? '' : ' off')} role="row">
                    <span className="fm-name"><i>{MOD_ICON[m.key] || '•'}</i><span><b>{m.label}</b><small>{m.bn}</small></span></span>
                    <span><Switch on={m.enabled} onChange={on => saveModule(m, { enabled: on })} title={m.enabled ? 'Turn off for everyone' : 'Turn on'} /></span>
                    {ROLES.map(([k, l]) => (
                      <span key={k} className="fm-c" style={{ '--h': ROLE_H[k] }}>
                        <button type="button" disabled={!m.enabled} className={'fm-cb' + (m.roles.includes(k) ? ' on' : '')} aria-pressed={m.roles.includes(k)} aria-label={`${l} can use ${m.label}`} title={`${l}: ${m.roles.includes(k) ? 'can use' : 'cannot use'} ${m.label}`} onClick={() => toggleRole(m, k)}>{m.roles.includes(k) ? '✓' : ''}</button>
                      </span>
                    ))}
                    <span className="fm-end"><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => saveModule(m, { roles: ROLES.map(r => r[0]) })}>All</button><button type="button" className="fm-q" disabled={!m.enabled} onClick={() => saveModule(m, { roles: [] })}>None</button></span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <small className="fd-sub">Admins always keep every module, so they are not in the grid. A module that is off disappears for everyone, whatever the ticks say.</small>
      </section>
      {autos && (
        <section className="a-card">
          <div className="card-hd"><h3>Automations</h3></div>
          <div className="fd-autos">
            {autos.map(a => (
              <div key={a.key} className="fd-auto">
                <span className="fd-mt"><b>{a.title}</b><small>{a.bn}</small><em className={a.enabled ? 'on' : ''}>{a.status}</em></span>
                <Switch on={a.enabled} onChange={() => toggleAuto(a)} title={a.enabled ? 'Pause' : 'Run'} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
