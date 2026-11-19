import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../../store.jsx';
import { CodeArt } from '../ErrorPages.jsx';

/** 404 page: search box, category links and ways back home. Kept in its own file because App.jsx imports it statically. */
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
