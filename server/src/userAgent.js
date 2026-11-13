// Reads a browser's User-Agent header into the three things sellers and marketing care about:
// the kind of device, the operating system and the browser. Order matters: Edge and Opera also say "Chrome",
// and Chrome also says "Safari".
const BROWSERS = [
  [/EdgA?\/([\d.]+)|Edg\/([\d.]+)/, 'Edge'],
  [/OPR\/([\d.]+)|Opera/, 'Opera'],
  [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
  [/Firefox\/([\d.]+)|FxiOS\/([\d.]+)/, 'Firefox'],
  [/UCBrowser\/([\d.]+)/, 'UC Browser'],
  [/(?:Chrome|CriOS)\/([\d.]+)/, 'Chrome'],
  [/Version\/([\d.]+).*Safari/, 'Safari']
];

const OSES = [
  [/Windows NT 10\.0/, 'Windows 10/11'],
  [/Windows NT 6\.3/, 'Windows 8.1'],
  [/Windows NT 6\.[12]/, 'Windows 7/8'],
  [/Windows/, 'Windows'],
  [/Android ([\d.]+)/, m => 'Android ' + m[1].split('.')[0]],
  [/(?:iPhone|iPad|iPod).*OS ([\d_]+)/, m => 'iOS ' + m[1].split('_')[0]],
  [/Mac OS X/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux']
];

export function parseUserAgent(ua) {
  ua = String(ua || '').slice(0, 400);
  if (!ua) return { device: '', os: '', browser: '' };
  const device = /iPad|Tablet|Tab |SM-T\d/i.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? 'Tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  let browser = '';
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) { const v = m.slice(1).find(Boolean); browser = v ? `${name} ${v.split('.')[0]}` : name; break; }
  }
  let os = '';
  for (const [re, name] of OSES) {
    const m = ua.match(re);
    if (m) { os = typeof name === 'function' ? name(m) : name; break; }
  }
  return { device, os, browser };
}
