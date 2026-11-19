import { useState } from 'react';
import { adm } from '../adminApi.js';
import { useApiData } from '../hooks/useApiData.js';
import { DEFAULT_ABOUT, DEFAULT_FOOTER, DEFAULT_MENUS, withDefaults } from '../../data.js';
import { TABS, TAB_ICON } from './contentAdmin/contentConfig.js';
import { BrandsPanel, ClientsPanel, PerksPanel, SlidesPanel } from './contentAdmin/HomePanels.jsx';
import { AboutPanel, FaqsPanel, GeneralPanel, MenusPanel, PoliciesPanel } from './contentAdmin/TextPanels.jsx';

const PANELS = { slides: SlidesPanel, brands: BrandsPanel, clients: ClientsPanel, perks: PerksPanel, faqs: FaqsPanel, policies: PoliciesPanel, about: AboutPanel, menus: MenusPanel, general: GeneralPanel };

/** Loads /content and fills missing about/footer/menus pieces from the built-in defaults. */
const loadContent = () => adm.get('/content').then(d => ({
  ...d,
  about: withDefaults(DEFAULT_ABOUT, d.about), footer: withDefaults(DEFAULT_FOOTER, d.footer),
  menus: Object.fromEntries(['hot', 'services', 'blog', 'about'].map(k => [k, d.menus && d.menus[k] && d.menus[k].length ? d.menus[k] : DEFAULT_MENUS[k]]))
}));

/** Storefront content manager: everything on the public pages that is not a product, blog post or setting. */
export function ContentAdmin() {
  const q = useApiData(loadContent);
  const data = q.data, setData = q.setData;
  const [tab, setTab] = useState('slides');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!data) return q.error ? <div className="a-msg err">{q.error}</div> : <span className="spin" />;
  const set = (k, fn) => setData(d => ({ ...d, [k]: typeof fn === 'function' ? fn(d[k]) : fn }));
  const save = async keys => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { for (const k of keys) { const r = await adm.put('/content/' + k, { value: data[k] }); setData(d => ({ ...d, [k]: r.value })); } setMsg({ t: 'Saved. The website shows it immediately.' }); }
    catch (e) { setMsg({ err: true, t: e.message }); }
    setBusy(false);
  };
  const saveBar = keys => (
    <div className="cx-save">
      <span>{msg ? <b style={{ color: msg.err ? '#ffb4ab' : '#9be7b4' }}>{msg.err ? '⚠ ' : '✓ '}{msg.t}</b> : 'Changes go live on the website as soon as you save.'}</span>
      <button type="button" className="a-btn" disabled={busy} onClick={() => save(keys)}>{busy ? 'Saving…' : 'Save changes'}</button>
    </div>
  );
  const [, tabTitle, desc] = TABS.find(t => t[0] === tab) || [];
  const Panel = PANELS[tab];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cx-tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={'cx-tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setMsg(null); }}><i>{TAB_ICON[k]}</i>{l}</button>)}
      </div>
      <div className="cx-hero">
        <span className="cx-hero-ic">{TAB_ICON[tab]}</span>
        <div><b>{tabTitle}</b><span>{desc} Images are stored in the <u>uploads/site</u> folder.</span></div>
      </div>
      <div className="a-card cx-body" style={{ gap: 14 }}>
        <Panel data={data} set={set} saveBar={saveBar} />
      </div>
    </div>
  );
}
