import { useEffect, useState } from 'react';
import { adm, invApi } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { BLANK_PRODUCT, parseSpecs, specsToText } from './productDefaults.js';
import { useProductGallery } from './useProductGallery.js';
import { ProductMedia } from './ProductMedia.jsx';
import { ProductSeoCard } from './ProductSeoCard.jsx';
import './productForm.css';

/** A titled card of the product form. */
const Card = ({ title, children }) => <section className="pf-card"><h4>{title}</h4>{children}</section>;

/** The product form. `purchase`: used from a purchase entry to create a product (saved through the purchasing API; price and stock come from the purchase, so they are not shown). */
export function Editor({ product, cats, onClose, onSaved, purchase = false, initial }) {
  const [f, setF] = useState({ ...BLANK_PRODUCT, cat: cats[0]?.id || '', ...initial, ...product });
  const [specText, setSpecText] = useState('');
  useEffect(() => {
    if (!product) return undefined;
    let stale = false;
    adm.get(`/products/${product.id}/full`).then(r => { if (!stale) setSpecText(specsToText(r.specs)); }).catch(() => {});
    return () => { stale = true; };
  }, [product]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const isNew = !product;
  const off = f.old > f.price && f.price ? Math.round((1 - f.price / f.old) * 100) : 0;
  const gallery = useProductGallery(f, setF, setErr, setBusy);

  const submit = async e => {
    e.preventDefault();
    if (busy) return; // already saving or uploading
    setErr(''); setWarn(''); setBusy(true);
    try {
      if (purchase) {
        onSaved(await invApi.post('/products', { ...f, specs: parseSpecs(specText) })); return;
      }
      const saved = isNew ? await adm.post('/products', f) : await adm.put('/products/' + product.id, f);
      if (isNew && (f.metaTitle || f.metaDesc || f.metaKeywords)) await adm.put('/products/' + saved.id, { metaTitle: f.metaTitle, metaDesc: f.metaDesc, metaKeywords: f.metaKeywords });
      const specs = parseSpecs(specText);
      if (specs.length || !isNew) await adm.put(`/products/${isNew ? saved.id : product.id}/specs`, { specs });
      if (saved.gtinWarning) { onSaved(); setWarn(saved.gtinWarning); return; } // stays open so the warning is read; the button stays off so a new product is not added twice
      onSaved(); onClose();
    } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side kicker={isNew ? 'New product' : 'Edit product'} title={isNew ? 'Add a product' : f.name} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{warn ? 'Saved' : busy ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}</button></>}>
      <div className={'pf' + (purchase ? ' pf-buy' : '')}>
        <ProductMedia f={f} product={product} purchase={purchase} off={off} gallery={gallery} />
        <div className="pf-main">
          {err && <div className="a-msg err">{err}</div>}
          {warn && <div className="a-msg err">Saved. {warn}</div>}
          <Card title="Basics">
            <div className="pf-g pf-g3">
              <label className="a-lbl pf-w3">Product name<input className="a-input" required value={f.name} onChange={on('name')} /></label>
              <label className="a-lbl">Brand<input className="a-input" required value={f.brand} onChange={on('brand')} /></label>
              <label className="a-lbl">Category<select className="a-input" value={f.cat} onChange={on('cat')}>{cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label className="a-lbl">Part no.<input className="a-input" value={f.part} onChange={on('part')} /></label>
              <label className="a-lbl">GTIN / EAN barcode<input className="a-input" inputMode="numeric" maxLength={14} value={f.gtin || ''} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 14); setF(s => ({ ...s, gtin: v })); }} /><small className="pf-hint">Optional. 8, 12, 13 or 14 digits. Shown to Google in product data.</small></label>
            </div>
          </Card>
          {!purchase && <Card title="Price &amp; stock">
            <div className="pf-g pf-g3">
              <label className="a-lbl">Price (৳)<input className="a-input" type="number" min="0" value={f.price} onChange={on('price')} /></label>
              <label className="a-lbl">Regular price (৳)<input className="a-input" type="number" min="0" value={f.old} onChange={on('old')} /></label>
              <label className="a-lbl">Stock (from purchases)<input className="a-input" type="number" value={f.stock} readOnly disabled title="Stock changes through purchases, returns and stock counts" /></label>
            </div>
          </Card>}
          <Card title="Warranty">
            <div className="pf-warr" role="radiogroup" aria-label="Product warranty available">
              <span className="a-lbl">Product warranty available</span>
              <div className="pf-yn">
                {[[true, 'Yes'], [false, 'No']].map(([v, l]) => <button type="button" key={l} role="radio" aria-checked={f.warranty !== false === v} className={f.warranty !== false === v ? 'on' : ''} onClick={() => setF(x => ({ ...x, warranty: v }))}>{l}</button>)}
              </div>
              <small className="pf-hint">Shown on the product page next to the price. Choose No for items sold without a warranty.</small>
            </div>
          </Card>
          <Card title="Details">
            <div className="pf-g pf-g3">
              <label className="a-lbl">Technology<input className="a-input" value={f.tech} onChange={on('tech')} /></label>
              <label className="a-lbl">Colour<input className="a-input" value={f.color} onChange={on('color')} /></label>
              <label className="a-lbl">Page yield / size<input className="a-input" value={f.yield} onChange={on('yield')} /></label>
              <label className="a-lbl pf-w3">Short spec line<input className="a-input" value={f.spec} onChange={on('spec')} placeholder="e.g. 33 ppm · Wi-Fi · Duplex" /></label>
              <label className="a-lbl pf-w3">Compatible printers<textarea className="a-input" rows={2} value={f.compat || ''} onChange={on('compat')} /></label>
            </div>
          </Card>
          <Card title={<>Description <small>basic HTML allowed · shown on the product page</small></>}>
            <textarea className="a-input pf-desc" rows={8} value={f.description || ''} onChange={on('description')} placeholder="<p>…</p>" />
          </Card>
          <div className="pf-two">
            <Card title={<>Specifications <small>one per line: Name: value</small></>}>
              <textarea className="a-input pf-specs" rows={9} value={specText} onChange={e => setSpecText(e.target.value)} placeholder={'Page yield: 1,500 pages\nColour: Black'} />
            </Card>
            <ProductSeoCard f={f} setF={setF} on={on} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
