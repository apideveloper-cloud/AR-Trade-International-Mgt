import { createContext, useContext } from 'react';

export const SettingsCtx = createContext(null);

/** Text field bound to one setting. Defined at module level on purpose: a component created inside Settings would be re-created on every keystroke. */
export function F({ k, label, type = 'text', style, prefix, suffix }) {
  const { s, set } = useContext(SettingsCtx);
  const input = <input className="a-input" type={type} value={s[k] ?? ''} onChange={set(k)} style={style} />;
  return <label className="a-lbl">{label}{prefix || suffix ? <span className="adorn">{prefix && <i>{prefix}</i>}{input}{suffix && <i>{suffix}</i>}</span> : input}</label>;
}

/** Coloured icon + title + one-line explanation at the top of a settings section. */
export function SecHead({ icon, title, sub, children }) {
  return (
    <div className="st-hd">
      <span className="st-ic">{icon}</span>
      <div><b>{title}</b><small>{sub}</small></div>
      <span style={{ flex: 1 }} />
      {children}
    </div>
  );
}

/** Active | Inactive choice for one block of the website. */
export function ActiveToggle({ on, onChange, label }) {
  return (
    <div className="act" role="group" aria-label={label}>
      <span className="act-l">{label}</span>
      <div className="vt">
        <button type="button" className={on ? 'on ok' : ''} aria-pressed={on} onClick={() => onChange(true)}>● Active</button>
        <button type="button" className={!on ? 'on off' : ''} aria-pressed={!on} onClick={() => onChange(false)}>○ Inactive</button>
      </div>
    </div>
  );
}

/** Smooth-scroll to a section by element id. */
export const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
