import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import OvActions from './OvActions.jsx';
import OvSetup from './OvSetup.jsx';
import OvKpis from './OvKpis.jsx';
import OvIntegrations from './OvIntegrations.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthA.js';
import './growth.css';
import './overview.css';

/** Admin > Search & Growth > Overview. */
export function GrowthOverview({ go }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/overview'), []);
  const d = q.data;
  return (
    <div className="adov">
      <div className="adov-top">
        <p className="adseo-hint adov-intro">{tr('A quick look at how your shop is doing in search, and what to fix first.')}</p>
        <button type="button" className="a-btn sm" disabled={q.loading} onClick={() => q.reload()}>{q.loading ? tr('Loading...') : tr('Refresh')}</button>
      </div>
      {q.error && <div className="adgr-msg adgr-msg-err" role="alert">{tr(q.error)}</div>}
      {!d && !q.error && <p className="adseo-hint">{tr('Loading...')}</p>}
      {d && (
        <>
          <OvActions actions={d.actions} go={go} />
          <OvSetup setup={d.setup} go={go} />
          <OvKpis d={d} go={go} />
          <OvIntegrations integ={d.health?.integrations} />
        </>
      )}
    </div>
  );
}
