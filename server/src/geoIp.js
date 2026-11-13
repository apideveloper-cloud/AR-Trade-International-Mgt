// Turns an IP address into an approximate place ("Dhaka, Dhaka Division, BD") for the chat leads list.
// Off unless GEOIP_URL is set in server/.env, because it sends the visitor's IP to the lookup service you pick.
// GEOIP_URL is the service address with {ip} where the address goes, e.g. https://ipwho.is/{ip}
// The reply is read as JSON with city, region (or regionName) and country_code (or countryCode).

const PRIVATE = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^::1$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i, /^0\./];
export const isPrivateIp = ip => !ip || PRIVATE.some(re => re.test(ip));

/** The place for an IP, or '' when lookup is off, the address is private, or the service does not answer in time. */
export async function lookupPlace(ip, { url = process.env.GEOIP_URL, doFetch = fetch, timeoutMs = 2500 } = {}) {
  if (!url || isPrivateIp(ip)) return '';
  try {
    const r = await doFetch(url.replace('{ip}', encodeURIComponent(ip)), { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!r.ok) return '';
    const j = await r.json();
    if (j && (j.success === false || j.status === 'fail' || j.error)) return '';
    const bits = [j.city, j.region || j.regionName, j.country_code || j.countryCode || j.country]
      .map(x => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return [...new Set(bits)].join(', ').slice(0, 120);
  } catch { return ''; }
}
