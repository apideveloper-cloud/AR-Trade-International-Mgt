import { useEffect, useState } from 'react';
import { adm } from '../adminApi.js';
import { DEFAULT_ABOUT, DEFAULT_FOOTER, DEFAULT_MENUS, withDefaults } from '../../data.js';

const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#3a3f4b', minWidth: 0 };

/** Image field: preview + upload into uploads/site/<folder>/ (or paste a link). */
function ImageField({ label, value, onChange, folder, wide }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const up = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try { const r = await adm.post('/upload-image', { folder: 'site/' + folder, name: f.name, data: await readFile(f) }); onChange(r.url); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  return (
    <div style={{ ...lbl, gridColumn: wide ? '1 / -1' : undefined }}>
      <span>{label}</span>
      <div className={'cx-img' + (wide ? ' wide' : '')}>
        <label className="cx-drop" style={{ backgroundImage: value ? `url('${value}')` : 'none' }} title="Click to upload an image">
          {!value && <span>⤒<small>{busy ? 'Uploading…' : 'Upload image'}</small></span>}
          {value && <em>{busy ? 'Uploading…' : 'Change'}</em>}
          <input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={up} />
        </label>
        <div className="cx-img-r">
          <input className="a-input" value={value || ''} onChange={e => onChange(e.target.value)} placeholder="/api/uploads/site/… or https://…" style={{ fontSize: 12 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="a-btn ghost sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading…' : '⤒ Upload image'}<input type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp" onChange={up} /></label>
            {value && <button type="button" className="a-btn ghost sm" style={{ color: '#b3261e' }} onClick={() => onChange('')}>Remove</button>}
            {err && <span style={{ color: '#b3261e', fontSize: 12 }}>{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ f, item, set }) {
  const v = item[f.k];
  if (f.type === 'image') return <ImageField label={f.label} value={v} onChange={x => set(f.k, x)} folder={f.folder} wide={f.wide} />;
  if (f.type === 'check') { const on = v !== false && !!v; return <div className="cx-toggle"><button type="button" role="switch" aria-checked={on} className={'a-sw' + (on ? ' on' : '')} onClick={() => set(f.k, !on)} /><span>{f.label}</span></div>; }
  if (f.type === 'select') return <label style={lbl}>{f.label}<select className="a-input" value={v || f.options[0][0]} onChange={e => set(f.k, e.target.value)}>{f.options.map(([val, l]) => <option key={val} value={val}>{l}</option>)}</select></label>;
  if (f.type === 'area') return <label style={{ ...lbl, gridColumn: '1 / -1' }}>{f.label}<textarea className="a-input" rows={f.rows || 3} value={v || ''} onChange={e => set(f.k, e.target.value)} /></label>;
  return <label style={{ ...lbl, gridColumn: f.wide ? '1 / -1' : undefined }}>{f.label}<input className="a-input" type={f.type || 'text'} value={v ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph || ''} /></label>;
}

/** Editable list of cards: fields per item (with optional conditions), reorder, remove, add. */
function ListEditor({ items, setItems, fields, blank, title, max = 60 }) {
  const mv = (i, d) => setItems(a => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; });
  const upd = (i, k, v) => setItems(a => a.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} className={'cx-item' + (it.on === false ? ' off' : '')}>
          <div className="cx-item-hd">
            <span className="cx-no">{i + 1}</span>
            <b>{title(it, i)}</b>
            <button type="button" className="cx-ic" title="Move up" onClick={() => mv(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="cx-ic" title="Move down" onClick={() => mv(i, 1)} disabled={i === items.length - 1}>↓</button>
            <button type="button" className="cx-ic del" title="Remove" onClick={() => setItems(a => a.filter((_, j) => j !== i))}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            {fields.filter(f => !f.show || f.show(it)).map(f => <Field key={f.k} f={f} item={it} set={(k, v) => upd(i, k, v)} />)}
          </div>
        </div>
      ))}
      {items.length < max && <button type="button" className="cx-add" onClick={() => setItems(a => [...a, typeof blank === 'function' ? blank() : { ...blank }])}>＋ Add another</button>}
    </div>
  );
}

const SLIDE_FIELDS = [
  { k: 'on', type: 'check', label: 'Show this slide' },
  { k: 'type', type: 'select', label: 'Slide style', options: [['image', 'Banner image (full)'], ['design', 'Text + product picture']] },
  { k: 'img', type: 'image', label: 'Banner image', folder: 'slides', wide: true, show: s => s.type === 'image' },
  { k: 'alt', label: 'Banner title (for accessibility)', show: s => s.type === 'image' },
  { k: 'href', label: 'Opens (e.g. #/shop/toner)', show: s => s.type === 'image' },
  { k: 'tag', label: 'Small tag line', show: s => s.type !== 'image' },
  { k: 'title', label: 'Headline', show: s => s.type !== 'image', ph: 'or {heroTitle} for the Settings text' },
  { k: 'sub', type: 'area', label: 'Sub text', rows: 2, show: s => s.type !== 'image' },
  { k: 'c1', label: 'Button 1 text', show: s => s.type !== 'image' }, { k: 'h1', label: 'Button 1 link', show: s => s.type !== 'image' },
  { k: 'c2', label: 'Button 2 text', show: s => s.type !== 'image' }, { k: 'h2', label: 'Button 2 link', show: s => s.type !== 'image' },
  { k: 'pic', type: 'image', label: 'Product picture', folder: 'slides', show: s => s.type !== 'image' },
  { k: 'badgeT', label: 'Badge top text', show: s => s.type !== 'image' }, { k: 'badgeV', label: 'Badge value', show: s => s.type !== 'image' }
];

const TAB_ICON = { slides: '🖼️', brands: '🏷️', clients: '🏢', perks: '✨', faqs: '❓', policies: '📜', about: 'ℹ️', menus: '🔗', general: '✎' };
const TABS = [
  ['slides', 'Home slider', 'The big banner on the home page. Order = display order.'],
  ['brands', 'Brand logos', 'The scrolling brand strip on the home page.'],
  ['clients', 'Client logos', 'Corporate clients on the About page.'],
  ['perks', 'Home highlights', 'The four icon cards under the slider.'],
  ['faqs', 'FAQs', 'Frequently asked questions page.'],
  ['policies', 'Policies', 'Privacy, terms, returns and shipping pages.'],
  ['about', 'About page', 'Introduction, Managing Director message, vision, mission, numbers and "why choose us" cards.'],
  ['menus', 'Menus & footer', 'Links in the Hot Products, Our Services and Blog dropdowns, the footer About column, and footer / contact texts.'],
  ['general', 'Texts & links', 'Section titles, social links and the search-box typing hints.']
];

/** Storefront content manager: everything on the public pages that is not a product, blog post or setting. */
export function ContentAdmin() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('slides');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    adm.get('/content').then(d => setData({
      ...d,
      about: withDefaults(DEFAULT_ABOUT, d.about), footer: withDefaults(DEFAULT_FOOTER, d.footer),
      menus: Object.fromEntries(['hot', 'services', 'blog', 'about'].map(k => [k, d.menus && d.menus[k] && d.menus[k].length ? d.menus[k] : DEFAULT_MENUS[k]]))
    })).catch(e => setMsg({ err: true, t: e.message }));
  }, []);
  if (!data) return msg ? <div className="a-msg err">{msg.t}</div> : <span className="spin" />;
  const set = (k, fn) => setData(d => ({ ...d, [k]: typeof fn === 'function' ? fn(d[k]) : fn }));
  const save = async keys => {
    setBusy(true); setMsg(null);
    try { for (const k of keys) { const r = await adm.put('/content/' + k, { value: data[k] }); setData(d => ({ ...d, [k]: r.value })); } setMsg({ t: 'Saved. The website shows it immediately.' }); }
    catch (e) { setMsg({ err: true, t: e.message }); }
    setBusy(false);
  };
  const SaveBar = ({ keys }) => (
    <div className="cx-save">
      <span>{msg ? <b style={{ color: msg.err ? '#ffb4ab' : '#9be7b4' }}>{msg.err ? '⚠ ' : '✓ '}{msg.t}</b> : 'Changes go live on the website as soon as you save.'}</span>
      <button type="button" className="a-btn" disabled={busy} onClick={() => save(keys)}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  );
  const policyFields = [{ k: 't', label: 'Title' }, { k: 'k', label: 'Web address key (e.g. privacy)' }];
  const desc = (TABS.find(t => t[0] === tab) || [])[2];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cx-tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={'cx-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setMsg(null); }}><i>{TAB_ICON[k]}</i>{l}</button>)}
      </div>
      <div className="cx-hero">
        <span className="cx-hero-ic">{TAB_ICON[tab]}</span>
        <div><b>{(TABS.find(t => t[0] === tab) || [])[1]}</b><span>{desc} Images are stored in the <u>uploads/site</u> folder.</span></div>
      </div>
      <div className="a-card cx-body" style={{ gap: 14 }}>

        {tab === 'slides' && <>
          <div className="cx-strip" aria-label="Slide order preview">
            {data.slides.map((s, i) => <div key={i} className={'cx-th' + (s.on === false ? ' off' : '')} title={s.type === 'image' ? (s.alt || 'banner') : (s.title || 'text slide')} style={{ backgroundImage: `url('${s.type === 'image' ? s.img : s.pic}')` }}><em>{i + 1}</em></div>)}
            <label style={{ ...lbl, maxWidth: 200, marginLeft: 'auto' }}>Seconds per slide<input className="a-input" type="number" min="2" max="30" step="0.5" value={data.slideSecs ?? 5.5} onChange={e => set('slideSecs', e.target.value)} /></label>
          </div>
          <ListEditor items={data.slides} setItems={fn => set('slides', fn)} fields={SLIDE_FIELDS} max={12} title={(s, i) => `Slide ${i + 1} · ${s.type === 'image' ? (s.alt || 'banner') : (s.title || 'text slide')}`} blank={() => ({ on: true, type: 'image', img: '', alt: '', href: '#/shop/all' })} />
          <SaveBar keys={['slides', 'slideSecs']} />
        </>}

        {tab === 'brands' && <>
          <ListEditor items={data.brands} setItems={fn => set('brands', fn)} max={40} title={b => b.n || 'New brand'} blank={{ n: '', src: '' }}
            fields={[{ k: 'n', label: 'Brand name' }, { k: 'src', type: 'image', label: 'Logo', folder: 'brands' }]} />
          <SaveBar keys={['brands']} />
        </>}

        {tab === 'clients' && <>
          <ListEditor items={(data.clients || []).map(c => ({ src: c }))} setItems={fn => set('clients', a => fn(a.map(c => ({ src: c }))).map(x => x.src))} max={80} title={(c, i) => `Client logo ${i + 1}`} blank={{ src: '' }}
            fields={[{ k: 'src', type: 'image', label: 'Logo', folder: 'clients' }]} />
          <SaveBar keys={['clients']} />
        </>}

        {tab === 'perks' && <>
          <ListEditor items={data.perks} setItems={fn => set('perks', fn)} max={8} title={p => p.t || 'Highlight'} blank={{ ic: '✓', t: '', d: '' }}
            fields={[{ k: 'ic', label: 'Icon (a symbol)' }, { k: 't', label: 'Title' }, { k: 'd', label: 'Description', wide: true }]} />
          <SaveBar keys={['perks']} />
        </>}

        {tab === 'faqs' && <>
          <ListEditor items={data.faqs} setItems={fn => set('faqs', fn)} max={40} title={f => f.q || 'New question'} blank={{ q: '', a: '' }}
            fields={[{ k: 'q', label: 'Question', wide: true }, { k: 'a', type: 'area', label: 'Answer (you can use {phone} for the store phone)', rows: 3 }]} />
          <SaveBar keys={['faqs']} />
        </>}

        {tab === 'policies' && <>
          {data.policies.map((p, pi) => (
            <div key={pi} style={{ border: '1px solid #e4e2dc', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                {policyFields.map(f => <Field key={f.k} f={f} item={p} set={(k, v) => set('policies', a => a.map((x, j) => (j === pi ? { ...x, [k]: v } : x)))} />)}
              </div>
              <ListEditor items={p.secs} setItems={fn => set('policies', a => a.map((x, j) => (j === pi ? { ...x, secs: fn(x.secs) } : x)))} max={30} title={(s, i) => `Section ${i + 1} · ${s.h || ''}`} blank={{ h: '', p: '' }}
                fields={[{ k: 'h', label: 'Heading', wide: true }, { k: 'p', type: 'area', label: 'Text', rows: 3 }]} />
            </div>
          ))}
          <SaveBar keys={['policies']} />
        </>}

        {tab === 'about' && <>
          <h4 className="cx-h">Introduction</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            {[['heading', 'Page heading'], ['intro', 'Introduction'], ['mdMessage', 'Managing Director message'], ['mdName', 'Managing Director name'], ['mdTitle', 'Managing Director title'], ['vision', 'Vision'], ['mission', 'Mission']].map(([k, l]) => (
              <label key={k} style={lbl}>{l}{['intro', 'mdMessage', 'vision', 'mission'].includes(k) ? <textarea className="a-input" rows={3} value={data.about[k] || ''} onChange={e => set('about', a => ({ ...a, [k]: e.target.value }))} /> : <input className="a-input" value={data.about[k] || ''} onChange={e => set('about', a => ({ ...a, [k]: e.target.value }))} />}</label>
            ))}
          </div>
          <h4 className="cx-h">Numbers</h4>
          <ListEditor items={data.stats} setItems={fn => set('stats', fn)} max={8} title={s => `${s.v} ${s.t}`} blank={{ v: '', t: '' }} fields={[{ k: 'v', label: 'Number (e.g. 2011)' }, { k: 't', label: 'Caption' }]} />
          <h4 className="cx-h">Why choose us</h4>
          <ListEditor items={data.whys} setItems={fn => set('whys', fn)} max={12} title={w => w.t || 'New card'} blank={{ t: '', d: '' }} fields={[{ k: 't', label: 'Title' }, { k: 'd', type: 'area', label: 'Description', rows: 2 }]} />
          <SaveBar keys={['about', 'stats', 'whys']} />
        </>}

        {tab === 'menus' && <>
          {[['hot', 'Hot Products dropdown'], ['services', 'Our Services dropdown'], ['blog', 'Blog dropdown'], ['about', 'Footer "About us" column']].map(([k, title]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h4 className="cx-h">{title}</h4>
              <ListEditor items={(data.menus[k] || []).map(i => ({ t: i.t, link: i.href || i.to || '' }))} max={20} title={i => i.t || 'New link'} blank={{ t: '', link: '' }}
                setItems={fn => set('menus', m => ({ ...m, [k]: fn((m[k] || []).map(i => ({ t: i.t, link: i.href || i.to || '' }))).map(i => ({ t: i.t, to: i.link })) }))}
                fields={[{ k: 't', label: 'Text' }, { k: 'link', label: 'Link (/shop/toner, /blog or https://…)' }]} />
            </div>
          ))}
          <h4 className="cx-h">Footer and contact page texts</h4>
          <div style={{ display: 'grid', gap: 10 }}>
            {[['tagline', 'Footer description'], ['hours', 'Opening hours'], ['mobileBanking', 'Contact page: mobile banking line'], ['email2', 'Contact page: second email']].map(([k, l]) => <label key={k} style={lbl}>{l}<input className="a-input" value={data.footer[k] || ''} onChange={e => set('footer', f => ({ ...f, [k]: e.target.value }))} /></label>)}
          </div>
          <SaveBar keys={['menus', 'footer']} />
        </>}

        {tab === 'general' && <>
          <h4 className="cx-h">Social links</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {['facebook', 'instagram', 'linkedin', 'youtube', 'x'].map(k => <label key={k} style={lbl}>{k[0].toUpperCase() + k.slice(1)}<input className="a-input" value={data.social?.[k] || ''} onChange={e => set('social', s => ({ ...s, [k]: e.target.value }))} placeholder="https://…" /></label>)}
          </div>
          <h4 className="cx-h">Section titles on the home page</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            {Object.keys(data.labels || {}).map(k => <label key={k} style={lbl}>{k}<input className="a-input" value={data.labels[k]} onChange={e => set('labels', l => ({ ...l, [k]: e.target.value }))} /></label>)}
          </div>
          <h4 className="cx-h">Home page blocks (show / hide)</h4>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.keys(data.sections || {}).map(k => <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={!!data.sections[k]} onChange={e => set('sections', s => ({ ...s, [k]: e.target.checked }))} />{k}</label>)}
          </div>
          <label style={lbl}>Search-box typing hints (one per line)<textarea className="a-input" rows={5} value={(data.words || []).join('\n')} onChange={e => set('words', e.target.value.split('\n'))} /></label>
          <SaveBar keys={['social', 'labels', 'sections', 'words']} />
        </>}
      </div>
    </div>
  );
}
