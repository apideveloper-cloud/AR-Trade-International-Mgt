import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken } from '../../api.js';
import { useStore } from '../../store.jsx';
import { H2, acc } from './shared.jsx';

const TOPICS = [['orders', 'Order updates', 'Confirmation, packing and delivery status'], ['delivery', 'Delivery alerts', 'Rider on the way and OTP codes'], ['offers', 'Offers & deals', 'Friday deals and new arrivals'], ['refill', 'Refill reminders', 'Before your toner or ink runs out'], ['service', 'Servicing', 'Technician visits and repair updates']];

export default function Settings({ profile, setProfile }) {
  const { logout, say } = useStore();
  const nav = useNavigate();
  const [ask, setAsk] = useState(false);
  const toggle = async (topic, ch, on) => {
    const notifs = { ...profile.notifs, [topic]: { ...profile.notifs[topic], [ch]: on } };
    setProfile({ ...profile, notifs });
    try { await acc.put('/profile', { ...profile, notifs }); } catch (e) { say(e.message); }
  };
  const download = async () => {
    const d = await acc.get('/export');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'ar-trade-my-data.json'; a.click();
  };
  const del = async e => {
    e.preventDefault();
    try { await acc.del('/me', { confirm: new FormData(e.target).get('c') }); setToken(null); logout(); nav('/'); } catch (er) { say(er.message); }
  };
  return (
    <>
      <H2>Notifications &amp; privacy</H2>
      <div className="ac-card ac-s128">
        <div className="ac-card-hd"><b>Notification settings</b><span className="ac-s94">Changes save automatically</span></div>
        <div className="ac-ntop"><span>TOPIC</span><span>SMS</span><span>EMAIL</span><span>PUSH</span></div>
        {TOPICS.map(([k, t, d]) => (
          <div key={k} className="ac-nrow">
            <div className="ac-s13"><b className="ac-s120">{t}</b><span className="ac-s94">{d}</span></div>
            {['sms', 'email', 'push'].map(c => <label key={c} className="ac-s129"><input type="checkbox" checked={!!profile.notifs[k]?.[c]} onChange={e => toggle(k, c, e.target.checked)} className="ac-s130" /></label>)}
          </div>
        ))}
      </div>
      <div className="ac-s131">
        <div className="ac-card ac-s132"><b>Download my data</b><span className="ac-s133">Get a copy of your profile, addresses, sub-profiles, orders and reminders as a JSON file.</span><div><button className="ac-btn ghost" onClick={download}>⤓ Download data</button></div></div>
        <div className="ac-card ac-s134">
          <b className="ac-s135">Delete account</b>
          <span className="ac-s133">Removes your account and saved details. Invoices for past orders are kept as required by law.</span>
          {!ask ? <div><button className="ac-btn ghost ac-s136" onClick={() => setAsk(true)}>Request deletion</button></div> : (
            <form onSubmit={del} className="ac-s8">
              <label className="ac-lbl">Type DELETE to confirm<input className="ac-input" name="c" required pattern="DELETE" autoComplete="off" /></label>
              <div className="ac-s115"><button className="ac-btn ac-s137">Delete my account</button><button type="button" className="ac-btn ghost" onClick={() => setAsk(false)}>Cancel</button></div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
