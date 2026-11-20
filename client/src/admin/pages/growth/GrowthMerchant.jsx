import { useState } from 'react';
import { adm, can } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import McStatus from './McStatus.jsx';
import McFeedUrls from './McFeedUrls.jsx';
import McCategories from './McCategories.jsx';
import McGrid from './McGrid.jsx';
import McSync from './McSync.jsx';
import '../../i18n/dict/growthC.js';
import './growth.css';
import './merchant.css';

/** Admin > Search & Growth > Google Shopping. */
export function GrowthMerchant({ staff, go }) {
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState('');
  const refresh = () => setTick(t => t + 1);
  const st = useApiData(() => adm.get('/growth/merchant/status'), [tick]);
  const canProducts = can(staff, 'products.manage');
  const canConnect = can(staff, 'growth.integrations');
  const search = v => { setQ(v); document.getElementById('admc-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return (
    <div className="admc">
      <McStatus q={st} go={go} filterBy={search} />
      <McFeedUrls data={st.data} canEdit={canConnect} onChanged={refresh} />
      <McCategories settings={st.data?.settings} canEdit={canProducts} onSaved={refresh} />
      <McGrid q={q} setQ={setQ} canEdit={canProducts} tick={tick} onSaved={refresh} />
      <McSync data={st.data} canConnect={canConnect} onChanged={refresh} go={go} />
    </div>
  );
}
