import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import { Msg, Section } from './parts.jsx';
import { send } from './pricesApi.js';

/** Weekly e-mail listing the products that need attention. */
export default function DigestCard() {
  const q = useApiData(() => adm.get('/growth/price-digest'));
  const [on, setOn] = useState(false);
  const [to, setTo] = useState('');
  const [m, setM] = useState(null);
  const [busy, setBusy] = useState(false);
  const d = q.data;
  useEffect(() => { if (d) { setOn(!!d.enabled); setTo(d.to || ''); } }, [d]);
  const go = async (url, body, okText) => {
    setBusy(true); setM(null);
    const r = await send(url, body);
    setBusy(false);
    setM(r.ok ? { ok: true, text: r.body.message || okText } : { ok: false, text: r.body.error || 'That did not work. Please try again.' });
    if (r.ok && url.endsWith('digest')) q.reload();
  };
  return (
    <Section id="adgp-digest" title="Weekly e-mail" what="Every week we e-mail you the list of products with price or stock problems, so nothing is missed.">
      <Msg m={q.error ? { ok: false, text: q.error } : m} />
      {d && !d.mailReady && <div className="adgr-warn">{d.hint || 'E-mail is not set up yet, so nothing can be sent.'}</div>}
      <label className="adgr-chk"><input type="checkbox" role="switch" checked={on} onChange={e => setOn(e.target.checked)} /> Send the weekly e-mail</label>
      <div className="adgr-filters">
        <input className="a-in" type="email" placeholder="name@example.com" value={to} onChange={e => setTo(e.target.value)} aria-label="Send to this e-mail" />
        <button type="button" className="a-btn sm" disabled={busy} onClick={() => go('/growth/price-digest', { enabled: on, to: to.trim() }, 'Saved.')}>Save</button>
        <button type="button" className="a-btn ghost sm" disabled={busy || !d?.mailReady} onClick={() => go('/growth/price-digest/test', {}, 'A test e-mail was sent.')}>Send test now</button>
      </div>
    </Section>
  );
}
