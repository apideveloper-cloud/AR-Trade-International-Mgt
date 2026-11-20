import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import RrqStars from './RrqStars.jsx';
import { TEXT, initialLang, saveLang } from './reviewRequestText.js';
import './review-request.css';

const MIN = 10, MAX = 1500;

/** Public page opened from the review e-mail / WhatsApp link. Bilingual, noindex, no login. */
export default function ReviewRequest() {
  const { token } = useParams();
  const [qs] = useSearchParams();
  const [lang, setLang] = useState(initialLang);
  const t = TEXT[lang];
  const [d, setD] = useState(null);
  const [fail, setFail] = useState(null); // { status, msg }
  const [rows, setRows] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tried, setTried] = useState(false);
  const [phase, setPhase] = useState(qs.get('optout') === '1' ? 'optAsk' : 'form'); // form | optAsk | optDone | thanks

  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex,nofollow';
    document.head.appendChild(m);
    const old = document.title;
    document.title = 'Review your order | AR Trade International';
    return () => { m.remove(); document.title = old; };
  }, []);

  useEffect(() => {
    api.get('/review-request/' + encodeURIComponent(token)).then(setD).catch(e => setFail({ status: e.status, msg: e.message }));
  }, [token]);

  const pick = l => { setLang(l); saveLang(l); };
  const set = (id, k, v) => setRows(r => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const todo = useMemo(() => (d ? d.items.filter(i => !i.alreadyReviewed) : []), [d]);
  const filled = id => { const r = rows[id] || {}; return !!(r.rating || (r.title || '').trim() || (r.body || '').trim()); };
  const bodyLen = id => ((rows[id] || {}).body || '').trim().length;
  const rowProblem = id => (!filled(id) ? '' : !(rows[id] || {}).rating ? t.needRating : bodyLen(id) < MIN ? t.short(MIN - bodyLen(id)) : '');

  const submit = async e => {
    e.preventDefault(); setErr(''); setTried(true);
    const send = todo.filter(i => filled(i.productId));
    if (!send.length) return setErr(t.needOne);
    if (send.some(i => rowProblem(i.productId))) return;
    setBusy(true);
    try {
      await api.post('/review-request/' + encodeURIComponent(token), {
        reviews: send.map(i => { const r = rows[i.productId]; return { productId: i.productId, rating: r.rating, title: (r.title || '').trim(), body: r.body.trim() }; }),
        renderedAt: d.renderedAt,
        website: e.target.elements.website.value,
      });
      setPhase('thanks');
    } catch (er) { setErr(er.status === 0 ? t.netErr : er.message); }
    setBusy(false);
  };

  const optout = async () => {
    setErr('');
    try { await api.post(`/review-request/${encodeURIComponent(token)}/optout`); setPhase('optDone'); } catch (er) { setErr(er.status === 0 ? t.netErr : er.message); }
  };
  const askOptout = () => { if (window.confirm(t.optConfirm)) optout(); };

  const shell = body => (
    <div className="rrq">
      <div className="rrq-card">
        <div className="rrq-hd">
          <img src="/ar-icon-round.png" alt="AR Trade" className="rrq-logo" />
          <b className="rrq-brand">AR Trade International</b>
          <div className="rrq-lang" role="group" aria-label="Language">
            <button type="button" className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => pick('en')}>EN</button>
            <button type="button" className={lang === 'bn' ? 'on' : ''} aria-pressed={lang === 'bn'} onClick={() => pick('bn')} lang="bn">বাংলা</button>
          </div>
        </div>
        <div className="rrq-body" lang={lang}>{body}</div>
        <div className="rrq-note">{t.footer}</div>
      </div>
    </div>
  );
  const alert = err && <div className="rrq-alert" role="alert">{err}</div>;

  if (fail) {
    const gone = fail.status === 410;
    return shell(<div className="rrq-msg"><h1>{gone ? t.goneTitle : t.badTitle}</h1><p>{gone ? t.goneBody : t.badBody}</p><Link className="rrq-btn" to="/">{t.shop}</Link></div>);
  }
  if (!d) return shell(<div className="rrq-load" role="status"><span className="spin" /><span>{t.loading}</span></div>);
  if (phase === 'optDone') return shell(<div className="rrq-msg"><h1>✓</h1><p>{t.optDone}</p><Link className="rrq-btn" to="/">{t.shop}</Link></div>);
  if (phase === 'thanks') return shell(<div className="rrq-msg"><h1>{t.thanksTitle}</h1><p>{t.thanksBody}</p><Link className="rrq-btn" to="/">{t.shop}</Link></div>);
  if (phase === 'optAsk') {
    return shell(<div className="rrq-msg"><p>{t.optConfirm}</p>{alert}
      <button type="button" className="rrq-btn" onClick={optout}>{t.optout}</button>
      <button type="button" className="rrq-link" onClick={() => setPhase('form')}>{t.hi(d.firstName)}</button></div>);
  }

  return shell(
    <form onSubmit={submit} noValidate>
      <h1 className="rrq-h1">{t.hi(d.firstName)}</h1>
      {d.orderRef && <span className="rrq-order">{t.order} {d.orderRef}</span>}
      <p className="rrq-lead">{t.lead}</p>
      <input className="rrq-hp" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
      {d.items.map(i => {
        const id = i.productId, r = rows[id] || {}, prob = tried ? rowProblem(id) : '';
        return (
          <fieldset key={id} className="rrq-item" disabled={i.alreadyReviewed || busy}>
            <legend className="rrq-prod">
              {i.img && <img src={i.img} alt="" loading="lazy" />}<span>{i.name}</span>
            </legend>
            {i.alreadyReviewed ? <div className="rrq-done">✓ {t.done}</div> : <>
              <RrqStars name={'rate-' + id} value={r.rating || 0} onChange={v => set(id, 'rating', v)} t={t} />
              <input className="rrq-in" value={r.title || ''} onChange={e => set(id, 'title', e.target.value)} maxLength={120} placeholder={t.titlePh} aria-label={t.titlePh} />
              <textarea className="rrq-in" rows={4} value={r.body || ''} onChange={e => set(id, 'body', e.target.value)} maxLength={MAX} placeholder={t.bodyPh} aria-label={t.bodyPh} aria-invalid={!!prob} aria-describedby={'rrq-c-' + id} />
              <div className="rrq-meta" id={'rrq-c-' + id}>
                <span className="rrq-err">{prob}</span>
                <span className="rrq-count">{t.count((r.body || '').length, MAX)}</span>
              </div>
            </>}
          </fieldset>
        );
      })}
      {!todo.length && <p className="rrq-lead">{t.allDone}</p>}
      {alert}
      {!!todo.length && <button className="rrq-btn rrq-submit" type="submit" disabled={busy}>{busy ? t.sending : t.submit}</button>}
      <button type="button" className="rrq-link" onClick={askOptout}>{t.optout}</button>
    </form>
  );
}
