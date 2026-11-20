import { useEffect, useState } from 'react';
import { send, mcMsg, normHours, SOURCE_TEXT } from './bzApi.js';
import { Msg } from './parts.jsx';
import BzHours from './BzHours.jsx';

const TEXT = [
  ['legalName', 'Legal name', 'The registered company name, if different.', ''],
  ['phone', 'Phone', 'The number customers call.', '+8801XXXXXXXXX'],
  ['whatsapp', 'WhatsApp number (digits only)', 'Digits only, with country code.', '8801XXXXXXXXX'],
  ['email', 'E-mail', 'The address customers write to.', ''],
  ['address', 'Address (one line)', 'Example: 159, Santinagar, Dhaka-1217', '159, Santinagar, Dhaka-1217'],
  ['priceRange', 'Price range', 'Example: ৳৳ (cheap to mid-priced).', '৳৳'],
  ['logo', 'Logo path', 'Where the logo file is, for example /uploads/logo.png.', ''],
];

/** Section A: the details form. */
export default function BzDetails({ info, canEdit, onSaved }) {
  const [f, setF] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF({ ...info, geoLat: info.geoLat ?? '', geoLng: info.geoLng ?? '', hours: normHours(info.hours) }); }, [info]);
  if (!f) return null;
  const set = patch => setF(x => ({ ...x, ...patch }));
  const save = async () => {
    if (f.whatsapp && !/^\d+$/.test(String(f.whatsapp))) return setM({ ok: false, text: 'WhatsApp number: type digits only, for example 8801XXXXXXXXX.' });
    for (const k of ['geoLat', 'geoLng']) if (f[k] !== '' && f[k] != null && isNaN(Number(f[k]))) return setM({ ok: false, text: 'Map position: type numbers only, for example 23.7381.' });
    setBusy(true); setM(null);
    const body = { legalName: f.legalName, phone: f.phone, whatsapp: f.whatsapp, email: f.email, address: f.address, priceRange: f.priceRange, logo: f.logo, hours: f.hours, geoLat: f.geoLat === '' ? null : Number(f.geoLat), geoLng: f.geoLng === '' ? null : Number(f.geoLng) };
    const r = await send('/growth/business', body);
    setBusy(false);
    setM(mcMsg(r, 'Saved. These details are now used everywhere.'));
    if (r.ok) onSaved?.(r.body?.info);
  };
  const used = Object.entries(info.sources || {});
  return (
    <section className="a-card adbz-card" id="adbz-details">
      <h3>Your business details</h3>
      <p className="adbz-hint">Write them once here. The website, Google data and the weekly e-mail all use these same details.</p>
      {!canEdit && <Msg m={{ ok: false, text: 'Only people with Settings permission can change these details.' }} />}
      <div className="adbz-form">
        <label className="adbz-field">Shop name
          <input className="a-in" value={info.name || ''} readOnly disabled />
          <small>Change the name in Settings, not here.</small>
        </label>
        {TEXT.map(([k, l, hint, ph]) => (
          <label key={k} className="adbz-field">{l}
            <input className="a-in" value={f[k] ?? ''} placeholder={ph} disabled={!canEdit} onChange={e => set({ [k]: e.target.value })} />
            <small>{hint}</small>
          </label>
        ))}
        <label className="adbz-field">Map position: latitude (optional)
          <input className="a-in" inputMode="decimal" value={f.geoLat} placeholder="23.7381" disabled={!canEdit} onChange={e => set({ geoLat: e.target.value })} />
        </label>
        <label className="adbz-field">Map position: longitude (optional)
          <input className="a-in" inputMode="decimal" value={f.geoLng} placeholder="90.4066" disabled={!canEdit} onChange={e => set({ geoLng: e.target.value })} />
        </label>
      </div>
      <p className="adbz-hint">How to find the map position: open Google Maps, right-click your shop, and click the two numbers at the top of the menu. The first is the latitude, the second the longitude.</p>
      <BzHours hours={f.hours} onChange={h => set({ hours: h })} disabled={!canEdit} />
      <div className="adbz-row">
        <button type="button" className="a-btn a-btn-primary" disabled={!canEdit || busy} onClick={save}>{busy ? 'Saving...' : 'Save details'}</button>
        <Msg m={m} />
      </div>
      {used.length > 0 && (
        <details><summary>Where each detail is used</summary>
          <ul className="adbz-hint">{used.map(([k, v]) => <li key={k}>{k}: taken from {SOURCE_TEXT[v] || v}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
