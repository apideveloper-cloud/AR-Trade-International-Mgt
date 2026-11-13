import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import './chat-start.css';

/** The first thing a visitor sees in the chat: name, mobile and location. The shop keeps them as an upcoming-customer record. */
export default function ChatStart({ user, onDone }) {
  const [f, setF] = useState({ name: user?.name || '', phone: user?.phone || '', location: user?.address || '', marketing: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(s => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async e => {
    e.preventDefault();
    const name = f.name.trim(), phone = f.phone.replace(/\D/g, '').slice(-11), location = f.location.trim();
    if (name.length < 2) return setErr('Please enter your name');
    if (!/^01\d{9}$/.test(phone)) return setErr('Enter a valid mobile number (01XXXXXXXXX)');
    if (location.length < 2) return setErr('Please enter your location (area and district)');
    setErr(''); setBusy(true);
    try {
      const r = await api.post('/chat/start', { name, phone, location, marketing: f.marketing });
      onDone(r.lead);
    } catch (ex) { setErr(ex.message || 'Could not start the chat. Please try again.'); }
    setBusy(false);
  };

  return (
    <form className="cs" onSubmit={submit} noValidate>
      <div className="cs-intro"><b>Before we chat</b><span>Tell us about you so we can help · আপনার তথ্য দিন</span></div>
      <div className="cs-row">
        <label>Name<input value={f.name} onChange={set('name')} autoComplete="name" placeholder="Full name" /></label>
        <label>Mobile<input value={f.phone} onChange={set('phone')} autoComplete="tel" inputMode="numeric" placeholder="01XXXXXXXXX" /></label>
      </div>
      <label>Location<input value={f.location} onChange={set('location')} autoComplete="address-level2" placeholder="Area, district (e.g. Mirpur, Dhaka)" /></label>
      <label className="cs-ck"><input type="checkbox" checked={f.marketing} onChange={set('marketing')} /><span>Send me offers by call, SMS, WhatsApp or email. <Link to="/policy/privacy" target="_blank">Privacy</Link></span></label>
      {err && <div className="cs-err" role="alert">{err}</div>}
      <button className="cs-go" type="submit" disabled={busy}>{busy ? 'Starting…' : 'Start chat'}</button>
    </form>
  );
}
