import { useEffect, useMemo, useRef, useState } from 'react';
import './district-combo.css';

/** A searchable district box: type to filter the list, pick with the mouse, finger or arrow keys + Enter.
 *  The chosen value goes into a hidden input named `name`, so the checkout form reads it like a normal field. */
export default function DistrictCombo({ id, name, value, onChange, options, invalid, describedBy, extra = 'Others' }) {
  const all = useMemo(() => [...options, extra], [options, extra]);
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef(null), list = useRef(null);
  useEffect(() => { setText(value || ''); }, [value]);

  const q = text.trim().toLowerCase();
  const shown = useMemo(() => (value && text === value ? all : all.filter(x => x.toLowerCase().includes(q))), [all, q, text, value]);
  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => { // keep the highlighted row in view
    if (open) list.current?.children[hi]?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  const pick = v => { setOpen(false); setText(v); if (v !== value) onChange(v); };
  const settle = () => { // leaving the box: an exact name is accepted, anything else goes back to the chosen value
    const exact = all.find(x => x.toLowerCase() === q);
    const only = q && shown.length === 1 ? shown[0] : null; // typed text narrows to one option
    const lit = open && q ? shown[hi] : null; // list open: the highlighted row
    const chosen = exact || only || lit;
    if (chosen) pick(chosen); else { setText(value || ''); setOpen(false); }
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); if (shown.length) setHi(i => Math.min(shown.length - 1, Math.max(0, i) + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); if (shown.length) setHi(i => Math.max(0, Math.min(shown.length - 1, i) - 1)); }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); if (shown[hi]) pick(shown[hi]); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); setText(value || ''); setOpen(false); } }
  };

  return (
    <div className="dcb" ref={wrap} onBlur={e => { if (!wrap.current.contains(e.relatedTarget)) settle(); }}>
      <input type="hidden" name={name} value={value || ''} />
      <input id={id} className={'field' + (invalid ? ' bad' : '')} type="text" role="combobox" aria-expanded={open} aria-controls={open ? id + '-list' : undefined} aria-activedescendant={open && shown[hi] ? id + '-o' + hi : undefined} aria-autocomplete="list" aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required="true"
        autoComplete="off" placeholder="Search or select your district" value={text}
        onChange={e => { setText(e.target.value); setOpen(true); }} onFocus={e => { e.target.select(); setOpen(true); }} onClick={() => setOpen(true)} onKeyDown={onKey} />
      <span className="dcb-ar" aria-hidden="true" />
      {open && (
        <ul className="dcb-list" id={id + '-list'} role="listbox" ref={list}>
          {shown.length ? shown.map((x, i) => (
            <li key={x} id={id + '-o' + i} role="option" aria-selected={x === value} className={(i === hi ? 'hi ' : '') + (x === value ? 'on' : '')} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(x); }}>{x}</li>
          )) : <li className="none" role="presentation">No district found. Choose "{extra}" to type yours.</li>}
        </ul>
      )}
    </div>
  );
}
