import { useState } from 'react';
import { Switch } from '../ui.jsx';
import { useSeoItem } from './useSeoItem.js';
import { ScoreBadge } from './ScoreBadge.jsx';
import { SerpPreview } from './SerpPreview.jsx';
import { MetaFields } from './MetaFields.jsx';
import { SlugEditor } from './SlugEditor.jsx';
import { SocialFields } from './SocialFields.jsx';
import { FaqRepeater } from './FaqRepeater.jsx';
import { ImageAltEditor } from './ImageAltEditor.jsx';
import { SchemaPreview } from './SchemaPreview.jsx';
import { HistoryPanel } from './HistoryPanel.jsx';
import { IndexingHelper } from './IndexingHelper.jsx';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';
import './seoItem.css';

const MAX_KW = 12;
const tick = ok => <span className={'adsi-mark ' + (ok ? 'ok' : 'warn')}>{ok ? '✓' : '!'}</span>;

/** Per-item SEO editor. Props: type (product|category|brand|blog|page), id, mode ('full'|'advanced'), onChanged. */
function Editor({ type, id, mode, onChanged }) {
  const tr = useT();
  const s = useSeoItem(type, id, onChanged);
  const [kw, setKw] = useState('');
  const { data, manual: m, set } = s;
  if (s.loadErr) return <div className="a-msg err">{tr(s.loadErr)}</div>;
  if (!data) return <div className="adsi-muted">{tr('Loading SEO…')}</div>;
  const full = mode === 'full';
  const p = data.product;
  const kws = m.secondaryKeywords || [];
  const addKw = () => { const v = kw.trim(); if (v && kws.length < MAX_KW && !kws.includes(v)) set({ secondaryKeywords: [...kws, v] }); setKw(''); };
  const canon = m.canonicalUrl || '';
  const badCanon = !!canon && !/^https:\/\/\S+$/i.test(canon);
  const shownTitle = m.metaTitle || data.resolved?.title || data.auto?.title;
  const shownDesc = m.metaDescription || data.resolved?.description || data.auto?.description;
  return (
    <div className="adsi">
      <ScoreBadge score={data.score} />
      <SerpPreview title={shownTitle} description={shownDesc} url={data.url} product={p} />
      {full && <MetaFields manual={m} set={set} auto={data.auto} limits={data.limits} />}
      <SlugEditor key={data.slug?.value} type={type} id={id} slug={data.slug} onDone={r => { s.setData(d => ({ ...d, url: r.url || d.url, slug: { ...d.slug, value: r.slug } })); onChanged?.(); }} />
      <div className="adsi-sec">
        <label className="a-lbl">{tr('Focus keyword')}<input className="a-input" maxLength={80} value={m.focusKeyword || ''} onChange={e => set({ focusKeyword: e.target.value })} /></label>
        <span className="adsi-lbl">{tr('Secondary keywords')} <small className="adsi-note">{kws.length}/{MAX_KW}</small></span>
        <div className="adsi-chips">{kws.map(k => <span className="adsi-chip" key={k}>{k}<button type="button" aria-label={tr('Remove {name}', { name: k })} onClick={() => set({ secondaryKeywords: kws.filter(x => x !== k) })}>×</button></span>)}</div>
        <span className="adsi-row"><input className="a-input adsi-grow" value={kw} maxLength={60} placeholder={tr('Add a keyword')} onChange={e => setKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw(); } }} />
          <button type="button" className="a-btn" disabled={!kw.trim() || kws.length >= MAX_KW} onClick={addKw}>{tr('Add')}</button></span>
      </div>
      <div className="adsi-sec">
        <label className="a-lbl">{tr('Canonical URL')} <small className="adsi-note">{tr('empty = this page itself')}</small>
          <input className="a-input" value={canon} placeholder={data.resolved?.canonical || data.url} onChange={e => set({ canonicalUrl: e.target.value })} /></label>
        {badCanon && <div className="a-msg err">{tr('The canonical URL must start with https://')}</div>}
        {full && <div className="adsi-sw"><Switch on={m.robotsIndex === false} onChange={v => set({ robotsIndex: !v })} title={tr('Hide from search engines')} /><span>{tr('Hide from search engines (noindex)')}</span></div>}
        <div className="adsi-sw"><Switch on={m.robotsFollow === false} onChange={v => set({ robotsFollow: !v })} title={tr('Do not follow links')} /><span>{tr('Do not follow links on this page (nofollow)')}</span></div>
        {m.robotsIndex === false && <div className="a-msg err">{tr('This page is hidden from Google and will not appear in search results.')}</div>}
      </div>
      <SocialFields manual={m} set={set} auto={data.auto} url={data.url} />
      {p && (
        <div className="adsi-sec"><div className="adsi-hd"><b>{tr('Product data sent to Google')}</b><small className="adsi-note">{tr('Edit these in the product form')}</small></div>
          <ul className="adsi-facts">{[['Brand', p.brand], ['MPN', p.mpn], ['GTIN', p.gtin], ['Condition', p.condition], ['Warranty', p.warrantyText], ['Stock status', p.stockStatus]].map(([k, v]) => <li key={k}>{tick(!!v)}<span>{tr(k)}: {v || tr('not set')}</span></li>)}</ul></div>
      )}
      <FaqRepeater faq={m.faq} set={set} />
      {type === 'product' && <ImageAltEditor id={id} images={s.images} setImages={s.setImages} />}
      <SchemaPreview key={String(data.score?.score)} base={`/seo/item/${type}/${id}`} url={data.url} />
      <IndexingHelper url={data.url} />
      <div className="adsi-bar">
        {s.msg && <div className={'a-msg ' + (s.msg.ok ? 'ok' : 'err')}>{s.msg.lines.length > 1 ? <ul>{s.msg.lines.map((l, i) => <li key={i}>{tr(l)}</li>)}</ul> : tr(s.msg.lines[0])}</div>}
        <span className="adsi-hint">{s.dirty ? tr('Unsaved SEO changes') : tr('No changes')}</span>
        <button type="button" className="a-btn grad" disabled={s.busy || !s.dirty || badCanon} onClick={s.save}>{s.busy ? tr('Saving…') : tr('Save SEO')}</button>
      </div>
    </div>
  );
}

/** The editor plus its change History; a revert remounts the editor so it shows the restored values. */
export default function SeoItemEditor({ type, id, mode = 'full', onChanged }) {
  const [rev, setRev] = useState(0);
  return (
    <>
      <Editor key={rev} type={type} id={id} mode={mode} onChanged={onChanged} />
      <HistoryPanel type={type} id={id} onReverted={() => { setRev(n => n + 1); onChanged?.(); }} />
    </>
  );
}
