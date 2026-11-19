import { Link, useParams } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { CHAT_DATA_SECTION, FACT, POL_META } from './policyData.js';

/** "Still have a question?" card with call, WhatsApp and contact links. */
function PolicyHelp({ site, wa }) {
  return (
    <div className="pol-help">
      <div><b>Still have a question?</b><span>Our team replies within working hours, usually in a few minutes.</span></div>
      <div className="act">
        <a href={'tel:' + String((site && site.phone) || '+8801977554401').replace(/\s/g, '')}>☎ Call us</a>
        <a href={wa} target="_blank" rel="noreferrer" className="wa">WhatsApp</a>
        <Link to="/contact">Contact page</Link>
      </div>
    </div>
  );
}

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
          <PolicyHelp site={site} wa={wa} />
          <Link to={'/policy/' + next.k} className="pol-next"><span>Next policy</span><b>{next.t} →</b></Link>
        </div>
      </div>
    </section>
  );
}
