import { useState } from 'react';
import './product-video.css';

const EMBED = 'https://www.youtube-nocookie.com/embed/';

/** Click-to-load YouTube video: only a thumbnail loads until the shopper presses play (faster, more private). */
export default function ProductVideo({ video }) {
  const [on, setOn] = useState(false);
  if (!video || !video.id || typeof video.embedUrl !== 'string' || !video.embedUrl.startsWith(EMBED)) return null;
  const title = video.title || 'Product video';
  return (
    <section className="pvid" aria-label="Product video">
      <h2 className="pvid-h">Watch the video</h2>
      <div className="pvid-box">
        {on ? (
          <iframe className="pvid-frame" src={video.embedUrl + '?autoplay=1&rel=0'} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        ) : (
          <button type="button" className="pvid-poster" onClick={() => setOn(true)} aria-label={'Play video: ' + title}>
            <img src={'https://i.ytimg.com/vi/' + encodeURIComponent(video.id) + '/hqdefault.jpg'} width="480" height="360" loading="lazy" alt={title} />
            <span className="pvid-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path fill="#fff" d="M8 5v14l11-7z" /></svg></span>
          </button>
        )}
      </div>
    </section>
  );
}
