import { forwardRef, useEffect, useState } from 'react';
import { adm } from '../../../adminApi.js';
import { useDebounced } from '../../../hooks/useDebounced.js';
import { DEFAULT_TARGETS } from './redirectModel.js';

/** Text box for a target path with a live suggestion list (products, categories, pages) from GET /seo/targets. */
export const TargetPicker = forwardRef(function TargetPicker({ value, onChange, placeholder = '/shop/all or https://…', defaults = DEFAULT_TARGETS }, ref) {
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState([]);
  const q = useDebounced(value.trim(), 300);
  useEffect(() => {
    if (!open || q.length < 2) { setFound([]); return undefined; }
    let stale = false;
    adm.get('/seo/targets?q=' + encodeURIComponent(q)).then(r => { if (!stale) setFound(r.rows || []); }).catch(() => { if (!stale) setFound([]); });
    return () => { stale = true; };
  }, [q, open]);
  const list = value.trim().length < 2 ? defaults : found;
  const pick = r => { onChange(r.path); setOpen(false); };
  return (
    <div className="adrd-pick">
      <input ref={ref} className="a-input" value={value} placeholder={placeholder} autoComplete="off" maxLength={500}
        onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }} />
      {open && list.length > 0 && (
        <ul className="adrd-sug" role="listbox">
          {list.map(r => (
            <li key={r.type + r.path} role="option" aria-selected="false" onMouseDown={e => { e.preventDefault(); pick(r); }}>
              <span className="adrd-sug-t">{r.type}</span><b>{r.label}</b><small>{r.path}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
