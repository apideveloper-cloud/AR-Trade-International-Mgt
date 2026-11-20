import { useState } from 'react';
import { confirmBox, alertBox } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson } from '../seoModel.js';

export const ACTIONS = [
  ['reset_template', 'Reset to template'], ['noindex', 'Set noindex'], ['index', 'Set index'], ['alt_autofill', 'Auto-fill alt text'], ['recalculate', 'Recalculate scores']
];
const WARN = {
  reset_template: n => `This removes the hand-written title and description of ${n} products. The template will apply again.`,
  noindex: n => `${n} products will be hidden from Google.`
};

/** Runs a bulk action: dry run, confirm dialog with samples, real run, inline result. `body` is { ids } or { scope }. */
export function useBulk(reload) {
  const [busy, run] = useBusy();
  const [result, setResult] = useState(null);
  const start = (action, label, body) => run(async () => {
    setResult(null);
    const dry = await postJson('/seo/bulk', { action, ...body, dryRun: true });
    if (!dry.ok) { await alertBox(dry.error); return; }
    const { affected = 0, samples = [] } = dry.data;
    if (!affected) { await alertBox('Nothing to change: no product needs this action.'); return; }
    const ok = await confirmBox(
      <span className="adpt-dlg">
        <b>{affected} products will be changed</b>
        {WARN[action] && <span className="adpt-warn">{WARN[action](affected)}</span>}
        {samples.slice(0, 8).map(s => <small key={s.id}>#{s.id} {s.name}: {s.change}</small>)}
        {affected > 8 && <small>… and {affected - 8} more</small>}
      </span>,
      { title: label, confirmLabel: 'Yes, ' + label.toLowerCase(), danger: action === 'reset_template' || action === 'noindex' }
    );
    if (!ok) return;
    const r = await postJson('/seo/bulk', { action, ...body });
    if (!r.ok) { await alertBox(r.error); return; }
    setResult(`${label}: ${r.data.affected} changed, ${r.data.skipped || 0} skipped, ${((r.data.durationMs || 0) / 1000).toFixed(1)} s.`);
    reload();
  });
  return { busy, start, result };
}
