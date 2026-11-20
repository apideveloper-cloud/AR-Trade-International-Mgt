import { useState } from 'react';
import { send, mcMsg, when } from './bzApi.js';
import { Msg } from './parts.jsx';

const ST = { match: ['adbz-st-ok', '✔ Match'], mismatch: ['adbz-st-bad', '✖ Different'], warning: ['adbz-st-warn', '⚠ Warning'] };
const kind = r => (r.match ? 'match' : r.severity === 'warning' || r.severity === 'warn' ? 'warning' : 'mismatch');
const rank = r => ({ mismatch: 0, warning: 1, match: 2 })[kind(r)];

/** Section B: do the details match everywhere. */
export default function BzNap({ nap, onChecked }) {
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState(null);
  const rows = [...(nap?.rows || [])].sort((a, b) => rank(a) - rank(b));
  const run = async () => {
    setBusy(true); setM(null);
    const r = await send('/growth/business/nap-check', {});
    setBusy(false);
    if (r.ok) { onChecked?.(r.body); setM({ ok: true, text: 'Check finished.' }); } else setM(mcMsg(r));
  };
  return (
    <section className="a-card adbz-card" id="adbz-nap">
      <h3>Do your details match everywhere?</h3>
      <p className="adbz-hint">Google compares your name, address and phone number across the web. If they differ, even slightly, Google trusts your shop less and may rank it lower. This check compares your details with what you typed under "What Google shows today".</p>
      <div className="adbz-row">
        <button type="button" className="a-btn" disabled={busy} onClick={run}>{busy ? 'Checking...' : 'Check now'}</button>
        <span className="adbz-hint">Last check: {when(nap?.at)}{nap?.at ? ` (${nap.issues || 0} to fix)` : ''}</span>
      </div>
      <Msg m={m} />
      {rows.length === 0 ? <p className="adbz-hint">No results yet. Press "Check now".</p> : (
        <div className="adbz-tablewrap"><table className="adbz-table">
          <thead><tr><th>Detail</th><th>Where</th><th>What it shows</th><th>What it should show</th><th>Result</th></tr></thead>
          <tbody>{rows.map((r, i) => { const [c, t] = ST[kind(r)]; return (
            <tr key={i}><td>{r.field}</td><td>{r.place}</td><td>{r.value || '-'}</td><td>{r.expected || '-'}</td>
              <td><span className={'adbz-st ' + c}>{t}</span>{r.note && <small style={{ display: 'block' }}>{r.note}</small>}</td></tr>); })}</tbody>
        </table></div>)}
    </section>
  );
}
