// My own tracking summary for the Tracking screen. Not part of the "team" module (that one is for managers), so every role can use it.
//   GET /api/field/mytrack/me             km today, on-road seconds, visits n/m, next stop (with distance) and the street name of my last GPS point
//   GET /api/field/mytrack/place?lat=&lng=  street / area name for a point (OpenStreetMap Nominatim, cached); { place: string|null }
import { Router } from 'express';
import { pool, wrap, fail, guard, todayBD, UTC, distKm, pathKm } from '../common.js';

const router = Router();
const mysql = d => d.toISOString().slice(0, 19).replace('T', ' ');
const dayStart = () => new Date(`${todayBD()}T00:00:00+06:00`);

// ---- reverse geocoding: "Kakrail Rd, Ramna, Dhaka" for a GPS point. Cached by ~100 m cell, at most one lookup per 1.1 s (Nominatim policy). ----
const placeCache = new Map(); // key -> { v: string|null, at: ms }
const key = (lat, lng) => Number(lat).toFixed(3) + ',' + Number(lng).toFixed(3);
let geoChain = Promise.resolve(), lastGeo = 0;
export function lookupPlace(lat, lng) {
  const k = key(lat, lng);
  const hit = placeCache.get(k);
  if (hit && Date.now() - hit.at < (hit.v ? 12 * 36e5 : 5 * 6e4)) return Promise.resolve(hit.v);
  const job = geoChain.then(async () => {
    const wait = lastGeo + 1100 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastGeo = Date.now();
    let v = null;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=en&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'ARTradeConsole/1.0 (artradeinternational.com)' }, signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const a = (await r.json()).address || {};
        const parts = [a.road || a.pedestrian || a.neighbourhood, a.suburb || a.quarter || a.city_district, a.city || a.town || a.state_district]
          .filter((x, i, arr) => x && arr.indexOf(x) === i);
        v = parts.join(', ') || null;
      }
    } catch { /* offline server: the app falls back to coordinates */ }
    if (placeCache.size > 2000) placeCache.clear();
    placeCache.set(k, { v, at: Date.now() });
    return v;
  });
  geoChain = job.catch(() => null);
  return job;
}
/** Cached name now; starts a background lookup when it is not known yet (so list endpoints never wait for the network). */
export function placeNow(pos) {
  if (!pos) return null;
  const hit = placeCache.get(key(pos.lat, pos.lng));
  if (!hit) lookupPlace(pos.lat, pos.lng).catch(() => null);
  return hit?.v ?? null;
}

router.get('/me', guard(), wrap(async (req, res) => {
  const from = mysql(dayStart());
  const [pts] = await pool.query(`SELECT lat, lng, ${UTC('at')} at FROM field_track WHERE staff_id = ? AND at >= ? ORDER BY at`, [req.staff.id, from]);
  const points = pts.map(p => ({ lat: Number(p.lat), lng: Number(p.lng), t: Date.parse(p.at) }));
  let onRoadSec = 0;
  for (let i = 1; i < points.length; i++) {
    const gap = (points[i].t - points[i - 1].t) / 1000;
    if (gap > 0 && gap <= 600 && distKm(points[i - 1], points[i]) > 0.03) onRoadSec += gap;
  }
  let visits = null, nextStop = null;
  try {
    const [vs] = await pool.query(
      `SELECT v.status, v.purpose, v.visit_time, c.name, c.area, c.address, c.lat, c.lng FROM field_visits v LEFT JOIN field_customers c ON c.id = v.customer_id
       WHERE v.staff_id = ? AND v.visit_date = ? ORDER BY v.visit_time`, [req.staff.id, todayBD()]);
    visits = { done: vs.filter(v => v.status === 'Done').length, total: vs.length };
    const next = vs.find(v => v.status !== 'Done');
    if (next) {
      const here = points.length ? points[points.length - 1] : null;
      const there = next.lat != null && next.lng != null ? { lat: Number(next.lat), lng: Number(next.lng) } : null;
      nextStop = { client: next.name || '', area: next.area || next.address || '', purpose: next.purpose || '', time: String(next.visit_time).slice(0, 5),
        lat: there?.lat ?? null, lng: there?.lng ?? null, km: here && there ? Math.round(distKm(here, there) * 10) / 10 : null };
    }
  } catch { /* visits module not installed */ }
  const lastPt = points.length ? points[points.length - 1] : null;
  const place = lastPt ? await Promise.race([lookupPlace(lastPt.lat, lastPt.lng), new Promise(r => setTimeout(() => r(null), 1500))]) : null;
  res.json({ km: pathKm(points), onRoadSec: Math.round(onRoadSec), visits, nextStop, place });
}));

router.get('/place', guard(), wrap(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw fail(400, 'Invalid coordinates');
  res.json({ place: await Promise.race([lookupPlace(lat, lng), new Promise(r => setTimeout(() => r(null), 2500))]) });
}));

export default router;
