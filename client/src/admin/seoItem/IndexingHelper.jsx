import { useState } from 'react';
import { liveUrl } from './useSeoItem.js';
import './indexing.css';

const CONSOLE = 'https://search.google.com/search-console';

/** "Request indexing" helper: copy the live URL, open Search Console. No network calls. */
export function IndexingHelper({ url }) {
  const abs = liveUrl(url);
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(abs); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
  };
  return (
    <div className="adsi-sec adix">
      <b>Request indexing</b>
      <code className="adix-url">{abs}</code>
      <div className="adix-acts">
        <button type="button" className="a-btn ghost sm" onClick={copy}>{done ? 'Copied' : 'Copy URL'}</button>
        <a className="a-btn ghost sm" href={CONSOLE} target="_blank" rel="noreferrer">Open Search Console</a>
      </div>
      <span className="adix-note">In Search Console, paste the URL into the top search box and choose Request indexing.</span>
    </div>
  );
}
