import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, copyText, fmtDate } from '../../api.js';
import { NotFound } from '../info/NotFound.jsx';
import Card from './Card.jsx';
import Sidebar from './Sidebar.jsx';
import Progress from './Progress.jsx';
import { readMins, withToc } from './blogUtils.js';
import './blog.css';

/** One article with the cleaned-up body copied from the live blog, plus related reads. */
export default function BlogPost() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [all, setAll] = useState([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => { let live = true; api.get('/blog').then(r => { if (live) setAll(r.posts); }).catch(() => {}); return () => { live = false; }; }, []);
  useEffect(() => {
    setD(null); setMissing(false); window.scrollTo(0, 0);
    let live = true; // a slow answer for the previous article must not overwrite the one now open
    api.get('/blog/' + slug).then(r => { if (!live) return; setD(r); document.title = r.post.metaTitle || r.post.title + ' | AR Trade International'; }).catch(() => { if (live) setMissing(true); });
    return () => { live = false; document.title = 'AR Trade International'; };
  }, [slug]);
  const body = useMemo(() => (d ? withToc(d.post.body) : { html: '', toc: [] }), [d]);

  if (missing) return <NotFound />;
  if (!d) return <div className="blgx-spin"><span className="spin" /></div>;
  const { post, related } = d;
  const url = encodeURIComponent(window.location.href), tt = encodeURIComponent(post.title);
  const copy = () => { copyText(window.location.href); };

  return (
    <section className="bpost">
      <Progress />
      <div className="crumbs blgx-crumbs"><Link to="/">Home</Link><span>/</span><Link to="/blog">Blog</Link><span>/</span><span className="blgx-crumb-cur">{post.title}</span></div>
      <div className="bl-layout">
        <article className="bp-main">
          <header className="bp-hd">
            <Link className="cat" to={'/blog?cat=' + encodeURIComponent(post.category)}>{post.category}</Link>
            <h1>{post.title}</h1>
            <div className="by">
              <i>AR</i>
              <span><b>AR Trade International</b><small>{fmtDate(post.date)} · {readMins(post.body)} min read</small></span>
              <div className="sh">
                <a className="blgx-fb" href={'https://www.facebook.com/sharer/sharer.php?u=' + url} target="_blank" rel="noreferrer" title="Share on Facebook">f</a>
                <a className="blgx-x" href={`https://twitter.com/intent/tweet?url=${url}&text=${tt}`} target="_blank" rel="noreferrer" title="Share on X">X</a>
                <a className="blgx-in" href={'https://www.linkedin.com/sharing/share-offsite/?url=' + url} target="_blank" rel="noreferrer" title="Share on LinkedIn">in</a>
                <a className="blgx-wa" href={`https://wa.me/?text=${tt}%20${url}`} target="_blank" rel="noreferrer" title="Share on WhatsApp">W</a>
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
