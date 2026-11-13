// What we know about a visit without asking: the first page, where the visitor came from, campaign tags
// (utm_*), screen, language and time zone. The first three are noted once per browser tab, on arrival.
const KEY = 'ar_visit';
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function captureVisit() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const q = new URLSearchParams(location.search), v = { landing: location.pathname };
    for (const k of UTM) if (q.get(k)) v[k] = q.get(k);
    try {
      if (document.referrer) { const u = new URL(document.referrer); if (u.origin !== location.origin) v.ref = u.origin + u.pathname; }
    } catch { /* an odd referrer is simply left out */ }
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch { /* storage blocked: the visit is still served, just not tagged */ }
}
captureVisit();

/** The visit details sent with the chat start form (the server adds the browser, system and IP address). */
export function visitInfo() {
  let v = {};
  try { v = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { /* none stored */ }
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* old browser */ }
  return { ...v, page: location.pathname, screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`, lang: navigator.language || '', tz };
}
