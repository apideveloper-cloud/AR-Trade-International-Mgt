import { useState } from 'react';
import { fDateTime } from '../../../fieldKit.jsx';
import { useBusy } from '../../../hooks/useBusy.js';
import { postJson } from '../seoModel.js';
import { useT } from '../../../i18n/lang.jsx';
import '../../../i18n/dict/seo.js';
import { AuBlock, AuMsg, AuPill, AuRow } from './parts.jsx';

const KINDS = [['products', 'Products'], ['categories', 'Categories'], ['blog', 'Blog'], ['pages', 'Pages'], ['brands', 'Brands']];

export function SitemapBlock({ sm, reload }) {
  const tr = useT();
  const [busy, run] = useBusy();
  const [msg, setMsg] = useState(null);
  const c = sm.counts || {};
  const rebuild = () => run(async () => {
    setMsg(null);
    const r = await postJson('/seo/automation/sitemap/rebuild', {});
    if (r.ok) { setMsg({ ok: true, text: tr('Sitemap rebuilt.') }); reload(); } else setMsg({ ok: false, text: tr(r.error) });
  });
  return (
    <AuBlock title={tr('Sitemap')} pill={sm.dirty ? <AuPill tone="warn">{tr('Rebuild pending')}</AuPill> : <AuPill tone="ok">{tr('Up to date')}</AuPill>}>
      <AuRow k={tr('Generated')}>{sm.generatedAt ? fDateTime(sm.generatedAt) : tr('Not yet')}</AuRow>
      <ul className="adau-counts">{KINDS.map(([k, l]) => <li key={k}><b>{c[k] ?? 0}</b><span>{tr(l)}</span></li>)}</ul>
      <div className="adau-acts">
        <button type="button" className="a-btn sm" disabled={busy} onClick={rebuild}>{busy ? tr('Rebuilding…') : tr('Rebuild now')}</button>
        <a className="a-btn ghost sm" href={sm.url || '/sitemap.xml'} target="_blank" rel="noreferrer">{tr('Open /sitemap.xml')}</a>
      </div>
      <AuMsg m={msg} />
    </AuBlock>
  );
}
