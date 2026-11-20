import { Section } from './parts.jsx';

export default function IndexNowCard({ s, go }) {
  const n = s.indexNow || {};
  const yn = v => (v ? 'Yes' : 'No');
  return (
    <Section id="adgr-indexnow" title="IndexNow" what="A quick way to tell Bing and other search engines the moment a page is added or changed."
      steps={['Open SEO > Settings > Automation (button below).', 'Switch IndexNow on and press Generate key.', 'Press Submit all pages once.']}>
      <ul className="adgr-sum"><li>Switched on: <b>{yn(n.enabled)}</b></li><li>Key created: <b>{yn(n.keySet)}</b></li><li>Ready to send: <b>{yn(n.ready)}</b></li></ul>
      <div className="adgr-acts"><button type="button" className="a-btn sm" onClick={() => go('seo')}>Open SEO settings</button></div>
      <p className="adseo-hint">The SEO page opens on Overview. Choose the Settings tab, then Automation.</p>
    </Section>
  );
}
