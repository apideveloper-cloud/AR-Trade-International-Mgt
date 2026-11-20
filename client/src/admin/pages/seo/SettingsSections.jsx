import { Switch } from '../../ui.jsx';
import { SecHead } from '../system/settings/parts.jsx';
import { DAYS, SEPARATORS, trServer } from './seoModel.js';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/seo.js';

/** Text input bound to a path of the settings. */
function Field({ s, set, path, label, type = 'text', hint, placeholder }) {
  const tr = useT();
  const v = path.reduce((o, k) => o?.[k], s);
  return (
    <label className="a-lbl adseo-grow">{tr(label)}
      <input className="a-input" type={type} value={v ?? ''} placeholder={placeholder} onChange={e => set(path, type === 'number' && e.target.value !== '' ? +e.target.value : e.target.value)} />
      {hint && <span className="adseo-hint">{tr(hint)}</span>}
    </label>
  );
}

export function GeneralSection({ s, set }) {
  const tr = useT();
  const g = s.general || {};
  return (
    <div className="a-card st-sec" id="seo-general" style={{ '--h': 250 }}>
      <SecHead icon="🏷️" title={tr('General')} sub={tr('Names and defaults used by every page title')} />
      <div className="a-fields">
        <Field s={s} set={set} path={['general', 'siteName']} label="Site name" hint="Used by {site_name}." />
        <Field s={s} set={set} path={['general', 'siteNameShort']} label="Short site name" hint="Used by {site_name_short}: a shorter brand used in product titles so they fit in 60 characters." />
        <label className="a-lbl">{tr('Title separator')}<select className="a-input" value={g.separator || '|'} onChange={e => set(['general', 'separator'], e.target.value)}>{SEPARATORS.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <Field s={s} set={set} path={['general', 'defaultOgImage']} label="Default share image" placeholder="/uploads/share.jpg" hint="Shown when a page has no picture of its own." />
        <Field s={s} set={set} path={['general', 'preferredDomain']} label="Preferred domain" placeholder="https://artradeinternational.com" />
        <Field s={s} set={set} path={['general', 'defaultLanguage']} label="Default language" placeholder="en" />
      </div>
    </div>
  );
}

function HoursEditor({ hours, onChange }) {
  const tr = useT();
  const rows = hours || [];
  const upd = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const toggle = (i, d) => { const cur = rows[i].days || []; upd(i, { days: cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d] }); };
  return (
    <div className="adseo-hours">
      {rows.map((r, i) => (
        <div className="adseo-hrow" key={i}>
          <div className="adseo-days adseo-grow" role="group" aria-label={tr('Days')}>
            {DAYS.map(([d, l]) => <button key={d} type="button" aria-pressed={(r.days || []).includes(d)} className={(r.days || []).includes(d) ? 'on' : ''} onClick={() => toggle(i, d)}>{tr(l)}</button>)}
          </div>
          <label className="a-lbl">{tr('Opens')}<input className="a-input" type="time" value={r.opens || ''} onChange={e => upd(i, { opens: e.target.value })} /></label>
          <label className="a-lbl">{tr('Closes')}<input className="a-input" type="time" value={r.closes || ''} onChange={e => upd(i, { closes: e.target.value })} /></label>
          <button type="button" className="a-btn ghost sm" onClick={() => onChange(rows.filter((_, j) => j !== i))}>{tr('Remove')}</button>
        </div>
      ))}
      <div><button type="button" className="a-btn ghost sm" onClick={() => onChange([...rows, { days: [], opens: '09:00', closes: '18:00' }])}>{tr('+ Add opening hours')}</button></div>
    </div>
  );
}

export function BusinessSection({ s, set }) {
  const tr = useT();
  return (
    <div className="a-card st-sec" id="seo-business" style={{ '--h': 160 }}>
      <SecHead icon="🏢" title={tr('Business and schema info')} sub={tr('Feeds the structured data Google reads about the shop')} />
      <div className="a-fields">
        <Field s={s} set={set} path={['business', 'legalName']} label="Legal name" />
        <Field s={s} set={set} path={['business', 'logo']} label="Logo path" placeholder="/uploads/logo.png" />
        <Field s={s} set={set} path={['business', 'geoLat']} label="Latitude" placeholder="23.7806" />
        <Field s={s} set={set} path={['business', 'geoLng']} label="Longitude" placeholder="90.4193" />
        <Field s={s} set={set} path={['business', 'priceRange']} label="Price range" placeholder="৳৳" />
      </div>
      <b className="adseo-hint">{tr('Opening hours')}</b>
      <HoursEditor hours={s.business?.hours} onChange={v => set(['business', 'hours'], v)} />
      <span className="adseo-hint">{tr('Address, phone, WhatsApp, email and social links are edited in Settings and Content and are reused here automatically.')}</span>
    </div>
  );
}

export function ShippingSection({ s, set }) {
  const tr = useT();
  const zones = s.shipping?.zones || [];
  const upd = (i, patch) => set(['shipping', 'zones'], zones.map((z, j) => (j === i ? { ...z, ...patch } : z)));
  return (
    <div className="a-card st-sec" id="seo-shipping" style={{ '--h': 45 }}>
      <SecHead icon="🚚" title={tr('Shipping and returns')} sub={tr('Shown on Google product listings')} />
      <div className="adseo-hours">
        {zones.map((z, i) => (
          <div className="adseo-hrow" key={z.id || i}>
            <label className="a-lbl adseo-grow">{tr('Zone')}<input className="a-input" value={z.label || ''} onChange={e => upd(i, { label: e.target.value })} /></label>
            <label className="a-lbl">{tr('Rate (৳)')}<input className="a-input" type="number" min="0" value={z.rate ?? ''} onChange={e => upd(i, { rate: e.target.value === '' ? '' : +e.target.value })} /></label>
          </div>
        ))}
      </div>
      <div className="a-fields">
        <Field s={s} set={set} path={['shipping', 'handlingDays']} type="number" label="Handling days" />
        <Field s={s} set={set} path={['shipping', 'transitDays', 'dhaka']} type="number" label="Transit days, Dhaka" />
        <Field s={s} set={set} path={['shipping', 'transitDays', 'outside']} type="number" label="Transit days, outside Dhaka" />
        <Field s={s} set={set} path={['returns', 'windowDays']} type="number" label="Return window (days)" />
        <label className="a-lbl">{tr('Return method')}<select className="a-input" value={s.returns?.method || ''} onChange={e => set(['returns', 'method'], e.target.value)}><option value="">{tr('Not set')}</option><option value="store">{tr('At the store')}</option><option value="courier">{tr('By courier')}</option><option value="both">{tr('Store or courier')}</option></select></label>
        <Field s={s} set={set} path={['returns', 'fees']} label="Return fees" />
        <label className="a-lbl">{tr('Return category')}<select className="a-input" value={s.returns?.category || ''} onChange={e => set(['returns', 'category'], e.target.value)}><option value="">{tr('Not set')}</option><option value="full">{tr('Full refund')}</option><option value="exchange">{tr('Exchange only')}</option><option value="none">{tr('No returns')}</option></select></label>
      </div>
      <span className="adseo-hint">{tr('Empty values are never published to Google.')}</span>
    </div>
  );
}

export function VerificationSection({ s, set }) {
  const tr = useT();
  return (
    <div className="a-card st-sec" id="seo-verify" style={{ '--h': 200 }}>
      <SecHead icon="✅" title={tr('Verification and tracking')} sub={tr('Prove ownership to search engines')} />
      <div className="a-fields">
        <Field s={s} set={set} path={['verification', 'google']} label="Google verification token" hint="Only the content value, not the whole meta tag." />
        <Field s={s} set={set} path={['verification', 'bing']} label="Bing verification token" hint="Only the content value." />
        <Field s={s} set={set} path={['verification', 'ga4']} label="GA4 measurement ID" placeholder="G-XXXXXXXXXX" hint="Looks like G-ABC123XYZ9." />
        <Field s={s} set={set} path={['verification', 'gtm']} label="GTM container ID" placeholder="GTM-XXXXXXX" hint="Looks like GTM-ABC1234." />
      </div>
      <span className="adseo-hint">{tr('GA4 and GTM IDs are now added to the public website pages (after the page loads, never in the admin). The website has no cookie-consent banner. Check your privacy policy before turning tracking on.')}</span>
    </div>
  );
}

export function RobotsSection({ s, set, text, onText, onValidate, busy, errors, ok }) {
  const tr = useT();
  const r = s.robots || {};
  const sw = (k, label, hint) => (
    <div className="adseo-switch"><Switch on={!!r[k]} onChange={v => set(['robots', k], v)} title={tr(label)} /><span>{tr(label)}<br /><span className="adseo-hint">{tr(hint)}</span></span></div>
  );
  return (
    <div className="a-card st-sec" id="seo-robots" style={{ '--h': 330 }}>
      <SecHead icon="🤖" title={tr('Robots')} sub={tr('What search engines may crawl')} />
      {sw('noindexSearch', 'Hide search result pages', 'Adds noindex to the shop search pages.')}
      {sw('noindexFilters', 'Hide filtered lists', 'Adds noindex to pages with filter options in the address.')}
      <label className="a-lbl">{tr('Custom robots.txt')}<textarea className="a-input adseo-robots" rows={8} value={text} onChange={e => onText(e.target.value)} placeholder={tr('Leave empty for the automatic robots.txt')} /></label>
      <span className="adseo-hint">{tr('Empty means the automatic robots.txt is used. This box is saved with its own button; the two switches above are saved with Save all.')}</span>
      {errors.length > 0 && <div className="a-msg err"><ul className="adseo-errs">{errors.map((e, i) => <li key={i}>{trServer(tr, e)}</li>)}</ul></div>}
      {ok && <div className="a-msg ok">{tr('robots.txt saved.')}</div>}
      <div><button type="button" className="a-btn" disabled={busy} onClick={onValidate}>{tr('Validate & save robots.txt')}</button></div>
    </div>
  );
}

/** Two editable switches (saved with the page's Save all) and the fixed "AI drafting" note. */
export function FlagsSection({ s, set }) {
  const tr = useT();
  const f = s.flags || {};
  const sw = (k, label, hint) => (
    <div className="adseo-switch"><Switch on={!!f[k]} onChange={v => set(['flags', k], v)} title={tr(label)} /><span>{tr(label)}<br /><span className="adseo-hint">{tr(hint)}</span></span></div>
  );
  return (
    <div className="a-card" id="seo-flags">
      <b>{tr('Automation switches')}</b>
      {sw('indexNow', 'IndexNow (tell Bing and others when a page changes)', 'Sends the changed page address to search engines after you save a product, post or page. Needs the Preferred domain (General) and a key (Automation).')}
      {sw('merchantFeed', 'Google Merchant product feed', 'Publishes a product feed that Google Merchant Center can read.')}
      <span className="adseo-hint">{tr('AI drafting: not available.')}</span>
    </div>
  );
}
