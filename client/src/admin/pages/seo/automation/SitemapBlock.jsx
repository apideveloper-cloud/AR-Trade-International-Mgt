import { useState } from 'react';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson } from '../seoModel.js';
import { AuBlock, AuMsg, AuPill, AuRow } from './parts.jsx';

const KINDS = [['products', 'Products'], ['categories', 'Categories'], ['blog', 'Blog'], ['pages', 'Pages'], ['brands', 'Brands']];

export function SitemapBlock({ sm, reload }) {
  const [busy, run] = useBusy();
  const [msg, setMsg] = useState(null);
  const c = sm.counts || {};
  const rebuild = () => run(async () => {
    setMsg(null);
    const r = await postJson('/seo/automation/sitemap/rebuild', {});
    if (r.ok) { setMsg({ ok: true, text: 'Sitemap rebuilt.' }); reload(); } else setMsg({ ok: false, text: r.error });
  });
  return (
    <AuBlock title="Sitemap" pill={sm.dirty ? <AuPill tone="warn">Rebuild pending</AuPill> : <AuPill tone="ok">Up to date</AuPill>}>
      <AuRow k="Generated">{sm.generatedAt ? fDateTime(sm.generatedAt) : 'Not yet'}</AuRow>
      <ul className="adau-counts">{KINDS.map(([k, l]) => <li key={k}><b>{c[k] ?? 0}</b><span>{l}</span></li>)}</ul>
      <div className="adau-acts">
        <button type="button" className="a-btn sm" disabled={busy} onClick={rebuild}>{busy ? 'Rebuilding…' : 'Rebuild now'}</button>
        <a className="a-btn ghost sm" href={sm.url || '/sitemap.xml'} target="_blank" rel="noreferrer">Open /sitemap.xml</a>
      </div>
      <AuMsg m={msg} />
    </AuBlock>
  );
}
