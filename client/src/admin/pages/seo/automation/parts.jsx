import { useState } from 'react';

/** Small on/off pill. tone: ok | warn | off */
export const AuPill = ({ tone, children }) => <span className={'adau-pill adau-pill-' + tone}>{children}</span>;

/** One label/value line of a block. */
export const AuRow = ({ k, children }) => <div className="adau-row"><span className="adau-k">{k}</span><span className="adau-v">{children}</span></div>;

/** A block (IndexNow, Sitemap...) with a title and an optional pill beside it. */
export const AuBlock = ({ title, pill, children }) => (
  <section className="adau-block"><div className="adau-bh"><b>{title}</b>{pill}</div>{children}</section>
);

/** Button that copies text and says "Copied" for two seconds. */
export function CopyBtn({ text, label }) {
  const [done, setDone] = useState(false);
  const go = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
  };
  return <button type="button" className="a-btn ghost sm adau-copy" title={text} onClick={go}>{done ? 'Copied' : label || 'Copy'}</button>;
}

/** Inline result line: { ok, text } or null. */
export const AuMsg = ({ m }) => (m ? <div className={'adau-msg ' + (m.ok ? 'adau-msg-ok' : 'adau-msg-err')} role="status">{m.text}</div> : null);
