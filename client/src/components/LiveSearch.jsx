import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt } from '../api.js';
import { useStore } from '../store.jsx';
import { productPath } from '../slug.js';
import { highlight, matchProducts } from '../search.js';

const SHOWN = 8;
/** Highlights the beginning of the typed words inside a name. */
function Marked({ text, q }) {
  return highlight(text, q).map(([s, hit], i) => (hit ? <mark key={i}>{s}</mark> : s));
}

/** The header search box with live suggestions: type two letters and matching products appear. Up / Down choose, Enter opens, Esc closes. */
export default function LiveSearch({ q, setQ, onSubmit, inputRef, placeholder }) {
  const { products } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(-1);
  const box = useRef(null);
  const term = q.trim();
  const { list, total } = useMemo(() => {
    if (term.length < 2) return { list: [], total: 0 };
    const all = matchProducts(products, term);
    return { list: all.slice(0, SHOWN), total: all.length };
  }, [products, term]);

  useEffect(() => { setAt(-1); }, [term]);
  useEffect(() => {
    const away = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const go = p => { setOpen(false); nav(productPath(p)); };
  const onKey = e => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open || !list.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => (i + 1) % list.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => (i <= 0 ? list.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && at >= 0) { e.preventDefault(); go(list[at]); }
  };
  const show = open && term.length >= 2;

  return (
    <form className="search" onSubmit={e => { setOpen(false); onSubmit(e); }} ref={box} role="search">
      <i />
      <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey} placeholder={placeholder} aria-label="Search" autoComplete="off"
        role="combobox" aria-expanded={show} aria-controls="live-search-list" aria-activedescendant={at >= 0 ? 'ls-' + at : undefined} />
      <button type="submit">Search</button>
      {show && (
        <div className="ls" id="live-search-list" role="listbox">
          {list.length ? list.map((p, i) => (
            <button type="button" key={p.id} id={'ls-' + i} role="option" aria-selected={i === at} className={'ls-row' + (i === at ? ' on' : '')} onMouseEnter={() => setAt(i)} onClick={() => go(p)}>
              <span className="ls-img" style={p.img ? { backgroundImage: `url('${p.img}')` } : undefined} />
              <span className="ls-tx"><b><Marked text={p.name} q={term} /></b><small>{[p.brand, p.part].filter(Boolean).join(' · ')}</small></span>
              <span className="ls-pr">{p.price ? <>{fmt(p.price)}{p.old > p.price && <s>{fmt(p.old)}</s>}</> : <em>Ask price</em>}{p.stock <= 0 && p.price > 0 && <i>Out of stock</i>}</span>
            </button>
          )) : <div className="ls-none">No product found for <b>“{term}”</b>. Try a model or part number.</div>}
          <button type="submit" className="ls-all">{total > SHOWN ? `See all ${total} results for “${term}”` : `Search “${term}” in the shop`} →</button>
        </div>
      )}
    </form>
  );
}
