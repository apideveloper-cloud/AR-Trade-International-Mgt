import { useEffect, useState } from 'react';
import { useDebounced } from './fieldKit.jsx';

/** Search the field app's customers (Existing or Upcoming) and hand the chosen one back.
 *  `load(type, query)` returns { items }: each screen passes the API it is allowed to call (quotations or orders).
 *  With `selected` it shows that customer (and a clear button) instead of the search box. */
export function CustomerPick({ type, selected, onPick, onClear, bad, load }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q.trim(), 250);
  const [items, setItems] = useState(null); const [openList, setOpenList] = useState(false);
  useEffect(() => {
    if (selected) return undefined;
    let stale = false;
    load(type, dq).then(r => { if (!stale) setItems(r.items); }).catch(() => { if (!stale) setItems([]); });
    return () => { stale = true; };
  }, [type, dq, selected, load]);
  if (selected) return <div className="iv-sel" title={selected}><b>{selected}</b><small>{type}</small><button type="button" onClick={onClear} aria-label="Choose another customer">✕</button></div>;
  return (
    <div className="iv-pick">
      <input className={'a-input' + (bad ? ' bad' : '')} value={q} onChange={e => { setQ(e.target.value); setOpenList(true); }} onFocus={() => setOpenList(true)} onBlur={() => setTimeout(() => setOpenList(false), 150)} placeholder={`Search ${type.toLowerCase()} customers by name, phone or area…`} aria-label="Search customers" />
      {openList && (
        <div className="iv-res">
          {items === null ? <small>Searching…</small> : !items.length ? <small>{q.trim() ? 'No customer found.' : `No ${type.toLowerCase()} customers yet.`} Use "New customer" to type one in.</small> : items.map(c => (
            <button key={c.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(c); setQ(''); setOpenList(false); }}><span>{c.name}{c.contact ? ' · ' + c.contact : ''}</span><em>{c.phone}</em></button>
          ))}
        </div>
      )}
    </div>
  );
}
