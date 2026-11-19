import { useEffect, useRef, useState } from 'react';

/** Full-screen toggle for one element: uses the browser's Fullscreen API where allowed, and always keeps a page-wide overlay flag (`full`) that Escape or leaving full screen clears. */
export function useFullscreen() {
  const ref = useRef(null);
  const [full, setFull] = useState(false);
  const toggle = () => {
    if (full) { setFull(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); return; }
    setFull(true);
    ref.current?.requestFullscreen?.().catch(() => {}); // the page-wide overlay still works where the browser refuses
  };
  useEffect(() => {
    if (!full) return undefined;
    const key = e => { if (e.key === 'Escape') setFull(false); };
    const fs = () => { if (!document.fullscreenElement) setFull(false); };
    window.addEventListener('keydown', key); document.addEventListener('fullscreenchange', fs);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fs); };
  }, [full]);
  return { ref, full, toggle };
}
