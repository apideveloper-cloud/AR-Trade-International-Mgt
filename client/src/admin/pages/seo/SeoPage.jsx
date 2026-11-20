import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { Tabs } from '../../fieldKit.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { Brands } from './Brands.jsx';
import Dashboard from './Dashboard.jsx';
import { ProductsTab } from './ProductsTab.jsx';
import { Redirects } from './Redirects.jsx';
import { NotFound404 } from './NotFound404.jsx';
import Activity from './Activity.jsx';
import { SeoSettings } from './SeoSettings.jsx';
import { SEO_TABS, setIn } from './seoModel.js';
import './seo.css';

/** Admin > SEO. Settings are loaded here so the Overview checklist and the Settings tab (and its unsaved edits) share them. */
export function SeoPage() {
  const q = useApiData(() => adm.get('/seo/settings'));
  const [tab, setTab] = useState('overview');
  const [jump, setJump] = useState({ filter: 'all', n: 0 }); // Dashboard asks for Products with a filter already chosen
  const onGoto = (t, filter) => { if (filter) setJump(j => ({ filter, n: j.n + 1 })); setTab(t); };
  const [draft, setDraft] = useState(null);
  const [saved, setSavedState] = useState(null);
  if (q.data && !saved) { setSavedState(q.data.settings); setDraft(q.data.settings); }
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const st = {
    data: q.data, draft, setDraft, dirty,
    setSaved: s => { setSavedState(s); setDraft(s); },
    setSavedPath: (path, v) => { setSavedState(s => setIn(s, path, v)); setDraft(d => setIn(d, path, v)); }
  };
  return (
    <div className="adseo">
      <Tabs value={tab} onChange={setTab} items={SEO_TABS} />
      {q.error && <div className="a-msg err">{q.error}</div>}
      {tab === 'overview' ? <Dashboard onGoto={onGoto} /> : tab === 'products' ? <ProductsTab key={jump.n} initialFilter={jump.filter} /> : tab === 'brands' ? <Brands /> : tab === 'redirects' ? <Redirects /> : tab === '404' ? <NotFound404 /> : tab === 'activity' ? <Activity /> : !draft ? (!q.error && <span className="spin" />) : tab === 'settings' ? <SeoSettings st={st} />: null}
    </div>
  );
}
