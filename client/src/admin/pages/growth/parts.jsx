import { CopyBtn } from '../seo/automation/parts.jsx';

export { CopyBtn };

/** Result line: m = { ok, text } or null. */
export const Msg = ({ m }) => (m ? <div className={'adgr-msg ' + (m.ok ? 'adgr-msg-ok' : 'adgr-msg-err')} role="status">{m.text}</div> : null);

/** Card with a title, a one-line "what is this" and numbered steps. */
export function Section({ id, title, what, steps, children, right }) {
  return (
    <section className="a-card adgr-sec" id={id}>
      <div className="adgr-hd"><h3>{title}</h3>{right}</div>
      {what && <p className="adseo-hint adgr-what"><b>What is this?</b> {what}</p>}
      {steps && <ol className="adgr-steps">{steps.map((t, i) => <li key={i}>{t}</li>)}</ol>}
      {children}
    </section>
  );
}

/** Collapsible help block. */
export function Help({ title, children }) {
  return <details className="adgr-help"><summary>{title}</summary><div className="adgr-help-body">{children}</div></details>;
}

/** A line with a value and a Copy button. */
export const CopyRow = ({ label, value }) => (
  <div className="adgr-copy">{label && <span className="adgr-k">{label}</span>}<code className="adgr-code">{value || '-'}</code>{value && <CopyBtn text={value} />}</div>
);

export const Note = ({ children }) => <div className="adgr-note">{children}</div>;
