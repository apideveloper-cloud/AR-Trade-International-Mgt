import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtDate } from '../../api.js';
import { match } from './blogUtils.js';

/**
 * Right-hand menu shared by the blog list and every article: search (live results), optional table of contents,
 * categories and the latest posts. On the list page the search drives the list through `onQ`.
 */
export default function Sidebar({ posts, current, q, onQ, toc }) {
  const nav = useNavigate();
  const [local, setLocal] = useState('');
  const term = onQ ? q : local;
  const hits = useMemo(() => (term ? posts.filter(p => match(p, term)).slice(0, 6) : []), [posts, term]);
  const cats = useMemo(() => {
    const m = {};
    posts.forEach(p => { m[p.category] = (m[p.category] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [posts]);
  const recent = posts.filter(p => p.slug !== current).slice(0, 5);
  const [active, setActive] = useState('');
  useEffect(() => {
    if (!toc || !toc.length) return undefined;
    const on = () => {
      let cur = toc[0].id;
      for (const t of toc) { const el = document.getElementById(t.id); if (el && el.getBoundingClientRect().top <= 190) cur = t.id; }
      setActive(cur);
    };
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [toc]);
  const activeIdx = toc ? Math.max(0, toc.findIndex(t => t.id === active)) : 0;
  const curCat = new URLSearchParams(window.location.search).get('cat') || '';

  return (
    <aside className="bl-side">
      <form className="bs-card bs-search" onSubmit={e => { e.preventDefault(); if (!onQ) nav('/blog?q=' + encodeURIComponent(local)); }}>
        <h3>Search articles</h3>
        <label><span>⌕</span><input value={term} onChange={e => (onQ ? onQ(e.target.value) : setLocal(e.target.value))} placeholder="Toner, printer, price…" />{term && <button type="button" onClick={() => (onQ ? onQ('') : setLocal(''))} aria-label="Clear">✕</button>}</label>
        {!onQ && term && (
          <div className="bs-hits">
            {hits.map(p => <Link key={p.slug} to={'/blog/' + p.slug}>{p.title}<small>{p.category}</small></Link>)}
            {!hits.length && <span>No matching articles.</span>}
            {hits.length > 0 && <Link to={'/blog?q=' + encodeURIComponent(term)} className="all">See all results →</Link>}
          </div>
        )}
      </form>

      <div className="bs-card">
        <h3>Categories</h3>
        <div className="bs-chips">
          <Link to="/blog" className={!curCat && !current ? 'on' : ''}>All<i>{posts.length}</i></Link>
          {cats.map(([c, n]) => <Link key={c} to={'/blog?cat=' + encodeURIComponent(c)} className={curCat === c ? 'on' : ''}>{c}<i>{n}</i></Link>)}
        </div>
      </div>

      <div className="bs-card">
        <h3>Latest posts</h3>
        <ul className="bs-recent">
          {recent.map((p, n) => (
            <li key={p.slug}>
              <Link to={'/blog/' + p.slug}>
                <span className="th" style={p.cover ? { backgroundImage: `url('${p.cover}')` } : undefined}><em>{n + 1}</em></span>
                <span className="tx"><b>{p.title}</b><small><u>{p.category}</u>{fmtDate(p.date)}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="bs-card bs-cta">
        <em>🖨</em>
        <b>Need toner or a printer?</b>
        <span>Same-day delivery in Dhaka · cash on delivery.</span>
        <Link to="/shop/all">Shop products →</Link>
      </div>

      {toc && toc.length > 1 && (
        <nav className="bs-card bs-toc">
          <div className="th"><h3>In this article</h3><span>{activeIdx + 1}/{toc.length}</span></div>
          <div className="bar"><i style={{ width: ((activeIdx + 1) / toc.length) * 100 + '%' }} /></div>
          <ol>{toc.map((t, n) => (
            <li key={t.id} className={(t.id === active ? 'on ' : '') + (t.lvl === 3 ? 'sub' : '')}>
              <a href={'#' + t.id} onClick={e => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><i>{n + 1}</i><span>{t.text.replace(/^\d+[.)]\s*/, '')}</span></a>
            </li>
          ))}</ol>
        </nav>
      )}
    </aside>
  );
}
