import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fmt } from '../api.js';
import MapSearch from './MapSearch.jsx';
import { useDeliveryQuote } from './useDeliveryQuote.js';
import './delivery-map.css';

const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const icon = cls => L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [26, 26], iconAnchor: [13, 26] });
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DeliveryMap({ office, freeKm, label, value, onChange, invalid }) {
  const box = useRef(null), map = useRef(null), pin = useRef(null), stage = useRef(null), fsBtn = useRef(null), opener = useRef(null), wasFull = useRef(false);
  const { q, err, busy, quote, retry } = useDeliveryQuote(value, onChange);
  const [note, setNote] = useState({ src: '', text: '' }); // src 'search' or 'locate': a search result only clears search messages
  const [locBusy, setLocBusy] = useState(false);
  const [full, setFull] = useState(false);

  const place = (lat, lng, pan) => {
    const m = map.current; if (!m) return;
    if (!pin.current) {
      pin.current = L.marker([lat, lng], { draggable: true, icon: icon('dm-pin'), keyboard: true, title: 'Your delivery location' }).addTo(m);
      pin.current.on('dragend', () => { const p = pin.current.getLatLng(); quote(p.lat, p.lng); });
    } else pin.current.setLatLng([lat, lng]);
    if (pan) m.setView([lat, lng], Math.max(m.getZoom(), 14), { animate: !reduce() });
    quote(lat, lng);
  };

  useEffect(() => {
    const m = L.map(box.current, { center: [office.lat, office.lng], zoom: 13, zoomAnimation: !reduce(), scrollWheelZoom: false, attributionControl: false, zoomControl: false });
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    map.current = m;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    L.circle([office.lat, office.lng], { radius: freeKm * 1000, color: '#1a7f3c', weight: 2, fillColor: '#1a7f3c', fillOpacity: 0.1 }).addTo(m);
    L.marker([office.lat, office.lng], { icon: icon('dm-office'), interactive: false, keyboard: false })
      .bindTooltip(label || 'Our office', { permanent: true, direction: 'right', offset: [12, -14], className: 'dm-lbl' }).addTo(m);
    m.on('click', e => place(e.latlng.lat, e.latlng.lng, false));
    if (value && Number.isFinite(value.lat)) { pin.current = null; place(value.lat, value.lng, false); }
    const rs = setTimeout(() => m.invalidateSize(), 200);
    return () => { clearTimeout(rs); m.remove(); map.current = null; pin.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // full screen: the wrapper grows over the page, the map re-measures itself; Esc closes, Tab stays inside, focus moves in and back
  useEffect(() => {
    const t = setTimeout(() => map.current?.invalidateSize(), 60), t2 = setTimeout(() => map.current?.invalidateSize(), 400);
    if (!full) {
      if (wasFull.current) { wasFull.current = false; const o = opener.current; opener.current = null; if (o && document.contains(o)) o.focus(); }
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
    wasFull.current = true;
    fsBtn.current?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { if (!e.defaultPrevented) setFull(false); return; } // the search list takes the first Esc
      if (e.key !== 'Tab' || !stage.current) return;
      const els = [...stage.current.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1], a = document.activeElement;
      if (!stage.current.contains(a)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); clearTimeout(t2); document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [full]);

  const toggleFull = () => { if (!full) opener.current = document.activeElement; setFull(f => !f); };
  const onSearchNotice = text => setNote(n => (text ? { src: 'search', text } : n.src === 'search' ? { src: '', text: '' } : n));
  const choose = h => place(h.lat, h.lng, true);

  const locate = () => {
    if (!navigator.geolocation) { setNote({ src: 'locate', text: 'Location is not available on this device. Please tap the map instead.' }); return; }
    setLocBusy(true); setNote({ src: '', text: '' });
    navigator.geolocation.getCurrentPosition(
      p => { setLocBusy(false); place(p.coords.latitude, p.coords.longitude, true); },
      () => { setLocBusy(false); setNote({ src: 'locate', text: 'We could not get your location. Allow location access, or tap the map to place the pin.' }); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const free = q && (q.fee === 0 || q.km <= freeKm);
  const area = (label || 'Santinagar office').split(',')[0].replace(/^\d+\s*/, '');
  const msg = err || note.text;
  return (
    <div className={'dm' + (invalid ? ' bad' : '')}>
      <div className="dm-bar">
        <button type="button" className="dm-btn" onClick={locate} disabled={locBusy}>{locBusy ? 'Finding you…' : '◎ Use my current location'}</button>
        <span className="dm-hint">or tap the map / drag the pin</span>
      </div>
      {/* the class of this box must never change: Leaflet adds its own classes to it and React would wipe them */}
      <div className={'dm-stage' + (full ? ' fs' : '')} ref={stage} {...(full ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Map, full screen' } : {})}>
        <div ref={box} id="dm-map" className="dm-map" role="application" aria-label="Map to choose your delivery location" />
        <MapSearch onPick={choose} onNotice={onSearchNotice} />
        <button type="button" ref={fsBtn} className="dm-full" onClick={toggleFull} aria-pressed={full} aria-label={full ? 'Exit full screen' : 'View map full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>{full ? '✕' : '⛶'}</button>
        {full && <div className="dm-fs-info" aria-live="polite">{busy ? 'Calculating delivery charge…' : q ? (free ? `Free delivery · within ${freeKm} km` : `${Number(q.km).toFixed(1)} km · Delivery ${fmt(q.fee)}`) : 'Tap the map to place the pin'}</div>}
      </div>
      <div className={'dm-info' + (free ? ' free' : '')} aria-live="polite">
        {busy ? 'Calculating delivery charge…' : q ? (free ? `Within ${freeKm} km of our office · Free delivery` : `${Number(q.km).toFixed(1)} km from our ${area} office · Delivery ${fmt(q.fee)}`) : <span className="dm-hint">Free delivery within {freeKm} km (green circle). Pick your location to see the charge.</span>}
      </div>
      <small className="dm-credit">Map data © OpenStreetMap contributors</small>
      {msg && <div className="dm-msg" role="alert">{msg}{err && <> <button type="button" className="dm-btn" onClick={retry}>Try again</button></>}</div>}
    </div>
  );
}
