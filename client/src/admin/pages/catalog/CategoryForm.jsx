import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { Modal, Switch } from '../../ui.jsx';
import './categoryForm.css';

const readFile = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const svg = d => <svg viewBox="0 0 24 24">{d}</svg>;
const TAG = svg(<><path d="M3.5 12.5V4.5h8l9 9-8 8-9-9z" /><circle cx="8" cy="9" r="1.4" /></>);
const TEXT = svg(<path d="M4 7h16M4 12h16M4 17h10" />);
const PLUS = svg(<path d="M12 5v14M5 12h14" />);
const EYE = svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>);

/** Add a product category, or (with \`cat\`) change its name and description. The picture of an existing category is changed on its tile. */
export function CategoryForm({ cat, onClose, onSaved }) {
  const [f, setF] = useState({ title: cat?.title || '', description: cat?.description || '', visible: false });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const choose = e => { const x = e.target.files[0]; e.target.value = ''; if (!x) return; setFile(x); setPreview(URL.createObjectURL(x)); };
  const dropPicture = () => { setFile(null); setPreview(''); };
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      if (cat) await adm.put('/categories/' + cat.id, { title: f.title, description: f.description });
      else {
        const image = file ? (await adm.post('/upload-image', { folder: 'site/categories', name: file.name, data: await readFile(file) })).url : '';
        await adm.post('/categories', { title: f.title, description: f.description, image, hidden: !f.visible });
      }
      onSaved(); onClose();
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  const ready = f.title.trim().length >= 2;
  return (
    <Modal narrow cls="cf" kicker="Product category" title={cat ? 'Edit category' : 'Add a category'} onClose={onClose} onSubmit={submit}
      footer={<><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy || !ready}>{busy ? 'Saving…' : cat ? 'Save changes' : 'Add category'}</button></>}>
      {err && <div className="a-msg err">{err}</div>}
      <div className={'cf-top' + (cat ? ' solo' : '')}>
        {!cat && (
          <div className="cf-pic-wrap">
            <label className={'cf-pic' + (preview ? ' has' : '')} style={{ backgroundImage: preview ? `url('${preview}')` : 'none' }} title={preview ? 'Change the picture' : 'Add a picture'}>
              {!preview && <span>{PLUS}<small>Photo</small></span>}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={choose} />
            </label>
            {preview ? <button type="button" className="cf-rm" onClick={dropPicture}>Remove</button> : <small>Optional</small>}
          </div>
        )}
        <div className="cf-fields">
          <label className="cf-f">Category name
            <span className="cf-in">{TAG}<input autoFocus required maxLength={120} value={f.title} onChange={set('title')} placeholder="e.g. Paper & Stationery" /></span>
            <small className="cf-count">{f.title.length}/120</small>
          </label>
          <label className="cf-f">Short description <em>shown under the name</em>
            <span className="cf-in">{TEXT}<input maxLength={255} value={f.description} onChange={set('description')} placeholder="e.g. A4 paper, files, pens" /></span>
          </label>
        </div>
      </div>
      {!cat && (
        <div className="cf-vis">
          <span className="cf-vi">{EYE}</span>
          <div><b>Show on the store now</b><small>A category with no products looks empty to shoppers, so it starts hidden. Switch it on later, once it has products.</small></div>
          <Switch on={f.visible} onChange={() => setF(v => ({ ...v, visible: !v.visible }))} title="Show on the store now" />
        </div>
      )}
    </Modal>
  );
}
