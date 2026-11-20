import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { Switch } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import { useApiData } from '../../hooks/useApiData.js';
import { send } from './pricesApi.js';
import { Section } from './parts.jsx';
import { RvMsg, rvMsg } from './rvApi.jsx';
import RvTemplates from './RvTemplates.jsx';

const NUM = [['delayDays', 'Send the request after (days)', 0, 60, 'Days after delivery. 0 means the same day.'], ['reminderDays', 'Send a reminder after (days)', 1, 60, 'Only if there is no review yet.'], ['expireDays', 'Stop asking after (days)', 7, 180, 'The review link stops working then.']];

/** Settings card: switches, numbers, language and the e-mail templates. */
export default function RvSettings({ onSaved }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/growth/review-settings'), []);
  const [f, setF] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  if (q.error) return <Section title={tr('Settings')}><RvMsg m={{ ok: false, text: tr(q.error) }} /></Section>;
  if (!f) return null;
  const set = patch => setF(x => ({ ...x, ...patch }));
  const save = async () => {
    for (const [k, l, lo, hi] of NUM) { const n = Number(f[k]); if (!Number.isInteger(n) || n < lo || n > hi) return setM({ ok: false, text: tr('{label}: type a whole number from {lo} to {hi}.', { label: tr(l), lo, hi }) }); }
    setBusy(true);
    const r = await send('/growth/review-settings', f);
    setBusy(false);
    setM(rvMsg(r, 'Saved.', tr));
    if (r.ok) { if (r.body && r.body.templates) setF(r.body); onSaved?.(); }
  };
  return (
    <Section id="adrv-settings" title={tr('Settings')} what={tr('Choose when to ask buyers for a review and what the message says.')}>
      <div className="adrv-row"><Switch on={!!f.enabled} onChange={v => set({ enabled: v })} title={tr('Review requests on or off')} /><b>{f.enabled ? tr('Review requests are on') : tr('Review requests are off')}</b></div>
      <div className="adrv-form">
        {NUM.map(([k, l, lo, hi, hint]) => (
          <label key={k} className="adrv-field">{tr(l)}
            <input className="a-in" type="number" min={lo} max={hi} step="1" value={f[k] ?? ''} onChange={e => set({ [k]: e.target.value })} />
            <small>{tr(hint)} {tr('Allowed: {lo} to {hi}.', { lo, hi })}</small>
          </label>
        ))}
        <label className="adrv-field">{tr('Message language')}
          <select className="a-in" value={f.language || 'auto'} onChange={e => set({ language: e.target.value })}>
            <option value="auto">{tr('Automatic (match the customer)')}</option><option value="en">English</option><option value="bn">বাংলা (Bangla)</option>
          </select>
        </label>
      </div>
      <div className="adrv-row"><Switch on={!!f.reminder} onChange={v => set({ reminder: v })} title={tr('Send one reminder')} /><span>{tr('Send one reminder if there is no review yet')}</span></div>
      <div className="adrv-row"><Switch on={!!f.autoApproveVerified} onChange={v => set({ autoApproveVerified: v })} title={tr('Auto-approve verified buyers')} /><span>{tr('Approve verified buyers automatically')}</span></div>
      <div className="adrv-warn">{tr('Approve verified buyers automatically. Only turn on when you trust the requests.')}</div>
      <RvTemplates templates={f.templates || {}} onChange={t => set({ templates: t })} />
      <div className="adrv-row"><button type="button" className="a-btn" disabled={busy} onClick={save}>{busy ? tr('Saving...') : tr('Save settings')}</button><RvMsg m={m} /></div>
    </Section>
  );
}
