import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { send } from './ovApi.js';
import { mcMsg } from './mcApi.js';
import { Msg } from './parts.jsx';
import SdCards from './SdCards.jsx';
import SdList from './SdList.jsx';
import './growth.css';
import './overview.css';

/** Admin > Search & Growth > Structured data. */
export function GrowthSchema() {
  const [f, setF] = useState({ severity: '', code: '', kind: '' });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qs = `severity=${f.severity}&code=${encodeURIComponent(f.code)}&kind=${f.kind}&page=${page}&limit=15`;
  const q = useApiData(() => adm.get('/growth/schema-checks?' + qs), [qs]);
  const set = patch => { setF(x => ({ ...x, ...patch })); setPage(1); };
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await send('/growth/schema-checks/run', {});
    setBusy(false);
    setMsg(mcMsg(r, r.body?.message || 'The check has started. Press Refresh in a minute to see the result.'));
    if (r.ok) q.reload();
  };
  return (
    <div className="adov">
      <Msg m={msg} />
      {q.error && <Msg m={{ ok: false, text: q.error }} />}
      {!q.data && !q.error && <p className="adseo-hint">Loading...</p>}
      {q.data && (
        <>
          <SdCards d={q.data} busy={busy} run={run} reload={q.reload} loading={q.loading} />
          <SdList d={q.data} f={f} set={set} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}
