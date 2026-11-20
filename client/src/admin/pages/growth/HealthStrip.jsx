import { useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { ISSUES, send } from './pricesApi.js';
import { useT } from '../../i18n/lang.jsx';
import { when } from './growthModel.js';
import { useCheckProgress, ProgressBar } from './GrProgress.jsx';

/** Health cards: last check, run now, count chips per problem, and the "history not recording" warning. */
const SHORT = { schema_price_mismatch: 'Page price differs', schema_availability_mismatch: 'Page stock differs', feed_price_mismatch: 'Feed price differs', feed_availability_mismatch: 'Feed stock differs', sale_expired_not_cleared: 'Sale ended', old_below_price: 'Old price too low', zero_price_active: 'Price is 0', no_sku: 'No SKU', stale_price: 'Price not changed 180 days' };
export default function HealthStrip({ tick, code, setCode }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/price-checks?limit=1'), [tick]);
  const h = useApiData(() => adm.get('/growth/prices/health'), []);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  const prog = useCheckProgress('price_check', () => { setM({ ok: true, text: tr('The check is finished.') }); q.reload(); });
  const run = async () => {
    setBusy(true); setM(null);
    const r = await send('/growth/price-checks/run', {});
    if (r.ok) { setM(r.body.queued === false ? { ok: true, text: tr('A check is already waiting to run.') } : null); if (r.body.queued !== false) prog.begin(); }
    else setM({ ok: false, text: r.status === 429 ? tr(r.body.error || 'Please wait a little before running the check again.') : tr(r.body.error || 'Could not start the check.') });
    setBusy(false);
  };
  const counts = Object.entries(d?.counts || {}).filter(([, n]) => n > 0);
  const labels = {};
  (d?.rows || []).forEach(r => { labels[r.code] = r.label; });
  return (
    <>
      {h.data && h.data.trigger === false && h.data.mode !== 'snapshot' && <div className="adgr-warn" role="alert">{tr('Warning: Price history is not recording: ask your developer.')}</div>}
      <Section id="adgp-health" title={tr('Price and stock health')} what={tr("Every night (or when you press Run check now) the system looks at every product and checks that the price and stock a customer sees on the website, and the price and stock Google reads, are the same as in your catalogue. It also finds common mistakes: a sale that has ended but still shows a crossed-out price, an old price lower than the selling price, a product with price 0, a product with no SKU, and a price that has not changed for over 180 days. Press a problem below to see which products, then fix them in the grid further down.") } right={<button type="button" className="a-btn sm" onClick={run} disabled={busy || prog.watching}>{busy || prog.watching ? tr('Working…') : tr('Run check now')}</button>}>
        {q.error && <Msg m={{ ok: false, text: tr(q.error) }} />}
        <Msg m={m} />
        <ProgressBar p={prog.p} watching={prog.watching} noun={tr('products')} />
        <p className="adgr-dim">{d?.lastRun ? tr('Last check: {at}. {checked} products checked, {issues} problems found.', { at: when(d.lastRun.at), checked: d.lastRun.checked, issues: d.lastRun.issues }) : q.loading ? tr('Loading…') : tr('No check has run yet.')}</p>
        <div className="adgp-chips">
          {counts.map(([c, n]) => (
            <button key={c} type="button" aria-pressed={code === c} className={'adgp-chip' + (code === c ? ' adgp-on' : '')} onClick={() => setCode(code === c ? '' : c)}>{tr(SHORT[c] || c.replace(/_/g, ' '))}: <b>{n}</b></button>
          ))}
          {code && <button type="button" className="adgr-link" onClick={() => setCode('')}>{tr('Show all problems')}</button>}
          {d && !counts.length && <span className="adgr-dim">{tr('No problems found.')}</span>}
        </div>
      </Section>
    </>
  );
}
