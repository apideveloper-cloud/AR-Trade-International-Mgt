import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Pill } from '../../ui.jsx';
import { ymd } from '../../ListFilter.jsx';
import { SeoPanel } from '../../SeoPanel.jsx';
import { StackField as Field } from '../../components/StackField.jsx';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import '../seo/brands.css';
import { RichToolbar } from './RichToolbar.jsx';
import { BLOG_TOOLS } from './richTools.js';
import { useRichEditor } from './useRichEditor.js';
import './blogAdmin.css';

const today = () => ymd(new Date()); // the date in Dhaka (UTC+6), not UTC
const INITIAL = () => ({ title: '', slug: '', category: '', excerpt: '', cover: '', status: 'Draft', date: today(), metaTitle: '', metaDesc: '', metaKeywords: '', noindex: false });
const fromRecord = r => ({ title: r.title, slug: r.slug, category: r.category, excerpt: r.excerpt, cover: r.cover, status: r.status, date: r.date, metaTitle: r.metaTitle, metaDesc: r.metaDesc, metaKeywords: r.metaKeywords, noindex: r.noindex });
const folderOf = f => 'blog/' + (f.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general');
const slugOf = title => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const IMG_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** Create / edit one article. The body is a small rich-text editor; the server sanitises it again on save. */
export function BlogEditor({ id, cats, onDone }) {
  const [slugTouched, setSlugTouched] = useState(false);
  const { f, set, patch, loading, loadErr, busy, setBusy, upl, msg, setMsg, ed, cmd, addImage, setCover } = useRichEditor({
    id, endpoint: '/blog', initial: INITIAL(), fromRecord, folderOf, onLoaded: () => setSlugTouched(true)
  });

  const save = async status => {
    setMsg(null); setBusy(true);
    try {
      const body = { ...f, status: status || f.status, body: ed.current.innerHTML };
      const r = id ? await adm.put('/blog/' + id, body) : await adm.post('/blog', body);
      setMsg({ t: (status || f.status) === 'Published' ? 'Saved and published.' : 'Saved as draft.' });
      if (!id) onDone(r.id); else set('slug', r.slug);
      if (status) set('status', status);
    } catch (e) { setMsg({ err: true, t: e.message }); }
    setBusy(false);
  };

  if (loading) return <div className="a-card">Loading…</div>;
  if (loadErr) return <div className="a-card"><div className="a-msg err">{msg?.t}</div><button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← Back</button></div>;
  return (
    <div className="bw-grid blg-layout">
      <div className="a-card blg-main">
        <div className="blg-topbar">
          <button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← All articles</button>
          <span className="blg-topbtns">
            {id && <Pill s={f.status === 'Published' ? 'Active' : 'Pending'} label={f.status} />}
            {id && f.status === 'Published' && <a className="a-btn ghost sm" href={'/blog/' + encodeURIComponent(f.slug)} target="_blank" rel="noreferrer">View on site ↗</a>}
          </span>
        </div>
        {msg && <div className={'a-msg ' + (msg.err ? 'err' : 'ok')}>{msg.t}</div>}
        <Field label="Title"><input className="a-input blg-title" value={f.title} onChange={e => { set('title', e.target.value); if (!slugTouched) set('slug', slugOf(e.target.value)); }} placeholder="Article title" /></Field>
        <div>
          <RichToolbar tools={BLOG_TOOLS} cmd={cmd} uploading={upl} onImage={addImage} linkTitle="Link" />
          <div ref={ed} contentEditable suppressContentEditableWarning className="bw-editor bp-body blg-body" />
        </div>
      </div>

      <div className="blg-side">
        <div className="a-card">
          <h3>Publish</h3>
          <Field label="Status"><select className="a-input" value={f.status} onChange={e => set('status', e.target.value)}><option>Published</option><option>Draft</option></select></Field>
          <Field label="Publish date"><input type="date" className="a-input" value={f.date} onChange={e => set('date', e.target.value)} /></Field>
          <div className="blg-actions">
            <button type="button" className="a-btn grad blg-grow" disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create article'}</button>
          </div>
          <div className="blg-actions">
            {f.status !== 'Published' && <button type="button" className="a-btn green sm blg-grow" disabled={busy} onClick={() => save('Published')}>Publish now</button>}
            {f.status === 'Published' && <button type="button" className="a-btn ghost sm blg-grow" disabled={busy} onClick={() => save('Draft')}>Unpublish (draft)</button>}
          </div>
        </div>
        <div className="a-card">
          <h3>Cover image</h3>
          {f.cover ? <div className="blg-cover" style={{ backgroundImage: `url('${f.cover}')` }} /> : <div className="blg-cover blg-cover-none">No cover image</div>}
          <div className="blg-actions">
            <label className="a-btn ghost sm blg-pick blg-pick-fill">{upl ? 'Uploading…' : 'Upload image'}<input type="file" accept={IMG_TYPES} hidden onChange={setCover} /></label>
            {f.cover && <button type="button" className="a-btn ghost sm" onClick={() => set('cover', '')}>Remove</button>}
          </div>
          <span className="blg-hint">PNG, JPG, GIF or WebP up to 6 MB. Best at 16:9 (e.g. 1600×900).</span>
        </div>
        <div className="a-card">
          <SeoPanel value={f} onChange={patch} path={'blog/' + (f.slug || '…')} title={f.title} summary={f.excerpt} category={f.category} />
        </div>
        <details className="a-card adbr-adv">
          <summary><b>Advanced SEO</b></summary>
          {id && f.slug ? <SeoItemEditor type="blog" id={f.slug} mode="advanced" /> : <small>Save first to edit advanced SEO</small>}
        </details>
        <div className="a-card">
          <h3>Details</h3>
          <Field label="Category"><input className="a-input" list="blog-cats" value={f.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Toner" /><datalist id="blog-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></Field>
          <Field label="Short summary" hint="shown on cards · optional"><textarea className="a-input" rows={3} maxLength={190} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Leave empty to use the first lines of the article" /></Field>
          <Field label="Web address" hint="/blog/…"><input className="a-input" value={f.slug} onChange={e => { setSlugTouched(true); set('slug', e.target.value); }} /></Field>
        </div>
      </div>
    </div>
  );
}
