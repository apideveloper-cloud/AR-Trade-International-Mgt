import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmt } from '../api.js';
import { NotFound } from './Info.jsx';
import { useStore } from '../store.jsx';
import { cleanHtml } from '../sanitize.js';

const TYPES = ['Printer servicing', 'Photocopier servicing', 'Computer servicing', 'Installation & networking'];

/** Servicing detail pages (imported from the website, editable in Admin → Site pages). */
export function ServiceDetail() {
  const { slug } = useParams();
  const [pg, setPg] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { setPg(null); setMissing(false); window.scrollTo(0, 0); let live = true; api.get('/pages/' + slug).then(p => { if (!live) return; setPg(p); document.title = p.metaTitle || p.title + ' | AR Trade International'; }).catch(() => { if (live) setMissing(true); }); return () => { live = false; document.title = 'AR Trade International'; }; }, [slug]);
  if (missing) return <NotFound />;
  if (!pg) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  return (
    <section className="bpost" style={{ maxWidth: 900 }}>
      <div className="crumbs" style={{ marginBottom: 18 }}><Link to="/">Home</Link><span>/</span><Link to="/services">Servicing</Link><span>/</span><span style={{ color: '#16181d' }}>{pg.title}</span></div>
      <header className="bp-hd"><h1>{pg.title}</h1></header>
      {pg.cover && <img className="svc-cover" src={pg.cover} alt={pg.title} />}
      <div className="bp-body" dangerouslySetInnerHTML={{ __html: cleanHtml(pg.body) }} />
      <div className="bp-cta"><div><b>Need a technician?</b><span>Book a visit — we reply within working hours.</span></div><Link to="/services"><button>Book servicing →</button></Link></div>
    </section>
  );
}

export default function Services() {
  const { site, user } = useStore();
  const [details, setDetails] = useState([]);
  useEffect(() => { api.get('/pages?group=servicing').then(d => setDetails(d.pages)).catch(() => {}); }, []);
  const [sentId, setSentId] = useState('');
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    const d = Object.fromEntries(new FormData(e.target).entries());
    try { const r = await api.post('/services', { ...d, mkt: !!d.mkt }); setSentId(r.id); } catch (er) { setErr(er.message); }
  };
  return (
    <section style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div className="dark-hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="k">Printer · Photocopier · Computer</span>
          <h1>Servicing by trained engineers.</h1>
          <p className="bn" style={{ margin: 0, color: '#c9ccd4', fontSize: 16, lineHeight: 1.6 }}>HP, Canon, Samsung, Epson, Lexmark, Brother — লেজার, ইঙ্কজেট ও ডট প্রিন্টার সার্ভিসিং।</p>
        </div>
        <div className="gold">
          <span style={{ fontWeight: 800, fontSize: 18 }}>Free servicing every Saturday</span>
          <span className="bn" style={{ fontSize: 14, lineHeight: 1.5 }}>প্রতি শনিবার লেজার, ইঙ্কজেট ও ডট প্রিন্টার সার্ভিসিং সম্পূর্ণ ফ্রি (স্পেয়ার পার্টস ব্যতীত)। প্রিন্টার নিয়ে সরাসরি আমাদের হাউজে চলে আসুন।</span>
        </div>
      </div>
      {details.length > 0 && (
        <div className="svc-details">
          <h2>Our servicing</h2>
          <div className="grid">
            {details.map(d => (
              <Link key={d.slug} to={'/services/' + d.slug} className="card">
                <span className="im" style={d.cover ? { backgroundImage: `url('${d.cover}')` } : undefined} />
                <span className="bd"><b>{d.title}</b><span>{d.excerpt}</span><em>Read details →</em></span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))', gap: 24, alignItems: 'start' }}>
        <div className="white-card">
          <h2 className="t">Service charges</h2>
          <div className="svc-row hd"><span>Service</span><span style={{ textAlign: 'right' }}>Regular</span><span style={{ textAlign: 'right' }}>Offer</span></div>
          {site.svcPrices.map(s => (
            <div className="svc-row" key={s.t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 14, fontWeight: 600 }}>{s.t}</span><span className="bn" style={{ fontSize: 12, color: '#5d6270' }}>{s.bn}</span></div>
              <span style={{ textAlign: 'right', color: '#8a8f9b', textDecoration: 'line-through', fontSize: 14 }}>{fmt(s.reg)}</span>
              <span style={{ textAlign: 'right', fontWeight: 800, fontSize: 15 }}>{fmt(s.offer)}</span>
            </div>
          ))}
          <span style={{ fontSize: 12, color: '#5d6270', marginTop: 8 }}>Charges may vary by location.</span>
        </div>
        <div className="white-card" style={{ gap: 14, position: 'sticky', top: 140 }}>
          <h2 className="t" style={{ margin: 0 }}>Book a technician</h2>
          {!sentId ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="lbl">Service type<select className="field" name="type">{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                <label className="lbl">Name<input className="field" name="name" required defaultValue={user?.name} /></label>
                <label className="lbl">Mobile<input className="field" name="phone" required defaultValue={user?.phone} /></label>
                <label className="lbl">Device model<input className="field" name="model" required placeholder="e.g. HP LaserJet M12w" /></label>
                <label className="lbl">Preferred date<input className="field" name="date" type="date" required /></label>
              </div>
              <label className="lbl">What's the problem?<textarea className="field" name="issue" rows={3} required style={{ resize: 'vertical' }} /></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f6f8fc', border: '1px solid #e3e8f2', borderRadius: 14, padding: '12px 14px' }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, color: '#3a3f4b', cursor: 'pointer' }}><input type="checkbox" name="mkt" value="1" style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} /><span>Send me service tips &amp; offers by email. <span style={{ color: '#7a8090' }}>Optional · unsubscribe anytime.</span></span></label>
                <input name="mktEmail" type="email" placeholder="Email (only if ticked)" style={{ border: '1px solid #cfd6e4', borderRadius: 10, padding: '10px 12px', background: '#fff', fontSize: 13 }} />
              </div>
              {err && <div className="err">{err}</div>}
              <button className="btn btn-dark btn-pill" style={{ padding: 15, fontSize: 15 }}>Request booking</button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'oklch(0.42 0.19 258)' }}>Request {sentId} received.</span>
              <span style={{ fontSize: 14, color: '#3d424d' }}>Our customer care will call to confirm the visit.</span>
            </div>
          )}
        </div>
      </div>
      <div className="bn" style={{ background: 'oklch(0.95 0.03 350)', borderRadius: 20, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'Manrope, sans-serif' }}>Caution / সতর্কতা</span>
        <span style={{ fontSize: 14, lineHeight: 1.6 }}>মানি রিসিপ্ট ছাড়া লেনদেন করবেন না · রিসিপ্টে কর্তৃপক্ষের সিল ও স্বাক্ষর বাধ্যতামূলক · টেকনিশিয়ানের পার্সোনাল নাম্বারে যোগাযোগ করবেন না · আমাদের কোন শাখা নেই।</span>
      </div>
    </section>
  );
}
