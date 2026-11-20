import { CopyRow, Help, Rich, Section } from './parts.jsx';
import { useT } from '../../i18n/lang.jsx';
import { NO_CONNECT_NOTE, stepsOf } from './growthModel.js';

const jump = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/** Numbered setup checklist with ticks, what is missing, and the Google / Bing key how-tos. */
export default function Wizard({ s, go, canConn }) {
  const tr = useT();
  const steps = stepsOf(s, tr);
  const left = steps.filter(x => !x.done).length;
  return (
    <Section id="adgr-wizard" title="Setup checklist" right={<span className={'adgr-pill ' + (left ? 'adgr-pill-todo' : 'adgr-pill-done')}>{left ? tr(left > 1 ? '{n} steps left' : '{n} step left', { n: left }) : tr('All set')}</span>}
      what="Do these six steps once, top to bottom. A green tick means the step is finished.">
      <ol className="adgr-list">
        {steps.map((x, i) => (
          <li key={x.key} className="adgr-step">
            <span className={'adgr-tick ' + (x.done ? 'adgr-tick-done' : 'adgr-tick-todo')} aria-label={x.done ? tr('Done') : tr('To do')}>{x.done ? '✓' : i + 1}</span>
            <div className="adgr-step-txt"><b>{x.title}</b><span className="adseo-hint">{x.fix}</span>{x.needsKey && !canConn && !x.done && <span className="adseo-hint">{tr(NO_CONNECT_NOTE)}</span>}</div>
            <div className="adgr-step-acts">
              {x.goto && !x.done && <button type="button" className="a-btn ghost sm" onClick={() => go(x.goto)}>{tr('Open SEO settings')}</button>}
              {x.anchor && !x.done && <button type="button" className="a-btn ghost sm" onClick={() => jump(x.anchor)}>{tr('Go to this step')}</button>}
            </div>
          </li>
        ))}
      </ol>
      {s.siteUrl && <CopyRow label="Your domain" value={s.siteUrl} />}
      <Help title="How to get the Google client ID and secret">
        <ol className="adgr-steps">
          <li><Rich href="https://console.cloud.google.com/" text={tr('Open <a>Google Cloud Console</a> and create a new project (any name, for example AR Trade Search).')} /></li>
          <li><Rich text={tr('Go to APIs & Services > Library. Search for and Enable <b>Google Search Console API</b>, then <b>Site Verification API</b>.')} /></li>
          <li><Rich text={tr('Go to APIs & Services > OAuth consent screen. Choose <b>External</b>, fill in the app name and your email, and under Test users add your own Google account.')} /></li>
          <li><Rich text={tr('Go to Credentials > Create credentials > <b>OAuth client ID</b> > Application type <b>Web application</b>.')} /></li>
          <li>{tr('Under Authorized redirect URIs add exactly this address:')}<CopyRow label="" value={s.redirectUri} /></li>
          <li><Rich text={tr('Press Create. Copy the <b>Client ID</b> and <b>Client secret</b> into the Google section below and press Save.')} /></li>
        </ol>
      </Help>
      <Help title="How to get the Bing API key">
        <ol className="adgr-steps">
          <li><Rich href="https://www.bing.com/webmasters" text={tr('Open <a>Bing Webmaster Tools</a> and sign in. Add your site if it is not there.')} /></li>
          <li><Rich text={tr('Click Settings (the gear icon) > <b>API access</b>.')} /></li>
          <li><Rich text={tr('Under API Key press <b>Generate</b>, copy the key and paste it into the Bing section below.')} /></li>
        </ol>
      </Help>
    </Section>
  );
}
