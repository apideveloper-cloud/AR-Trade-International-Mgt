import { Component, useEffect } from 'react';

// The other error screens share the look of the 404 page. They use plain links on purpose: a full page load also clears a crashed app.
const PHONE = '+880 1977-554401';
const WA = 'https://wa.me/8801977554401';

const GLYPHS = {
  question: <><path d="M54 68a6.5 6.5 0 1 1 8.6 6.1c-1.8.8-2.6 1.7-2.6 3.4" fill="none" stroke="oklch(0.45 0.17 258)" strokeWidth="3.4" strokeLinecap="round" /><circle cx="60" cy="84" r="2.2" fill="oklch(0.45 0.17 258)" /></>,
  alert: <><path d="M60 64v13" stroke="oklch(0.52 0.2 28)" strokeWidth="3.8" strokeLinecap="round" /><circle cx="60" cy="84" r="2.3" fill="oklch(0.52 0.2 28)" /></>,
  lock: <><rect x="51.5" y="72" width="17" height="13" rx="3" fill="oklch(0.5 0.14 68)" /><path d="M54.5 72v-4a5.5 5.5 0 0 1 11 0v4" fill="none" stroke="oklch(0.5 0.14 68)" strokeWidth="3.2" strokeLinecap="round" /></>,
  clock: <><circle cx="60" cy="73" r="9" fill="none" stroke="oklch(0.45 0.13 205)" strokeWidth="3.2" /><path d="M60 68v5.5l3.6 2.2" fill="none" stroke="oklch(0.45 0.13 205)" strokeWidth="3.2" strokeLinecap="round" /></>,
  offline: <><path d="M50 69.5a14 14 0 0 1 20 0M54.5 75a7.5 7.5 0 0 1 11 0" fill="none" stroke="oklch(0.42 0.05 250)" strokeWidth="3.2" strokeLinecap="round" /><circle cx="60" cy="81.5" r="2.2" fill="oklch(0.42 0.05 250)" /><path d="M48 63l24 24" stroke="oklch(0.52 0.2 28)" strokeWidth="3.4" strokeLinecap="round" /></>
};

/** The toner cartridge between the two digits (or on its own for "offline"). */
export function CodeArt({ a, b, glyph = 'question' }) {
  return (
    <div className="nf-art" aria-hidden="true">
      {a && <span className="nf-d">{a}</span>}
      <svg className="nf-cart" viewBox="0 0 120 150" role="img">
        <defs><linearGradient id="nfg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="oklch(0.7 0.14 var(--nf-h, 235))" /><stop offset="1" stopColor="oklch(0.45 0.17 calc(var(--nf-h, 235) + 23))" /></linearGradient></defs>
        <rect x="14" y="30" width="92" height="104" rx="16" fill="url(#nfg)" />
        <rect x="26" y="14" width="68" height="26" rx="9" fill="#0b1631" />
        <rect x="30" y="52" width="60" height="42" rx="9" fill="rgba(255,255,255,.18)" />
        <circle cx="60" cy="73" r="15" fill="#fff" />
        {GLYPHS[glyph]}
        <rect x="34" y="106" width="52" height="7" rx="3.5" fill="rgba(255,255,255,.4)" />
        <rect x="34" y="118" width="34" height="7" rx="3.5" fill="rgba(255,255,255,.25)" />
      </svg>
      {b && <span className="nf-d">{b}</span>}
    </div>
  );
}

/** A whole error screen with its own slim header, so it works even when the shop itself could not load. */
export function ErrorScreen({ hue, a, b, glyph, title, text, actions = [], note }) {
  return (
    <div className="nf-page" style={{ '--nf-h': hue }}>
      <header className="nf-top"><a href="/"><img src="/api/uploads/site/ar-icon-round.png" alt="" width="34" height="34" /><b>AR TRADE INTERNATIONAL</b></a></header>
      <section className="nf" role="alert">
        <CodeArt a={a} b={b} glyph={glyph} />
        <h1>{title}</h1>
        <p>{text}</p>
        {note && <code className="nf-path">{note}</code>}
        <div className="nf-actions">
          {actions.map(x => (x.onClick
            ? <button key={x.label} type="button" onClick={x.onClick} className={'btn btn-pill ' + (x.alt ? 'nf-alt' : 'btn-dark')}>{x.label}</button>
            : <a key={x.label} href={x.href} target={x.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={'btn btn-pill ' + (x.alt ? 'nf-alt' : 'btn-dark')}>{x.label}</a>))}
        </div>
        <a className="nf-link" href="/contact">Need help? Call {PHONE} →</a>
      </section>
    </div>
  );
}

const reload = () => window.location.reload();

export const ServerErrorPage = ({ title = 'Something went wrong on our side' } = {}) => (
  <ErrorScreen hue={28} a="5" b="0" glyph="alert" title={title}
    text="We hit an unexpected problem. Please try again in a moment. Your cart and orders are safe, and our team has been told."
    actions={[{ label: 'Try again', onClick: reload }, { label: 'Back to home', href: '/', alt: true }]} />
);

export const ForbiddenPage = () => (
  <ErrorScreen hue={72} a="4" b="3" glyph="lock" title="You don't have access to this page"
    text="This area is for staff, or your account doesn't have permission for it. Sign in with the right account, or head back to the shop."
    actions={[{ label: 'Back to home', href: '/' }, { label: 'Staff sign in', href: '/admin', alt: true }]} />
);

export const MaintenancePage = () => (
  <ErrorScreen hue={205} a="5" b="3" glyph="clock" title="We'll be back shortly"
    text="We are doing a little maintenance to make the shop better. Please check again in a few minutes. Need something right now? Call or WhatsApp us."
    actions={[{ label: 'Reload', onClick: reload }, { label: 'WhatsApp us', href: WA, alt: true }, { label: 'Call ' + PHONE, href: 'tel:+8801977554401', alt: true }]} />
);

export function OfflinePage() {
  useEffect(() => { window.addEventListener('online', reload); return () => window.removeEventListener('online', reload); }, []);
  return (
    <ErrorScreen hue={250} glyph="offline" title="You're offline"
      text="Check your internet connection and try again. This page reloads by itself as soon as you are back online."
      actions={[{ label: 'Try again', onClick: reload }]} />
  );
}

/** Shown when the shop's data could not be loaded at all. */
export const LoadFailedPage = () => (typeof navigator !== 'undefined' && navigator.onLine === false ? <OfflinePage /> : <ServerErrorPage title="We couldn't load the shop right now" />);

/** Catches a crash while drawing any page and shows the friendly 500 screen instead of a blank page. */
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error(err); }
  render() { return this.state.failed ? <ServerErrorPage /> : this.props.children; }
}
