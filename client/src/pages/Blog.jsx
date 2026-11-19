import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Card from './blog/Card.jsx';
import Sidebar from './blog/Sidebar.jsx';
import { match } from './blog/blogUtils.js';
import './blog/blog.css';

export { default as BlogPost } from './blog/BlogPost.jsx';

const PAGE = 9;

/** Blog index: featured article, category chips and a paged grid, with the search/category menu on the right. */
export function Blog() {
  const [posts, setPosts] = useState(null);
  const [err, setErr] = useState('');
  const [sp, setSp] = useSearchParams();
  const [shown, setShown] = useState(PAGE);
  const cat = sp.get('cat') || '';
  const q = sp.get('q') || '';
  const setQ = v => { const n = new URLSearchParams(sp); if (v) n.set('q', v); else n.delete('q'); setSp(n, { replace: true }); };

  useEffect(() => {
    document.title = 'Blog | AR Trade International';
    let live = true;
    api.get('/blog').then(d => { if (live) setPosts(d.posts); }).catch(e => { if (live) setErr(e.message); });
    return () => { live = false; document.title = 'AR Trade International'; };
  }, []);
  useEffect(() => { setShown(PAGE); }, [cat, q]);

  const list = useMemo(() => (posts || []).filter(p => (!cat || p.category === cat) && match(p, q)), [posts, cat, q]);
  const feature = !cat && !q ? list[0] : null;
  const rest = feature ? list.slice(1) : list;

  if (err) return <div className="a-msg err blgx-err">{err}</div>;
  if (!posts) return <div className="blgx-spin"><span className="spin" /></div>;

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
