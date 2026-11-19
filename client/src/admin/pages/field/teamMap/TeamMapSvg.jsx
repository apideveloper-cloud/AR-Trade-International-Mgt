import { initials, STATE, DOT } from '../shared.jsx';

/** Schematic distance view (works without internet): the head office in the middle, rings every few km, people placed by distance and bearing, the picked person's route. */
export function TeamMapSvg({ office, members, route, sel, onPick }) {
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
