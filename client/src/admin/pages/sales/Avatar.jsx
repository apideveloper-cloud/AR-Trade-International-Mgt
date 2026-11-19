import { hueOf } from '../../ui.jsx';

/** Round initials badge for a person's name; `cls` picks the surrounding stylesheet's avatar class. */
export function Avatar({ name, cls }) {
  return <span className={cls} style={{ '--h': hueOf(name) }}>{String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>;
}
