import { useEffect, useState } from 'react';
import { adm, can, fmtMoney, invApi, slNo, useTable } from '../adminApi.js';
import { CategoryForm } from './catalog/CategoryForm.jsx';
import { FlagChips, LiveSwitch } from './catalog/ProductControls.jsx';
import './catalog/productForm.css';
import { ListFilter } from '../ListFilter.jsx';
import { IconBtn } from '../IconBtn.jsx';
import { Empty, Modal, Pager, Summary, Switch, Toolbar, ViewToggle, alertBox, confirmBox, useView } from '../ui.jsx';
import { readFileAsDataUrl as readFile } from '../hooks/download.js';
import { useApiData } from '../hooks/useApiData.js';

const BLANK = { name: '', brand: '', cat: '', price: '', old: '', stock: 10, img: '', part: '', tech: '', color: '', yield: '', compat: '', spec: '', description: '', gallery: [], metaTitle: '', metaDesc: '', metaKeywords: '' };
/** "Name: value" lines -> [{ name, value }] (lines without a colon are dropped). */
const parseSpecs = text => text.split('\n').map(l => { const i = l.indexOf(':'); return i > 0 ? { name: l.slice(0, i), value: l.slice(i + 1) } : null; }).filter(Boolean);

/** The product form. `purchase`: used from a purchase entry to create a product (saved through the purchasing API; price and stock come from the purchase, so they are not shown). */
export function Editor({ product, cats, onClose, onSaved, purchase = false, initial }) {
  const [f, setF] = useState({ ...BLANK, cat: cats[0]?.id || '', ...initial, ...product });
  const [specText, setSpecText] = useState('');
  useEffect(() => {
    if (!product) return undefined;
    let stale = false;
    adm.get(`/products/${product.id}/full`).then(r => { if (!stale) setSpecText((r.specs || []).map(s => `${s.name}: ${s.value}`).join('\n')); }).catch(() => {});
    return () => { stale = true; };
  }, [product]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const isNew = !product;
  const off = f.old > f.price && f.price ? Math.round((1 - f.price / f.old) * 100) : 0;

  const submit = async e => {
    e.preventDefault();
    if (busy) return; // already saving or uploading
    setErr(''); setBusy(true);
    try {
      if (purchase) {
        onSaved(await invApi.post('/products', { ...f, specs: parseSpecs(specText) })); return;
      }
      const saved = isNew ? await adm.post('/products', f) : await adm.put('/products/' + product.id, f);
      if (isNew && (f.metaTitle || f.metaDesc || f.metaKeywords)) await adm.put('/products/' + saved.id, { metaTitle: f.metaTitle, metaDesc: f.metaDesc, metaKeywords: f.metaKeywords });
      const specs = parseSpecs(specText);
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
    <Modal side kicker={isNew ? 'New product' : 'Edit product'} title={isNew ? 'Add a product' : f.name} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</button></>}>
      <div className={'pf' + (purchase ? ' pf-buy' : '')}>
        <aside className="pf-media">
          <div className="pf-hero">
            {f.img ? <div style={{ backgroundImage: `url('${f.img}')` }} /> : <span>No image yet</span>}
            {off > 0 && <em>−{off}%</em>}
          </div>
          <label className="pf-up">⤒ Upload image(s)<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={upload} /></label>
          {(f.gallery || []).length > 0 && (
            <div className="pf-thumbs">
              {f.gallery.map(u => (
                <div key={u} className={u === f.img ? 'on' : ''} style={{ backgroundImage: `url('${u}')` }}>
                  <button type="button" className="x" title="Remove" onClick={() => removeImg(u)}>✕</button>
                  {u !== f.img && <button type="button" className="mk" title="Use as main image" onClick={() => makeMain(u)}>main</button>}
                </div>
              ))}
            </div>
          )}
          {!isNew && <span className="pf-id mono">ID · #{product.id} · <a href={'/product/' + product.id} target="_blank" rel="noreferrer">View on store ↗</a></span>}
          <span className="pf-hint">{purchase ? 'Price and stock come from the purchase. The product stays hidden from the shop until its first purchase is stocked in.' : 'Set price to 0 to show “Ask price” on the store.'}</span>
        </aside>
        <div className="pf-main">
          {err && <div className="a-msg err">{err}</div>}
          <section className="pf-card">
            <h4>Basics</h4>
            <div className="pf-g pf-g3">
              <label className="a-lbl pf-w3">Product name<input className="a-input" required value={f.name} onChange={on('name')} /></label>
              <label className="a-lbl">Brand<input className="a-input" required value={f.brand} onChange={on('brand')} /></label>
              <label className="a-lbl">Category<select className="a-input" value={f.cat} onChange={on('cat')}>{cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label className="a-lbl">Part no.<input className="a-input" value={f.part} onChange={on('part')} /></label>
            </div>
          </section>
          {!purchase && <section className="pf-card">
            <h4>Price &amp; stock</h4>
            <div className="pf-g pf-g3">
              <label className="a-lbl">Price (৳)<input className="a-input" type="number" min="0" value={f.price} onChange={on('price')} /></label>
              <label className="a-lbl">Regular price (৳)<input className="a-input" type="number" min="0" value={f.old} onChange={on('old')} /></label>
              <label className="a-lbl">Stock (from purchases)<input className="a-input" type="number" value={f.stock} readOnly disabled title="Stock changes through purchases, returns and stock counts" /></label>
            </div>
          </section>}
          <section className="pf-card">
            <h4>Details</h4>
            <div className="pf-g pf-g3">
              <label className="a-lbl">Technology<input className="a-input" value={f.tech} onChange={on('tech')} /></label>
              <label className="a-lbl">Colour<input className="a-input" value={f.color} onChange={on('color')} /></label>
              <label className="a-lbl">Page yield / size<input className="a-input" value={f.yield} onChange={on('yield')} /></label>
              <label className="a-lbl pf-w3">Short spec line<input className="a-input" value={f.spec} onChange={on('spec')} placeholder="e.g. 33 ppm · Wi-Fi · Duplex" /></label>
              <label className="a-lbl pf-w3">Compatible printers<textarea className="a-input" rows={2} value={f.compat || ''} onChange={on('compat')} /></label>
            </div>
          </section>
          <section className="pf-card">
            <h4>Description <small>basic HTML allowed · shown on the product page</small></h4>
            <textarea className="a-input pf-desc" rows={8} value={f.description || ''} onChange={on('description')} placeholder="<p>…</p>" />
          </section>
          <div className="pf-two">
            <section className="pf-card">
              <h4>Specifications <small>one per line: Name: value</small></h4>
              <textarea className="a-input pf-specs" rows={9} value={specText} onChange={e => setSpecText(e.target.value)} placeholder={'Page yield: 1,500 pages\nColour: Black'} />
            </section>
            <section className="pf-card pf-seo">
              <h4>SEO · Google listing
                <button type="button" className="a-btn" onClick={() => setF(s => ({ ...s, metaTitle: s.name + ' Price in Bangladesh | AR Trade', metaDesc: `${s.name}. Buy online in Dhaka, Bangladesh. Genuine, fast delivery.`, metaKeywords: [s.name, s.brand && `${s.brand} ${s.part || ''}`.trim(), s.part, `${s.name} price in Bangladesh`, 'AR Trade International'].filter(Boolean).join(', ') }))}>Auto-fill</button>
              </h4>
              <label className="a-lbl">SEO title <small style={{ color: (f.metaTitle || '').length > 60 ? '#b3261e' : undefined }}>{(f.metaTitle || '').length}/60</small><input className="a-input" maxLength={160} value={f.metaTitle || ''} onChange={on('metaTitle')} placeholder="Product name + Price in Bangladesh | AR Trade" /></label>
              <label className="a-lbl">Meta description <small style={{ color: (f.metaDesc || '').length > 160 ? '#b3261e' : undefined }}>{(f.metaDesc || '').length}/160</small><textarea className="a-input" rows={2} maxLength={320} value={f.metaDesc || ''} onChange={on('metaDesc')} /></label>
              <label className="a-lbl">SEO keywords <small>comma separated, most important first</small><textarea className="a-input" rows={2} maxLength={500} value={f.metaKeywords || ''} onChange={on('metaKeywords')} placeholder="hp 79a toner, hp cf279a, toner price in bangladesh" /></label>
            </section>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Grid view of the product list: one card per product, same inline editing as the table. */
function ProductCards({ t, patch, catName, setEdit, canWrite }) {
  return (
    <div className="pg-grid" style={{ opacity: t.loading ? .6 : 1 }}>
      {t.data.rows.map((p, i) => (
        <div key={p.id} className="pg-card" style={{ opacity: p.active ? 1 : .6 }}>
          <span className="pg-sl">{slNo(t, i)}</span>
          <button type="button" className="pg-img" disabled={!canWrite} style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none', cursor: canWrite ? 'pointer' : 'default' }} onClick={() => setEdit(p)} aria-label={canWrite ? 'Edit ' + p.name : p.name}>{!p.img && <small>No photo</small>}</button>
          <button type="button" className="pg-name" disabled={!canWrite} style={{ cursor: canWrite ? 'pointer' : 'default', color: 'inherit' }} onClick={() => setEdit(p)}>{p.name}</button>
          <span className="pg-meta">{p.brand} · #{p.id} · {catName(p.cat)}</span>
          <div className="pg-nums">
            {[['price', 'Price'], ['old', 'Regular'], ['stock', 'Stock']].map(([k, l]) => (
              <label key={k}><small>{l}</small>{!canWrite || k === 'stock' ? <b className="ro-val">{p[k]}</b> : <input className="a-mini" type="number" min="0" defaultValue={p[k]} style={k === 'stock' && p.price && p.stock <= 5 ? { borderColor: 'oklch(0.6 0.2 350)' } : undefined} onBlur={e => { if (+e.target.value !== p[k]) patch(p, { [k]: +e.target.value }); }} />}</label>
            ))}
          </div>
          <div className="pg-foot">
            <FlagChips p={p} canWrite={canWrite} patch={patch} />
            <LiveSwitch p={p} canWrite={canWrite} patch={patch} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Products({ cats, staff }) {
  const canWrite = can(staff, 'products.manage'); // Master Admin and Admin only; everyone else sees the list read-only
  const t = useTable('/products', { cat: '', stock: '', live: '' });
  const [view, setView] = useView('products');
  const [edit, setEdit] = useState(null); // null | 'new' | product
  const patch = async (p, body) => { try { await adm.put('/products/' + p.id, body); t.reload(); } catch (e) { alertBox(e.message); } };
  const catName = id => cats.find(c => c.id === id)?.title || id;
  const cols = '44px 52px minmax(200px,1fr) 120px 110px 110px 80px 150px 70px';
  return (
    <>
      {t.data.summary && (() => {
        const m = t.data.summary;
        return <Summary items={[
          ['Products', m.total, m.live + ' live · ' + m.hidden + ' hidden · ' + m.categories + ' categories', 'blue', 'box'],
          ['Stock value', fmtMoney(m.stockValue), 'Live products at selling price', 'violet', 'money'],
          ['Low stock', m.low, '1 to 5 left', 'amber', 'alert'],
          ['Out of stock', m.outOfStock, 'Live, priced, none left', 'red', 'alert'],
          ['Quotation only', m.quote, 'No price: shown as ask us', 'blue', 'tag'],
          ['No photo', m.noImage, 'Live products without an image', 'red', 'image']
        ]} />;
      })()}
      <ListFilter t={t} noun="product" title="Search products" search={{ placeholder: 'Name, brand, part no. or ID', span: 'c4' }} resetSpan="c1"
        selects={[
          { key: 'cat', label: 'Category', all: 'All categories', icon: 'grid', span: 'c3', options: cats.map(c => ({ v: c.id, t: c.title })) },
          { key: 'stock', label: 'Stock', all: 'Any stock', icon: 'box', span: 'c2', options: [{ v: 'low', t: 'Low stock (5 or fewer)' }] },
          { key: 'live', label: 'Visibility', all: 'Live and hidden', icon: 'status', span: 'c2', options: [{ v: '0', t: 'Hidden only' }] }
        ]} />
      <Toolbar t={t} search={false}>{!canWrite && <span className="ro-note" title="Only an Admin or the Master Admin can change products">👁 View only</span>}<ViewToggle view={view} setView={setView} /></Toolbar>
      {view === 'grid' ? <ProductCards t={t} patch={patch} catName={catName} setEdit={setEdit} canWrite={canWrite} /> : <div className="a-table" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 904 }}>
          <div className="head" style={{ gridTemplateColumns: cols }}><span>SL</span><span /><span>Product</span><span>Category</span><span>Price</span><span>Regular</span><span>Stock</span><span>Flags</span><span>Live</span></div>
          {t.data.rows.map((p, i) => (
            <div key={p.id} className="row" style={{ gridTemplateColumns: cols, opacity: p.active ? 1 : .55 }}>
              <span className="sl">{slNo(t, i)}</span>
              <div className="a-thumb" style={{ backgroundImage: p.img ? `url('${p.img}')` : 'none' }} />
              <button disabled={!canWrite} onClick={() => setEdit(p)} style={{ textAlign: 'left', border: 0, background: 'transparent', padding: 0, display: 'flex', flexDirection: 'column', gap: 2, cursor: canWrite ? 'pointer' : 'default', color: 'inherit' }}><b>{p.name}</b><span style={{ color: '#5d6270', fontSize: 12 }}>{p.brand} · #{p.id} · Edit</span></button>
              <span style={{ color: '#5d6270' }}>{catName(p.cat)}</span>
              {['price', 'old', 'stock'].map(k => !canWrite || k === 'stock' ? <span key={k} className="ro-val" style={k === 'stock' && p.price && p.stock <= 5 ? { color: 'oklch(0.55 0.2 350)', fontWeight: 800 } : undefined}>{p[k]}</span> : <input key={k} className="a-mini" type="number" min="0" defaultValue={p[k]} style={k === 'stock' && p.price && p.stock <= 5 ? { borderColor: 'oklch(0.6 0.2 350)' } : undefined} onBlur={e => { if (+e.target.value !== p[k]) patch(p, { [k]: +e.target.value }); }} />)}
              <FlagChips p={p} canWrite={canWrite} patch={patch} />
              <LiveSwitch p={p} canWrite={canWrite} patch={patch} />
            </div>
          ))}
        </div>
      </div>}
      <Empty t={t} /><Pager t={t} />
      {edit && <Editor product={edit} cats={cats} onClose={() => setEdit(null)} onSaved={t.reload} />}
    </>
  );
}

export function Categories({ onChanged }) {
  const list = useApiData(() => adm.get('/categories'), [], []);
  const rows = list.data, load = list.reload;
  const [view, setView] = useView('categories', 'grid');
  const [busy, setBusy] = useState('');
  const [actionErr, setErr] = useState('');
  const err = actionErr || list.error;
  const [form, setForm] = useState(null); // 'new', or the category being edited
  const toggle = async c => {
    try { await adm.put('/categories/' + c.id, { hidden: !c.hidden }); await load(); onChanged?.(); } catch (e) { setErr(e.message); }
  };
  const pick = async (c, file) => {
    if (!file) return;
    setErr(''); setBusy(c.id);
    try {
      const up = await adm.post('/upload-image', { folder: 'site/categories', name: c.id + '-' + file.name, data: await readFile(file) });
      await adm.put('/categories/' + c.id, { image: up.url });
      await load(); onChanged?.();
    } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const clear = async c => {
    if (!(await confirmBox('Remove the picture of “' + c.title + '”? The store goes back to the automatic picture.', { danger: true, confirmLabel: 'Remove picture' }))) return;
    setErr(''); setBusy(c.id);
    try { await adm.put('/categories/' + c.id, { image: '' }); await load(); onChanged?.(); } catch (e) { setErr(e.message); }
    setBusy('');
  };
  const remove = async c => {
    if (!(await confirmBox('Delete the category “' + c.title + '”? It has no products. This cannot be undone.', { danger: true, confirmLabel: 'Delete category' }))) return;
    setErr('');
    try { await adm.del('/categories/' + c.id); await load(); onChanged?.(); } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <Summary items={[
        ['Categories', rows.length, 'product groups', 'blue', 'tag'],
        ['Visible', rows.filter(c => !c.hidden).length, 'shown on the store', 'green', 'check'],
        ['Hidden', rows.filter(c => c.hidden).length, 'not on the store', 'amber', 'alert'],
        ['Products', rows.reduce((t, c) => t + (c.total || 0), 0), 'in all categories', 'violet', 'box']
      ]} />
      {err && <div className="a-msg err">{err}</div>}
      <div className="a-bar"><b>{rows.length} categories</b><span className="info">Click a picture to change it</span><button type="button" className="a-btn sm grad" onClick={() => setForm('new')}>＋ Add category</button><ViewToggle view={view} setView={setView} /></div>
      <div className={'vw cats ' + view} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
        {rows.map(c => (
          <div key={c.id} className="a-card" style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr) auto', alignItems: 'center', gap: 12, padding: 14 }}>
            <label className="cat-pic" title={c.img ? 'Change picture' : 'Add a picture'} style={{ backgroundImage: c.img ? `url('${c.img}')` : 'none', opacity: busy === c.id ? .5 : 1 }}>
              {!c.img && <span>＋<small>Photo</small></span>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { pick(c, e.target.files[0]); e.target.value = ''; }} />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <b>{c.title}</b>
              <span style={{ fontSize: 12, color: '#5d6270' }}>{c.count} products · {c.hidden ? 'hidden on store' : 'visible'}</span>
              <span style={{ fontSize: 12, color: '#5d6270' }}>{c.description}</span>
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <label style={{ color: 'oklch(0.48 0.16 254)', cursor: 'pointer' }}>{busy === c.id ? 'Uploading…' : c.img ? 'Change photo' : 'Add photo'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => { pick(c, e.target.files[0]); e.target.value = ''; }} /></label>
                <span className="ic-row"><IconBtn icon="edit" title="Edit the name and description" onClick={() => setForm(c)} />
                {!c.total && <IconBtn icon="trash" tone="bad" title="Delete this empty category" onClick={() => remove(c)} />}</span>
                {c.img && <button type="button" onClick={() => clear(c)} style={{ border: 0, background: 'transparent', color: '#b3261e', fontWeight: 700, padding: 0, cursor: 'pointer' }}>Remove</button>}
              </span>
            </div>
            <Switch on={!c.hidden} onChange={() => toggle(c)} title="Visible on the store" />
          </div>
        ))}
      </div>
      {form && <CategoryForm cat={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { load(); onChanged?.(); }} />}
    </>
  );
}

export { fmtMoney };
