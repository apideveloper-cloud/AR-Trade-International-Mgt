import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import OvActions from './OvActions.jsx';
import OvSetup from './OvSetup.jsx';
import OvKpis from './OvKpis.jsx';
import OvIntegrations from './OvIntegrations.jsx';
import './growth.css';
import './overview.css';

/** Admin > Search & Growth > Overview. */
export function GrowthOverview({ go }) {
  const q = useApiData(() => adm.get('/growth/overview'), []);
  const d = q.data;
  return (
    <div className="adov">
      <div className="adov-top">
        <p className="adseo-hint adov-intro">A quick look at how your shop is doing in search, and what to fix first.</p>
        <button type="button" className="a-btn sm" disabled={q.loading} onClick={() => q.reload()}>{q.loading ? 'Loading...' : 'Refresh'}</button>
      </div>
      {q.error && <div className="adgr-msg adgr-msg-err" role="alert">{q.error}</div>}
      {!d && !q.error && <p className="adseo-hint">Loading...</p>}
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
