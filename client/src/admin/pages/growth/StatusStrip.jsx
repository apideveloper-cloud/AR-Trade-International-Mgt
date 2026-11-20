import { LABEL, toneOf, when } from './growthModel.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthA.js';

function Tile({ name, tone, account, last, err, act, onAct }) {
  const tr = useT();
  return (
    <div className="a-card adgr-tile">
      <div className="adgr-tile-hd"><span className={'adgr-dot adgr-dot-' + tone} aria-hidden="true" /><b>{tr(name)}</b></div>
      <div className={'adgr-tile-st adgr-st-' + tone}>{tr(LABEL[tone])}</div>
      <div className="adgr-tile-line">{account || tr('No account yet')}</div>
      <div className="adgr-tile-line adgr-dim">{tr('Last sync: {d}', { d: when(last, tr) })}</div>
      {err && <div className="adgr-tile-err">{err}</div>}
      <button type="button" className="a-btn sm" onClick={onAct}>{tr(act)}</button>
    </div>
  );
}

const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** The four status cards plus the "keep keys safe" warning. */
export default function StatusStrip({ s }) {
  const tr = useT();
  const g = s.google || {}, b = s.bing || {}, n = s.indexNow || {};
  const sm = g.sitemapSubmittedAt || b.sitemapSubmittedAt;
  return (
    <>
      {s.vault?.fallbackKey && <div className="adgr-warn" role="alert">{tr('Add SECRETS_KEY to the server settings so saved keys stay safe if the login secret changes.')}</div>}
      <div className="adgr-strip">
        <Tile name="Google Search Console" tone={toneOf(g.status)} account={g.account} last={g.lastSync} err={g.lastError} act={g.status === 'connected' ? 'Test connection' : 'Connect Google'} onAct={() => jump('adgr-google')} />
        <Tile name="Bing Webmaster" tone={toneOf(b.status)} account={b.account} last={b.lastSync} err={b.lastError} act={b.status === 'connected' ? 'Test connection' : 'Add API key'} onAct={() => jump('adgr-bing')} />
        <Tile name="IndexNow" tone={n.ready ? 'ok' : 'off'} account={n.ready ? tr('Key set, switched on') : n.enabled ? tr('Switched on, key missing') : tr('Switched off')} last={null} act="See IndexNow" onAct={() => jump('adgr-indexnow')} />
        <Tile name="Sitemap" tone={sm ? 'ok' : 'off'} account={s.sitemapUrl || tr('No address yet')} last={sm} act="Submit sitemap" onAct={() => jump('adgr-sitemap')} />
      </div>
    </>
  );
}
