import ClientLogos from '../components/ClientLogos.jsx';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard.jsx';
import { api, offPct } from '../api.js';
import { DEFAULT_ABOUT, DEFAULT_FOOTER, withDefaults } from '../data.js';
import { useStore } from '../store.jsx';
import { CodeArt } from './ErrorPages.jsx';

const wrap = { maxWidth: 1600, margin: '0 auto', padding: '24px 28px 40px', display: 'flex', flexDirection: 'column', gap: 28 };

export function NotFound() {
  const { cats } = useStore();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const submit = e => { e.preventDefault(); nav('/shop/all' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : '')); };
  return (
    <section className="nf" style={{ '--nf-h': 238 }}>
      <CodeArt a="4" b="4" glyph="question" />
      <h1>We couldn't find that page</h1>
      <p>The link may be old or mistyped, or the product is no longer listed. Try a search, pick a category, or head back home.</p>
      <code className="nf-path" title="The address you opened">{pathname.length > 70 ? pathname.slice(0, 70) + '…' : pathname}</code>
      <form className="nf-search" onSubmit={submit} role="search">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search toner, ink, printers, photocopiers…" aria-label="Search the shop" />
        <button type="submit" className="btn btn-pill">Search</button>
      </form>
      {cats.length > 0 && (
        <div className="nf-cats" aria-label="Browse categories">
          {cats.slice(0, 10).map(c => <Link key={c.id} to={'/shop/' + c.id}>{c.t}</Link>)}
        </div>
      )}
      <div className="nf-actions">
        <Link to="/" className="btn btn-dark btn-pill">Back to home</Link>
        <Link to="/shop/all" className="btn btn-pill nf-alt">Browse all products</Link>
        <Link to="/contact" className="nf-link">Need help? Contact us →</Link>
      </div>
    </section>
  );
}

export function About() {
  const { content } = useStore();
  const ab = withDefaults(DEFAULT_ABOUT, content.about);
  return (
    <section style={{ ...wrap, gap: 56 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 40, alignItems: 'end' }}>
        <h1 style={{ fontWeight: 800, fontSize: 'clamp(38px,5vw,68px)', letterSpacing: '-.03em', margin: 0, lineHeight: .95, textWrap: 'balance' }}>{ab.heading}</h1>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: '#3d424d' }}>{ab.intro}</p>
      </div>
      <div className="stats-g">{content.stats.map(s => <div key={s.t}><b>{s.v}</b><span style={{ fontSize: 14, color: '#5d6270' }}>{s.t}</span></div>)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 20 }}>
        <div style={{ background: '#16181d', color: '#f6f5f2', borderRadius: 24, padding: 36, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="mono" style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a9adb8' }}>Message from the Managing Director</span>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>{ab.mdMessage}</p>
          <div style={{ display: 'flex', flexDirection: 'column' }}><b>{ab.mdName}</b><span style={{ fontSize: 13, color: '#a9adb8' }}>{ab.mdTitle}</span></div>
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          <div className="white-card" style={{ gap: 10 }}><span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22 }}>Vision</span><span style={{ fontSize: 15, lineHeight: 1.6, color: '#3d424d' }}>{ab.vision}</span></div>
          <div className="white-card" style={{ gap: 10 }}><span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 22 }}>Mission</span><span style={{ fontSize: 15, lineHeight: 1.6, color: '#3d424d' }}>{ab.mission}</span></div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{ fontWeight: 800, fontSize: 36, letterSpacing: '-.025em', margin: 0 }}>Why choose us</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
          {content.whys.map((w, i) => <div className="why" key={w.t}><small>{String(i + 1).padStart(2, '0')}</small><b style={{ fontSize: 18 }}>{w.t}</b><span style={{ fontSize: 14, lineHeight: 1.55, color: '#5d6270' }}>{w.d}</span></div>)}
        </div>
      </div>
      <ClientLogos />
    </section>
  );
}

export function Contact() {
  const { site, content } = useStore();
  const ft = withDefaults(DEFAULT_FOOTER, content.footer);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { await api.post('/contact', Object.fromEntries(new FormData(e.target).entries())); setSent(true); } catch (er) { setErr(er.message); }
  };
  const box = { background: '#fff', border: '1px solid #e4e2dc', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 };
  const k = { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#5d6270' };
  return (
    <section style={wrap}>
      <h1 style={{ fontWeight: 800, fontSize: 'clamp(36px,4.6vw,60px)', letterSpacing: '-.03em', margin: 0, lineHeight: 1 }}>Talk to us</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
        <div style={box}><span style={k}>Showroom</span><span style={{ fontWeight: 700, fontSize: 17 }}>{site.address}</span><span style={{ fontSize: 13, color: '#5d6270' }}>{ft.hours}</span></div>
        <div style={box}><span style={k}>Call / WhatsApp</span><a href="tel:+8801977554401" style={{ fontWeight: 700, fontSize: 17 }}>{site.phone}</a><span style={{ fontSize: 13, color: '#5d6270' }}>{ft.mobileBanking}</span></div>
        <div style={box}><span style={k}>Email</span><a href={'mailto:' + site.email} style={{ fontWeight: 700, fontSize: 17 }}>{site.email}</a><span style={{ fontSize: 13, color: '#5d6270' }}>{ft.email2}</span></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 20 }}>
        <div className="white-card" style={{ gap: 14 }}>
          <span style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 24 }}>Send a message or request a quote</span>
          {!sent ? (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                <label className="lbl">Name<input className="field" name="name" required /></label>
                <label className="lbl">Mobile or email<input className="field" name="contact" required /></label>
              </div>
              <label className="lbl">Company (optional)<input className="field" name="company" /></label>
              <label className="lbl">Message<textarea className="field" name="msg" rows={5} required style={{ resize: 'vertical' }} /></label>
              {err && <div className="err">{err}</div>}
              <button className="btn btn-dark btn-pill" style={{ alignSelf: 'flex-start', padding: '14px 26px', fontSize: 15 }}>Send message</button>
            </form>
          ) : <span style={{ fontWeight: 700, color: 'oklch(0.42 0.19 258)', fontSize: 16 }}>Thanks — we'll reply within one business day.</span>}
        </div>
        <div className="map">
          <iframe title="AR Trade International — 159 Santinagar, Dhaka-1217" src="https://maps.google.com/maps?q=159%20Santinagar%2C%20Dhaka%201217%2C%20Bangladesh&z=16&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <a href="https://www.google.com/maps/dir/?api=1&destination=159+Santinagar+Dhaka+1217" target="_blank" rel="noreferrer"><img src="/ar-icon-round.png" alt="" /><span><b style={{ fontSize: 13 }}>AR Trade International</b><small>Get directions →</small></span></a>
        </div>
      </div>
    </section>
  );
}

export function Offers() {
  const { products, site } = useStore();
  const items = products.filter(p => p.old && p.price && p.price < p.old).sort((a, b) => offPct(b) - offPct(a));
  const [shown, setShown] = useState(24);
  return (
    <section style={wrap}>
      <div style={{ background: 'oklch(0.82 0.13 85)', borderRadius: 28, padding: 44, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="mono" style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>Hot sale · limited time</span>
        <h1 style={{ fontWeight: 800, fontSize: 'clamp(36px,4.6vw,62px)', letterSpacing: '-.03em', margin: 0, lineHeight: .95, maxWidth: 820, textWrap: 'balance' }}>{site.offerTitle}</h1>
        <p style={{ margin: 0, fontSize: 16, maxWidth: 560, lineHeight: 1.5 }}>{site.offerSub}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14 }}>{items.slice(0, shown).map(p => <ProductCard key={p.id} p={p} />)}</div>
      {items.length > shown && <button className="btn btn-dark btn-pill" style={{ alignSelf: 'center', padding: '13px 28px' }} onClick={() => setShown(n => n + 24)}>Load more offers ({items.length - shown} more)</button>}
    </section>
  );
}

export function Faq() {
  const { content, tk } = useStore();
  return (
    <section style={{ maxWidth: 860, margin: '0 auto', padding: '28px 28px 40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}><h1 style={{ fontWeight: 800, fontSize: 'clamp(28px,3.4vw,42px)', letterSpacing: '-.025em', margin: 0, color: '#0b1631' }}>Frequently asked questions</h1><span style={{ color: '#5d6270', fontSize: 15 }}>Ordering, delivery, payment and warranty.</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {content.faqs.map(f => <details className="faq" key={f.q}><summary>{tk(f.q)}</summary><p>{tk(f.a)}</p></details>)}
      </div>
    </section>
  );
}

const POL_META = {
  privacy: { icon: '🔒', tone: 250, line: 'How we collect, use and protect your information.' },
  terms: { icon: '📜', tone: 290, line: 'The rules that apply when you shop with AR Trade.' },
  returns: { icon: '↺', tone: 150, line: 'Easy returns, free replacement for faulty items and quick refunds.' },
  shipping: { icon: '🚚', tone: 40, line: 'Where we deliver, how fast and what it costs.' }
};
// What the website chat and visit tracking keep. It is added to the privacy page here (not typed into the editable policy text)
// so it always shows, whatever the editors save.
const CHAT_DATA_SECTION = {
  h: 'Chat and visit information',
  p: 'When you start a chat with us we keep your name, mobile number, whether you use us personally, for an office or as a reseller, and the location you give us. We also record technical details of your visit: your device type, operating system and browser, your IP address (and the approximate place it points to), screen size, language, time zone, the page you started on, where you came from and any campaign tag in the link you used. If your browser asks to share your exact location and you allow it, we keep that position too; if you decline, the chat works exactly the same. We use this to answer you, plan delivery, let our sellers follow up on your enquiry and improve our service. We use your contact details for offers only if you tick the offers box, and you can ask us to stop at any time. We do not sell this information, and only AR Trade staff can see it. To have your chat record deleted, call or WhatsApp us. (বাংলায়: চ্যাট শুরু করলে আপনার নাম, মোবাইল নম্বর, ডিভাইস, ব্রাউজার, IP ঠিকানা ও আপনি অনুমতি দিলে সঠিক লোকেশন আমরা সংরক্ষণ করি। এগুলো বিক্রি করা হয় না।)'
};
// pulls a short "key fact" (e.g. "7 days", "48 hours") out of a section so it can be shown as a badge
const FACT = /(\d+(?:\s*[–-]\s*\d+)?\s*(?:working\s+days?|days?|hours?|hrs?|minutes?))/i;

/** Policy pages: hero banner, sticky policy menu, numbered section cards with key-fact badges and a help card. */
export function Policy() {
  const { key } = useParams();
  const { content, tk, site } = useStore();
  const list = content.policies;
  const pol = list.find(p => p.k === key) || list.find(p => p.k === 'privacy') || list[0];
  const meta = POL_META[pol.k] || { icon: '§', tone: 250, line: '' };
  const shown = pol.k === 'privacy' && !pol.secs.some(x => x.h === CHAT_DATA_SECTION.h) ? [...pol.secs, CHAT_DATA_SECTION] : pol.secs;
  const secs = shown.map(x => ({ h: tk(x.h), p: tk(x.p), fact: (FACT.exec(tk(x.p)) || [])[1] }));
  const idx = list.findIndex(p => p.k === pol.k);
  const next = list[(idx + 1) % list.length];
  const go = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const wa = site && site.whatsapp ? `https://wa.me/${site.whatsapp}?text=${encodeURIComponent('Hi, I have a question about your ' + pol.t)}` : '#';

  return (
    <section className="pol" style={{ '--tone': meta.tone }} key={pol.k}>
      <header className="pol-hero">
        <span className="ic">{meta.icon}</span>
        <div>
          <span className="kick">AR Trade · Policies</span>
          <h1>{pol.t}</h1>
          <p>{meta.line}</p>
          <div className="chips"><span>Last updated October 2026</span><span>{secs.length} sections</span><span>Applies to all orders</span></div>
        </div>
      </header>

      <div className="pol-layout">
        <aside className="pol-side">
          <nav className="pol-nav">
            <small>All policies</small>
            {list.map(p => <Link key={p.k} to={'/policy/' + p.k} className={p.k === pol.k ? 'on' : ''}><i>{(POL_META[p.k] || {}).icon || '§'}</i>{p.t}</Link>)}
          </nav>
          <nav className="pol-toc">
            <small>On this page</small>
            {secs.map((x, i) => <a key={i} href={'#sec-' + i} onClick={e => { e.preventDefault(); go('sec-' + i); }}><b>{i + 1}</b>{x.h}</a>)}
          </nav>
        </aside>

        <div className="pol-main">
          {secs.map((x, i) => (
            <article key={i} id={'sec-' + i} className="pol-sec" style={{ animationDelay: i * 0.08 + 's' }}>
              <div className="no">{String(i + 1).padStart(2, '0')}</div>
              <div className="bd">
                <h2>{x.h}</h2>
                {x.fact && <span className="fact">⏱ {x.fact}</span>}
                <p>{x.p}</p>
              </div>
            </article>
          ))}

          <div className="pol-help">
            <div><b>Still have a question?</b><span>Our team replies within working hours, usually in a few minutes.</span></div>
            <div className="act">
              <a href={'tel:' + String((site && site.phone) || '+8801977554401').replace(/\s/g, '')}>☎ Call us</a>
              <a href={wa} target="_blank" rel="noreferrer" className="wa">WhatsApp</a>
              <Link to="/contact">Contact page</Link>
            </div>
          </div>
          <Link to={'/policy/' + next.k} className="pol-next"><span>Next policy</span><b>{next.t} →</b></Link>
        </div>
      </div>
    </section>
  );
}
