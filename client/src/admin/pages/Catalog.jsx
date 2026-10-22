import { useEffect, useState } from 'react';
import { adm, fmtMoney, useTable } from '../adminApi.js';
import { Empty, Modal, Pager, Switch, Toolbar } from '../ui.jsx';

const BLANK = { name: '', brand: '', cat: '', price: '', old: '', stock: 10, img: '', part: '', tech: '', color: '', yield: '', compat: '', spec: '', description: '', gallery: [] };
const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

function Editor({ product, cats, onClose, onSaved }) {
  const [f, setF] = useState({ ...BLANK, cat: cats[0]?.id || '', ...product });
  const [specText, setSpecText] = useState('');
  useEffect(() => { if (product) adm.get(`/products/${product.id}/full`).then(r => setSpecText((r.specs || []).map(s => `${s.name}: ${s.value}`).join('\n'))).catch(() => {}); }, [product]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const isNew = !product;
  const off = f.old > f.price && f.price ? Math.round((1 - f.price / f.old) * 100) : 0;

  const submit = async e => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const saved = isNew ? await adm.post('/products', f) : await adm.put('/products/' + product.id, f);
      const specs = specText.split('\n').map(l => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i), value: l.slice(i + 1) } : null; }).filter(Boolean);
      if (specs.length || !isNew) await adm.put(`/products/${isNew ? saved.id : product.id}/specs`, { specs });
      onSaved(); onClose();
    } catch (er) { setErr(er.message); setBusy(false); }
  };
  // images are uploaded to the server and stored in uploads/products/<category>/ (never inside the database)
  const upload = async e => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    setErr(''); setBusy(true);
    try {
      const added = [];
      for (const file of files.slice(0, 8)) {
        const r = await adm.post('/upload-image', { folder: 'products/' + (f.cat || 'general'), name: file.name, data: await readFile(file) });
        added.push(r.url);
      }
      setF(s => { const g = [...(s.gallery || []), ...added]; return { ...s, gallery: g, img: s.img || g[0] }; });
    } catch (er) { setErr(er.message); }
    setBusy(false);
  };
  const removeImg = u => setF(s => { const g = (s.gallery || []).filter(x => x !== u); return { ...s, gallery: g, img: s.img === u ? g[0] || '' : s.img }; });
  const makeMain = u => setF(s => ({ ...s, img: u, gallery: [u, ...(s.gallery || []).filter(x => x !== u)] }));
  return (
    <Modal kicker={isNew ? 'New product' : 'Edit product'} title={isNew ? 'Add a product' : f.name} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</button></>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 240px', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', aspectRatio: 1, borderRadius: 18, background: 'radial-gradient(120% 90% at 50% 20%,#fff 0%,#f1f4fa 60%,#e6ebf4 100%)', border: '1px solid #e3e7ef', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {f.img ? <div style={{ width: '84%', height: '84%', backgroundImage: `url('${f.img}')`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} /> : <span style={{ color: '#8a8f9b', fontWeight: 700 }}>No image yet</span>}
            {off > 0 && <span style={{ position: 'absolute', top: 12, left: 12, background: 'var(--pink)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '5px 10px', borderRadius: 999 }}>−{off}%</span>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 42, border: '1px dashed #b9c4da', borderRadius: 11, background: '#fff', fontWeight: 800, color: 'oklch(0.45 0.15 252)', cursor: 'pointer' }}>⤒ Upload image(s)<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={upload} /></label>
          <label className="a-lbl">Image URL<input className="a-input" value={f.img && f.img.startsWith('data:') ? '' : f.img || ''} onChange={on('img')} placeholder="https://…" /></label>
          {(f.gallery || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {f.gallery.map(u => (
                <div key={u} style={{ position: 'relative', width: 62, height: 62, borderRadius: 10, border: '2px solid ' + (u === f.img ? 'oklch(0.52 0.16 252)' : '#e3e7ef'), background: `#fff url('${u}') center/contain no-repeat` }}>
                  <button type="button" title="Remove" onClick={() => removeImg(u)} style={{ position: 'absolute', top: -7, right: -7, width: 20, height: 20, borderRadius: '50%', border: 0, background: '#16181d', color: '#fff', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  {u !== f.img && <button type="button" title="Use as main image" onClick={() => makeMain(u)} style={{ position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)', border: 0, borderRadius: 8, background: 'oklch(0.52 0.16 252)', color: '#fff', fontSize: 9, padding: '2px 5px', cursor: 'pointer' }}>main</button>}
                </div>
              ))}
            </div>
          )}
          {!isNew && <span className="mono" style={{ fontSize: 11, color: '#6b7080' }}>ID · #{product.id} · <a href={'/product/' + product.id} target="_blank" rel="noreferrer">View on store ↗</a></span>}
        </div>
        <div style={{ flex: '2 1 360px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div className="a-msg err">{err}</div>}
          <label className="a-lbl">Product name<input className="a-input" required value={f.name} onChange={on('name')} /></label>
          <div className="a-fields">
            <label className="a-lbl">Brand<input className="a-input" required value={f.brand} onChange={on('brand')} /></label>
            <label className="a-lbl">Category<select className="a-input" value={f.cat} onChange={on('cat')}>{cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            <label className="a-lbl">Price (৳)<input className="a-input" type="number" min="0" value={f.price} onChange={on('price')} /></label>
            <label className="a-lbl">Regular price (৳)<input className="a-input" type="number" min="0" value={f.old} onChange={on('old')} /></label>
            <label className="a-lbl">Stock<input className="a-input" type="number" min="0" value={f.stock} onChange={on('stock')} /></label>
            <label className="a-lbl">Part no.<input className="a-input" value={f.part} onChange={on('part')} /></label>
            <label className="a-lbl">Technology<input className="a-input" value={f.tech} onChange={on('tech')} /></label>
            <label className="a-lbl">Colour<input className="a-input" value={f.color} onChange={on('color')} /></label>
            <label className="a-lbl">Page yield / size<input className="a-input" value={f.yield} onChange={on('yield')} /></label>
          </div>
          <label className="a-lbl">Short spec line<input className="a-input" value={f.spec} onChange={on('spec')} placeholder="e.g. 33 ppm · Wi-Fi · Duplex" /></label>
          <label className="a-lbl">Compatible printers<textarea className="a-input" rows={2} value={f.compat || ''} onChange={on('compat')} /></label>
          <label className="a-lbl">Description <small style={{ fontWeight: 500, color: '#8a8f9b' }}>basic HTML allowed · shown on the product page</small><textarea className="a-input" rows={6} value={f.description || ''} onChange={on('description')} placeholder="<p>…</p>" /></label>
          <label className="a-lbl">Specifications <small style={{ fontWeight: 500, color: '#8a8f9b' }}>one per line: Name: value</small><textarea className="a-input" rows={5} value={specText} onChange={e => setSpecText(e.target.value)} placeholder={'Page yield: 1,500 pages\nColour: Black'} /></label>
          <span style={{ fontSize: 12, color: '#6b7080' }}>Set price to 0 to show “Ask price” on the store.</span>
        </div>
      </div>
    </Modal>
  );
}

export function Products({ cats }) {
  const t = useTable('/products', { cat: '', stock: '', live: '' });
  const [edit, setEdit] = useState(null); // null | 'new' | product
  const patch = async (p, body) => { try { await adm.put('/products/' + p.id, body); t.reload(); } catch (e) { window.alert(e.message); } };
  const catName = id => cats.find(c => c.id === id)?.title || id;
  const cols = '52px minmax(200px,1fr) 120px 110px 110px 80px 150px 70px';
  return (
    <>
      <Toolbar t={t} filters={[
        { key: 'cat', label: 'All categories', options: cats.map(c => ({ v: c.id, t: c.title })) },
        { key: 'stock', label: 'Any stock', options: [{ v: 'low', t: 'Low stock (≤5)' }] },
        { key: 'live', label: 'Live + hidden', options: [{ v: '0', t: 'Hidden only' }] }
      ]}><button className="a-btn sm" style={{ marginLeft: 4 }} onClick={() => setEdit('new')}>+ Add product</button></Toolbar>
      <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 860 }}>
          <div className="head" style={{ gridTemplateColumns: cols }}><span /><span>Product</span><span>Category</span><span>Price</span><span>Regular</span><span>Stock</span><span>Flags</span><span>Live</span></div>
          {t.data.rows.map(p => (
            <div key={p.id} className="row" style={{ gridTemplateColumns: cols, opacity: p.active ? 1 : .55 }}>
              <div className="a-thumb" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
              <button onClick={() => setEdit(p)} style={{ textAlign: 'left', border: 0, background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><b>{p.name}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{p.brand} · #{p.id} · Edit</span></button>
              <span style={{ color: '#5d6270' }}>{catName(p.cat)}</span>
              {['price', 'old', 'stock'].map(k => <input key={k} className="a-mini" type="number" min="0" defaultValue={p[k]} style={k === 'stock' && p.price && p.stock <= 5 ? { borderColor: 'oklch(0.6 0.2 350)' } : undefined} onBlur={e => { if (+e.target.value !== p[k]) patch(p, { [k]: +e.target.value }); }} />)}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[['popular', 'Popular'], ['isNew', 'New']].map(([k, l]) => <button key={k} className="a-chip" style={{ padding: '3px 8px', fontSize: 11, background: p[k] ? 'oklch(0.95 0.04 150)' : '#fff' }} onClick={() => patch(p, { [k]: !p[k] })}>{l}</button>)}
              </div>
              <Switch on={p.active} onChange={v => patch(p, { active: v })} title="Visible on the store" />
            </div>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
      {edit && <Editor product={edit === 'new' ? null : edit} cats={cats} onClose={() => setEdit(null)} onSaved={t.reload} />}
    </>
  );
}

export function Categories({ onChanged }) {
  const [rows, setRows] = useState([]);
  const load = () => adm.get('/categories').then(setRows);
  useEffect(() => { load(); }, []);
  const toggle = async c => { await adm.put('/categories/' + c.id, { hidden: !c.hidden }); await load(); onChanged?.(); };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
      {rows.map(c => (
        <div key={c.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><b>{c.title}</b><span style={{ fontSize: 12, color: '#5d6270' }}>{c.count} products · {c.hidden ? 'hidden on store' : 'visible'}</span><span style={{ fontSize: 12, color: '#8a8f9b' }}>{c.description}</span></div>
          <Switch on={!c.hidden} onChange={() => toggle(c)} title="Visible on the store" />
        </div>
      ))}
    </div>
  );
}

export { fmtMoney };
