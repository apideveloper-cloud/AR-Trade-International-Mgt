import { useEffect, useRef, useState } from 'react';
import { adm, can } from '../adminApi.js';
import { confirmBox } from '../ui.jsx';
import { IconBtn } from '../IconBtn.jsx';
import { SeoPanel } from '../SeoPanel.jsx';

const GROUPS = [['servicing', 'Servicing details', 'Shown on the Servicing page'], ['clients', 'Corporate clients', 'Shown on the About page'], ['company', 'Company profile', 'Profile, mission and vision']];
const GROUP_LOOK = { servicing: ['🛠', 215], clients: ['🏢', 160], company: ['📘', 45] };
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const TOOLS = [
  ['B', 'Bold', c => c('bold'), { fontWeight: 800 }], ['I', 'Italic', c => c('italic'), { fontStyle: 'italic' }],
  ['H2', 'Heading', c => c('formatBlock', 'h2')], ['H3', 'Sub-heading', c => c('formatBlock', 'h3')], ['¶', 'Paragraph', c => c('formatBlock', 'p')],
  ['• List', 'Bullet list', c => c('insertUnorderedList')], ['1. List', 'Numbered list', c => c('insertOrderedList')], ['Clear', 'Clear formatting', c => c('removeFormat')]
];
const Field = ({ label, children }) => <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#3a3f4b' }}><span>{label}</span>{children}</label>;

function PageEditor({ id, group, onDone }) {
  const [f, setF] = useState({ title: '', slug: '', excerpt: '', cover: '', status: 'Published', order: 0, metaTitle: '', metaDesc: '', metaKeywords: '', noindex: false });
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
      setF({ title: r.title, slug: r.slug, excerpt: r.excerpt, cover: r.cover, status: r.status, order: r.order, metaTitle: r.metaTitle, metaDesc: r.metaDesc, metaKeywords: r.metaKeywords, noindex: r.noindex });
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
      <div style={{ border: '1px solid #e3e8f2', borderRadius: 14, padding: 14, background: '#f9fbff' }}>
        <SeoPanel value={f} onChange={patch => setF(p => ({ ...p, ...patch }))} path={group === 'servicing' ? 'services/' + (f.slug || '…') : group === 'company' ? 'about' : 'about'} title={f.title} summary={f.excerpt} />
        {group !== 'servicing' && <small style={{ display: 'block', marginTop: 8, color: '#6b7388', fontSize: 11.5 }}>This page is shown on the About page. Its title and description are used for /about when this is the Company profile; keywords of all three About pages are merged.</small>}
      </div>
    </div>
  );
}

/** Servicing details, corporate clients and the company profile — editable by Admin and Content writer. */
export function PagesAdmin({ staff }) {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null); // null | { id } | { group } for new
  const [tab, setTab] = useState(GROUPS[0][0]);
  const [q, setQ] = useState('');
  const load = () => adm.get('/pages').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const del = async r => { if (await confirmBox(`Delete “${r.title}”?`, { danger: true, confirmLabel: 'Delete' })) { await adm.del('/pages/' + r.id); load(); } };
  if (edit) return <PageEditor id={edit.id} group={edit.group || rows.find(r => r.id === edit.id)?.group} onDone={id => { setEdit(id ? { id } : null); load(); }} />;
  if (!rows) return <div className="a-card">Loading…</div>;
  const isAdmin = can(staff, 'pages.delete');
  const cur = GROUPS.find(g => g[0] === tab) || GROUPS[0];
  const list = rows.filter(r => r.group === cur[0] && (!q.trim() || (r.title + ' ' + (r.excerpt || '')).toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="pg">
      <div className="pg-tabs" role="tablist">
        {GROUPS.map(([g, title]) => {
          const n = rows.filter(r => r.group === g).length, live = rows.filter(r => r.group === g && r.status === 'Published').length;
          return <button key={g} type="button" role="tab" aria-selected={tab === g} className={tab === g ? 'on' : ''} style={{ '--h': GROUP_LOOK[g][1] }} onClick={() => setTab(g)}><i>{GROUP_LOOK[g][0]}</i><span><b>{title}</b><small>{n} page{n === 1 ? '' : 's'} · {live} live</small></span></button>;
        })}
      </div>
      <section className="pg-card">
        <div className="pg-hd" style={{ '--h': GROUP_LOOK[cur[0]][1] }}>
          <span className="pg-hi">{GROUP_LOOK[cur[0]][0]}</span>
          <div><h3>{cur[1]}</h3><span>{cur[2]} · {list.length} shown</span></div>
          <input className="a-input pg-q" type="search" placeholder="Search pages…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search pages" />
          <button type="button" className="a-btn sm pg-new" onClick={() => setEdit({ group: cur[0] })}>＋ New page</button>
        </div>
        <div className="pg-grid">
          {list.map(r => (
            <article key={r.id} className={'pg-it' + (r.status === 'Published' ? '' : ' draft')} style={{ '--h': GROUP_LOOK[cur[0]][1] }}>
              <button type="button" className="pg-cover" onClick={() => setEdit({ id: r.id })} aria-label={'Edit ' + r.title}>
                {r.cover ? <><span className="pg-bk" style={{ backgroundImage: `url('${r.cover}')` }} /><img src={r.cover} alt="" loading="lazy" /></> : <span className="pg-none">{GROUP_LOOK[cur[0]][0]}<small>No cover image</small></span>}
                <span className={'pg-st ' + (r.status === 'Published' ? 'live' : 'dr')}>{r.status === 'Published' ? '● Live' : '○ Draft'}</span>
                <em className="pg-ed">✎ Edit page</em>
              </button>
              <div className="pg-b">
                <div className="pg-t"><b>{r.title}</b>{r.edited && <em>edited</em>}</div>
                <p>{r.excerpt || 'No summary yet.'}</p>
                <div className="pg-act">
                  <IconBtn icon="edit" tone="pri" title="Edit the page" onClick={() => setEdit({ id: r.id })} />
                  {isAdmin && <IconBtn icon="trash" tone="bad" title="Delete the page" onClick={() => del(r)} />}
                </div>
              </div>
            </article>
          ))}
          <button type="button" className="pg-add" onClick={() => setEdit({ group: cur[0] })}><b>＋</b>New page<small>{cur[1]}</small></button>
        </div>
        {!list.length && rows.some(r => r.group === cur[0]) && <div className="a-empty">No page matches your search.</div>}
      </section>
    </div>
  );
}
