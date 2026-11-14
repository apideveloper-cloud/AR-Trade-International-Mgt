import { useEffect, useRef, useState } from 'react';

/** Place search box (Photon, built on OpenStreetMap data, Bangladesh area) with its result list.
 *  onPick(hit) places the pin; onNotice(text) reports a search problem ('' = search worked). */
export default function MapSearch({ onPick, onNotice }) {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState(null); // null = no search yet, [] = nothing found
  const [finding, setFinding] = useState(false);
  const [openList, setOpenList] = useState(false);
  const skip = useRef(false), notice = useRef(onNotice);
  notice.current = onNotice;

  // live search while typing: waits for a short pause, ignores older answers
  useEffect(() => {
    if (skip.current) { skip.current = false; setHits(null); setFinding(false); return undefined; } // the text was just set by choosing a result
    const t = term.trim();
    if (t.length < 3) { setHits(null); setFinding(false); return undefined; }
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
        if (ac.signal.aborted) return;
        setHits(rows); notice.current?.('');
      } catch (e) { if (e.name !== 'AbortError') { setHits(null); notice.current?.('Search is not available right now. Please tap the map to place the pin.'); } }
      if (!ac.signal.aborted) setFinding(false);
    }, 350);
    return () => { clearTimeout(h); ac.abort(); };
  }, [term]);

  const choose = h => {
    if (finding) return;
    setOpenList(false);
    if (h.title !== term) skip.current = true; // no pointless search for the text we just filled in
    setTerm(h.title); onPick(h);
  };
  const listShown = openList && term.trim().length >= 3 && !!hits;

  const onKeyDown = e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!finding && hits?.[0]) choose(hits[0]); }
    else if (e.key === 'Escape' && listShown) { e.preventDefault(); setOpenList(false); } // only the list closes; full screen stays
  };

  return (
    <div className="dm-find" role="search">
      <div className="dm-find-box">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        <input type="text" value={term} onChange={e => { setTerm(e.target.value); setHits(null); setOpenList(true); }} onFocus={() => setOpenList(true)} onKeyDown={onKeyDown} placeholder="Search your area, road or landmark" aria-label="Search a location on the map" autoComplete="off" maxLength={80} enterKeyHint="search" />
        {finding && <i className="dm-spin" aria-hidden="true" />}
        {term && !finding && <button type="button" className="dm-x" aria-label="Clear search" onClick={() => { setTerm(''); setHits(null); }}>✕</button>}
      </div>
      {listShown && (hits.length
        ? <ul className="dm-hits" aria-label="Search results">{hits.map((h, i) => <li key={i}><button type="button" onClick={() => choose(h)}><b>{h.title}</b>{h.sub && <span>{h.sub}</span>}</button></li>)}</ul>
        : <div className="dm-hits dm-none">No place found. Try a nearby landmark or tap the map.</div>)}
    </div>
  );
}
