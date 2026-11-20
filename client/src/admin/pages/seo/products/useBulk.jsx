import { useState } from 'react';
import { confirmBox, alertBox } from '../../../ui.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson, trServer } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';

export const ACTIONS = [
  ['reset_template', 'Reset to template'], ['noindex', 'Set noindex'], ['index', 'Set index'], ['alt_autofill', 'Auto-fill alt text'], ['recalculate', 'Recalculate scores']
];

/** Runs a bulk action: dry run, confirm dialog with samples, real run, inline result. `body` is { ids } or { scope }. */
export function useBulk(reload) {
  const tr = useT();
  const WARN = {
    reset_template: n => tr('This removes the hand-written title and description of {n} products. The template will apply again.', { n }),
    noindex: n => tr('{n} products will be hidden from Google.', { n })
  };
  const [busy, run] = useBusy();
  const [result, setResult] = useState(null);
  const start = (action, en, body) => run(async () => {
    const label = tr(en);
    setResult(null);
    const dry = await postJson('/seo/bulk', { action, ...body, dryRun: true });
    if (!dry.ok) { await alertBox(trServer(tr, dry.error)); return; }
    const { affected = 0, samples = [] } = dry.data;
    if (!affected) { await alertBox(tr('Nothing to change: no product needs this action.')); return; }
    const ok = await confirmBox(
      <span className="adpt-dlg">
        <b>{tr('{n} products will be changed', { n: affected })}</b>
        {WARN[action] && <span className="adpt-warn">{WARN[action](affected)}</span>}
        {samples.slice(0, 8).map(s => <small key={s.id}>#{s.id} {s.name}: {trServer(tr, s.change)}</small>)}
        {affected > 8 && <small>{tr('… and {n} more', { n: affected - 8 })}</small>}
      </span>,
      { title: label, confirmLabel: tr('Yes, {label}', { label: label.toLowerCase() }), danger: action === 'reset_template' || action === 'noindex' }
    );
    if (!ok) return;
    const r = await postJson('/seo/bulk', { action, ...body });
    if (!r.ok) { await alertBox(trServer(tr, r.error)); return; }
    setResult(tr('{label}: {a} changed, {s} skipped, {t} s.', { label, a: r.data.affected, s: r.data.skipped || 0, t: ((r.data.durationMs || 0) / 1000).toFixed(1) }));
    reload();
  });
  return { busy, start, result };
}
