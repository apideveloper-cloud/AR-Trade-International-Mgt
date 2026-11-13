import { useEffect, useState } from 'react';
import { H2, acc } from './shared.jsx';

const THANAS = ['Ramna', 'Motijheel', 'Dhanmondi', 'Mirpur', 'Uttara', 'Gulshan', 'Banani', 'Tejgaon', 'Mohammadpur', 'Paltan', 'Khilgaon', 'Savar', 'Gazipur Sadar', 'Narayanganj Sadar', 'Kotwali', 'Panchlaish'];
const DISTRICTS = ['Dhaka', 'Gazipur', 'Narayanganj', 'Chattogram', 'Sylhet', 'Khulna', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh'];

export default function Addresses() {
  const [rows, setRows] = useState(null);
  const [pin, setPin] = useState({ lat: 23.7394, lng: 90.4119 });
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const load = () => acc.get('/addresses').then(setRows);
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
      <H2 right={<span className="ac-s6">Pick one at checkout. The default is used first.</span>}>Saved addresses</H2>
      <div className="ac-s86">
        {rows?.map(a => (
          <div key={a.id} className="ac-card ac-s9">
            <div className="ac-s87">{a.lat && <iframe src={map(a.lat, a.lng, 15)} title="Map" loading="lazy" className="ac-s88" />}</div>
            <div className="ac-s89">
              <div className="ac-s90"><b className="ac-s91">{a.label}</b>{a.isDefault && <span className="ac-s92">Default</span>}</div>
              <span className="ac-s93">{a.line}</span>
              <span className="ac-s94">{a.area} · {a.thana} · {a.district}</span>
              {a.lat && <span className="mono ac-s95">📍 {a.lat}, {a.lng}</span>}
            </div>
            <div className="ac-s96">
              {!a.isDefault && <button className="ac-btn ghost sm" onClick={async () => { await acc.put(`/addresses/${a.id}/default`); load(); }}>Set default</button>}
              <button className="ac-btn ghost sm ac-s52" onClick={async () => { await acc.del('/addresses/' + a.id); load(); }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {rows && !rows.length && <div className="ac-card ac-s97">No saved addresses yet.</div>}
      <form className="ac-card ac-s98" onSubmit={add} >
        <div className="ac-s99">
          <b className="ac-s91">Add a new address</b>
          <div className="ac-s100">
            <label className="ac-lbl">Label<select className="ac-input" name="label">{['Home', 'Office', 'Warehouse', 'Parents', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">District<select className="ac-input" name="district">{DISTRICTS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="ac-lbl">Thana<input className="ac-input" name="thana" list="ar-thanas" required placeholder="e.g. Ramna" /></label>
            <label className="ac-lbl">Area<input className="ac-input" name="area" required placeholder="e.g. Shantinagar" /></label>
          </div>
          <datalist id="ar-thanas">{THANAS.map(t => <option key={t} value={t} />)}</datalist>
          <label className="ac-lbl">House, road, floor<textarea className="ac-input" name="line" rows={2} required placeholder="House 12, Road 4, 3rd floor" /></label>
          <label className="ac-s101"><input type="checkbox" name="def" />Make this my default address</label>
          {err && <span className="ac-s102">{err}</span>}
          <div className="ac-s75"><button className="ac-btn dark">Save address</button>{saved && <span className="ac-s83">Address saved</span>}</div>
        </div>
        <div className="ac-s103">
          <div className="ac-s104"><b className="ac-s105">Map pin</b><button type="button" className="ac-btn ghost sm" onClick={locate}>◎ Use my location</button></div>
          <div className="ac-s106"><iframe src={map(pin.lat, pin.lng)} title="Pin map" className="ac-s107" /></div>
          <div className="ac-s108">{[['↑', .0008, 0], ['↓', -.0008, 0], ['←', 0, -.0008], ['→', 0, .0008]].map(([l, dy, dx]) => <button key={l} type="button" className="ac-btn ghost sm" onClick={() => nudge(dy, dx)}>{l}</button>)}</div>
          <span className="mono ac-s109">{pin.lat}, {pin.lng}</span>
        </div>
      </form>
    </>
  );
}
