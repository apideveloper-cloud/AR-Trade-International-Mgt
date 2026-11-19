import './footer-extra.css';

/** SVG path per network (badge colours live in footer-extra.css). */
const PATHS = {
  facebook: 'M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9H17l.6-4h-4.1V8.9c0-.6.3-.9.5-.9z',
  linkedin: 'M4.5 9.5h3v10h-3zM10 9.5h2.9v1.4c.5-.9 1.7-1.7 3.4-1.7 3 0 3.7 1.9 3.7 4.6v5.7h-3v-5c0-1.2-.1-2.6-1.7-2.6s-2.3 1.2-2.3 2.6v5H10z',
  youtube: 'M10 8.5v7l6-3.5z',
  x: 'M5 4.5h4.2l3.5 4.8 4-4.8h2l-5.1 6 5.9 8.5h-4.2l-3.8-5.2-4.4 5.2h-2l5.5-6.5z'
};

/** Round social-network badge linking to `href`. */
export default function SocialIcon({ name, href }) {
  if (name === 'instagram') {
    return (
      <a href={href} target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram" className="ftx-instagram">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="12" r="3.6" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="17" cy="7" r="1.2" /></svg>
      </a>
    );
  }
  const known = name in PATHS;
  return (
    <a href={href} target="_blank" rel="noreferrer" title={name} aria-label={name} className={known ? 'ftx-' + name : 'ftx-other'}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d={PATHS[name] || ''} />{name === 'linkedin' && <circle cx="6" cy="6" r="1.8" />}</svg>
    </a>
  );
}
