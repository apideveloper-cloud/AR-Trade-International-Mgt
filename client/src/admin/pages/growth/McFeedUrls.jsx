import { useState } from 'react';
import { confirmBox } from '../../ui.jsx';
import { useT } from '../../i18n/lang.jsx';
import { Msg, Section, CopyRow } from './parts.jsx';
import { send, sendDelete, mcMsg } from './mcApi.js';

/** B. The three feed addresses and the secret-key protection. */
export default function McFeedUrls({ data, canEdit, onChanged }) {
  const tr = useT();
  const f = data?.feed || {};
  const [urls, setUrls] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const u = urls || f.urls || {};
  const run = async (fn, ok) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setM(mcMsg(r, ok, tr));
    if (r.ok) { setUrls(r.body?.urls || null); onChanged(); }
  };
  const create = () => run(() => send('/growth/merchant/token', {}), tr('Done. Copy the new addresses below into Google Merchant Center.'));
  const renew = async () => { if (await confirmBox(tr('Make a new key? The old address stops working at once. You must paste the new address into Google Merchant Center.'), { confirmLabel: tr('Yes, make a new key') })) create(); };
  const remove = async () => { if (await confirmBox(tr('Remove the protection? Anyone who knows the address will be able to read your product feed.'), { confirmLabel: tr('Yes, remove it') })) run(() => sendDelete('/growth/merchant/token'), tr('Protection removed.')); };
  return (
    <Section id="admc-urls" title={tr('Feed addresses')} what={tr('Google reads your products from one of these web addresses. Use the first one unless Google asks for another format.')}>
      {[['xml', 'XML'], ['csv', 'CSV'], ['tsv', 'TSV']].map(([k, l]) => <CopyRow key={k} label={l} value={u[k]} />)}
      <p className="adseo-hint">{tr('Paste one of these in Google Merchant Center > Products > Feeds > Add feed > Scheduled fetch.')}</p>
      <div className="admc-row"><b>{f.tokenSet ? tr('Protected by a secret address') : tr('Public address')}</b></div>
      {canEdit ? (
        <div className="admc-row">
          {!f.tokenSet && <button type="button" className="a-btn" disabled={busy} onClick={create}>{tr('Protect with a secret key')}</button>}
          {f.tokenSet && <button type="button" className="a-btn" disabled={busy} onClick={renew}>{tr('Make a new key')}</button>}
          {f.tokenSet && <button type="button" className="a-btn ghost" disabled={busy} onClick={remove}>{tr('Remove protection')}</button>}
        </div>
      ) : <p className="adseo-hint">{tr('Only the Master Admin or Admin can change this.')}</p>}
      <Msg m={m} />
    </Section>
  );
}
