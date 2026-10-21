import { useState } from 'react';
import { api, fmtDate } from '../api.js';

/** Stars filled to a fractional value (e.g. 4.3) using an overlay clipped to width. */
export function Stars({ value = 0, size = 16 }) {
  return (
    <span className="rv-stars" style={{ fontSize: size }} aria-label={`${value} out of 5`}>
      <span className="bg">★★★★★</span>
      <span className="fg" style={{ width: (Math.max(0, Math.min(5, value)) / 5) * 100 + '%' }}>★★★★★</span>
    </span>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Customer reviews: summary, write form (sign-in required, published after admin approval) and the approved list. */
export default function Reviews({ pid, data, user, onLogin, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!data) return null;
  const max = Math.max(1, ...data.dist);

  const submit = async e => {
    e.preventDefault();
    setMsg(null);
    if (!rating) return setMsg({ err: true, t: 'Please choose a star rating.' });
    setBusy(true);
    try {
      await api.post(`/products/${pid}/reviews`, { rating, title, body });
      setMsg({ t: 'Thank you! Your review was received and will appear here once our team approves it.' });
      setOpen(false); setRating(0); setTitle(''); setBody('');
      onSubmitted();
    } catch (er) { setMsg({ err: true, t: er.message }); }
    setBusy(false);
  };

  const mine = data.mine;
  const shown = hover || rating;

  return (
    <section className="rv" id="reviews">
      <div className="rv-hd"><h2>Customer reviews</h2><span>Reviews are published after approval by our team</span></div>
      <div className="rv-grid">
        <aside className="rv-sum">
          <div className="rv-big"><b>{data.count ? data.avg.toFixed(1) : '–'}</b><span>/ 5</span></div>
          <Stars value={data.avg} size={22} />
          <span className="rv-cnt">{data.count ? `Based on ${data.count} review${data.count > 1 ? 's' : ''}` : 'No reviews yet'}</span>
          <div className="rv-bars">
            {[5, 4, 3, 2, 1].map(n => (
              <div key={n}><span>{n} ★</span><i><em style={{ width: (data.dist[n - 1] / max) * 100 + '%' }} /></i><span>{data.dist[n - 1]}</span></div>
            ))}
          </div>
          {!user && <button className="rv-cta" onClick={onLogin}>Sign in to write a review</button>}
          {user && !mine && !open && <button className="rv-cta" onClick={() => { setOpen(true); setMsg(null); }}>✎ Write a review</button>}
          {user && mine === 'Pending' && <div className="rv-note">⏳ Your review is awaiting approval.</div>}
          {user && mine === 'Approved' && <div className="rv-note ok">✓ You have reviewed this product.</div>}
        </aside>

        <div className="rv-main">
          {msg && <div className={'rv-note' + (msg.err ? ' err' : ' ok')}>{msg.t}</div>}
          {open && (
            <form className="rv-form" onSubmit={submit}>
              <b>Rate this product</b>
              <div className="rv-pick" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button type="button" key={n} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
                ))}
                <span>{LABELS[shown]}</span>
              </div>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Review title (optional)" />
              <textarea value={body} onChange={e => setBody(e.target.value)} required minLength={10} maxLength={1500} rows={4} placeholder="Share your experience with this product (at least 10 characters)" />
              <div className="rv-actions">
                <button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button>
                <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          )}

          {!data.reviews.length && !open && (
            <div className="rv-empty"><i>★</i><b>Be the first to review this product</b><span>Your feedback helps other customers choose the right toner and printer.</span></div>
          )}
          <div className="rv-list">
            {data.reviews.map(r => (
              <article key={r.id}>
                <div className="av">{(r.name || '?').trim().charAt(0).toUpperCase()}</div>
                <div className="tx">
                  <div className="top"><b>{r.name}</b>{r.verified && <em>✓ Verified purchase</em>}<time>{fmtDate(r.at)}</time></div>
                  <Stars value={r.rating} size={14} />
                  {r.title && <h4>{r.title}</h4>}
                  <p>{r.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
