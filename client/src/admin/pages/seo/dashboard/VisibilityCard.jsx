import { adm } from '../../../adminApi.js';
import { useApiData } from '../../../hooks/useApiData.js';
import { CopyBtn } from '../automation/parts.jsx';
import { whenOf } from './dashModel.js';
import { Rich } from '../../growth/parts.jsx';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

/** One checklist line: a dot (done or still to do), the step, a hint and the action buttons. */
function Step({ done, title, hint, children }) {
  const tr = useT();
  return (
    <li className="adds-vis-step">
      <span className={'adds-vis-dot ' + (done ? 'adds-vis-done' : 'adds-vis-todo')} aria-label={done ? tr('Done') : tr('To do')}>{done ? '✓' : '!'}</span>
      <div className="adds-vis-txt"><b>{tr(title)}</b>{hint && <span className="adseo-hint">{Array.isArray(hint) ? tr(hint[0], hint[1]) : tr(hint)}</span>}</div>
      <div className="adds-vis-acts">{children}</div>
    </li>
  );
}

/** Overview card: what is still missing before search engines can find and list the site. onGoto(tab) opens a tab. */
export default function VisibilityCard({ onGoto }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/seo/automation'));
  const v = q.data?.visibility;
  if (!v) return q.error ? null : <span className="spin" />;
  const sm = v.sitemapUrl || '/sitemap.xml';
  const todo = [!v.preferredDomain, !v.bingVerified, !v.googleVerified, !v.indexNowReady, !v.submittedAt].filter(Boolean).length;
  return (
    <section className="a-card adds-vis">
      <div className="adds-vis-hd">
        <b>{tr('Get found by search engines')}</b>
        <span className={'adds-vis-pill ' + (todo ? 'adds-vis-todo' : 'adds-vis-done')}>{todo ? (todo > 1 ? tr('{n} steps left', { n: todo }) : tr('1 step left')) : tr('All set')}</span>
      </div>
      <p className="adseo-hint">{tr('A page can only appear in Google or Bing after the search engine has been told about the site. Complete these steps once.')}</p>
      <ol className="adds-vis-list">
        <Step done={!!v.preferredDomain} title="Public domain" hint={v.preferredDomain ? ['{d}', { d: v.preferredDomain }] : 'Set the Preferred domain (for example https://artradeinternational.com) in Settings > General.'}>
          {!v.preferredDomain && <button type="button" className="a-btn ghost sm" onClick={() => onGoto('settings')}>{tr('Open settings')}</button>}
        </Step>
        <Step done={!!v.bingVerified} title="Bing Webmaster Tools" hint={v.bingVerified ? 'Verification code is on the site.' : 'Add the site in Bing Webmaster Tools, copy the verification code into Settings > Verification, then press Verify.'}>
          <a className="a-btn ghost sm" href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer">{tr('Open Bing Webmaster')}</a>
          {!v.bingVerified && <button type="button" className="a-btn ghost sm" onClick={() => onGoto('settings')}>{tr('Open settings')}</button>}
        </Step>
        <Step done={!!v.googleVerified} title="Google Search Console" hint={v.googleVerified ? 'Verification code is on the site.' : 'Add the site in Google Search Console, copy the HTML-tag verification code into Settings > Verification, then press Verify.'}>
          <a className="a-btn ghost sm" href="https://search.google.com/search-console" target="_blank" rel="noreferrer">{tr('Open Search Console')}</a>
          {!v.googleVerified && <button type="button" className="a-btn ghost sm" onClick={() => onGoto('settings')}>{tr('Open settings')}</button>}
        </Step>
        <Step done={false} title="Submit the sitemap in both tools" hint={['Paste this address under Sitemaps: {sm} (the tools do not tell the site when this is done).', { sm }]}>
          <CopyBtn text={sm} label="Copy sitemap address" />
        </Step>
        <Step done={!!v.indexNowReady} title="IndexNow (Bing and others, fast)" hint={v.indexNowReady ? 'Switch on, key set and domain set.' : 'Turn the IndexNow switch on, generate a key and set the Preferred domain.'}>
          {!v.indexNowReady && <button type="button" className="a-btn ghost sm" onClick={() => onGoto('settings')}>{tr('Open settings')}</button>}
        </Step>
        <Step done={!!v.submittedAt} title="Send all pages to IndexNow" hint={v.submittedAt ? ['Last sent: {when}', { when: whenOf(v.submittedAt) }] : 'In Settings > Automation press Submit all pages (the whole site is sent in one go).'}>
          {!v.submittedAt && v.indexNowReady && <button type="button" className="a-btn sm" onClick={() => onGoto('settings')}>{tr('Go to Automation')}</button>}
        </Step>
      </ol>
      <p className="adseo-hint"><Rich text={tr("Also check your domain's DNS: <b>www</b> must point to this same server (or have no record), otherwise visitors and search engines that use the www address land on the wrong site.")} /></p>
    </section>
  );
}
