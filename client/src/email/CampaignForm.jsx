import { useEffect, useMemo, useRef, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmtTime } from '../api.js';

const HEROES = [['navy', 'Navy', '#0b1631'], ['pink', 'Rose', '#f4a9b8'], ['blue', 'Sky', '#bfe0f8'], ['green', 'Green', '#0f6b52'], ['red', 'Red', '#b3261e'], ['gold', 'Gold', '#b7791f']];
const taka = n => '৳ ' + Number(n || 0).toLocaleString('en-US');
const off = p => (p.old > p.price ? Math.round((p.old - p.price) / p.old * 100) : 0);

/** Designs a marketing email (headline, hero colour, product grid, button) with a live preview, then schedules or sends it. */
export function CampaignForm({ tpls, onDone }) {
  const [f, setF] = useState({ name: '', tpl: '', subjA: '', subjB: '', aud: 'offers', when: '', kicker: '', headline: '', body: '', hero: 'navy', cta: 'Explore deals', ctaUrl: '' });
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const [html, setHtml] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const tplSel = useMemo(() => tpls.find(t => t.id === f.tpl), [tpls, f.tpl]);

  useEffect(() => { if (!f.tpl && tpls[0]) setF(v => ({ ...v, tpl: tpls[0].id })); }, [tpls, f.tpl]);
  useEffect(() => { const t = setTimeout(() => api.get('/products?q=' + encodeURIComponent(q)).then(setFound).catch(() => setFound([])), 250); return () => clearTimeout(t); }, [q]);

  const design = useMemo(() => ({ kicker: f.kicker, headline: f.headline, hero: f.hero, cta: f.cta, ctaUrl: f.ctaUrl, products: picked.map(p => p.id) }), [f.kicker, f.headline, f.hero, f.cta, f.ctaUrl, picked]);
  const seq = useRef(0);
  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => api.post('/preview', { subject: f.subjA, body: f.body, tpl: f.tpl, design }).then(r => { if (n === seq.current) setHtml(r.html); }).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [f.subjA, f.body, f.tpl, design]);

  const toggle = p => setPicked(l => (l.some(x => x.id === p.id) ? l.filter(x => x.id !== p.id) : l.length < 8 ? [...l, p] : l));
  const create = async e => {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const c = await api.post('/campaigns', { name: f.name, tpl: f.tpl, subjA: f.subjA, subjB: f.subjB, aud: f.aud, when: f.when, body: f.body, design });
      setMsg(c.status === 'Sent' ? `✓ Recorded for ${c.sent} subscriber${c.sent === 1 ? '' : 's'}` : '✓ Scheduled for ' + fmtTime(c.at));
      setF(v => ({ ...v, name: '', subjA: '', subjB: '', when: '', kicker: '', headline: '', body: '' })); setPicked([]); onDone();
    } catch (er) { setErr(er.message); }
  };

  return (
    <div className="em-cf">
      <form onSubmit={create} className="em-cf-card em-cf-form">
        <b className="em-cf-title">New campaign</b>
        <label className="em-cf-lbl">Campaign name<input required value={f.name} onChange={set('name')} placeholder="e.g. Victory Day toner sale" className="em-cf-inp" /></label>
        <label className="em-cf-lbl">Template<select value={f.tpl} onChange={set('tpl')} className="em-cf-inp">{tpls.map(t => <option key={t.id} value={t.id}>{t.name} · {t.kind}</option>)}</select></label>
        <label className="em-cf-lbl">Subject line A<input required value={f.subjA} onChange={set('subjA')} placeholder="Eid Mubarak: office restock, 18% off" className="em-cf-inp" /></label>
        <label className="em-cf-lbl">Subject line B <span className="em-cf-hint">Optional, for an A/B test</span><input value={f.subjB} onChange={set('subjB')} placeholder="Your Eid toner deal is inside" className="em-cf-inp" /></label>

        <b className="em-cf-subhead">Email design</b>
        <div className="em-cf-grid2">
          <label className="em-cf-lbl">Small line above <span className="em-cf-hint">(kicker)</span><input value={f.kicker} onChange={set('kicker')} placeholder="Picks that stand out" className="em-cf-inp" /></label>
          <label className="em-cf-lbl">Big headline<input value={f.headline} onChange={set('headline')} placeholder={tplSel?.headline || 'Worth your attention'} className="em-cf-inp" /></label>
        </div>
        <label className="em-cf-lbl">Message <span className="em-cf-hint">Leave empty to use the template text</span><textarea rows={3} value={f.body} onChange={set('body')} placeholder={tplSel?.body} className="em-cf-inp em-cf-inp--area" /></label>
        <div className="em-cf-lbl">Banner colour
          <div className="em-cf-swatches">
            {HEROES.map(([k, n, c]) => <button key={k} type="button" title={n} aria-label={n} onClick={() => setF(v => ({ ...v, hero: k }))} className={'em-cf-swatch' + (f.hero === k ? ' em-cf-swatch--on' : '')} style={{ background: c }} />)}
          </div>
        </div>

        <div className="em-cf-lbl">Products in the email <span className="em-cf-hint">Pick up to 8, shown two per row with price and discount badge</span>
          {!!picked.length && (
            <div className="em-cf-picked">
              {picked.map(p => <button key={p.id} type="button" onClick={() => toggle(p)} title="Remove" className="em-cf-chip">{p.name} ✕</button>)}
            </div>
          )}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products by name or brand" className="em-cf-inp" />
          <div className="em-cf-results">
            {!found.length && <div className="em-cf-none">No products found.</div>}
            {found.map(p => {
              const on = picked.some(x => x.id === p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p)} className={'em-cf-row' + (on ? ' em-cf-row--on' : '')}>
                  {p.img ? <img src={p.img} alt="" width="34" height="34" className="em-cf-thumb" /> : <span className="em-cf-thumb-blank" />}
                  <span className="em-cf-name">{p.name}</span>
                  <span className="em-cf-price">{off(p) ? <i className="em-cf-off">-{off(p)}%</i> : null}{taka(p.price)}</span>
                  <span className="em-cf-check">{on ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="em-cf-grid2">
          <label className="em-cf-lbl">Button text<input value={f.cta} onChange={set('cta')} placeholder="Explore deals" className="em-cf-inp" /></label>
          <label className="em-cf-lbl">Button link <span className="em-cf-hint">(https, empty = shop)</span><input value={f.ctaUrl} onChange={set('ctaUrl')} placeholder="https://…" className="em-cf-inp" /></label>
        </div>
        <label className="em-cf-lbl">Audience<select value={f.aud} onChange={set('aud')} className="em-cf-inp"><option value="offers">Subscribers who want offers</option><option value="festivals">Subscribers who want festival campaigns</option><option value="tips">Subscribers who want health tips</option><option value="all">All confirmed subscribers</option></select></label>
        <label className="em-cf-lbl">Schedule <span className="em-cf-hint">Leave empty to send now</span><input type="datetime-local" value={f.when} onChange={set('when')} className="em-cf-inp" /></label>
        {msg && <span className="em-cf-msg">{msg}</span>}{err && <span className="em-cf-msg em-cf-msg--err">{err}</span>}
        <button className="em-cf-submit">Schedule / send campaign</button>
        <span className="em-cf-foot">Logo, unsubscribe and preference links are added automatically. Only confirmed subscribers receive it.</span>
      </form>
      <div className="em-cf-card em-cf-preview">
        <div className="em-cf-pv-head"><b className="em-cf-pv-title">Live preview</b><span className="em-cf-pv-subj">{f.subjA || 'Subject line appears here'}</span></div>
        <iframe title="Email preview" sandbox="allow-popups" srcDoc={html} className="em-cf-frame" />
      </div>
    </div>
  );
}
