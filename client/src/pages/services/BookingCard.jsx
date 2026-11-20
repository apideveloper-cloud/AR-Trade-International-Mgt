import { useState } from 'react';
import { api } from '../../api.js';

const TYPES = ['Printer servicing', 'Photocopier servicing', 'Computer servicing', 'Installation & networking'];

/** "Book a technician" card: servicing request form (posts to /services) and its confirmation. */
export default function BookingCard({ user }) {
  const [sentId, setSentId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); // blocks a second click while the first booking is on its way
  const submit = async e => {
    e.preventDefault(); if (busy) return; setErr(''); setBusy(true);
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { const r = await api.post('/services', { ...d, mkt: !!d.mkt }); setSentId(r.id); } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <div className="white-card sv-book">
      <h2 className="t sv-book-t">Book a technician</h2>
      {!sentId ? (
        <form onSubmit={submit} className="sv-form">
          <label className="lbl">Service type<select className="field" name="type">{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
          <div className="sv-grid">
            <label className="lbl">Name<input className="field" name="name" required defaultValue={user?.name} /></label>
            <label className="lbl">Mobile<input className="field" name="phone" required defaultValue={user?.phone} /></label>
            <label className="lbl">Device model<input className="field" name="model" required placeholder="e.g. HP LaserJet M12w" /></label>
            <label className="lbl">Preferred date<input className="field" name="date" type="date" required /></label>
          </div>
          <label className="lbl">What's the problem?<textarea className="field sv-issue" name="issue" rows={3} required /></label>
          <div className="sv-mkt">
            <label className="sv-mkt-row"><input type="checkbox" name="mkt" value="1" className="sv-mkt-box" /><span>Send me service tips &amp; offers by email. <span className="sv-mkt-hint">Optional · unsubscribe anytime.</span></span></label>
            <input name="mktEmail" type="email" placeholder="Email (only if ticked)" className="sv-mkt-email" />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn btn-dark btn-pill sv-submit" disabled={busy}>{busy ? "Sending…" : "Request booking"}</button>
        </form>
      ) : (
        <div className="sv-sent">
          <span className="sv-sent-h">Request {sentId} received.</span>
          <span className="sv-sent-p">Our customer care will call to confirm the visit.</span>
        </div>
      )}
    </div>
  );
}
