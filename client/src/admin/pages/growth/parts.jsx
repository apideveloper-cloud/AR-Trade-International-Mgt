import { CopyBtn } from '../seo/automation/parts.jsx';
import { useT } from '../../i18n/lang.jsx';

export { CopyBtn };

/** Result line: m = { ok, text } or null. */
export const Msg = ({ m }) => (m ? <div className={'adgr-msg ' + (m.ok ? 'adgr-msg-ok' : 'adgr-msg-err')} role="status">{m.text}</div> : null);

/** Card with a title, a one-line "what is this" and numbered steps. */
export function Section({ id, title, what, steps, children, right }) {
  const tr = useT();
  return (
    <section className="a-card adgr-sec" id={id}>
      <div className="adgr-hd"><h3>{tr(title)}</h3>{right}</div>
      {what && <p className="adseo-hint adgr-what"><b>{tr('What is this?')}</b> {tr(what)}</p>}
      {steps && <ol className="adgr-steps">{steps.map((st, i) => <li key={i}>{tr(st)}</li>)}</ol>}
      {children}
    </section>
  );
}

/** Collapsible help block. */
export function Help({ title, children }) {
  const tr = useT();
  return <details className="adgr-help"><summary>{tr(title)}</summary><div className="adgr-help-body">{children}</div></details>;
}

/** A line with a value and a Copy button. */
export function CopyRow({ label, value }) {
  const tr = useT();
  return (
  <div className="adgr-copy">{label && <span className="adgr-k">{tr(label)}</span>}<code className="adgr-code">{value || '-'}</code>{value && <CopyBtn text={value} />}</div>
  );
}

export const Note = ({ children }) => <div className="adgr-note">{children}</div>;

/** Text with <b>bold</b> and <a>link</a> pieces inside one translated sentence (the link goes to href). */
export function Rich({ text, href }) {
  return <>{String(text).split(/(<b>.*?<\/b>|<a>.*?<\/a>)/g).map((p, i) => (p.startsWith('<b>') ? <b key={i}>{p.slice(3, -4)}</b> : p.startsWith('<a>') ? <a key={i} href={href} target="_blank" rel="noreferrer">{p.slice(3, -4)}</a> : p))}</>;
}
