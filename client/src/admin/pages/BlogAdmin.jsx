import { useEffect, useRef, useState } from 'react';
import { adm, dateF, useTable } from '../adminApi.js';
import { Empty, Pager, Pill, Toolbar, ViewToggle, alertBox, confirmBox, useView } from '../ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const Field = ({ label, hint, children, style }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#3a3f4b', ...style }}>
    <span>{label}{hint && <em style={{ fontStyle: 'normal', fontWeight: 500, color: '#8a8f9b', marginLeft: 8 }}>{hint}</em>}</span>{children}
  </label>
);

const TOOLS = [
  ['B', 'Bold', c => c('bold'), { fontWeight: 800 }], ['I', 'Italic', c => c('italic'), { fontStyle: 'italic' }],
  ['H2', 'Heading', c => c('formatBlock', 'h2')], ['H3', 'Sub-heading', c => c('formatBlock', 'h3')], ['¶', 'Paragraph', c => c('formatBlock', 'p')],
  ['• List', 'Bullet list', c => c('insertUnorderedList')], ['1. List', 'Numbered list', c => c('insertOrderedList')],
  ['❝', 'Quote', c => c('formatBlock', 'blockquote')], ['—', 'Divider', c => c('insertHorizontalRule')], ['Clear', 'Clear formatting', c => c('removeFormat')]
];

/** Create / edit one article. The body is a small rich-text editor; the server sanitises it again on save. */
function Editor({ id, cats, onDone }) {
  const [f, setF] = useState({ title: '', slug: '', category: '', excerpt: '', cover: '', status: 'Draft', date: today() });
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [upl, setUpl] = useState(false);
  const ed = useRef(null);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!id) { if (ed.current) ed.current.innerHTML = '<p><br></p>'; return; }
    adm.get('/blog/' + id).then(r => {
      setF({ title: r.title, slug: r.slug, category: r.category, excerpt: r.excerpt, cover: r.cover, status: r.status, date: r.date });
      setSlugTouched(true); setLoading(false);
      setTimeout(() => { if (ed.current) ed.current.innerHTML = r.body; }, 0);
    }).catch(e => { setMsg({ err: true, t: e.message }); setLoading(false); });
  }, [id]);

  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const cmd = (c, v) => { ed.current && ed.current.focus(); document.execCommand(c, false, v || null); };
  const upload = async file => {
    if (!file) return null;
    setUpl(true); setMsg(null);
    try { const data = await readFile(file); const r = await adm.post('/upload-image', { folder: 'blog/' + (f.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general'), name: file.name, data }); return r.url; }
    catch (e) { setMsg({ err: true, t: e.message }); return null; } finally { setUpl(false); }
  };
  const addImage = async e => { const url = await upload(e.target.files[0]); e.target.value = ''; if (url) { ed.current.focus(); document.execCommand('insertHTML', false, `<img src="${url}" alt="">`); } };
  const addLink = () => { const u = window.prompt('Link address (https://…)'); if (u) cmd('createLink', u); };
  const setCover = async e => { const url = await upload(e.target.files[0]); e.target.value = ''; if (url) set('cover', url); };

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
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }} className="bw-grid">
      <div className="a-card" style={{ gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← All articles</button>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {id && <Pill s={f.status === 'Published' ? 'Active' : 'Pending'} label={f.status} />}
            {id && f.status === 'Published' && <a className="a-btn ghost sm" href={'/blog/' + encodeURIComponent(f.slug)} target="_blank" rel="noreferrer">View on site ↗</a>}
          </span>
        </div>
        {msg && <div className={'a-msg ' + (msg.err ? 'err' : 'ok')}>{msg.t}</div>}
        <Field label="Title"><input className="a-input" value={f.title} onChange={e => { set('title', e.target.value); if (!slugTouched) set('slug', e.target.value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')); }} placeholder="Article title" style={{ fontSize: 18, fontWeight: 700 }} /></Field>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, border: '1px solid #cfccc4', borderBottom: 0, borderRadius: '10px 10px 0 0', background: '#f6f5f2', position: 'sticky', top: 0, zIndex: 2 }}>
            {TOOLS.map(([l, t, fn, st]) => <button key={l} type="button" title={t} onMouseDown={e => e.preventDefault()} onClick={() => fn(cmd)} className="a-btn ghost sm" style={{ padding: '7px 10px', ...st }}>{l}</button>)}
            <button type="button" title="Link" onMouseDown={e => e.preventDefault()} onClick={addLink} className="a-btn ghost sm" style={{ padding: '7px 10px' }}>🔗 Link</button>
            <label className="a-btn ghost sm" style={{ padding: '7px 10px', cursor: 'pointer' }}>{upl ? 'Uploading…' : '🖼 Image'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={addImage} /></label>
          </div>
          <div ref={ed} contentEditable suppressContentEditableWarning className="bw-editor bp-body" style={{ minHeight: 460, padding: '18px 22px', border: '1px solid #cfccc4', borderRadius: '0 0 10px 10px', background: '#fff', outline: 0, overflow: 'auto', maxHeight: '70vh' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="a-card">
          <h3>Publish</h3>
          <Field label="Status"><select className="a-input" value={f.status} onChange={e => set('status', e.target.value)}><option>Published</option><option>Draft</option></select></Field>
          <Field label="Publish date"><input type="date" className="a-input" value={f.date} onChange={e => set('date', e.target.value)} /></Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="a-btn grad" disabled={busy} onClick={() => save()} style={{ flex: 1 }}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create article'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {f.status !== 'Published' && <button type="button" className="a-btn green sm" disabled={busy} onClick={() => save('Published')} style={{ flex: 1 }}>Publish now</button>}
            {f.status === 'Published' && <button type="button" className="a-btn ghost sm" disabled={busy} onClick={() => save('Draft')} style={{ flex: 1 }}>Unpublish (draft)</button>}
          </div>
        </div>
        <div className="a-card">
          <h3>Cover image</h3>
          {f.cover ? <div style={{ aspectRatio: '16/9', borderRadius: 12, background: `#eef3fb url('${f.cover}') center/cover`, border: '1px solid #e4e2dc' }} /> : <div style={{ aspectRatio: '16/9', borderRadius: 12, background: '#f0f2f6', display: 'grid', placeItems: 'center', color: '#8a8f9b', fontSize: 13 }}>No cover image</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="a-btn ghost sm" style={{ cursor: 'pointer', flex: 1, textAlign: 'center' }}>{upl ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={setCover} /></label>
            {f.cover && <button type="button" className="a-btn ghost sm" onClick={() => set('cover', '')}>Remove</button>}
          </div>
          <span style={{ fontSize: 11.5, color: '#8a8f9b' }}>PNG, JPG, GIF or WebP up to 6 MB. Best at 16:9 (e.g. 1600×900).</span>
        </div>
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

/** Blog management for Admins and the Content writer role. */
export function BlogAdmin({ staff }) {
  const t = useTable('/blog', { status: '' });
  const [view, setView] = useView('blog');
  const [edit, setEdit] = useState(null); // null = list, 'new' or an id
  const isWriter = staff.role === 'Content writer';
  const del = async r => { if (await confirmBox(`Delete “${r.title}” permanently?`, { danger: true, confirmLabel: 'Delete' })) { try { await adm.del('/blog/' + r.id); t.reload(); } catch (e) { alertBox(e.message); } } };
  if (edit) return <Editor id={edit === 'new' ? null : edit} cats={t.data.categories || []} onDone={id => { setEdit(id || null); t.reload(); }} />;
  return (
    <>
      <Toolbar t={t} filters={[{ key: 'status', label: 'All statuses', options: ['Published', 'Draft'] }]}>
        <ViewToggle view={view} setView={setView} />
        <button className="a-btn grad" onClick={() => setEdit('new')}>+ New article</button>
      </Toolbar>
      <div className={'vw ' + view} style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: t.loading ? .6 : 1 }}>
        {t.data.rows.map(r => (
          <div key={r.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) auto', gap: 16, alignItems: 'center', padding: '12px 16px' }}>
            <div className="bl-cover" style={{ width: 96, height: 64, borderRadius: 10, background: `#eef3fb ${r.cover ? `url('${r.cover}')` : ''} center/cover`, border: '1px solid #e4e2dc' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 14.5 }}>{r.title}</b><Pill s={r.status === 'Published' ? 'Active' : 'Pending'} label={r.status} /></div>
              <span style={{ color: '#5d6270', fontSize: 12.5 }}>{r.category} · {dateF(r.date)} · by {r.author}{r.updated ? ' · edited' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {r.status === 'Published' && <a className="a-btn ghost sm" href={'/blog/' + encodeURIComponent(r.slug)} target="_blank" rel="noreferrer">View</a>}
              <button className="a-btn sm" onClick={() => setEdit(r.id)}>Edit</button>
              {(!isWriter || r.authorId === staff.id) && <button className="a-btn ghost sm" style={{ color: '#b3261e' }} onClick={() => del(r)}>Delete</button>}
            </div>
          </div>
        ))}
      </div>
      <Empty t={t} /><Pager t={t} />
    </>
  );
}
