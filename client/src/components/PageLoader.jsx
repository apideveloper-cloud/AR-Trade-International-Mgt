/**
 * Full-page / full-panel loading screen with the company logo inside a turning ring.
 * `inline` is the shorter version for the body of a page (the sidebar and top bar stay on screen).
 * The small `<span className="spin" />` stays for loading inside cards and tables.
 */
export function PageLoader({ label = 'Loading…', inline = false }) {
  return (
    <div className={'ld' + (inline ? ' inline' : '')} role="status" aria-live="polite">
      <div className="ld-mark">
        <i className="ld-ring" aria-hidden="true" />
        <img src="/ar-icon-round.png" alt="" width="56" height="56" draggable="false" />
      </div>
      <b>AR Trade International</b>
      <small>{label}</small>
    </div>
  );
}
