import { useState } from 'react';
import { useBusy } from '../../hooks/useBusy.js';
import { CopyRow, Msg, Note, Section } from './parts.jsx';
import { NO_CONNECT_NOTE, run } from './growthModel.js';

/** Manual verification files for both engines (the meta-tag way stays in SEO > Settings > Verification). */
export default function VerifyCard({ s, reload, go, canConn }) {
  const v = s.verification || {};
  const [gName, setGName] = useState('');
  const [gBody, setGBody] = useState('');
  const [bCode, setBCode] = useState('');
  const [busy, doit] = useBusy();
  const [m, setM] = useState(null);
  const save = () => doit(async () => {
    setM(null);
    const body = {};
    if (gName.trim()) { body.googleFileName = gName.trim(); body.googleFileContent = gBody; }
    if (bCode.trim()) body.bingAuthCode = bCode.trim();
    if (!Object.keys(body).length) { setM({ ok: false, text: 'Fill in the Google file name or the Bing code first.' }); return; }
    const r = await run('POST', '/growth/verification', body);
    setM(r.ok ? { ok: true, text: 'Saved. The files are now on your site at the addresses below.' } : { ok: false, text: r.error });
    if (r.ok) { setGName(''); setGBody(''); setBCode(''); reload(); }
  });
  return (
    <Section id="adgr-verify" title="Verify by file (Google and Bing)" what="Search engines ask you to prove the site is yours. These files do that without touching the page code."
      steps={['Google: in Search Console choose HTML file, then copy the file name (googleXXXX.html) and the text inside it here.', 'Bing: copy the code from BingSiteAuth.xml (the text inside the User tag) here.', 'Press Save, then press Verify in Google or Bing.']}>
      <Msg m={m} />
      {!canConn && <Note>{NO_CONNECT_NOTE}</Note>}
      <div className="a-fields">
        <label className="a-lbl">Google file name<input className="a-in" value={gName} disabled={!canConn} onChange={e => setGName(e.target.value)} placeholder={v.googleFileName || 'google1234abcd.html'} /></label>
        <label className="a-lbl">Google file text<input className="a-in" value={gBody} disabled={!canConn} onChange={e => setGBody(e.target.value)} placeholder="google-site-verification: google1234abcd.html" /></label>
        <label className="a-lbl">Bing code<input className="a-in" value={bCode} disabled={!canConn} onChange={e => setBCode(e.target.value)} placeholder={v.bingAuthCode || 'Code from BingSiteAuth.xml'} /></label>
      </div>
      <div className="adgr-acts"><button type="button" className="a-btn sm" disabled={busy || !canConn} onClick={save}>{busy ? 'Working…' : 'Save'}</button>{busy && <span className="spin" />}</div>
      {v.googleFileUrl && <CopyRow label="Google file" value={v.googleFileUrl} />}
      {v.bingAuthUrl && <CopyRow label="Bing file" value={v.bingAuthUrl} />}
      <p className="adseo-hint">Prefer a tag in the page head? That stays in <button type="button" className="adgr-link" onClick={() => go('seo')}>SEO &gt; Settings &gt; Verification</button> and is not repeated here.</p>
    </Section>
  );
}
