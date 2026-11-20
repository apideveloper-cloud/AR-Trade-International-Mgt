import { useCallback, useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { SecHead } from '../system/settings/parts.jsx';
import { IndexNowBlock } from './automation/IndexNowBlock.jsx';
import { SitemapBlock } from './automation/SitemapBlock.jsx';
import { AnalyticsBlock, FeedBlock } from './automation/FeedBlock.jsx';
import './automation/automation.css';

/** Admin > SEO > Settings > Automation: status of IndexNow, sitemap, Merchant feed and analytics (GET /seo/automation). */
export function AutomationSection() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try { setD(await adm.get('/seo/automation')); setErr(''); } catch (e) { setErr(e.message || 'Could not load the automation status.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="a-card st-sec adau" id="seo-automation" style={{ '--h': 400 }}>
      <SecHead icon="⚙️" title="Automation" sub="What the website sends to search engines by itself" />
      {err && <div className="a-msg err">{err} <button type="button" className="a-btn ghost sm" onClick={load}>Try again</button></div>}
      {!d && !err && <div className="adau-muted">Loading…</div>}
      {d && (
        <>
          <span className="adseo-hint">Status shows what is saved. A switch changed above counts after you press Save all settings.</span>
          <div className="adau-grid">
            {d.indexNow && <IndexNowBlock i={d.indexNow} reload={load} />}
            {d.sitemap && <SitemapBlock sm={d.sitemap} reload={load} />}
            {d.feed && <FeedBlock f={d.feed} />}
            <AnalyticsBlock a={d.analytics} />
          </div>
        </>
      )}
    </div>
  );
}
