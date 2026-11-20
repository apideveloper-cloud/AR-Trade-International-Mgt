import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { send } from './ovApi.js';
import { mcMsg } from './mcApi.js';
import { Msg } from './parts.jsx';
import SdCards from './SdCards.jsx';
import { useCheckProgress, ProgressBar } from './GrProgress.jsx';
import SdList from './SdList.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/growthA.js';
import './growth.css';
import './overview.css';

/** Admin > Search & Growth > Structured data. */
export function GrowthSchema() {
  const tr = useT();
  const [f, setF] = useState({ severity: '', code: '', kind: '' });
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const qs = `severity=${f.severity}&code=${encodeURIComponent(f.code)}&kind=${f.kind}&page=${page}&limit=15`;
  const q = useApiData(() => adm.get('/growth/schema-checks?' + qs), [qs]);
  const prog = useCheckProgress('schema_check', () => { setMsg({ ok: true, text: tr('The check is finished.') }); q.reload(); });
  const set = patch => { setF(x => ({ ...x, ...patch })); setPage(1); };
  const run = async () => {
    setBusy(true); setMsg(null);
    const r = await send('/growth/schema-checks/run', {});
    setBusy(false);
    setMsg(r.ok && r.body?.queued !== false ? null : mcMsg(r, r.body?.message || tr('The check has started.'), tr));
    if (r.ok) prog.begin();
  };
  return (
    <div className="adov">
      <Msg m={msg} />
      {q.error && <Msg m={{ ok: false, text: tr(q.error) }} />}
      {!q.data && !q.error && <p className="adseo-hint">{tr('Loading...')}</p>}
      {q.data && (
        <>
          <SdCards d={q.data} busy={busy || prog.watching} run={run} reload={q.reload} loading={q.loading} progress={<ProgressBar p={prog.p} watching={prog.watching} noun="pages" />} />
          <SdList d={q.data} f={f} set={set} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}
