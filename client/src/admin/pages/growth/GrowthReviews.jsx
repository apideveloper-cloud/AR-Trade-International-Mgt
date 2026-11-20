import { useState } from 'react';
import { useApiData } from '../../hooks/useApiData.js';
import { adm } from '../../adminApi.js';
import RvStatus from './RvStatus.jsx';
import RvSettings from './RvSettings.jsx';
import RvRequests from './RvRequests.jsx';
import RvOptouts from './RvOptouts.jsx';
import '../../i18n/dict/growthB.js';
import './growth.css';
import './reviews.css';

/** Admin > Search & Growth > Review requests. */
export function GrowthReviews() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const st = useApiData(() => adm.get('/growth/review-requests/stats'), [tick]);
  return (
    <div className="adrv">
      <RvStatus q={st} />
      <RvSettings onSaved={refresh} />
      <RvRequests tick={tick} onChanged={refresh} />
      <RvOptouts tick={tick} onChanged={refresh} />
    </div>
  );
}
