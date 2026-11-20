import { useT } from './i18n/lang.jsx';
import './i18n/dict/shell.js';
// Small square icon buttons for the Edit / Delete / View actions on cards and rows.
// The meaning is in `title` (hover text) and `aria-label`, so screen readers still read "Edit" or "Delete".
const svg = d => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
export const ICONS = {
  view: svg(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>),
  edit: svg(<><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>),
  trash: svg(<><path d="M4 7h16M10 3.5h4M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" /><path d="M10 11v6M14 11v6" /></>),
  external: svg(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>),
  photo: svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4.5 17 4.5-4.5 3.5 3.5 2.5-2.5 4.5 4" /></>)
};

/** `icon` is a key of ICONS. `tone`: 'pri' (dark, the main action), 'bad' (red, destructive) or nothing. Pass `href` to make it a link. */
export function IconBtn({ icon, title, tone = '', onClick, href, disabled }) {
  const tr = useT();
  if (typeof title === 'string') title = tr(title);
  const cls = 'ic-btn' + (tone ? ' ' + tone : '');
  if (href) return <a className={cls} href={href} target="_blank" rel="noreferrer" title={title} aria-label={title}>{ICONS[icon]}</a>;
  return <button type="button" className={cls} title={title} aria-label={title} onClick={onClick} disabled={disabled}>{ICONS[icon]}</button>;
}
