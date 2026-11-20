import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/shell.js';

// [role, icon, what the role does, accent hue]
export const LOGIN_ROLES = [
  ['Master Admin', '★', 'Everything, and the role matrix', 85], ['Admin', '◆', 'Access set by the Master Admin', 250], ['Manager', '☰', 'Orders, deliveries, approvals', 160],
  ['Accountant', '৳', 'Money, payments, expenses', 300], ['Purchase Officer', '▣', 'Buying, products and stock', 45], ['RM', '☺', 'Customers, enquiries, campaigns', 15],
  ['Field Officer', '⚑', 'Mobile app: attendance, tracking', 200], ['Delivery rider', '🚚', 'Pick-ups and deliveries', 230], ['Marketing manager', '✉', 'Campaigns and subscribers', 330], ['Content writer', '✎', 'Blog and site pages', 120]
];

/** A graphical combo box: the chosen role is shown as an icon + name + what it does, and the list opens as coloured rows. Arrow keys, Enter, Esc and Home/End work. */
export function RoleCombo({ value, onChange }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef(null);
  const cur = LOGIN_ROLES.find(r => r[0] === value);
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  useEffect(() => { if (open) box.current?.querySelector('.rc-row.hi')?.scrollIntoView({ block: 'nearest' }); }, [open, hi]);
  const toggle = () => { setHi(Math.max(0, LOGIN_ROLES.findIndex(r => r[0] === value))); setOpen(o => !o); };
  const pick = i => { onChange(LOGIN_ROLES[i][0]); setOpen(false); box.current?.querySelector('.rc-btn')?.focus(); };
  const key = e => {
    if (!open) { if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); toggle(); } return; }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => (h + 1) % LOGIN_ROLES.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => (h - 1 + LOGIN_ROLES.length) % LOGIN_ROLES.length); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(LOGIN_ROLES.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(hi); }
    else if (e.key === 'Tab') setOpen(false);
  };
  return (
    <div className={'rc' + (open ? ' open' : '')} ref={box} onKeyDown={key}>
      <button type="button" className="rc-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls="rc-list" aria-label={tr('Your role')} onClick={toggle} style={cur ? { '--h': cur[3] } : undefined}>
        {cur
          ? <><i className="rc-ic">{cur[1]}</i><span className="rc-tx"><b>{tr(cur[0])}</b><small>{tr(cur[2])}</small></span></>
          : <><i className="rc-ic none">?</i><span className="rc-tx"><b className="muted">{tr('Select your role')}</b><small>{tr('Tap to choose how you sign in')}</small></span></>}
        <svg className="rc-car" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="rc-list" id="rc-list" role="listbox" aria-label={tr('Roles')}>
          {LOGIN_ROLES.map(([r, ic, ds, h], i) => (
            <li key={r} role="option" aria-selected={value === r} className={'rc-row' + (hi === i ? ' hi' : '') + (value === r ? ' on' : '')} style={{ '--h': h }} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(i); }}>
              <i className="rc-ic">{ic}</i><span className="rc-tx"><b>{tr(r)}</b><small>{tr(ds)}</small></span>{value === r && <em aria-hidden="true">✓</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
