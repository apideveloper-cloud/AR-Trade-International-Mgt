import { useState } from 'react';
import { useBusy } from '../../hooks/useBusy.js';
import { CopyRow, Msg, Section } from './parts.jsx';
import { NO_CONNECT_NOTE, run, when } from './growthModel.js';

const NAMES = { google: 'Google', bing: 'Bing' };

function line(k, x) {
  if (x.skipped) return { ok: false, text: NAMES[k] + ': skipped' + (typeof x.skipped === 'string' ? ' (' + x.skipped + ')' : x.error ? ' (' + x.error + ')' : ' (not connected).') };
  return x.ok ? { ok: true, text: NAMES[k] + ': sitemap accepted.' } : { ok: false, text: NAMES[k] + ': ' + (x.error || 'not accepted.') };
}

export default function SitemapCard({ s, reload, canConn }) {
  const [busy, doit] = useBusy();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const send = engines => doit(async () => {
    setRes(null); setErr(null);
    const r = await run('POST', '/growth/sitemap/submit', { engines });
    if (!r.ok) setErr({ ok: false, text: r.error }); else setRes(r.data.results || {});
    reload();
  });
  return (
    <Section id="adgr-sitemap" title="Sitemap" what="The sitemap is the list of every page on your site. Sending it asks the search engine to read that list."
      steps={['Make sure the public domain is set and the site is verified.', 'Press Submit to both (or just one engine).', 'Read the answer under the buttons.']}>
      <CopyRow label="Sitemap address" value={s.sitemapUrl} />
      {!canConn && <p className="adseo-hint">{NO_CONNECT_NOTE}</p>}
      <div className="adgr-acts">
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['google'])}>Submit to Google</button>
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['bing'])}>Submit to Bing</button>
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['google', 'bing'])}>Submit to both</button>
        {busy && <span className="spin" />}
      </div>
      <Msg m={err} />
      {res && Object.keys(res).map(k => <Msg key={k} m={line(k, res[k] || {})} />)}
      <div className="adgr-dim">Last submitted: Google {when(s.google?.sitemapSubmittedAt)} · Bing {when(s.bing?.sitemapSubmittedAt)}</div>
    </Section>
  );
}
