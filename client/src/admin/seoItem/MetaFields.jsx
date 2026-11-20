import { useState } from 'react';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';

const RANGE_TXT = ([a, b], n) => (n === 0 ? 'empty' : n < a ? 'too short' : n > b ? 'too long' : 'good length');
const inRange = ([a, b], n) => n >= a && n <= b;
const px = s => Math.round(s.length * 6.2); // about 6.2 px per character at 20px Arial

/** One templated field: 'Use template' shows the auto value read-only, 'Customise' makes it editable. */
function TplField({ label, value, auto, onChange, range, area, children }) {
  const tr = useT();
  const [custom, setCustom] = useState(!!value);
  const n = (value || '').length;
  const toggle = () => { if (custom) onChange(''); setCustom(!custom); };
  const Tag = area ? 'textarea' : 'input';
  return (
    <div className="adsi-field">
      <div className="adsi-hd"><span className="adsi-lbl">{tr(label)}</span>
        <small className={'adsi-cnt ' + (custom ? (inRange(range, n) ? 'ok' : 'warn') : '')}>{custom ? tr('{n} chars · {state} ({a}-{b})', { n, state: tr(RANGE_TXT(range, n)), a: range[0], b: range[1] }) : tr('from template')}</small>
        <button type="button" className="a-btn ghost sm" onClick={toggle}>{custom ? tr('Use template') : tr('Customise')}</button></div>
      {custom
        ? <Tag className="a-input" rows={area ? 3 : undefined} maxLength={320} value={value || ''} placeholder={auto} onChange={e => onChange(e.target.value)} />
        : <div className="adsi-ro">{auto || tr('No template value yet.')}</div>}
      {children(custom ? value || '' : auto || '')}
    </div>
  );
}

/** Meta title, meta description and keywords (full mode only). */
export function MetaFields({ manual, set, auto, limits }) {
  const tr = useT();
  return (
    <div className="adsi-sec">
      <TplField label="Meta title" value={manual.metaTitle} auto={auto?.title} onChange={v => set({ metaTitle: v })} range={limits?.title || [30, 60]}>
        {s => <small className={'adsi-note' + (px(s) > 580 ? ' warn' : '')}>{tr('about {n} px of the ~580 px shown on desktop', { n: px(s) })}</small>}
      </TplField>
      <TplField area label="Meta description" value={manual.metaDescription} auto={auto?.description} onChange={v => set({ metaDescription: v })} range={limits?.description || [120, 155]}>
        {() => <small className="adsi-note">{tr('On mobile Google shows about 120 characters.')}</small>}
      </TplField>
      <label className="a-lbl">{tr('Meta keywords')} <small className="adsi-note">{tr('comma separated, optional')}</small>
        <input className="a-input" maxLength={500} value={manual.metaKeywords || ''} onChange={e => set({ metaKeywords: e.target.value })} /></label>
    </div>
  );
}
