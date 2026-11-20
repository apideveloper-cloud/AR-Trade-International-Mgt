import { useState } from 'react';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/shell.js';

/** Password box with a show / hide eye, so a mistyped password can be checked before signing in. */
export function PasswordInput({ name, autoComplete, minLength }) {
  const tr = useT();
  const [show, setShow] = useState(false);
  return (
    <span className="pw-in">
      <input type={show ? 'text' : 'password'} name={name} required minLength={minLength} autoComplete={autoComplete} />
      <button type="button" className="pw-eye" onClick={() => setShow(s => !s)} aria-label={tr(show ? 'Hide password' : 'Show password')} aria-pressed={show} title={tr(show ? 'Hide password' : 'Show password')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {show
            ? <><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c5 0 8.5 4 9.5 6a12 12 0 0 1-2.6 3.3M6.6 7.6A12.4 12.4 0 0 0 2.5 12c1 2 4.5 6 9.5 6 1.6 0 3-.4 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
            : <><path d="M2.5 12c1-2 4.5-6 9.5-6s8.5 4 9.5 6c-1 2-4.5 6-9.5 6s-8.5-4-9.5-6z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
    </span>
  );
}
