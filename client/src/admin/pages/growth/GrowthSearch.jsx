import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg } from './parts.jsx';
import GsCards from './GsCards.jsx';
import GsChart from './GsChart.jsx';
import GsTables from './GsTables.jsx';
import GsHealth from './GsHealth.jsx';
import GsInspections from './GsInspections.jsx';
import { send, gsMsg } from './gsApi.js';
import './growth.css';
import './search.css';

/** Admin > Search & Growth > Search performance. */
export function GrowthSearch({ staff, go }) {
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const perf = useApiData(() => adm.get('/growth/gsc/performance'), [tick]);
  const health = useApiData(() => adm.get('/growth/gsc/index-health'), [tick]);
  const refresh = () => setTick(t => t + 1);
  const sync = async () => {
    setBusy(true); setMsg(null);
    const r = await send('/growth/gsc/sync', {});
    setBusy(false);
    setMsg(r.status === 429 ? { ok: false, text: 'Data was refreshed a moment ago. Please wait a few minutes and try again.' } : gsMsg(r, r.body?.queued ? 'Refresh started. New numbers will appear in a few minutes.' : 'Data refreshed.'));
    if (r.ok) refresh();
  };
  const connected = perf.data?.connected;
  return (
    <div className="adgs">
      <Msg m={msg} />
      <GsCards q={perf} go={go} onRefresh={sync} busy={busy} />
      {connected && <GsChart daily={perf.data.daily} />}
      {connected && <GsTables data={perf.data} go={go} />}
      <GsHealth q={health} onChanged={refresh} />
      {connected && <GsInspections tick={tick} />}
    </div>
  );
}
