import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { ISSUES, send } from './pricesApi.js';
import { when } from './growthModel.js';

/** Health cards: last check, run now, count chips per problem, and the "history not recording" warning. */
const SHORT = { schema_price_mismatch: 'Page price differs', schema_availability_mismatch: 'Page stock differs', feed_price_mismatch: 'Feed price differs', feed_availability_mismatch: 'Feed stock differs', sale_expired_not_cleared: 'Sale ended', old_below_price: 'Old price too low', zero_price_active: 'Price is 0', no_sku: 'No SKU', stale_price: 'Price not changed 180 days' };
export default function HealthStrip({ tick, code, setCode }) {
  const q = useApiData(() => adm.get('/growth/price-checks?limit=1'), [tick]);
  const h = useApiData(() => adm.get('/growth/prices/health'), []);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const run = async () => {
    setBusy(true); setM(null);
    const r = await send('/growth/price-checks/run', {});
    if (r.ok) setM({ ok: true, text: r.body.queued === false ? 'A check is already waiting to run.' : (r.body.message || 'The check is queued. Refresh in a minute to see the result.') });
    else setM({ ok: false, text: r.status === 429 ? (r.body.error || 'Please wait a little before running the check again.') : (r.body.error || 'Could not start the check.') });
    setBusy(false);
  };
  const counts = Object.entries(d?.counts || {}).filter(([, n]) => n > 0);
  const labels = {};
  (d?.rows || []).forEach(r => { labels[r.code] = r.label; });
  return (
    <>
      {h.data && h.data.trigger === false && <div className="adgr-warn" role="alert">Warning: Price history is not recording: ask your developer.</div>}
      <Section id="adgp-health" title="Price and stock health" what="This checks every product for missing SKUs, ended sales, zero prices and stock problems, so customers always see the right price."
        right={<button type="button" className="a-btn sm" onClick={run} disabled={busy}>{busy ? 'Working…' : 'Run check now'}</button>}>
        {q.error && <Msg m={{ ok: false, text: q.error }} />}
        <Msg m={m} />
        <p className="adgr-dim">{d?.lastRun ? `Last check: ${when(d.lastRun.at)}. ${d.lastRun.checked} products checked, ${d.lastRun.issues} problems found.` : q.loading ? 'Loading…' : 'No check has run yet.'}</p>
        <div className="adgp-chips">
          {counts.map(([c, n]) => (
            <button key={c} type="button" aria-pressed={code === c} className={'adgp-chip' + (code === c ? ' adgp-on' : '')} onClick={() => setCode(code === c ? '' : c)}>{SHORT[c] || c.replace(/_/g, ' ')}: <b>{n}</b></button>
          ))}
          {code && <button type="button" className="adgr-link" onClick={() => setCode('')}>Show all problems</button>}
          {d && !counts.length && <span className="adgr-dim">No problems found.</span>}
        </div>
      </Section>
    </>
  );
}
