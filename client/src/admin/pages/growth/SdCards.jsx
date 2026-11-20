import { NA, isNum, num, when } from './ovApi.js';

/** Top cards, explanation and Check now. */
export default function SdCards({ d, busy, run, reload, loading }) {
  const r = d.lastRun, c = d.counts || {};
  return (
    <>
      <div className="adov-kpis">
        <div className="adov-kpi adov-static"><span className="adov-k">Pages checked</span><span className="adov-big">{r ? num(r.checked) : NA}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">Errors</span><span className={'adov-big' + (c.error > 0 ? ' adov-bad' : '')}>{isNum(c.error) ? num(c.error) : NA}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">Warnings</span><span className="adov-big">{isNum(c.warning) ? num(c.warning) : NA}</span></div>
        <div className="adov-kpi adov-static"><span className="adov-k">Last check</span><span className="adov-big adov-sm">{r ? when(r.at) : 'Never'}</span></div>
      </div>
      <div className="a-card adov-sec">
        <p className="adseo-hint adov-intro"><b>Errors</b> can stop Google from showing prices or stars in search results. <b>Warnings</b> are recommended fixes.</p>
        <div className="adov-top">
          <button type="button" className="a-btn" disabled={busy} onClick={run}>{busy ? 'Starting...' : 'Check now'}</button>
          <button type="button" className="a-btn sm" disabled={loading} onClick={() => reload()}>Refresh</button>
        </div>
      </div>
    </>
  );
}
