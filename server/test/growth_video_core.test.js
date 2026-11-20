import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeId, canonicalVideoUrl, embedUrl, thumbnailUrl, validateVideoChange, videoOut } from '../src/growth/youtube.js';
import { videoLd, productVideoLd } from '../src/seoSchema.js';
import { ensureVideoColumns } from '../src/growth/videoSchema.js';
import { validateChanges, gridWhere, rowOut } from '../src/admin/growthVideos.js';

const ID = 'dQw4w9WgXcQ';
test('youtubeId accepts the supported shapes', () => {
  for (const u of [`https://www.youtube.com/watch?v=${ID}`, `https://youtube.com/watch?v=${ID}&t=5`, `http://m.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtu.be/${ID}?si=x`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/shorts/${ID}`, `https://www.youtube-nocookie.com/embed/${ID}`, `www.youtube.com/watch?v=${ID}`, ID, ` ${ID} `]) assert.equal(youtubeId(u), ID, u);
});
test('youtubeId rejects everything else', () => {
  for (const u of ['', null, undefined, 'https://youtube.com.evil.com/watch?v=' + ID, 'https://evil.com/youtu.be/' + ID, 'https://notyoutube.com/watch?v=' + ID, 'https://youtu.be.evil.com/' + ID,
    'javascript:alert(1)', 'data:text/html,x', 'ftp://youtube.com/watch?v=' + ID, 'https://user@youtube.com/watch?v=' + ID, 'https://www.youtube.com/watch?v=' + ID.slice(0, 10), 'https://www.youtube.com/watch?v=' + ID + 'x',
    ID.slice(0, 10), ID + 'x', 'https://www.youtube.com/embed/' + ID + '/extra', 'https://youtu.be/' + ID + '/extra', 'https://www.youtube.com/channel/' + ID, 'https://www.youtube.com/', 'https://www.youtube.com/watch', 'https://www.youtube-nocookie.com/watch?v=' + ID, 'https://www.youtube.com/watch?v=<script>aaa']) assert.equal(youtubeId(u), null, String(u));
});
test('url builders', () => {
  assert.equal(canonicalVideoUrl(ID), 'https://www.youtube.com/watch?v=' + ID);
  assert.equal(embedUrl(ID), 'https://www.youtube-nocookie.com/embed/' + ID);
  assert.equal(thumbnailUrl(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
});
const NOW = new Date(2026, 10, 20);
test('validateVideoChange', () => {
  let r = validateVideoChange({ videoUrl: `https://youtu.be/${ID}`, videoTitle: ' <b>Unboxing</b>  the toner ', videoDate: '2026-03-15' }, NOW);
  assert.deepEqual(r, { value: { video_url: canonicalVideoUrl(ID), video_title: 'Unboxing the toner', video_date: '2026-03-15' }, errors: [] });
  r = validateVideoChange({ videoUrl: ID, videoDate: '2026-11-20' }, NOW); assert.equal(r.errors.length, 0);
  r = validateVideoChange({ videoUrl: ID, videoDate: '2026-11-21' }, NOW); assert.equal(r.errors[0].field, 'videoDate');
  for (const d of ['2026-02-30', '15/03/2026', '2026-13-01', 'abc']) assert.equal(validateVideoChange({ videoUrl: ID, videoDate: d }, NOW).errors[0].field, 'videoDate', d);
  assert.equal(validateVideoChange({ videoUrl: 'https://evil.com/x' }, NOW).errors[0].field, 'videoUrl');
  assert.equal(validateVideoChange({ videoUrl: ID, videoTitle: 'x'.repeat(121) }, NOW).errors[0].field, 'videoTitle');
  assert.deepEqual(validateVideoChange({ videoUrl: '  ', videoTitle: 'x', videoDate: '2026-01-01' }, NOW), { value: { video_url: '', video_title: '', video_date: null }, errors: [] });
  assert.equal(validateVideoChange({ videoUrl: ID }, NOW).value.video_date, null);
});
test('videoLd', () => {
  assert.equal(videoLd({ id: ID, name: 'X' }), null);
  assert.equal(videoLd({ id: ID, uploadDate: '2026-01-01' }), null);
  const v = videoLd({ id: ID, name: 'HP 79A', description: '<p>Toner</p>', uploadDate: '2026-01-01' });
  assert.equal(v['@type'], 'VideoObject'); assert.deepEqual(v.thumbnailUrl, [thumbnailUrl(ID)]); assert.equal(v.uploadDate, '2026-01-01'); assert.equal(v.embedUrl, embedUrl(ID)); assert.equal(v.description, 'Toner'); assert.ok(!('contentUrl' in v));
  assert.equal(videoLd({ id: ID, name: 'N', uploadDate: new Date(2026, 0, 5) }).uploadDate, '2026-01-05');
});
test('productVideoLd', () => {
  const base = { name: 'HP 79A', short_desc: '<b>Genuine</b> toner', video_url: canonicalVideoUrl(ID), video_title: 'Unboxing', video_date: '2026-01-01' };
  const v = productVideoLd(base, 'https://x.test');
  assert.equal(v.name, 'Unboxing'); assert.equal(v.description, 'Genuine toner');
  assert.equal(productVideoLd({ ...base, video_date: null }, 'https://x.test'), null);
  assert.equal(productVideoLd({ ...base, video_url: '' }, 'https://x.test'), null);
  assert.equal(productVideoLd({ ...base, video_url: 'https://evil.com/x' }, 'https://x.test'), null);
  assert.equal(productVideoLd({ ...base, video_title: '', short_desc: '' }, 'b').name, 'HP 79A');
  assert.equal(productVideoLd({ ...base, short_desc: 'y'.repeat(400) }, 'b').description.length <= 300, true);
});
test('videoOut payload', () => {
  assert.equal(videoOut({ video_url: '' }), null); assert.equal(videoOut({}), null);
  assert.deepEqual(videoOut({ video_url: canonicalVideoUrl(ID), video_title: 'T', video_date: new Date(2026, 0, 5) }), { id: ID, url: canonicalVideoUrl(ID), embedUrl: embedUrl(ID), title: 'T', date: '2026-01-05' });
  assert.equal(videoOut({ video_url: ID, video_date: null }).date, null);
});
test('ensureVideoColumns with a stub db', async () => {
  const run = have => { const sql = []; return { sql, db: { query: async s => { sql.push(s); return [/information_schema/.test(s) ? have.map(c => ({ c })) : {}]; } } }; };
  let t = run([]); assert.deepEqual(await ensureVideoColumns(t.db), []); assert.equal(t.sql.length, 1);
  t = run(['id']); assert.deepEqual(await ensureVideoColumns(t.db), ['video_url', 'video_title', 'video_date']); assert.equal(t.sql.length, 4);
  t = run(['id', 'video_url', 'video_title', 'video_date']); assert.deepEqual(await ensureVideoColumns(t.db), []);
  t = run(['id', 'video_title']); assert.deepEqual(await ensureVideoColumns(t.db), ['video_url', 'video_date']);
});
test('route validators', () => {
  assert.equal(validateChanges([]).errors.length, 1); assert.equal(validateChanges(undefined).errors.length, 1);
  assert.equal(validateChanges(Array.from({ length: 101 }, (_, i) => ({ id: i + 1 }))).errors.length, 1);
  const bad = validateChanges([{ id: 1, videoUrl: ID }, { id: 2, videoUrl: 'nope' }, { id: 'x' }]);
  assert.deepEqual(bad.errors.map(e => [e.id, e.field]), [[2, 'videoUrl'], ['x', 'id']]);
  const ok = validateChanges([{ id: 3, videoUrl: ID, videoTitle: 'T', videoDate: '2026-01-01' }, { id: 4, videoUrl: '' }]);
  assert.equal(ok.errors.length, 0); assert.equal(ok.items[0].value.video_url, canonicalVideoUrl(ID)); assert.equal(ok.items[1].value.video_url, '');
  assert.match(gridWhere({ filter: 'with' }).where, /video_url <> ''/);
  assert.match(gridWhere({ filter: 'without' }).where, /IS NULL/);
  assert.equal(gridWhere({ q: '50%' }).params[1], '%50\\%%');
  assert.equal(gridWhere({}).params.length, 0);
  assert.deepEqual(rowOut({ id: 1, name: 'n', video_url: canonicalVideoUrl(ID), video_date: '2026-01-01' }), { id: 1, sku: '', name: 'n', category: '', videoUrl: canonicalVideoUrl(ID), videoId: ID, videoTitle: '', videoDate: '2026-01-01' });
});
