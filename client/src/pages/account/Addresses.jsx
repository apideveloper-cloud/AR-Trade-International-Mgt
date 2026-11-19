import { useEffect, useState } from 'react';
import { Empty, H2, acc } from './shared.jsx';

const THANAS = ['Ramna', 'Motijheel', 'Dhanmondi', 'Mirpur', 'Uttara', 'Gulshan', 'Banani', 'Tejgaon', 'Mohammadpur', 'Paltan', 'Khilgaon', 'Savar', 'Gazipur Sadar', 'Narayanganj Sadar', 'Kotwali', 'Panchlaish'];
const DISTRICTS = ['Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh'];

export default function Addresses() {
  const [rows, setRows] = useState(null);
  const [pin, setPin] = useState({ lat: 23.7394, lng: 90.4119 });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const load = () => acc.get('/addresses').then(setRows).catch(() => setRows(r => r || []));
  useEffect(() => { load(); }, []);
  const map = (lat, lng, z = 16) => `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed`;
  const nudge = (dy, dx) => setPin(p => ({ lat: +(p.lat + dy).toFixed(6), lng: +(p.lng + dx).toFixed(6) }));
  const locate = () => navigator.geolocation?.getCurrentPosition(p => setPin({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }), () => setErr('Location permission was denied'));
  const add = async e => {
    e.preventDefault(); setErr('');
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.post('/addresses', { ...d, isDefault: !!d.def, lat: pin.lat, lng: pin.lng }); e.target.reset(); setSaved(true); setTimeout(() => setSaved(false), 2500); load(); } catch (er) { setErr(er.message); }
  };
  return (
    <>
      <H2 right={<span className="ac-muted">Pick one at checkout. The default is used first.</span>}>Saved addresses</H2>
      <div className="ac-addr-grid">
        {rows?.map(a => (
          <div key={a.id} className="ac-card ac-card-flush">
            <div className="ac-addr-map">{a.lat && <iframe src={map(a.lat, a.lng, 15)} title="Map" loading="lazy" className="ac-addr-iframe" />}</div>
            <div className="ac-addr-body">
              <div className="ac-row-8c"><b className="ac-title-sm">{a.label}</b>{a.isDefault && <span className="ac-pill-default">Default</span>}</div>
              <span className="ac-addr-line">{a.line}</span>
              <span className="ac-hint">{a.area} · {a.thana} · {a.district}</span>
              {a.lat && <span className="mono ac-coords">📍 {a.lat}, {a.lng}</span>}
            </div>
            <div className="ac-addr-actions">
              {!a.isDefault && <button className="ac-btn ghost sm" onClick={async () => { try { await acc.put(`/addresses/${a.id}/default`); } catch (er) { setErr(er.message); } load(); }}>Set default</button>}
              <button className="ac-btn ghost sm ac-s52" onClick={async () => { try { await acc.del('/addresses/' + a.id); } catch (er) { setErr(er.message); } load(); }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {rows && !rows.length && <Empty size="card">No saved addresses yet.</Empty>}
      <form className="ac-card ac-addr-form" onSubmit={add} >
        <div className="ac-col-12">
          <b className="ac-title-sm">Add a new address</b>
          <div className="ac-form-grid-150">
            <label className="ac-lbl">Label<select className="ac-input" name="label">{['Home', 'Office', 'Warehouse', 'Parents', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">District<select className="ac-input" name="district">{DISTRICTS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">Thana<input className="ac-input" name="thana" list="ar-thanas" required placeholder="e.g. Ramna" /></label>
            <label className="ac-lbl">Area<input className="ac-input" name="area" required placeholder="e.g. Shantinagar" /></label>
          </div>
          <datalist id="ar-thanas">{THANAS.map(t => <option key={t} value={t} />)}</datalist>
          <label className="ac-lbl">House, road, floor<textarea className="ac-input" name="line" rows={2} required placeholder="House 12, Road 4, 3rd floor" /></label>
          <label className="ac-check-row"><input type="checkbox" name="def" />Make this my default address</label>
          {err && <span className="ac-err-msg">{err}</span>}
          <div className="ac-row-10"><button className="ac-btn dark">Save address</button>{saved && <span className="ac-ok-msg">Address saved</span>}</div>
        </div>
        <div className="ac-col-8">
          <div className="ac-pin-head"><b className="ac-pin-title">Map pin</b><button type="button" className="ac-btn ghost sm" onClick={locate}>◎ Use my location</button></div>
          <div className="ac-pin-map"><iframe src={map(pin.lat, pin.lng)} title="Pin map" className="ac-pin-iframe" /></div>
          <div className="ac-pin-nudge">{[['↑', .0008, 0], ['↓', -.0008, 0], ['←', 0, -.0008], ['→', 0, .0008]].map(([l, dy, dx]) => <button key={l} type="button" className="ac-btn ghost sm" onClick={() => nudge(dy, dx)}>{l}</button>)}</div>
          <span className="mono ac-pin-coords">{pin.lat}, {pin.lng}</span>
        </div>
      </form>
    </>
  );
}
