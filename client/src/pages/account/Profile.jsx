import { useEffect, useState } from 'react';
import { useStore } from '../../store.jsx';
import { H2, acc } from './shared.jsx';

export default function Profile({ profile, setProfile }) {
  const { setUser, say } = useStore();
  const [f, setF] = useState(profile);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(profile), [profile]);
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const age = f.dob ? Math.floor((Date.now() - new Date(f.dob)) / 31557600000) : null;
  const submit = async e => {
    e.preventDefault();
    try { const p = await acc.put('/profile', f); setProfile(p); setUser(u => ({ ...u, name: p.name, phone: p.phone, email: p.email, address: p.address, area: p.area })); setSaved(true); setTimeout(() => setSaved(false), 2500); } catch (er) { say(er.message); }
  };
  return (
    <>
      <H2>Profile</H2>
      <form className="ac-card ac-form-card" onSubmit={submit} >
        <div className="ac-fields">
          <label className="ac-lbl">Full name<input className="ac-input" value={f.name || ''} onChange={on('name')} /></label>
          <label className="ac-lbl">Mobile<input className="ac-input" value={f.phone || ''} onChange={on('phone')} /></label>
          <label className="ac-lbl">Email<input className="ac-input" value={f.email || ''} onChange={on('email')} /></label>
          <label className="ac-lbl">Gender<select className="ac-input" value={f.gender || ''} onChange={on('gender')}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label className="ac-lbl">Date of birth {age != null && <span className="ac-s61">· {age} yrs</span>}<input className="ac-input" type="date" value={f.dob || ''} onChange={on('dob')} /></label>
          <label className="ac-lbl">Organisation (optional)<input className="ac-input" value={f.org || ''} onChange={on('org')} placeholder="Company, office or school" /></label>
          <label className="ac-lbl">BIN / VAT no. (for invoices)<input className="ac-input" value={f.bin || ''} onChange={on('bin')} placeholder="Optional" /></label>
          <label className="ac-lbl">Delivery area<select className="ac-input" value={f.area || 'inside'} onChange={on('area')}><option value="inside">Inside Dhaka</option><option value="suburb">Dhaka suburbs</option><option value="outside">Outside Dhaka</option></select></label>
        </div>
        <label className="ac-lbl">Default address<textarea className="ac-input" rows={3} value={f.address || ''} onChange={on('address')} /></label>
        <label className="ac-lbl">My printer / copier models<input className="ac-input" value={f.devices || ''} onChange={on('devices')} placeholder="e.g. HP M12w, Toshiba 2508A" /></label>
        <div className="ac-form-foot"><button className="ac-btn dark">Save changes</button>{saved && <span className="ac-ok-msg">Changes saved</span>}</div>
      </form>
      <PasswordForm />
    </>
  );
}

function PasswordForm() {
  const [msg, setMsg] = useState('');
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { await acc.put('/password', d); setMsg('Password changed'); e.target.reset(); } catch (er) { setMsg(er.message); }
  };
  return (
    <form className="ac-card ac-form-card-sm" onSubmit={submit} >
      <b>Change password</b>
      <div className="ac-fields"><label className="ac-lbl">Current password<input className="ac-input" type="password" name="current" required /></label><label className="ac-lbl">New password<input className="ac-input" type="password" name="next" required minLength={8} /></label></div>
      <div className="ac-row-12"><button className="ac-btn ghost">Update password</button>{msg && <span className="ac-msg">{msg}</span>}</div>
    </form>
  );
}
