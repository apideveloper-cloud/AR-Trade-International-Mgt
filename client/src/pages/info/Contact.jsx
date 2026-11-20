import { useState } from 'react';
import { api } from '../../api.js';
import { DEFAULT_FOOTER, withDefaults } from '../../data.js';
import { useStore } from '../../store.jsx';
import './info.css';

/** One contact detail box (label, main value, small note). `href` turns the value into a link. */
function InfoBox({ label, value, href, note }) {
  return (
    <div className="inf-box">
      <span className="inf-box-k">{label}</span>
      {href ? <a href={href} className="inf-box-v">{value}</a> : <span className="inf-box-v">{value}</span>}
      <span className="inf-box-n">{note}</span>
    </div>
  );
}

/** Contact page: detail boxes, message form and map. */
export function Contact() {
  const { site, content } = useStore();
  const ft = withDefaults(DEFAULT_FOOTER, content.footer);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); // blocks a second click while the first message is on its way
  const submit = async e => {
    e.preventDefault(); if (busy) return; setErr(''); setBusy(true);
    try { await api.post('/contact', Object.fromEntries(new FormData(e.target).entries())); setSent(true); } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  return (
    <section className="inf-wrap">
      <h1 className="inf-h1-contact">Talk to us</h1>
      <div className="inf-boxes">
        <InfoBox label="Showroom" value={site.address} note={ft.hours} />
        <InfoBox label="Call / WhatsApp" value={site.phone} href="tel:+8801977554401" note={ft.mobileBanking} />
        <InfoBox label="Email" value={site.email} href={'mailto:' + site.email} note={ft.email2} />
      </div>
      <div className="inf-grid-420">
        <div className="white-card inf-form-card">
          <span className="inf-form-t">Send a message or request a quote</span>
          {!sent ? (
            <form onSubmit={submit} className="inf-form">
              <div className="inf-form-row">
                <label className="lbl">Name<input className="field" name="name" required /></label>
                <label className="lbl">Mobile or email<input className="field" name="contact" required /></label>
              </div>
              <label className="lbl">Company (optional)<input className="field" name="company" /></label>
              <label className="lbl">Message<textarea className="field inf-msg" name="msg" rows={5} required /></label>
              {err && <div className="err">{err}</div>}
              <button className="btn btn-dark btn-pill inf-send" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
            </form>
          ) : <span className="inf-thanks">Thanks — we'll reply within one business day.</span>}
        </div>
        <div className="map">
          <iframe title="AR Trade International — 159 Santinagar, Dhaka-1217" src="https://maps.google.com/maps?q=159%20Santinagar%2C%20Dhaka%201217%2C%20Bangladesh&z=16&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <a href="https://www.google.com/maps/dir/?api=1&destination=159+Santinagar+Dhaka+1217" target="_blank" rel="noreferrer"><img src="/ar-icon-round.png" alt="" /><span><b className="inf-map-name">AR Trade International</b><small>Get directions →</small></span></a>
        </div>
      </div>
    </section>
  );
}
