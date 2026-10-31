import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { NotFound } from './Info.jsx';

const readMins = html => Math.max(1, Math.round(String(html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).length / 200));
const PAGE = 9;
const match = (p, q) => !q || (p.title + ' ' + p.excerpt + ' ' + p.category).toLowerCase().includes(q.toLowerCase());

function Card({ p, big }) {
  return (
    <Link to={'/blog/' + p.slug} className={'bl-card' + (big ? ' big' : '')}>
      <span className="im" style={p.cover ? { backgroundImage: `url('${p.cover}')` } : undefined}>{!p.cover && <b>AR</b>}</span>
      <span className="bd">
        <span className="meta"><em>{p.category}</em><time>{fmtDate(p.date)}</time></span>
        <strong>{p.title}</strong>
        <span className="ex">{p.excerpt}</span>
        <span className="more">Read article →</span>
      </span>
    </Link>
  );
}

/**
 * Right-hand menu shared by the blog list and every article: search (live results), optional table of contents,
 * categories and the latest posts. On the list page the search drives the list through `onQ`.
 */
function Sidebar({ posts, current, q, onQ, toc }) {
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

/** Blog index: featured article, category chips and a paged grid, with the search/category menu on the right. */
export function Blog() {
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState('');
  const [sp, setSp] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const cat = sp.get('cat') || '';
  const q = sp.get('q') || '';
  const setQ = v => { const n = new URLSearchParams(sp); if (v) n.set('q', v); else n.delete('q'); setSp(n, { replace: true }); };

  useEffect(() => { document.title = 'Blog | AR Trade International'; api.get('/blog').then(d => setPosts(d.posts)).catch(e => setErr(e.message)); }, []);
  useEffect(() => { setShown(PAGE); }, [cat, q]);

  const list = useMemo(() => (posts || []).filter(p => (!cat || p.category === cat) && match(p, q)), [posts, cat, q]);
  const feature = !cat && !q ? list[0] : null;
  const rest = feature ? list.slice(1) : list;

  if (err) return <div className="a-msg err" style={{ margin: 40 }}>{err}</div>;
  if (!posts) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;

  return (
    <section className="blog">
      <header className="bl-hero">
        <span className="kick">AR Trade Journal</span>
        <h1>{cat ? cat + ' articles' : q ? `Results for “${q}”` : 'Toner, printer & office tech guides'}</h1>
        <p>Buying guides, price lists and maintenance tips from the team at AR Trade International.</p>
      </header>
      <div className="bl-layout">
        <div className="bl-main">
          {(cat || q) && <div className="bl-filter">{list.length} article{list.length === 1 ? '' : 's'}{cat && <> in <b>{cat}</b></>}{q && <> matching <b>“{q}”</b></>}<button onClick={() => setSp({})}>Clear filters ✕</button></div>}
          {feature && <Card p={feature} big />}
          <div className="bl-grid">{rest.slice(0, shown).map(p => <Card key={p.slug} p={p} />)}</div>
          {!list.length && <div className="bl-empty">No articles match your search.</div>}
          {rest.length > shown && <button className="bl-more" onClick={() => setShown(s => s + PAGE)}>Load more articles ({rest.length - shown} more)</button>}
        </div>
        <Sidebar posts={posts} q={q} onQ={setQ} />
      </div>
    </section>
  );
}

const slugify = (s, i) => 's' + i + '-' + s.toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Adds ids to h2/h3 so the sidebar can link to each section. */
function withToc(html) {
  try {
    const doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    const toc = [];
    doc.querySelectorAll('#r h2, #r h3').forEach((h, i) => {
      const text = h.textContent.trim();
      if (!text) return;
      h.id = slugify(text, i);
      toc.push({ id: h.id, text, lvl: h.tagName === 'H3' ? 3 : 2 });
    });
    return { html: doc.getElementById('r').innerHTML, toc: toc.filter(t => t.lvl === 2).length > 1 ? toc.filter(t => t.lvl === 2) : toc.slice(0, 12) };
  } catch { return { html, toc: [] }; }
}

/** Thin reading-progress bar; portalled out of the zoomed storefront wrapper so position:fixed stays correct. */
function Progress() {
  const [w, setW] = useState(0);
  useEffect(() => {
    const on = () => { const el = document.querySelector('.bp-body'); if (!el) return; const r = el.getBoundingClientRect(); const total = r.height - window.innerHeight * 0.5; setW(Math.max(0, Math.min(100, (-r.top / Math.max(1, total)) * 100))); };
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return createPortal(<div className="bp-progress"><i style={{ width: w + '%' }} /></div>, document.body);
}

/** One article with the cleaned-up body copied from the live blog, plus related reads. */
export function BlogPost() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [all, setAll] = useState([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => { api.get('/blog').then(r => setAll(r.posts)).catch(() => {}); }, []);
  useEffect(() => {
    setD(null); setMissing(false); window.scrollTo(0, 0);
    api.get('/blog/' + slug).then(r => { setD(r); document.title = r.post.metaTitle || r.post.title + ' | AR Trade International'; }).catch(() => setMissing(true));
    return () => { document.title = 'AR Trade International'; };
  }, [slug]);
  const body = useMemo(() => (d ? withToc(d.post.body) : { html: '', toc: [] }), [d]);

  if (missing) return <NotFound />;
  if (!d) return <div style={{ padding: 80, textAlign: 'center' }}><span className="spin" /></div>;
  const { post, related } = d;
  const url = encodeURIComponent(window.location.href), tt = encodeURIComponent(post.title);
  const copy = () => { try { navigator.clipboard.writeText(window.location.href); } catch { /* clipboard unavailable */ } };

  return (
    <section className="bpost">
      <Progress />
      <div className="crumbs" style={{ marginBottom: 18 }}><Link to="/">Home</Link><span>/</span><Link to="/blog">Blog</Link><span>/</span><span style={{ color: '#16181d' }}>{post.title}</span></div>
      <div className="bl-layout">
        <article className="bp-main">
          <header className="bp-hd">
            <Link className="cat" to={'/blog?cat=' + encodeURIComponent(post.category)}>{post.category}</Link>
            <h1>{post.title}</h1>
            <div className="by">
              <i>AR</i>
              <span><b>AR Trade International</b><small>{fmtDate(post.date)} · {readMins(post.body)} min read</small></span>
              <div className="sh">
                <a href={'https://www.facebook.com/sharer/sharer.php?u=' + url} target="_blank" rel="noreferrer" style={{ background: '#1877f2' }} title="Share on Facebook">f</a>
                <a href={`https://twitter.com/intent/tweet?url=${url}&text=${tt}`} target="_blank" rel="noreferrer" style={{ background: '#0f1419' }} title="Share on X">X</a>
                <a href={'https://www.linkedin.com/sharing/share-offsite/?url=' + url} target="_blank" rel="noreferrer" style={{ background: '#0a66c2' }} title="Share on LinkedIn">in</a>
                <a href={`https://wa.me/?text=${tt}%20${url}`} target="_blank" rel="noreferrer" style={{ background: '#25d366' }} title="Share on WhatsApp">W</a>
                <button type="button" onClick={copy} title="Copy link">⧉</button>
              </div>
            </div>
          </header>
          {post.cover && <div className="bp-cover" style={{ backgroundImage: `url('${post.cover}')` }} role="img" aria-label={post.title} />}
          <div className="bp-body" dangerouslySetInnerHTML={{ __html: body.html }} />
          <div className="bp-end">
            <Link to={'/blog?cat=' + encodeURIComponent(post.category)}>More in {post.category} →</Link>
            <Link to="/blog">← All articles</Link>
          </div>
          {related.length > 0 && (
            <div className="bp-rel">
              <h2>More from the blog</h2>
              <div className="bl-grid two">{related.slice(0, 2).map(p => <Card key={p.slug} p={p} />)}</div>
            </div>
          )}
        </article>
        <Sidebar posts={all} current={post.slug} toc={body.toc} />
      </div>
    </section>
  );
}
