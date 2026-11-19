import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { useImgOk, useSlidePic } from './useSlidePics.js';

/** Turns a stored hash link into a router path. */
const to = h => String(h || '/').replace(/^#/, '') || '/';

/** A full-bleed image slide; falls back to a designed slide when the picture is dead. */
function ImageSlide({ s }) {
  const src = s.img.startsWith('./') ? s.img.slice(1).replace(/^\/assets\//, '/') : s.img;
  const ok = useImgOk(src);
  const pic = useSlidePic(s.href);
  if (ok === false) {
    return (
      <div className="slide-d">
        <span className="orb" />
        <div className="col"><span className="tag">AR Trade</span><h2>{s.alt}</h2><p>Original products, cash on delivery across Bangladesh.</p><div className="ctas"><Link to={to(s.href)}>Shop now →</Link></div></div>
        <div className="pic"><div className="card"><div style={{ backgroundImage: `url('${pic}')` }} /></div></div>
      </div>
    );
  }
  return <Link to={to(s.href)} className="slide-img" aria-label={s.alt}><div style={{ backgroundImage: ok ? `url('${src}')` : 'none' }} /></Link>;
}

function PicCard({ s }) {
  const ok = useImgOk(s.pic);
  const local = useSlidePic(s.h1);
  return <div className="card"><div style={{ backgroundImage: `url('${ok === false ? local : s.pic}')` }} /></div>;
}

/** A designed text slide with picture card and badge. */
function DesignSlide({ s, k, tk }) {
  return (
    <div className="slide-d">
      <span className="orb" /><span className="num">{String(k + 1).padStart(2, '0')}</span>
      <div className="col">
        <span className="tag">{tk(s.tag)}</span>
        <h2>{tk(s.title)}</h2>
        <p>{tk(s.sub)}</p>
        <div className="ctas"><Link to={to(s.h1)}>{s.c1} →</Link><Link to={to(s.h2)}>{s.c2}</Link></div>
      </div>
      <div className="pic">
        <PicCard s={s} />
        <span className="badge"><small>{s.badgeT}</small><b>{s.badgeV}</b></span>
      </div>
    </div>
  );
}

/** The auto-advancing hero slider (pauses on hover or hidden tab). */
export default function Hero() {
  const { content, tk } = useStore();
  const slides = content.slides.filter(s => s.on !== false);
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(null);
  const [tick, setTick] = useState(0);
  const paused = useRef(false);
  const go = n => {
    const k = ((n % slides.length) + slides.length) % slides.length;
    setI(cur => { if (cur !== k) { setPrev(cur); setTick(t => t + 1); } return k; });
  };
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => { if (!paused.current && !document.hidden) setI(cur => { setPrev(cur); setTick(x => x + 1); return (cur + 1) % slides.length; }); }, (content.slideSecs || 5.5) * 1000);
    return () => clearInterval(t);
  }, [slides.length, content.slideSecs]);

  return (
    <div className="hero" onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <h1 className="seo-h1">AR Trade International: genuine toner, printers and copiers in Bangladesh</h1>{/* the one page heading, whatever the first slide is (an image slide has none) */}
      <div key={tick} className={'sweep' + (tick ? ' go' : '')} />
      {slides.map((s, k) => (
        <div key={k} className={'slide' + (k === i ? ' on' : k === prev ? ' was' : '')} aria-hidden={k !== i}>
          {s.type === 'image' ? <ImageSlide s={s} /> : <DesignSlide s={s} k={k} tk={tk} />}
        </div>
      ))}
      <div className="dots">{slides.map((_, k) => <button key={k} type="button" title="Slide" aria-label={`Go to slide ${k + 1}`} onClick={() => go(k)} style={{ width: k === i ? 26 : 7, background: k === i ? '#fff' : 'rgba(255,255,255,.5)' }} />)}</div>
      <button className="arr prev" type="button" title="Previous" aria-label="Previous slide" onClick={() => go(i - 1)}>←</button>
      <button className="arr next" type="button" title="Next" aria-label="Next slide" onClick={() => go(i + 1)}>→</button>
    </div>
  );
}
