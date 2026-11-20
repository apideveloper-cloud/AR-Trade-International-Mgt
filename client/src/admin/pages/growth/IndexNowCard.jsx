import { Section } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';


export default function IndexNowCard({ s, go }) {
  const tr = useT();
  const n = s.indexNow || {};
  const yn = v => (v ? tr('Yes') : tr('No'));
  return (
    <Section id="adgr-indexnow" title="IndexNow" what="A quick way to tell Bing and other search engines the moment a page is added or changed."
      steps={['Open SEO > Settings > Automation (button below).', 'Switch IndexNow on and press Generate key.', 'Press Submit all pages once.']}>
      <ul className="adgr-sum"><li>{tr('Switched on:')} <b>{yn(n.enabled)}</b></li><li>{tr('Key created:')} <b>{yn(n.keySet)}</b></li><li>{tr('Ready to send:')} <b>{yn(n.ready)}</b></li></ul>
      <div className="adgr-acts"><button type="button" className="a-btn sm" onClick={() => go('seo')}>{tr('Open SEO settings')}</button></div>
      <p className="adseo-hint">{tr('The SEO page opens on Overview. Choose the Settings tab, then Automation.')}</p>
    </Section>
  );
}
