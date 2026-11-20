import { useState } from 'react';
import { adm, can } from '../../adminApi.js';
import { useApiData } from '../../hooks/useApiData.js';
import ActivityTabs from './ActivityTabs.jsx';
import BingCard from './BingCard.jsx';
import GoogleCard from './GoogleCard.jsx';
import IndexNowCard from './IndexNowCard.jsx';
import SitemapCard from './SitemapCard.jsx';
import StatusStrip from './StatusStrip.jsx';
import VerifyCard from './VerifyCard.jsx';
import Wizard from './Wizard.jsx';
import './growth.css';

/** Reads ?google=ok or ?google=error&msg=... (set by the server after the Google sign-in), then cleans the address. */
function readReturn() {
  try {
    const p = new URLSearchParams(window.location.search);
    const r = p.get('google');
    if (!r) return null;
    window.history.replaceState(null, '', window.location.pathname);
    return r === 'ok' ? { ok: true, text: 'Google is now connected.' } : { ok: false, text: p.get('msg') || 'Google did not connect. Please try again.' };
  } catch { return null; }
}

/** Admin > Search & Growth > Search engines. */
export function Growth({ staff, go }) {
  const q = useApiData(() => adm.get('/growth/status'));
  const [banner] = useState(readReturn);
  const s = q.data;
  const canConn = can(staff, 'growth.integrations');
  return (
    <div className="adgr">
      {banner && <div className={'adgr-msg ' + (banner.ok ? 'adgr-msg-ok' : 'adgr-msg-err')} role="status">{banner.text}</div>}
      {/* the same result is passed to the Google card so it stays visible beside the buttons */}
      {q.error && <div className="a-msg err">{q.error} <button type="button" className="a-btn ghost sm" onClick={q.reload}>Try again</button></div>}
      {!s ? (!q.error && <span className="spin" />) : (
        <>
          <StatusStrip s={s} />
          <Wizard s={s} go={go} canConn={canConn} />
          <GoogleCard s={s} reload={q.reload} canConn={canConn} banner={banner} />
          <BingCard s={s} reload={q.reload} canConn={canConn} />
          <VerifyCard s={s} reload={q.reload} go={go} canConn={canConn} />
          <SitemapCard s={s} reload={q.reload} canConn={canConn} />
          <IndexNowCard s={s} go={go} />
          <ActivityTabs />
        </>
      )}
    </div>
  );
}
