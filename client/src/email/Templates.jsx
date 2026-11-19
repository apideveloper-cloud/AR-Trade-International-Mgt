import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';

export default function Templates() {
  const [rows, setRows] = useState(null);
  const [pv, setPv] = useState(null);
  useEffect(() => { api.get('/templates').then(setRows).catch(() => {}); }, []);
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div className="em-tpl-grid">
        {rows.map(t => (
          <button key={t.id} onClick={() => setPv(t)} className="em-card em-card-lg em-tpl-card">
            <div className="em-tpl-hero" style={{ background: t.hero }}><span className="em-tpl-kind">{t.kind}</span><b className="em-tpl-headline">{t.headline}</b></div>
            <div className="em-tpl-body"><b className="em-tpl-name">{t.name}</b><span className="em-tpl-subject">{t.subject}</span><span className="em-tpl-more">Preview →</span></div>
          </button>
        ))}
      </div>
      {pv && (
        <div onClick={() => setPv(null)} className="em-modal">
          <div onClick={e => e.stopPropagation()} className="em-modal-box">
            <div className="em-mail-head">
              <div className="em-mail-head-top"><b className="em-mail-subject">{pv.subject}</b><button onClick={() => setPv(null)} className="em-modal-close">×</button></div>
              <span>From: AR Trade International &lt;hello@artradeinternational.com&gt; · {pv.preheader}</span>
            </div>
            <div className="em-modal-body">
              <div className="em-mail">
                <div className="em-mail-hero" style={{ background: pv.hero }}><img src="/ar-icon-round.png" alt="AR Trade" className="em-mail-logo" /><b className="em-mail-title">{pv.headline}</b></div>
                <div className="em-mail-main"><span className="em-mail-text">{pv.body}</span><a href="/" className="em-mail-cta">{pv.cta}</a></div>
                <div className="em-mail-foot">
                  <span>You're receiving this because you subscribed at artradeinternational.com. We never share or sell your email.</span>
                  <span className="em-mail-links"><b>Unsubscribe</b><b>Manage preferences</b><span>AR Trade International · Dhaka, Bangladesh</span></span>
                </div>
              </div>
              <span className="em-modal-note">The footer with unsubscribe + preferences is locked and added to every email.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
