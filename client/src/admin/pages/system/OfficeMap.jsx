import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const icon = L.divIcon({ className: '', html: '<div class="om-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
const fix = n => +Number(n).toFixed(6);
const ok = v => v !== '' && v != null && Number.isFinite(+v); // an empty box is not 0

/** The office on a map: click the map or drag the pin and the latitude and longitude fields follow. */
export default function OfficeMap({ lat, lng, onPick }) {
  const box = useRef(null), map = useRef(null), pin = useRef(null), cb = useRef(onPick);
  cb.current = onPick;

  useEffect(() => {
    const c = [ok(lat) ? +lat : 23.739316, ok(lng) ? +lng : 90.415567];
    const m = L.map(box.current, { center: c, zoom: 17, scrollWheelZoom: false });
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    pin.current = L.marker(c, { draggable: true, icon, keyboard: true, title: 'Office location' }).addTo(m);
    pin.current.on('dragend', () => { const p = pin.current.getLatLng(); cb.current({ lat: fix(p.lat), lng: fix(p.lng) }); });
    m.on('click', e => { pin.current.setLatLng(e.latlng); cb.current({ lat: fix(e.latlng.lat), lng: fix(e.latlng.lng) }); });
    const t = setTimeout(() => m.invalidateSize(), 200);
    return () => { clearTimeout(t); m.remove(); map.current = null; pin.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // typing new numbers moves the pin (and the map) to match
  useEffect(() => {
    if (!pin.current || !ok(lat) || !ok(lng)) return;
    const p = pin.current.getLatLng();
    if (Math.abs(p.lat - lat) > 1e-7 || Math.abs(p.lng - lng) > 1e-7) { pin.current.setLatLng([+lat, +lng]); map.current.panTo([+lat, +lng]); }
  }, [lat, lng]);

  return (
    <div className="om-wrap">
      {/* the class of this box never changes: Leaflet adds its own classes to it */}
      <div ref={box} className="om-map" role="application" aria-label="Map: click or drag the pin to set the office location" />
      <small className="dr-hint">Click the map or drag the pin to set the office location. The latitude and longitude above follow the pin. Remember to press Save.</small>
    </div>
  );
}
