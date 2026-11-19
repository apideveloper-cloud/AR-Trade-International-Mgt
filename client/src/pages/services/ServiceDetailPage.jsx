import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './services.css';
import { api } from '../../api.js';
import { cleanHtml } from '../../sanitize.js';
import { NotFound } from '../info/NotFound.jsx';

/** Loads a servicing page by slug and keeps document.title in sync (stale responses ignored). */
function useServicePage(slug) {
  const [pg, setPg] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setPg(null); setMissing(false); window.scrollTo(0, 0);
    let live = true;
    api.get('/pages/' + slug)
      .then(p => { if (!live) return; setPg(p); document.title = p.metaTitle || p.title + ' | AR Trade International'; })
      .catch(() => { if (live) setMissing(true); });
    return () => { live = false; document.title = 'AR Trade International'; };
  }, [slug]);
  return { pg, missing };
}

/** Servicing detail pages (imported from the website, editable in Admin → Site pages). */
export function ServiceDetail() {
  const { slug } = useParams();
  const { pg, missing } = useServicePage(slug);
  if (missing) return <NotFound />;
  if (!pg) return <div className="sv-loading"><span className="spin" /></div>;
  return (
    <section className="bpost sv-detail">
      <div className="crumbs"><Link to="/">Home</Link><span>/</span><Link to="/services">Servicing</Link><span>/</span><span className="sv-crumb-cur">{pg.title}</span></div>
      <header className="bp-hd"><h1>{pg.title}</h1></header>
      {pg.cover && <img className="svc-cover" src={pg.cover} alt={pg.title} />}
      <div className="bp-body" dangerouslySetInnerHTML={{ __html: cleanHtml(pg.body) }} />
      <div className="bp-cta"><div><b>Need a technician?</b><span>Book a visit — we reply within working hours.</span></div><Link to="/services"><button>Book servicing →</button></Link></div>
    </section>
  );
}
