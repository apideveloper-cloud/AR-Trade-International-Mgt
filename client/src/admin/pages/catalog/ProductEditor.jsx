import { useEffect, useState } from 'react';
import { adm, invApi } from '../../adminApi.js';
import { Modal } from '../../ui.jsx';
import { BLANK_PRODUCT, parseSpecs, specsToText } from './productDefaults.js';
import { useProductGallery } from './useProductGallery.js';
import { ProductMedia } from './ProductMedia.jsx';
import SeoItemEditor from '../../seoItem/SeoItemEditor.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';
import './productForm.css';

/** A titled card of the product form. */
const Card = ({ title, children }) => { const tr = useT(); return <section className="pf-card"><h4>{typeof title === 'string' ? tr(title) : title}</h4>{children}</section>; };

/** The product form. `purchase`: used from a purchase entry to create a product (saved through the purchasing API; price and stock come from the purchase, so they are not shown). */
export function Editor({ product, cats, onClose, onSaved, purchase = false, initial }) {
  const tr = useT();
  const [f, setF] = useState({ ...BLANK_PRODUCT, cat: cats[0]?.id || '', ...initial, ...product });
  const [specText, setSpecText] = useState('');
  const [specsKnown, setSpecsKnown] = useState(!product); // false until the saved specs are loaded (or typed): saving then must not overwrite them with an empty list
  useEffect(() => {
    if (!product) return undefined;
    let stale = false;
    adm.get(`/products/${product.id}/full`).then(r => { if (!stale) { setSpecText(specsToText(r.specs)); setSpecsKnown(true); } }).catch(() => {});
    return () => { stale = true; };
  }, [product]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [warn, setWarn] = useState('');
  const on = k => e => setF(s => ({ ...s, [k]: e.target.value }));
  const isNew = !product;
  const off = Number(f.old) > Number(f.price) && Number(f.price) ? Math.round((1 - Number(f.price) / Number(f.old)) * 100) : 0; // inputs hold strings: compare as numbers
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
      if (specsKnown && (specs.length || !isNew)) await adm.put(`/products/${isNew ? saved.id : product.id}/specs`, { specs });
      if (saved.gtinWarning) { onSaved(); setWarn(saved.gtinWarning); return; } // stays open so the warning is read; the button stays off so a new product is not added twice
      onSaved(); onClose();
    } catch (er) { setErr(er.message); setBusy(false); }
  };
  return (
    <Modal side kicker={isNew ? tr('New product') : tr('Edit product')} title={isNew ? tr('Add a product') : f.name} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>{tr('Cancel')}</button><button className="a-btn grad" disabled={busy}>{warn ? tr('Saved') : busy ? tr('Saving…') : isNew ? tr('Add product') : tr('Save changes')}</button></>}>
      <div className={'pf' + (purchase ? ' pf-buy' : '')}>
        <ProductMedia f={f} product={product} purchase={purchase} off={off} gallery={gallery} />
        <div className="pf-main">
          {err && <div className="a-msg err">{tr(err)}</div>}
          {warn && <div className="a-msg err">{tr('Saved.')} {tr(warn)}</div>}
          <Card title="Basics">
            <div className="pf-g pf-g3">
              <label className="a-lbl pf-w3">{tr('Product name')}<input className="a-input" required value={f.name} onChange={on('name')} /></label>
              <label className="a-lbl">{tr('Brand')}<input className="a-input" required value={f.brand} onChange={on('brand')} /></label>
              <label className="a-lbl">{tr('Category')}<select className="a-input" value={f.cat} onChange={on('cat')}>{cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label className="a-lbl">{tr('Part no.')}<input className="a-input" value={f.part} onChange={on('part')} /></label>
              <label className="a-lbl">{tr('GTIN / EAN barcode')}<input className="a-input" inputMode="numeric" maxLength={14} value={f.gtin || ''} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 14); setF(s => ({ ...s, gtin: v })); }} /><small className="pf-hint">{tr('Optional. 8, 12, 13 or 14 digits. Shown to Google in product data.')}</small></label>
            </div>
          </Card>
          {!purchase && <Card title="Price & stock">
            <div className="pf-g pf-g3">
              <label className="a-lbl">{tr('Price (৳)')}<input className="a-input" type="number" min="0" value={f.price} onChange={on('price')} /></label>
              <label className="a-lbl">{tr('Regular price (৳)')}<input className="a-input" type="number" min="0" value={f.old} onChange={on('old')} /></label>
              <label className="a-lbl">{tr('Stock (from purchases)')}<input className="a-input" type="number" value={f.stock} readOnly disabled title={tr('Stock changes through purchases, returns and stock counts')} /></label>
            </div>
          </Card>}
          <Card title="Warranty">
            <div className="pf-warr" role="radiogroup" aria-label={tr('Product warranty available')}>
              <span className="a-lbl">{tr('Product warranty available')}</span>
              <div className="pf-yn">
                {[[true, 'Yes'], [false, 'No']].map(([v, l]) => <button type="button" key={l} role="radio" aria-checked={f.warranty !== false === v} className={f.warranty !== false === v ? 'on' : ''} onClick={() => setF(x => ({ ...x, warranty: v }))}>{tr(l)}</button>)}
              </div>
              <small className="pf-hint">{tr('Shown on the product page next to the price. Choose No for items sold without a warranty.')}</small>
            </div>
          </Card>
          <Card title="Details">
            <div className="pf-g pf-g3">
              <label className="a-lbl">{tr('Technology')}<input className="a-input" value={f.tech} onChange={on('tech')} /></label>
              <label className="a-lbl">{tr('Colour')}<input className="a-input" value={f.color} onChange={on('color')} /></label>
              <label className="a-lbl">{tr('Page yield / size')}<input className="a-input" value={f.yield} onChange={on('yield')} /></label>
              <label className="a-lbl pf-w3">{tr('Short spec line')}<input className="a-input" value={f.spec} onChange={on('spec')} placeholder={tr('e.g. 33 ppm · Wi-Fi · Duplex')} /></label>
              <label className="a-lbl pf-w3">{tr('Compatible printers')}<textarea className="a-input" rows={2} value={f.compat || ''} onChange={on('compat')} /></label>
            </div>
          </Card>
          <Card title={<>{tr('Description')} <small>{tr('basic HTML allowed · shown on the product page')}</small></>}>
            <textarea className="a-input pf-desc" rows={8} value={f.description || ''} onChange={on('description')} placeholder="<p>…</p>" />
          </Card>
          <Card title={<>{tr('Specifications')} <small>{tr('one per line: Name: value')}</small></>}>
            <textarea className="a-input pf-specs" rows={9} value={specText} onChange={e => { setSpecText(e.target.value); setSpecsKnown(true); }} placeholder={tr('Page yield: 1,500 pages\nColour: Black')} />
          </Card>
          {!purchase && <Card title="SEO · Google listing">
            {isNew ? <small className="pf-hint">{tr('Save the product first to edit its SEO.')}</small> : <SeoItemEditor type="product" id={product.id} mode="full" />}
          </Card>}
        </div>
      </div>
    </Modal>
  );
}
