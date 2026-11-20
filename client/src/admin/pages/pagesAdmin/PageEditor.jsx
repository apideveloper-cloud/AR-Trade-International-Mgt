import { adm } from '../../adminApi.js';
import { SeoPanel } from '../../SeoPanel.jsx';
import { StackField as Field } from '../../components/StackField.jsx';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import '../seo/brands.css';
import { RichToolbar } from '../blogAdmin/RichToolbar.jsx';
import { PAGE_TOOLS } from '../blogAdmin/richTools.js';
import { useRichEditor } from '../blogAdmin/useRichEditor.js';
import './pagesAdmin.css';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

const INITIAL = { title: '', slug: '', excerpt: '', cover: '', status: 'Published', order: 0, metaTitle: '', metaDesc: '', metaKeywords: '', noindex: false };
const fromRecord = r => ({ title: r.title, slug: r.slug, excerpt: r.excerpt, cover: r.cover, status: r.status, order: r.order, metaTitle: r.metaTitle, metaDesc: r.metaDesc, metaKeywords: r.metaKeywords, noindex: r.noindex });
const IMG_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/** Upload folder for a page's images, e.g. services/toner-refill. */
const folderFor = (group, slug) => `${group === 'servicing' ? 'services' : group}/${(slug || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'general'}`;

/** Create / edit one static page (servicing, corporate client or company profile) with a rich-text body. */
export function PageEditor({ id, group, onDone }) {
  const tr = useT();
  const { f, set, patch, loading, loadErr, busy, setBusy, upl, msg, setMsg, ed, cmd, addImage, setCover } = useRichEditor({
    id, endpoint: '/pages', initial: INITIAL, fromRecord, folderOf: f => folderFor(group, f.slug)
  });
  const folder = folderFor(group, f.slug);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...f, group, body: ed.current.innerHTML };
      if (id) await adm.put('/pages/' + id, body); else { const r = await adm.post('/pages', body); setMsg({ t: 'Created.' }); onDone(r.id); setBusy(false); return; }
      setMsg({ t: 'Saved.' });
    } catch (e) { setMsg({ err: true, t: e.message }); }
    setBusy(false);
  };

  if (loading) return <div className="a-card">{tr('Loading…')}</div>;
  if (loadErr) return <div className="a-card"><div className="a-msg err">{tr(msg?.t)}</div><button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← {tr('Back')}</button></div>;
  return (
    <div className="a-card pgx-main">
      <div className="pgx-bar">
        <button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← {tr('All pages')}</button>
        <div className="pgx-barbtns">
          <select className="a-input pgx-status" value={f.status} onChange={e => set('status', e.target.value)}><option value="Published">{tr('Published')}</option><option value="Draft">{tr('Draft')}</option></select>
          <button type="button" className="a-btn grad" disabled={busy} onClick={save}>{busy ? tr('Saving…') : tr('Save')}</button>
        </div>
      </div>
      {msg && <div className={'a-msg ' + (msg.err ? 'err' : 'ok')}>{tr(msg.t)}</div>}
      <div className="pgx-two">
        <Field label={tr('Title')}><input className="a-input pgx-title" value={f.title} onChange={e => set('title', e.target.value)} /></Field>
        <Field label={tr('Order')}><input type="number" className="a-input" value={f.order} onChange={e => set('order', e.target.value)} /></Field>
      </div>
      <Field label={tr('Short summary')}><input className="a-input" maxLength={190} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder={tr('Shown on cards. Leave empty to use the first lines')} /></Field>
      <div className="pgx-coverrow">
        <div className="pgx-thumb" style={f.cover ? { backgroundImage: `url('${f.cover}')` } : undefined} />
        <label className="a-btn ghost sm blg-pick">{upl ? tr('Uploading…') : tr('Upload cover image')}<input type="file" accept={IMG_TYPES} hidden onChange={setCover} /></label>
        {f.cover && <button type="button" className="a-btn ghost sm" onClick={() => set('cover', '')}>{tr('Remove')}</button>}
        <span className="pgx-hint">{tr('Images are saved in uploads/{folder}/', { folder })}</span>
      </div>
      <div>
        <RichToolbar tools={PAGE_TOOLS} cmd={cmd} uploading={upl} onImage={addImage} roomy />
        <div ref={ed} contentEditable suppressContentEditableWarning className="bp-body pgx-body" />
      </div>
      <div className="pgx-seo">
        <SeoPanel value={f} onChange={patch} path={group === 'servicing' ? 'services/' + (f.slug || '…') : 'about'} title={f.title} summary={f.excerpt} />
        {group !== 'servicing' && <small className="pgx-note">{tr('This page is shown on the About page. Its title and description are used for /about when this is the Company profile; keywords of all three About pages are merged.')}</small>}
        <details className="a-card adbr-adv">
          <summary><b>{tr('Advanced SEO')}</b></summary>
          {id && f.slug ? <SeoItemEditor type="page" id={f.slug} mode="advanced" /> : <small>{tr('Save first to edit advanced SEO')}</small>}
        </details>
      </div>
    </div>
  );
}
