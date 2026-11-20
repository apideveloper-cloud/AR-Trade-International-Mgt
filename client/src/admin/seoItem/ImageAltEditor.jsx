import { useState } from 'react';
import { adm } from '../adminApi.js';

/** Alt text per product image. */
export function ImageAltEditor({ id, images, setImages }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!images.length) return null;
  const autofill = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { const r = await adm.post(`/seo/product/${id}/alt-autofill`); if (Array.isArray(r.images)) setImages(r.images); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const edit = (i, alt) => setImages(images.map((x, j) => (j === i ? { ...x, alt } : x)));
  return (
    <div className="adsi-sec">
      <div className="adsi-hd"><b>Image alt text</b>
        <button type="button" className="a-btn ghost sm" disabled={busy} onClick={autofill}>{busy ? 'Working…' : 'Auto-fill from product name'}</button></div>
      {err && <div className="a-msg err">{err}</div>}
      {images.map((im, i) => (
        <div className={'adsi-alt' + (im.alt ? '' : ' adsi-empty')} key={im.src + i}>
          <img src={im.src} alt="" loading="lazy" />
          <label className="adsi-grow">
            <input className="a-input" maxLength={255} value={im.alt || ''} placeholder="Describe this image" onChange={e => edit(i, e.target.value)} />
            <small className={'adsi-note' + (im.alt ? '' : ' warn')}>{im.alt ? `${im.alt.length}/255` : 'Missing alt text'}</small>
          </label>
        </div>
      ))}
    </div>
  );
}
