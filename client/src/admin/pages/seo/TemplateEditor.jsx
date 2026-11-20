import { useEffect, useRef, useState } from 'react';
import { useDebounced } from '../../hooks/useDebounced.js';
import { PAGE_TYPES, TPL_FIELDS, previewApi } from './seoModel.js';

/** Live rendered text of one template with a green/amber length counter. */
function Preview({ kind, field, template, max }) {
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const tpl = useDebounced(template, 400);
  useEffect(() => {
    let live = true;
    previewApi({ kind, field, template: tpl })
      .then(r => { if (live) { setRes(r); setErr(''); } })
      .catch(e => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [kind, field, tpl]);
  const len = res?.length ?? 0, lim = res?.max || max;
  return (
    <div className="adseo-prev" aria-live="polite">
      {err ? <em>{err}</em> : !res ? <em>Preview loading…</em> : (
        <>
          <b>{res.text || '(empty)'}</b>
          <small className={len > lim ? 'warn' : ''}>{len}/{lim} characters{len > lim ? ' · too long, Google may cut it' : ''}</small>
          {res.sample && <em>Preview uses a sample product</em>}
        </>
      )}
    </div>
  );
}

function TemplateField({ kind, field, label, max, value, def, vars, onChange }) {
  const ref = useRef(null);
  const insert = key => {
    const el = ref.current, tag = '{' + key + '}';
    const a = el ? el.selectionStart ?? value.length : value.length, b = el ? el.selectionEnd ?? a : a;
    onChange(value.slice(0, a) + tag + value.slice(b));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(a + tag.length, a + tag.length); } });
  };
  const long = field === 'description' || field === 'ogDescription';
  const props = { ref, className: 'a-input', value, onChange: e => onChange(e.target.value) };
  return (
    <div className="adseo-tpl">
      <div className="adseo-tpl-hd">
        <span>{label}</span><span className="adseo-cnt">{value.length} characters, aim for {max} or fewer</span><span className="adseo-sp" />
        <button type="button" className="a-btn ghost sm" disabled={value === (def ?? '')} onClick={() => onChange(def ?? '')}>Reset to default</button>
      </div>
      {long ? <textarea rows={2} {...props} /> : <input type="text" {...props} />}
      <div className="adseo-vars" role="group" aria-label="Insert a variable">
        {vars.map(v => <button key={v.key} type="button" className="adseo-var" title={`${v.label}, for example: ${v.example}`} onClick={() => insert(v.key)}>{'{' + v.key + '}'}</button>)}
      </div>
      <Preview kind={kind} field={field} template={value} max={max} />
    </div>
  );
}

/** Templates for one page type at a time: four fields, each with variable palette, counter, reset and live preview. */
export function TemplateEditor({ templates, defaults, vars, onChange }) {
  const [kind, setKind] = useState('product');
  const t = templates?.[kind] || {}, d = defaults?.templates?.[kind] || defaults?.[kind] || {};
  return (
    <>
      <div className="adseo-types" role="tablist">
        {PAGE_TYPES.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={'a-btn sm' + (kind === k ? '' : ' ghost')} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {TPL_FIELDS.map(([f, label, max]) => (
        <TemplateField key={kind + f} kind={kind} field={f} label={label} max={max} value={t[f] ?? ''} def={d[f]} vars={vars} onChange={v => onChange(kind, f, v)} />
      ))}
      <div className="adseo-help">
        <b>Template syntax.</b> <code>{'{var}'}</code> is replaced by the value. <code>{'[ - {brand}]'}</code> square brackets make an optional group, dropped when a variable inside is empty. <code>{'{if var}yes{else}no{/if}'}</code> chooses text by whether the variable has a value.
      </div>
    </>
  );
}
