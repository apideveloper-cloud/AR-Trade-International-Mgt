import { useState } from 'react';
import { Msg, Section } from './parts.jsx';
import { send, gsMsg, nf, dt, advice } from './gsApi.js';

const PARTS = [['indexed', 'Indexed', '✔', 'adgs-b-ok'], ['notIndexed', 'Not indexed', '✖', 'adgs-b-no'], ['unknown', 'Unknown', '?', 'adgs-b-un'], ['neverInspected', 'Not checked yet', '○', 'adgs-b-nc']];

/** D. Indexing health: bar, sitemap line, reasons, and the two action buttons. */
export default function GsHealth({ q, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const d = q.data;
  if (q.error) return <Section title="Is Google listing your pages?"><Msg m={{ ok: false, text: q.error }} /></Section>;
  if (!d) return <Section title="Is Google listing your pages?"><p className="adseo-hint">Loading...</p></Section>;
  if (!d.connected) return null;
  const c = d.counts || {};
  const total = Math.max(1, c.total || 0);
  const quota = d.quota || {};
  const sm = d.sitemap;
  const check = async () => {
    setBusy(true); setMsg(null);
    const r = await send('/growth/gsc/inspect-batch', {});
    setBusy(false);
    setMsg(r.status === 429 ? { ok: false, text: 'You have used all of today\'s checks. Please try again tomorrow.' } : gsMsg(r, r.body?.queued != null ? `Started. ${r.body.queued} pages are queued to be checked. Come back in a few minutes.` : 'Started. Your pages will be checked in the background.'));
    if (r.ok) onChanged();
  };
  let x = 0;
  return (
    <Section title="Is Google listing your pages?" what="Google can only send visitors to pages it has added to its list (indexed). We ask Google about your pages a few at a time."
      right={<button type="button" className="a-btn sm" disabled={busy} onClick={check}>{busy ? 'Starting...' : 'Check my pages now'}</button>}>
      <Msg m={msg} />
      <svg className="adgs-svg adgs-bar" viewBox="0 0 640 40" role="img" aria-labelledby="adgs-ht adgs-hd">
        <title id="adgs-ht">Indexing status of your pages</title>
        <desc id="adgs-hd">{PARTS.map(([k, t]) => `${t}: ${nf(c[k])}`).join('. ')}. Total {nf(c.total)}.</desc>
        {PARTS.map(([k, , , cls]) => {
          const w = (640 * (c[k] || 0)) / total, el = <rect key={k} x={x} y="4" width={w} height="32" className={cls} />;
          x += w; return el;
        })}
      </svg>
      <ul className="adgs-legend">
        {PARTS.map(([k, t, ic, cls]) => (
          <li key={k}><span className={'adgs-dot ' + cls} aria-hidden="true">{ic}</span> {t}: <b>{nf(c[k])}</b></li>
        ))}
      </ul>
      <p className="adgs-sm">{nf(quota.usedToday)} of {nf(quota.limitToday || 400)} checks used today. Last check run: {dt(d.lastRunAt)}.</p>
      {sm && (
        <p>Sitemap: <b>{nf(sm.submitted)}</b> addresses sent to Google, <b>{nf(sm.indexed)}</b> listed
          {sm.errors ? `, ${nf(sm.errors)} errors` : ''}{sm.warnings ? `, ${nf(sm.warnings)} warnings` : ''}. Last read by Google: {dt(sm.lastDownloaded)}.</p>
      )}
      {(d.byReason || []).length > 0 && (
        <div className="adgr-scroll">
          <table className="adgr-tbl">
            <thead><tr><th>Reason Google gives</th><th>Pages</th><th>What it means and what to do</th></tr></thead>
            <tbody>
              {d.byReason.slice(0, 10).map(r => (
                <tr key={r.reason}>
                  <td className="adgr-wrap">{r.reason}</td><td>{nf(r.count)}</td>
                  <td className="adgr-wrap">{advice(r.reason)}
                    {(r.sample || []).slice(0, 3).map(s => <div key={s.url} className="adgs-sm">{s.url}</div>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
