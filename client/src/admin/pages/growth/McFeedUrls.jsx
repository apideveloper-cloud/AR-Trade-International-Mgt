import { useState } from 'react';
import { confirmBox } from '../../ui.jsx';
import { Msg, Section, CopyRow } from './parts.jsx';
import { send, sendDelete, mcMsg } from './mcApi.js';

/** B. The three feed addresses and the secret-key protection. */
export default function McFeedUrls({ data, canEdit, onChanged }) {
  const f = data?.feed || {};
  const [urls, setUrls] = useState(null);
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const u = urls || f.urls || {};
  const run = async (fn, ok) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    setM(mcMsg(r, ok));
    if (r.ok) { setUrls(r.body?.urls || null); onChanged(); }
  };
  const create = () => run(() => send('/growth/merchant/token', {}), 'Done. Copy the new addresses below into Google Merchant Center.');
  const renew = async () => { if (await confirmBox('Make a new key? The old address stops working at once. You must paste the new address into Google Merchant Center.', { confirmLabel: 'Yes, make a new key' })) create(); };
  const remove = async () => { if (await confirmBox('Remove the protection? Anyone who knows the address will be able to read your product feed.', { confirmLabel: 'Yes, remove it' })) run(() => sendDelete('/growth/merchant/token'), 'Protection removed.'); };
  return (
    <Section id="admc-urls" title="Feed addresses" what="Google reads your products from one of these web addresses. Use the first one unless Google asks for another format.">
      {[['xml', 'XML'], ['csv', 'CSV'], ['tsv', 'TSV']].map(([k, l]) => <CopyRow key={k} label={l} value={u[k]} />)}
      <p className="adseo-hint">Paste one of these in Google Merchant Center &gt; Products &gt; Feeds &gt; Add feed &gt; Scheduled fetch.</p>
      <div className="admc-row"><b>{f.tokenSet ? 'Protected by a secret address' : 'Public address'}</b></div>
      {canEdit ? (
        <div className="admc-row">
          {!f.tokenSet && <button type="button" className="a-btn" disabled={busy} onClick={create}>Protect with a secret key</button>}
          {f.tokenSet && <button type="button" className="a-btn" disabled={busy} onClick={renew}>Make a new key</button>}
          {f.tokenSet && <button type="button" className="a-btn ghost" disabled={busy} onClick={remove}>Remove protection</button>}
        </div>
      ) : <p className="adseo-hint">Only the Master Admin or Admin can change this.</p>}
      <Msg m={m} />
    </Section>
  );
}
