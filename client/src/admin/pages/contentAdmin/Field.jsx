import { ImageField } from './ImageField.jsx';
import { lbl } from './shared.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/system.js';

/** One editable field described by a config object {k, type, label, ...}; `set(key, value)` writes it back. */
export function Field({ f, item, set }) {
  const tr = useT();
  const v = item[f.k];
  if (f.type === 'image') return <ImageField label={tr(f.label)} value={v} onChange={x => set(f.k, x)} folder={f.folder} wide={f.wide} tile={f.tile} />;
  if (f.type === 'check') { const on = v !== false; /* no saved value = shown on the store, so the switch reads as on */ return <div className="cx-toggle"><button type="button" role="switch" aria-checked={on} className={'a-sw' + (on ? ' on' : '')} onClick={() => set(f.k, !on)} /><span>{tr(f.label)}</span></div>; }
  if (f.type === 'select') return <label style={lbl}>{tr(f.label)}<select className="a-input" value={v || f.options[0][0]} onChange={e => set(f.k, e.target.value)}>{f.options.map(([val, l]) => <option key={val} value={val}>{tr(l)}</option>)}</select></label>;
  if (f.type === 'area') return <label style={{ ...lbl, gridColumn: '1 / -1' }}>{tr(f.label)}<textarea className="a-input" rows={f.rows || 3} value={v || ''} onChange={e => set(f.k, e.target.value)} /></label>;
  return <label style={{ ...lbl, gridColumn: f.wide ? '1 / -1' : undefined }}>{tr(f.label)}<input className="a-input" type={f.type || 'text'} value={v ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph ? tr(f.ph) : ''} /></label>;
}
