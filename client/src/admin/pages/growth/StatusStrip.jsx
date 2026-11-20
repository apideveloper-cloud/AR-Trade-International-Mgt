import { LABEL, toneOf, when } from './growthModel.js';

function Tile({ name, tone, account, last, err, act, onAct }) {
  return (
    <div className="a-card adgr-tile">
      <div className="adgr-tile-hd"><span className={'adgr-dot adgr-dot-' + tone} aria-hidden="true" /><b>{name}</b></div>
      <div className={'adgr-tile-st adgr-st-' + tone}>{LABEL[tone]}</div>
      <div className="adgr-tile-line">{account || 'No account yet'}</div>
      <div className="adgr-tile-line adgr-dim">Last sync: {when(last)}</div>
      {err && <div className="adgr-tile-err">{err}</div>}
      <button type="button" className="a-btn sm" onClick={onAct}>{act}</button>
    </div>
  );
}

const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** The four status cards plus the "keep keys safe" warning. */
export default function StatusStrip({ s }) {
  const g = s.google || {}, b = s.bing || {}, n = s.indexNow || {};
  const sm = g.sitemapSubmittedAt || b.sitemapSubmittedAt;
  return (
    <>
      {s.vault?.fallbackKey && <div className="adgr-warn" role="alert">Add SECRETS_KEY to the server settings so saved keys stay safe if the login secret changes.</div>}
      <div className="adgr-strip">
        <Tile name="Google Search Console" tone={toneOf(g.status)} account={g.account} last={g.lastSync} err={g.lastError} act={g.status === 'connected' ? 'Test connection' : 'Connect Google'} onAct={() => jump('adgr-google')} />
        <Tile name="Bing Webmaster" tone={toneOf(b.status)} account={b.account} last={b.lastSync} err={b.lastError} act={b.status === 'connected' ? 'Test connection' : 'Add API key'} onAct={() => jump('adgr-bing')} />
        <Tile name="IndexNow" tone={n.ready ? 'ok' : 'off'} account={n.ready ? 'Key set, switched on' : n.enabled ? 'Switched on, key missing' : 'Switched off'} last={null} act="See IndexNow" onAct={() => jump('adgr-indexnow')} />
        <Tile name="Sitemap" tone={sm ? 'ok' : 'off'} account={s.sitemapUrl || 'No address yet'} last={sm} act="Submit sitemap" onAct={() => jump('adgr-sitemap')} />
      </div>
    </>
  );
}
