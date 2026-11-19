import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { readFileAsDataUrl as readFile } from '../../hooks/download.js';
import { lbl } from './shared.js';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

/** Image field: preview + upload into uploads/site/<folder>/ (tile = compact logo card). */
export function ImageField({ label, value, onChange, folder, wide, tile }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const up = async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    setBusy(true); setErr('');
    try { const r = await adm.post('/upload-image', { folder: 'site/' + folder, name: f.name, data: await readFile(f) }); onChange(r.url); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  if (tile) {
    return (
      <div className="lt-img">
        <label className={'lt-drop' + (value ? '' : ' empty')} title="Click to upload or change the logo">
          {value ? <img src={value} alt="" /> : <span><b>＋</b>{busy ? 'Uploading…' : 'Add logo'}</span>}
          {value && <em>{busy ? 'Uploading…' : 'Change logo'}</em>}
          <input type="file" hidden accept={ACCEPT} onChange={up} />
        </label>
        {value && <button type="button" className="lt-rm" onClick={() => onChange('')} title="Remove the logo">Remove logo</button>}
        {err && <small className="lt-err">{err}</small>}
      </div>
    );
  }
  return (
    <div style={{ ...lbl, gridColumn: wide ? '1 / -1' : undefined }}>
      <span>{label}</span>
      <div className={'cx-img' + (wide ? ' wide' : '')}>
        <label className="cx-drop" style={{ backgroundImage: value ? `url('${value}')` : 'none' }} title="Click to upload an image">
          {!value && <span>⤒<small>{busy ? 'Uploading…' : 'Upload image'}</small></span>}
          {value && <em>{busy ? 'Uploading…' : 'Change'}</em>}
          <input type="file" hidden accept={ACCEPT} onChange={up} />
        </label>
        <div className="cx-img-r">
          {value && <small style={{ color: '#6b7388', fontSize: 12, wordBreak: 'break-all' }}>{value}</small>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="a-btn ghost sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading…' : '⤒ Upload image'}<input type="file" hidden accept={ACCEPT} onChange={up} /></label>
            {value && <button type="button" className="a-btn ghost sm" style={{ color: '#b3261e' }} onClick={() => onChange('')}>Remove</button>}
            {err && <span style={{ color: '#b3261e', fontSize: 12 }}>{err}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
