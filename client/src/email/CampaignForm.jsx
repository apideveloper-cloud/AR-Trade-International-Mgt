import { useEffect, useMemo, useRef, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmtTime } from '../api.js';

const card = { background: '#fff', borderRadius: 20, boxShadow: '0 1px 2px rgba(11,22,49,.05),0 10px 24px -18px rgba(11,22,49,.3)' };
const inp = { border: '1px solid #d3d8e3', borderRadius: 12, padding: '10px 12px', fontSize: 14, background: '#fff', width: '100%', fontFamily: 'inherit' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#56607a' };
const hint = { fontWeight: 500, color: '#8a8f9b' };
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
    <div style={{ flex: '1 1 100%', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <form onSubmit={create} style={{ ...card, flex: '1 1 380px', maxWidth: 520, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
        <b style={{ fontFamily: 'var(--disp)', fontSize: 20, color: '#0b1631' }}>New campaign</b>
        <label style={lbl}>Campaign name<input required value={f.name} onChange={set('name')} placeholder="e.g. Victory Day toner sale" style={inp} /></label>
        <label style={lbl}>Template<select value={f.tpl} onChange={set('tpl')} style={inp}>{tpls.map(t => <option key={t.id} value={t.id}>{t.name} · {t.kind}</option>)}</select></label>
        <label style={lbl}>Subject line A<input required value={f.subjA} onChange={set('subjA')} placeholder="Eid Mubarak: office restock, 18% off" style={inp} /></label>
        <label style={lbl}>Subject line B <span style={hint}>Optional, for an A/B test</span><input value={f.subjB} onChange={set('subjB')} placeholder="Your Eid toner deal is inside" style={inp} /></label>

        <b style={{ fontSize: 13, color: '#0b1631', paddingTop: 6 }}>Email design</b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lbl}>Small line above <span style={hint}>(kicker)</span><input value={f.kicker} onChange={set('kicker')} placeholder="Picks that stand out" style={inp} /></label>
          <label style={lbl}>Big headline<input value={f.headline} onChange={set('headline')} placeholder={tplSel?.headline || 'Worth your attention'} style={inp} /></label>
        </div>
        <label style={lbl}>Message <span style={hint}>Leave empty to use the template text</span><textarea rows={3} value={f.body} onChange={set('body')} placeholder={tplSel?.body} style={{ ...inp, resize: 'vertical' }} /></label>
        <div style={lbl}>Banner colour
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HEROES.map(([k, n, c]) => <button key={k} type="button" title={n} aria-label={n} onClick={() => setF(v => ({ ...v, hero: k }))} style={{ width: 30, height: 30, borderRadius: 99, background: c, border: f.hero === k ? '3px solid #e0245e' : '2px solid #fff', boxShadow: '0 0 0 1px #d3d8e3', cursor: 'pointer' }} />)}
          </div>
        </div>

        <div style={lbl}>Products in the email <span style={hint}>Pick up to 8, shown two per row with price and discount badge</span>
          {!!picked.length && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {picked.map(p => <button key={p.id} type="button" onClick={() => toggle(p)} title="Remove" style={{ border: 0, background: '#eaf0fb', color: '#173a7a', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name} ✕</button>)}
            </div>
          )}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products by name or brand" style={inp} />
          <div style={{ maxHeight: 190, overflow: 'auto', border: '1px solid #e6e9f0', borderRadius: 12 }}>
            {!found.length && <div style={{ padding: 12, fontWeight: 500, color: '#8a8f9b' }}>No products found.</div>}
            {found.map(p => {
              const on = picked.some(x => x.id === p.id);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p)} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #f1f2f6', background: on ? '#eef6ff' : '#fff', padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {p.img ? <img src={p.img} alt="" width="34" height="34" style={{ objectFit: 'contain', borderRadius: 6, background: '#f4f6fa' }} /> : <span style={{ width: 34, height: 34 }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: '#0b1631', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0b1631', whiteSpace: 'nowrap' }}>{off(p) ? <i style={{ fontStyle: 'normal', background: '#e0245e', color: '#fff', borderRadius: 4, padding: '1px 5px', marginRight: 5 }}>-{off(p)}%</i> : null}{taka(p.price)}</span>
                  <span style={{ width: 16, color: '#1a8a5a', fontWeight: 800 }}>{on ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={lbl}>Button text<input value={f.cta} onChange={set('cta')} placeholder="Explore deals" style={inp} /></label>
          <label style={lbl}>Button link <span style={hint}>(https, empty = shop)</span><input value={f.ctaUrl} onChange={set('ctaUrl')} placeholder="https://…" style={inp} /></label>
        </div>
        <label style={lbl}>Audience<select value={f.aud} onChange={set('aud')} style={inp}><option value="offers">Subscribers who want offers</option><option value="festivals">Subscribers who want festival campaigns</option><option value="tips">Subscribers who want health tips</option><option value="all">All confirmed subscribers</option></select></label>
        <label style={lbl}>Schedule <span style={hint}>Leave empty to send now</span><input type="datetime-local" value={f.when} onChange={set('when')} style={inp} /></label>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.42 0.12 150)' }}>{msg}</span>}{err && <span style={{ fontSize: 13, fontWeight: 700, color: 'oklch(0.5 0.18 25)' }}>{err}</span>}
        <button style={{ border: 0, background: 'linear-gradient(135deg,oklch(0.6 0.14 240),oklch(0.46 0.16 256))', color: '#fff', borderRadius: 999, padding: 13, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>Schedule / send campaign</button>
        <span style={{ fontSize: 12, color: '#7a8090' }}>Logo, unsubscribe and preference links are added automatically. Only confirmed subscribers receive it.</span>
      </form>
      <div style={{ ...card, flex: '999 1 420px', minWidth: 0, padding: 14, position: 'sticky', top: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 10px' }}><b style={{ fontSize: 14, color: '#0b1631' }}>Live preview</b><span style={{ fontSize: 12, color: '#7a8090' }}>{f.subjA || 'Subject line appears here'}</span></div>
        <iframe title="Email preview" srcDoc={html} style={{ width: '100%', height: 640, border: '1px solid #e6e9f0', borderRadius: 12, background: '#f1f3f8' }} />
      </div>
    </div>
  );
}
