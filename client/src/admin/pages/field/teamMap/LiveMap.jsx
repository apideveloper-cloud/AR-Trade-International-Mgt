import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { initials, ago, STATE, DOT } from '../shared.jsx';

/** The real street map (OpenStreetMap tiles through Leaflet): head office, the 10 km work zone, every person on the map and the picked person's route. */
export function LiveMap({ office, members, route, sel, onPick }) {
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
    const fitKey = sel + '|' + (route.length > 1); // zoom again once the picked person's route has arrived
    if (fitKey !== lastSel.current) {
      lastSel.current = fitKey;
      const me = members.find(x => x.id === sel);
      if (sel && route.length > 1) m.fitBounds(route.map(r => [r.lat, r.lng]), { padding: [50, 50], maxZoom: 16 });
      else if (me && me.lat != null) m.setView([me.lat, me.lng], Math.max(m.getZoom(), 14));
    }
  }, [office, members, route, sel]);
  return <div ref={box} className="fd-lmap" role="application" aria-label="Street map of the team" />;
}
