import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { card } from './emailShared.js';

export default function Templates() {
  const [rows, setRows] = useState(null);
  const [pv, setPv] = useState(null);
  useEffect(() => { api.get('/templates').then(setRows); }, []);
  if (!rows) return <span className="spin" />;
  return (
    <>
      <div className="em-s60">
        {rows.map(t => (
          <button key={t.id} onClick={() => setPv(t)} style={{ ...card, borderRadius: 20, textAlign: 'left', border: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform .25s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            <div style={{ height: 118, background: t.hero, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}><span className="em-s61">{t.kind}</span><b className="em-s62">{t.headline}</b></div>
            <div className="em-s63"><b className="em-s64">{t.name}</b><span className="em-s65">{t.subject}</span><span className="em-s66">Preview →</span></div>
          </button>
        ))}
      </div>
      {pv && (
        <div onClick={() => setPv(null)} className="em-s67">
          <div onClick={e => e.stopPropagation()} className="em-s68">
            <div className="em-s69">
              <div className="em-s70"><b className="em-s71">{pv.subject}</b><button onClick={() => setPv(null)} className="em-s72">×</button></div>
              <span>From: AR Trade International &lt;hello@artradeinternational.com&gt; · {pv.preheader}</span>
            </div>
            <div className="em-s73">
              <div className="em-s74">
                <div style={{ background: pv.hero, color: '#fff', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}><img src="/ar-icon-round.png" alt="AR Trade" className="em-s75" /><b className="em-s76">{pv.headline}</b></div>
                <div className="em-s77"><span className="em-s78">{pv.body}</span><a href="/" className="em-s79">{pv.cta}</a></div>
                <div className="em-s80">
                  <span>You're receiving this because you subscribed at artradeinternational.com. We never share or sell your email.</span>
                  <span className="em-s81"><b>Unsubscribe</b><b>Manage preferences</b><span>AR Trade International · Dhaka, Bangladesh</span></span>
                </div>
              </div>
              <span className="em-s82">The footer with unsubscribe + preferences is locked and added to every email.</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
