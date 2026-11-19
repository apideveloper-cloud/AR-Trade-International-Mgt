import { lazy, Suspense } from 'react';
import { getDelivery, isNum } from './deliveryModel.js';
import '../../../styles/admin-delivery-rules.css';

const OfficeMap = lazy(() => import('../OfficeMap.jsx')); // Leaflet loads only when this screen is opened

/** Labelled number input. */
const NumField = ({ label, value, onChange, ...extra }) => (
  <label className="a-lbl">{label}<input className="a-input" type="number" step="any" inputMode="decimal" value={value ?? ''} onChange={e => onChange(e.target.value)} {...extra} /></label>
);
/** Labelled taka-prefixed number input. */
const FeeField = ({ label, value, onChange }) => (
  <label className="a-lbl">{label}<span className="adorn"><i>৳</i><input className="a-input" type="number" step="any" inputMode="decimal" min="0" value={value ?? ''} onChange={e => onChange(e.target.value)} /></span></label>
);

/** One-line summary of the fee steps, e.g. "Free up to 2 km · 2-5 km ৳100 ...". */
function feePreview(d) {
  const f = n => (isNum(n) ? +n : '?');
  const parts = [`Free up to ${f(d.freeKm)} km`];
  let from = d.freeKm;
  d.tiers.forEach(t => { parts.push(`${f(from)}-${f(t.upToKm)} km ৳${f(t.fee)}`); from = t.upToKm; });
  parts.push(`over ${f(from)} km ৳${f(d.maxFee)}`);
  return parts.join(' · ');
}

/** Delivery-by-distance steps and outside-Dhaka shipping partners (edits s.delivery). */
export function DeliveryRules({ s, setS, errors }) {
  const d = getDelivery(s.delivery);
  const upd = fn => setS(x => ({ ...x, delivery: fn(getDelivery(x.delivery)) }));
  const setTop = (k, v) => upd(c => ({ ...c, [k]: v }));
  const setOffice = (k, v) => upd(c => ({ ...c, office: { ...c.office, [k]: v } }));
  const setTier = (i, k, v) => upd(c => ({ ...c, tiers: c.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));
  const setPartner = (i, name) => upd(c => ({ ...c, partners: c.partners.map((p, j) => (j === i ? { ...p, name } : p)) }));
  const addTier = () => upd(c => {
    const last = c.tiers[c.tiers.length - 1];
    const km = last && isNum(last.upToKm) ? +last.upToKm + 3 : (isNum(c.freeKm) ? +c.freeKm + 2 : 2);
    return { ...c, tiers: [...c.tiers, { upToKm: km, fee: last && isNum(last.fee) ? +last.fee + 50 : 100 }] };
  });
  const mapOk = isNum(d.office.lat) && isNum(d.office.lng);
  const mapUrl = `https://www.openstreetmap.org/?mlat=${+d.office.lat}&mlon=${+d.office.lng}#map=16/${+d.office.lat}/${+d.office.lng}`;
  return (
    <>
      <div className="dr-box">
        <b>Delivery by distance (inside Dhaka)</b>
        <p className="dr-hint">Distances are measured from here. Open the map and confirm the pin is on your office door.</p>
        <div className="a-fields">
          <label className="a-lbl">Office location label<input className="a-input" type="text" maxLength={120} value={d.office.label ?? ''} onChange={e => setOffice('label', e.target.value)} /></label>
          <NumField label="Latitude" value={d.office.lat} onChange={v => setOffice('lat', v)} />
          <NumField label="Longitude" value={d.office.lng} onChange={v => setOffice('lng', v)} />
        </div>
        {mapOk && <a className="dr-map" href={mapUrl} target="_blank" rel="noopener noreferrer">Check on map</a>}
        <Suspense fallback={<div className="dr-hint">Loading map…</div>}>
          <OfficeMap lat={d.office.lat} lng={d.office.lng} onPick={p => { setOffice('lat', p.lat); setOffice('lng', p.lng); }} />
        </Suspense>
        <div className="a-fields">
          <NumField label="Free distance (km)" value={d.freeKm} onChange={v => setTop('freeKm', v)} min={0} />
          <NumField label="Road factor" value={d.roadFactor} onChange={v => setTop('roadFactor', v)} min={1} max={3} />
        </div>
        <p className="dr-hint">Straight-line distance x this number approximates the road distance</p>
        <div className="dr-steps" role="group" aria-label="Distance steps">
          {d.tiers.map((t, i) => (
            <div className="dr-row" key={i}>
              <NumField label={`Step ${i + 1}: up to (km)`} value={t.upToKm} onChange={v => setTier(i, 'upToKm', v)} min={0} />
              <span aria-hidden="true">→</span>
              <FeeField label="Fee" value={t.fee} onChange={v => setTier(i, 'fee', v)} />
              <button type="button" className="a-btn" aria-label={`Remove step ${i + 1}`} onClick={() => upd(c => ({ ...c, tiers: c.tiers.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
          <div>
            <button type="button" className="a-btn" disabled={d.tiers.length >= 8} onClick={addTier}>+ Add step</button>
            {d.tiers.length >= 8 && <span className="dr-hint"> Maximum 8 steps.</span>}
          </div>
        </div>
        <div className="dr-last"><FeeField label="Beyond the last step" value={d.maxFee} onChange={v => setTop('maxFee', v)} /></div>
        <div className="dr-prev" aria-live="polite"><b>Preview: </b>{feePreview(d)}</div>
      </div>
      <div className="dr-box">
        <b>Shipping partners (outside Dhaka)</b>
        <div className="dr-steps">
          {d.partners.map((p, i) => (
            <div className="dr-row" key={i}>
              <label className="a-lbl">Partner {i + 1}<input className="a-input" type="text" maxLength={60} value={p.name ?? ''} onChange={e => setPartner(i, e.target.value)} /></label>
              <button type="button" className="a-btn" aria-label={`Remove partner ${i + 1}`} onClick={() => upd(c => ({ ...c, partners: c.partners.filter((_, j) => j !== i) }))}>Remove</button>
            </div>
          ))}
          <div>
            <button type="button" className="a-btn" disabled={d.partners.length >= 12} onClick={() => upd(c => ({ ...c, partners: [...c.partners, { name: '' }] }))}>+ Add partner</button>
            {d.partners.length >= 12 && <span className="dr-hint"> Maximum 12 partners.</span>}
          </div>
        </div>
      </div>
      {errors.length > 0 && <div role="alert">{errors.map(m => <p className="dr-err" key={m}>{m}</p>)}</div>}
    </>
  );
}
