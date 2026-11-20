import { useState } from 'react';
import { liveUrl } from './useSeoItem.js';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/catalog.js';
import './indexing.css';

const CONSOLE = 'https://search.google.com/search-console';

/** "Request indexing" helper: copy the live URL, open Search Console. No network calls. */
export function IndexingHelper({ url }) {
  const tr = useT();
  const abs = liveUrl(url);
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(abs); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
  };
  return (
    <div className="adsi-sec adix">
      <b>{tr('Request indexing')}</b>
      <code className="adix-url">{abs}</code>
      <div className="adix-acts">
        <button type="button" className="a-btn ghost sm" onClick={copy}>{done ? tr('Copied') : tr('Copy URL')}</button>
        <a className="a-btn ghost sm" href={CONSOLE} target="_blank" rel="noreferrer">{tr('Open Search Console')}</a>
      </div>
      <span className="adix-note">{tr('In Search Console, paste the URL into the top search box and choose Request indexing.')}</span>
    </div>
  );
}
