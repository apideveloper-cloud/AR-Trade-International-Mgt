import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/catalog.js';

/** Left column of the product form: main picture, upload button, thumbnails, store link and hint. */
export function ProductMedia({ f, product, purchase, off, gallery }) {
  const tr = useT();
  const { upload, removeImg, makeMain } = gallery;
  return (
    <aside className="pf-media">
      <div className="pf-hero">
        {f.img ? <div style={{ backgroundImage: `url('${f.img}')` }} /> : <span>{tr('No image yet')}</span>}
        {off > 0 && <em>−{off}%</em>}
      </div>
      <label className="pf-up">{tr('⤒ Upload image(s)')}<input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={upload} /></label>
      {(f.gallery || []).length > 0 && (
        <div className="pf-thumbs">
          {f.gallery.map(u => (
            <div key={u} className={u === f.img ? 'on' : ''} style={{ backgroundImage: `url('${u}')` }}>
              <button type="button" className="x" title={tr('Remove')} onClick={() => removeImg(u)}>✕</button>
              {u !== f.img && <button type="button" className="mk" title={tr('Use as main image')} onClick={() => makeMain(u)}>{tr('main')}</button>}
            </div>
          ))}
        </div>
      )}
      {product && <span className="pf-id mono">{tr('ID')} · #{product.id} · <a href={'/product/' + product.id} target="_blank" rel="noreferrer">{tr('View on store ↗')}</a></span>}
      <span className="pf-hint">{purchase ? tr('Price and stock come from the purchase. The product stays hidden from the shop until its first purchase is stocked in.') : tr('Set price to 0 to show “Ask price” on the store.')}</span>
    </aside>
  );
}
