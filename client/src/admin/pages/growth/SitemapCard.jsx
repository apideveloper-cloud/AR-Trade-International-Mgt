import { useState } from 'react';
import { useT } from '../../i18n/lang.jsx';
import { useBusy } from '../../hooks/useBusy.js';
import { CopyRow, Msg, Section } from './parts.jsx';
import { NO_CONNECT_NOTE, run, when } from './growthModel.js';

const NAMES = { google: 'Google', bing: 'Bing' };

function line(k, x, tr) {
  if (x.skipped) return { ok: false, text: NAMES[k] + ': ' + tr('skipped') + (typeof x.skipped === 'string' ? ' (' + tr(x.skipped) + ')' : x.error ? ' (' + tr(x.error) + ')' : ' (' + tr('not connected') + ').') };
  return x.ok ? { ok: true, text: NAMES[k] + ': ' + tr('sitemap accepted.') } : { ok: false, text: NAMES[k] + ': ' + tr(x.error || 'not accepted.') };
}

export default function SitemapCard({ s, reload, canConn }) {
  const tr = useT();
  const [busy, doit] = useBusy();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const send = engines => doit(async () => {
    setRes(null); setErr(null);
    const r = await run('POST', '/growth/sitemap/submit', { engines });
    if (!r.ok) setErr({ ok: false, text: tr(r.error) }); else setRes(r.data.results || {});
    reload();
  });
  return (
    <Section id="adgr-sitemap" title="Sitemap" what="The sitemap is the list of every page on your site. Sending it asks the search engine to read that list."
      steps={['Make sure the public domain is set and the site is verified.', 'Press Submit to both (or just one engine).', 'Read the answer under the buttons.']}>
      <CopyRow label="Sitemap address" value={s.sitemapUrl} />
      {!canConn && <p className="adseo-hint">{tr(NO_CONNECT_NOTE)}</p>}
      <div className="adgr-acts">
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['google'])}>{tr('Submit to Google')}</button>
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['bing'])}>{tr('Submit to Bing')}</button>
        <button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={() => send(['google', 'bing'])}>{tr('Submit to both')}</button>
        {busy && <span className="spin" />}
      </div>
      <Msg m={err} />
      {res && Object.keys(res).map(k => <Msg key={k} m={line(k, res[k] || {}, tr)} />)}
      <div className="adgr-dim">{tr('Last submitted: Google {g} · Bing {b}', { g: when(s.google?.sitemapSubmittedAt, tr), b: when(s.bing?.sitemapSubmittedAt, tr) })}</div>
    </Section>
  );
}
