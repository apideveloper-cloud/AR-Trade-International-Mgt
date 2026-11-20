import { useState } from 'react';
import { Tabs } from '../fieldKit.jsx';

const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, '') + '…');

/** Google result preview, desktop or mobile, with the product rich-snippet line. */
export function SerpPreview({ title, description, url, product }) {
  const [view, setView] = useState('desktop');
  let host = 'artradeinternational.com', parts = [];
  try { const u = new URL(/^https?:/i.test(url || '') ? url : 'https://' + host + (url || '/')); host = u.host; parts = u.pathname.split('/').filter(Boolean); } catch { /* keep defaults */ }
  const price = Number(product?.price) || 0;
  const inStock = Number(product?.stock) > 0 || /in.?stock/i.test(product?.stockStatus || '');
  const rich = product && price > 0 ? `৳${price.toLocaleString('en-US')} · ${inStock ? 'In stock' : 'Out of stock'}` : '';
  const mobile = view === 'mobile';
  return (
    <div className="adsi-sec">
      <div className="adsi-hd"><b>Google preview</b><Tabs items={[['desktop', 'Desktop'], ['mobile', 'Mobile']]} value={view} onChange={setView} /></div>
      <div className={'adsi-serp' + (mobile ? ' mob' : '')} aria-label="Search result preview">
        <small className="adsi-serp-url">{[host, ...parts].join(' › ')}</small>
        <b className="adsi-serp-t">{clip(title || 'Page title', 62)}</b>
        {rich && <span className="adsi-serp-rich">{rich}</span>}
        <p>{clip(description || 'Without a description, Google picks lines from the page.', mobile ? 120 : 160)}</p>
      </div>
    </div>
  );
}
