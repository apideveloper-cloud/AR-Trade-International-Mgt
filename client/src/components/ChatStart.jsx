import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { visitInfo } from '../visit.js';
import { MOBILE_HINT, bdMobile } from '../phone.js';
import './chat-start.css';

const USAGE = ['Personal', 'Office', 'Reseller'];

/** The first thing a visitor sees in the chat: name, mobile and location. The shop keeps them as an upcoming-customer record. */
export default function ChatStart({ user, onDone }) {
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '', location: user?.address || '', marketing: false, usage: 'Personal' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // The position is asked for quietly when the form opens. The browser shows its own permission prompt, and
  // nothing is read unless the visitor allows it; if they decline or ignore it, the chat starts as normal.
  const geoRef = useRef(null), geoAsk = useRef(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    geoAsk.current = new Promise(done => {
      try {
        navigator.geolocation.getCurrentPosition(
          p => { geoRef.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; done(); },
          () => done(),
          { timeout: 15000, maximumAge: 600000 });
      } catch { done(); }
    });
  }, []);

  const submit = async e => {
    e.preventDefault();
    const name = f.name.trim(), phone = bdMobile(f.phone), location = f.location.trim();
    if (name.length < 2) return setErr('Please enter your name');
    if (!phone) return setErr(MOBILE_HINT);
    setErr(''); setBusy(true);
    try {
      // give a pending permission prompt a moment, but never hold the chat back for it
      if (geoAsk.current && !geoRef.current) await Promise.race([geoAsk.current, new Promise(r => setTimeout(r, 2500))]);
      const r = await api.post('/chat/start', { name, phone, location, usage: f.usage, marketing: f.marketing, geo: geoRef.current || undefined, tech: visitInfo() });
      onDone(r.lead);
    } catch (ex) { setErr(ex.message || 'Could not start the chat. Please try again.'); }
    setBusy(false);
  };

  return (
    <form className="cs" onSubmit={submit} noValidate>
      <div className="cs-intro"><b>Before we chat</b><span>Tell us about you so we can help · আপনার তথ্য দিন</span></div>
      <div className="cs-row">
        <label><span>Name <i className="cs-req">*</i></span><input value={f.name} onChange={set('name')} autoComplete="name" placeholder="Full name" required aria-required="true" /></label>
        <label><span>Mobile <i className="cs-req">*</i></span><input value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="numeric" placeholder="01XXXXXXXXX" required aria-required="true" /></label>
      </div>
      <label><span>Location <span className="cs-opt">(optional)</span></span><textarea rows={2} value={f.location} onChange={set('location')} autoComplete="address-level2" placeholder="Area, district (e.g. Mirpur, Dhaka)" /></label>
      <div className="cs-use" role="radiogroup" aria-label="Usage type">
        <span className="cs-use-l">Usage Type</span>
        <div className="cs-chips">
          {USAGE.map(u => <button key={u} type="button" role="radio" aria-checked={f.usage === u} className={'cs-chip' + (f.usage === u ? ' on' : '')} onClick={() => setF(s => ({ ...s, usage: u }))}>{u}</button>)}
        </div>
      </div>
      <label className="cs-ck"><input type="checkbox" checked={f.marketing} onChange={set('marketing')} /><span>Send me offers by call, SMS, WhatsApp or email. <Link to="/policy/privacy" target="_blank" rel="noreferrer">Privacy</Link></span></label>
      {err && <div className="cs-err" role="alert">{err}</div>}
      <button className="cs-go" type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start chat'}</button>
    </form>
  );
}
