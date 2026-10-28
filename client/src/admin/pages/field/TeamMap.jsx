import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fld } from '../../adminApi.js';
import { Modal, Summary, Switch } from '../../ui.jsx';
import { Facts, Notice } from '../../fieldKit.jsx';
import { hhmm, dayTime, ago, initials, Av, Ic, ICON_CALL, ICON_MSG, ICON_INFO, ICON_PIN, Chip, osm, STATE, DOT } from './shared.jsx';
import '../../field.css';

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
  const [info, setInfo] = useState(null); // the team member open in the details popup
  const who = info && members.find(m => m.id === info);

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
                  <span className="fd-mmeta" onClick={() => setInfo(m.id)} title="Click for the details">
                    <span title="Distance today">🛣 {m.km} km</span>
                    {m.visits && <span title="Visits done / planned">📍 {m.visits.done}/{m.visits.total}</span>}
                    <span title="Clock-in time">⏱ {m.clockIn ? hhmm(m.clockIn) : '—'}</span>
                    {m.online && <span title="Last signal">● {ago(m.ageSec)}</span>}
                  </span>
                  <span className="fd-macts">
                    <button type="button" className="fd-ib info" onClick={() => setInfo(m.id)} title={"Details of " + m.name} aria-label={"Details of " + m.name}><Ic d={ICON_INFO} /></button>
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
      {who && (
        <Modal kicker="Team member" title={who.name} narrow cls="att-modal" onClose={() => setInfo(null)}
          footer={<>{who.lat != null && <button type="button" className="a-btn ghost" onClick={() => { setSel(who.id); setInfo(null); }}>Show on map</button>}<button type="button" className="a-btn" onClick={() => setInfo(null)}>Close</button></>}>
          <div className="att-hd"><Av name={who.name} /><div><b>{who.name}{who.me && ' (you)'}</b><small>{who.roleLabel}</small></div><Chip tone={STATE[who.status] || 'off'}>{who.status}</Chip></div>
          <Facts items={[['Mobile', who.phone || '—'], ['Email', who.email || '—'], ['Clock-in today', who.clockIn ? hhmm(who.clockIn) : 'Not clocked in'], ['Distance today', who.km + ' km'], ['Visits done / planned', who.visits ? who.visits.done + ' / ' + who.visits.total : '—'], ['Last signal', who.online ? ago(who.ageSec) : who.seenAt ? 'Last seen ' + dayTime(who.seenAt) : 'None yet'], ['Position', who.place || (who.lat != null ? 'Position known' : 'No position yet'), true]]} />
          <div className="att-call">
            {who.phone && <a className="a-mini" href={'tel:' + who.phone}>Call</a>}{who.phone && <a className="a-mini" href={'sms:' + who.phone}>Message</a>}
            {who.email && <a className="a-mini" href={'mailto:' + who.email}>Email</a>}{who.lat != null && <a className="a-mini" href={osm(who.lat, who.lng)} target="_blank" rel="noreferrer">Open map ↗</a>}
          </div>
        </Modal>
      )}
    </>
  );
}
