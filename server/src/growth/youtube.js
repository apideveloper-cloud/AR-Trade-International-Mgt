// YouTube links for product videos. Pure: everything is checked by pattern only, nothing is fetched.
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** The 11-character video id of a YouTube link (watch, youtu.be, embed, shorts, nocookie embed) or a bare id; null for anything else. */
export function youtubeId(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (ID.test(s)) return s;
  let u;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : s.startsWith('//') ? 'https:' + s : /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase();
  if (!HOSTS.has(host)) return null;
  const segs = u.pathname.replace(/\/+$/, '').split('/').slice(1);
  let id = null;
  if (host.endsWith('youtu.be')) { if (segs.length === 1) id = segs[0]; }
  else if (segs.length === 1 && segs[0] === 'watch' && !host.includes('nocookie')) id = u.searchParams.get('v');
  else if (segs.length === 2 && (segs[0] === 'embed' || (segs[0] === 'shorts' && !host.includes('nocookie')))) id = segs[1];
  return id && ID.test(id) ? id : null;
}
export const canonicalVideoUrl = id => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = id => `https://www.youtube-nocookie.com/embed/${id}`;
export const thumbnailUrl = id => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** A DATE value (string or Date) as 'YYYY-MM-DD', or ''. */
export function dateText(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : ymd(v);
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v ?? ''));
  return m ? m[1] : '';
}
const realDate = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

/** Validates one product video edit. Empty url clears all three. -> { value:{video_url, video_title, video_date}, errors:[{field,message}] } */
export function validateVideoChange({ videoUrl, videoTitle, videoDate } = {}, now = new Date()) {
  const errors = [];
  const raw = String(videoUrl ?? '').trim();
  if (!raw) return { value: { video_url: '', video_title: '', video_date: null }, errors };
  const id = youtubeId(raw);
  if (!id) errors.push({ field: 'videoUrl', message: 'Enter a YouTube link (youtube.com/watch?v=..., youtu.be/..., or the 11-character video id)' });
  const title = String(videoTitle ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (title.length > 120) errors.push({ field: 'videoTitle', message: 'The video title can be at most 120 characters' });
  let date = null;
  const d = String(videoDate ?? '').trim();
  if (d) {
    if (!realDate(d)) errors.push({ field: 'videoDate', message: 'The upload date must be a real date like 2026-03-15' });
    else if (d > ymd(now)) errors.push({ field: 'videoDate', message: 'The upload date cannot be in the future' });
    else date = d;
  }
  return { value: { video_url: id ? canonicalVideoUrl(id) : '', video_title: title.slice(0, 120), video_date: date }, errors };
}

/** The public `video` field of one product: { id, url, embedUrl, title, date } or null. */
export function videoOut(row) {
  const id = youtubeId(row?.video_url);
  if (!id) return null;
  return { id, url: canonicalVideoUrl(id), embedUrl: embedUrl(id), title: String(row.video_title || ''), date: dateText(row.video_date) || null };
}
