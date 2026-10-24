import { useEffect, useRef, useState } from 'react';
import { adm, can } from '../adminApi.js';
import { Pill, confirmBox } from '../ui.jsx';

const GROUPS = [['servicing', 'Servicing details', 'Shown on the Servicing page'], ['clients', 'Corporate clients', 'Shown on the About page'], ['company', 'Company profile', 'Profile, mission and vision']];
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const TOOLS = [
  ['B', 'Bold', c => c('bold'), { fontWeight: 800 }], ['I', 'Italic', c => c('italic'), { fontStyle: 'italic' }],
  ['H2', 'Heading', c => c('formatBlock', 'h2')], ['H3', 'Sub-heading', c => c('formatBlock', 'h3')], ['¶', 'Paragraph', c => c('formatBlock', 'p')],
  ['• List', 'Bullet list', c => c('insertUnorderedList')], ['1. List', 'Numbered list', c => c('insertOrderedList')], ['Clear', 'Clear formatting', c => c('removeFormat')]
];
const Field = ({ label, children }) => <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#3a3f4b' }}><span>{label}</span>{children}</label>;

function PageEditor({ id, group, onDone }) {
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', cover: '', status: 'Published', order: 0 });
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const [upl, setUpl] = useState(false);
  const [msg, setMsg] = useState(null);
  const ed = useRef(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const folder = `${group === 'servicing' ? 'services' : group}/${(f.slug || 'general').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'general'}`;

  useEffect(() => {
    if (!id) { if (ed.current) ed.current.innerHTML = '<p><br></p>'; return; }
    adm.get('/pages/' + id).then(r => {
      setF({ title: r.title, slug: r.slug, excerpt: r.excerpt, cover: r.cover, status: r.status, order: r.order });
      setLoading(false);
      setTimeout(() => { if (ed.current) ed.current.innerHTML = r.body; }, 0);
    }).catch(e => { setMsg({ err: true, t: e.message }); setLoading(false); });
  }, [id]);

  const cmd = (c, v) => { ed.current && ed.current.focus(); document.execCommand(c, false, v || null); };
  const upload = async file => {
    if (!file) return null;
    setUpl(true); setMsg(null);
    try { const r = await adm.post('/upload-image', { folder, name: file.name, data: await readFile(file) }); return r.url; }
    catch (e) { setMsg({ err: true, t: e.message }); return null; } finally { setUpl(false); }
  };
  const addImage = async e => { const u = await upload(e.target.files[0]); e.target.value = ''; if (u) { ed.current.focus(); document.execCommand('insertHTML', false, `<img src="${u}" alt="">`); } };
  const setCover = async e => { const u = await upload(e.target.files[0]); e.target.value = ''; if (u) set('cover', u); };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...f, group, body: ed.current.innerHTML };
      if (id) await adm.put('/pages/' + id, body); else { const r = await adm.post('/pages', body); setMsg({ t: 'Created.' }); onDone(r.id); setBusy(false); return; }
      setMsg({ t: 'Saved.' });
    } catch (e) { setMsg({ err: true, t: e.message }); }
    setBusy(false);
  };

  if (loading) return <div className="a-card">Loading…</div>;
  return (
    <div className="a-card" style={{ gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="a-btn ghost sm" onClick={() => onDone()}>← All pages</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="a-input" value={f.status} onChange={e => set('status', e.target.value)} style={{ width: 'auto' }}><option>Published</option><option>Draft</option></select>
          <button type="button" className="a-btn grad" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {msg && <div className={'a-msg ' + (msg.err ? 'err' : 'ok')}>{msg.t}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 220px', gap: 14 }}>
        <Field label="Title"><input className="a-input" value={f.title} onChange={e => set('title', e.target.value)} style={{ fontSize: 17, fontWeight: 700 }} /></Field>
        <Field label="Order"><input type="number" className="a-input" value={f.order} onChange={e => set('order', e.target.value)} /></Field>
      </div>
      <Field label="Short summary"><input className="a-input" maxLength={190} value={f.excerpt} onChange={e => set('excerpt', e.target.value)} placeholder="Shown on cards. Leave empty to use the first lines" /></Field>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 76, borderRadius: 10, border: '1px solid #e4e2dc', background: `#eef3fb ${f.cover ? `url('${f.cover}')` : ''} center/cover` }} />
        <label className="a-btn ghost sm" style={{ cursor: 'pointer' }}>{upl ? 'Uploading…' : 'Upload cover image'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={setCover} /></label>
        {f.cover && <button type="button" className="a-btn ghost sm" onClick={() => set('cover', '')}>Remove</button>}
        <span style={{ fontSize: 11.5, color: '#8a8f9b' }}>Images are saved in uploads/{folder}/</span>
      </div>
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, border: '1px solid #cfccc4', borderBottom: 0, borderRadius: '10px 10px 0 0', background: '#f6f5f2' }}>
          {TOOLS.map(([l, t, fn, st]) => <button key={l} type="button" title={t} onMouseDown={e => e.preventDefault()} onClick={() => fn(cmd)} className="a-btn ghost sm" style={{ padding: '7px 10px', ...st }}>{l}</button>)}
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { const u = window.prompt('Link address (https://…)'); if (u) cmd('createLink', u); }} className="a-btn ghost sm" style={{ padding: '7px 10px' }}>🔗 Link</button>
          <label className="a-btn ghost sm" style={{ padding: '7px 10px', cursor: 'pointer' }}>{upl ? 'Uploading…' : '🖼 Image'}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={addImage} /></label>
        </div>
        <div ref={ed} contentEditable suppressContentEditableWarning className="bp-body" style={{ minHeight: 420, maxHeight: '65vh', overflow: 'auto', padding: '18px 22px', border: '1px solid #cfccc4', borderRadius: '0 0 10px 10px', background: '#fff', outline: 0 }} />
      </div>
    </div>
  );
}

/** Servicing details, corporate clients and the company profile — editable by Admin and Content writer. */
export function PagesAdmin({ staff }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null); // null | { id } | { group } for new
  const load = () => adm.get('/pages').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const del = async r => { if (await confirmBox(`Delete “${r.title}”?`, { danger: true, confirmLabel: 'Delete' })) { await adm.del('/pages/' + r.id); load(); } };
  if (edit) return <PageEditor id={edit.id} group={edit.group || rows.find(r => r.id === edit.id)?.group} onDone={id => { setEdit(id ? { id } : null); load(); }} />;
  if (!rows) return <div className="a-card">Loading…</div>;
  const isAdmin = can(staff, 'pages.delete');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {GROUPS.map(([g, title, hint]) => (
        <div key={g} className="a-card" style={{ gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div><h3 style={{ margin: 0 }}>{title}</h3><span style={{ fontSize: 12.5, color: '#6b7080' }}>{hint}</span></div>
            <button className="a-btn sm" onClick={() => setEdit({ group: g })}>+ New page</button>
          </div>
          {rows.filter(r => r.group === g).map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '10px 0', borderTop: '1px solid #efede8' }}>
              <div style={{ width: 84, height: 56, borderRadius: 10, background: `#eef3fb ${r.cover ? `url('${r.cover}')` : ''} center/cover`, border: '1px solid #e4e2dc' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b>{r.title}</b><Pill s={r.status === 'Published' ? 'Active' : 'Pending'} label={r.status} />{r.edited && <span style={{ fontSize: 11, color: '#6b7080' }}>edited</span>}</div>
                <span style={{ fontSize: 12.5, color: '#5d6270', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.excerpt}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="a-btn sm" onClick={() => setEdit({ id: r.id })}>Edit</button>
                {isAdmin && <button className="a-btn ghost sm" style={{ color: '#b3261e' }} onClick={() => del(r)}>Delete</button>}
              </div>
            </div>
          ))}
          {!rows.some(r => r.group === g) && <span style={{ color: '#6b7080', fontSize: 13 }}>No pages yet.</span>}
        </div>
      ))}
    </div>
  );
}
