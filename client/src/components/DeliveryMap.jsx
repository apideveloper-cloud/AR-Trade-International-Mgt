import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, fmt } from '../api.js';
import './delivery-map.css';

const reduce = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const icon = cls => L.divIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [26, 26], iconAnchor: [13, 26] });

export default function DeliveryMap({ office, freeKm, label, value, onChange, invalid }) {
  const box = useRef(null), map = useRef(null), pin = useRef(null), seq = useRef(0), timer = useRef(null), cb = useRef(onChange);
  const [q, setQ] = useState(value || null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [full, setFull] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState(null); // null = no search yet, [] = nothing found
  const [finding, setFinding] = useState(false);
  const [openList, setOpenList] = useState(false);
  const ctl = useRef(null), stage = useRef(null);
  cb.current = onChange;

  const quote = (lat, lng) => {
    clearTimeout(timer.current);
    const id = ++seq.current;
    setMsg(''); setBusy(true);
    cb.current?.(null); // no price until the new point has one: an early submit asks for the pin instead of using the old one
    timer.current = setTimeout(async () => {
      try {
        const r = await api.post('/delivery/quote', { lat, lng });
        if (id !== seq.current) return;
        const nq = { lat, lng, km: r.km, fee: r.fee };
        setQ(nq); setBusy(false); cb.current?.(nq);
      } catch (e) {
        if (id !== seq.current) return;
        setBusy(false); setQ(null); cb.current?.(null);
        setMsg(e?.message || 'Could not work out the delivery charge. Please try again.');
      }
    }, 350);
  };
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
    return () => { clearTimeout(rs); clearTimeout(timer.current); seq.current++; m.remove(); map.current = null; pin.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // full screen: the wrapper grows over the page, the map re-measures itself; Esc closes
  useEffect(() => {
    const t = setTimeout(() => map.current?.invalidateSize(), 60), t2 = setTimeout(() => map.current?.invalidateSize(), 400);
    if (!full) return () => { clearTimeout(t); clearTimeout(t2); };
    const onKey = e => { if (e.key === 'Escape') setFull(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); clearTimeout(t2); document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [full]);

  // live search while typing (Photon, built on OpenStreetMap data, Bangladesh area): waits for a short pause, ignores older answers
  useEffect(() => {
    const t = term.trim();
    if (t.length < 3) { setHits(null); setFinding(false); return; }
    setFinding(true);
    const ac = new AbortController();
    const h = setTimeout(async () => {
      try {
        const res = await fetch('https://photon.komoot.io/api/?limit=7&lang=en&lat=23.78&lon=90.4&bbox=88,20.5,92.7,26.7&q=' + encodeURIComponent(t), { signal: ac.signal });
        if (!res.ok) throw new Error('search');
        const j = await res.json();
        const seen = new Set();
        const rows = (j.features || []).map(f => {
          const q = f.properties || {}, [lng, lat] = f.geometry?.coordinates || [];
          const sub = [q.street && q.name !== q.street ? q.street : '', q.district || q.locality, q.city || q.county, q.state].filter((x, i, a) => x && x !== q.name && a.indexOf(x) === i).join(', ');
          return { title: q.name || q.street || sub, sub: q.name ? sub : sub.split(', ').slice(1).join(', '), lat: +lat, lng: +lng };
        }).filter(x => x.title && Number.isFinite(x.lat) && Number.isFinite(x.lng) && !seen.has(x.title + x.sub) && seen.add(x.title + x.sub));
        setHits(rows); setMsg('');
      } catch (e) { if (e.name !== 'AbortError') { setHits(null); setMsg('Search is not available right now. Please tap the map to place the pin.'); } }
      if (!ac.signal.aborted) setFinding(false);
    }, 350);
    return () => { clearTimeout(h); ac.abort(); };
  }, [term]);
  const choose = h => { setOpenList(false); setTerm(h.title); place(h.lat, h.lng, true); };

  const locate = () => {
    if (!navigator.geolocation) { setMsg('Location is not available on this device. Please tap the map instead.'); return; }
    setLocBusy(true); setMsg('');
    navigator.geolocation.getCurrentPosition(
      p => { setLocBusy(false); place(p.coords.latitude, p.coords.longitude, true); },
      () => { setLocBusy(false); setMsg('We could not get your location. Allow location access, or tap the map to place the pin.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const free = q && (q.fee === 0 || q.km <= freeKm);
  const area = (label || 'Santinagar office').split(',')[0].replace(/^\d+\s*/, '');
  return (
    <div className={'dm' + (invalid ? ' bad' : '')}>
      <div className="dm-bar">
        <button type="button" className="dm-btn" onClick={locate} disabled={locBusy}>{locBusy ? 'Finding you…' : '◎ Use my current location'}</button>
        <span className="dm-hint">or tap the map / drag the pin</span>
      </div>
      {/* the class of this box must never change: Leaflet adds its own classes to it and React would wipe them */}
      <div className={'dm-stage' + (full ? ' fs' : '')} ref={stage}>
        <div ref={box} id="dm-map" className="dm-map" role="application" aria-label="Map to choose your delivery location" />
        <div className="dm-find" role="search">
          <div className="dm-find-box">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            <input type="text" value={term} onChange={e => { setTerm(e.target.value); setOpenList(true); }} onFocus={() => setOpenList(true)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (hits?.[0]) choose(hits[0]); } else if (e.key === 'Escape') setOpenList(false); }} placeholder="Search your area, road or landmark" aria-label="Search a location on the map" autoComplete="off" maxLength={80} enterKeyHint="search" />
            {finding && <i className="dm-spin" aria-hidden="true" />}
            {term && !finding && <button type="button" className="dm-x" aria-label="Clear search" onClick={() => { setTerm(''); setHits(null); }}>✕</button>}
          </div>
          {openList && term.trim().length >= 3 && hits && (hits.length
            ? <ul className="dm-hits" aria-label="Search results">{hits.map((h, i) => <li key={i}><button type="button" onClick={() => choose(h)}><b>{h.title}</b>{h.sub && <span>{h.sub}</span>}</button></li>)}</ul>
            : <div className="dm-hits dm-none">No place found. Try a nearby landmark or tap the map.</div>)}
        </div>
        <button type="button" className="dm-full" onClick={() => setFull(f => !f)} aria-pressed={full} aria-label={full ? 'Exit full screen' : 'View map full screen'} title={full ? 'Exit full screen (Esc)' : 'Full screen'}>{full ? '✕' : '⛶'}</button>
        {full && <div className="dm-fs-info" aria-live="polite">{busy ? 'Calculating delivery charge…' : q ? (free ? `Free delivery · within ${freeKm} km` : `${Number(q.km).toFixed(1)} km · Delivery ${fmt(q.fee)}`) : 'Tap the map to place the pin'}</div>}
      </div>
      <div className={'dm-info' + (free ? ' free' : '')} aria-live="polite">
        {busy ? 'Calculating delivery charge…' : q ? (free ? `Within ${freeKm} km of our office · Free delivery` : `${Number(q.km).toFixed(1)} km from our ${area} office · Delivery ${fmt(q.fee)}`) : <span className="dm-hint">Free delivery within {freeKm} km (green circle). Pick your location to see the charge.</span>}
      </div>
      <small className="dm-credit">Map data © OpenStreetMap contributors</small>
      {msg && <div className="dm-msg" role="alert">{msg}</div>}
    </div>
  );
}
