import { useEffect, useRef } from 'react';

const COLORS = ['#ffd24a', '#ff5c8a', '#4ad7ff', '#8cff6b', '#c58bff', '#ff9a3c', '#ffffff'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

/** Celebration overlay: rockets rise and explode in different styles (burst, ring, willow, sparkle) for a few seconds, then it removes itself. */
export default function Fireworks({ seconds = 7 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, raf = 0, last = performance.now(), nextLaunch = 0;
    const t0 = last;
    const rockets = [], parts = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener('resize', size);

    const spark = (x, y, vx, vy, color, life, extra = {}) => parts.push({ x, y, vx, vy, color, life, max: life, ...extra });

    function explode(x, y) {
      const color = pick(COLORS), alt = pick(COLORS), kind = pick(['burst', 'ring', 'willow', 'sparkle']);
      const n = kind === 'ring' ? 46 : kind === 'sparkle' ? 70 : 64;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.04, 0.04);
        if (kind === 'ring') { const s = 3.2; spark(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(55, 70), { drag: 0.985, g: 0.02 }); }
        else if (kind === 'willow') { const s = rand(1.2, 4.2); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 2 ? color : '#ffe9a8', rand(95, 130), { drag: 0.97, g: 0.045, trail: true }); }
        else if (kind === 'sparkle') { const s = rand(0.8, 5); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 3 ? color : alt, rand(45, 85), { drag: 0.96, g: 0.05, twinkle: true }); }
        else { const s = rand(1.5, 5.2); spark(x, y, Math.cos(a) * s, Math.sin(a) * s, i % 4 ? color : alt, rand(55, 90), { drag: 0.975, g: 0.06 }); }
      }
    }

    function launch() {
      const x = rand(w * 0.12, w * 0.88);
      rockets.push({ x, y: h + 10, vx: rand(-0.6, 0.6), vy: -rand(h * 0.0125, h * 0.0165), peak: rand(h * 0.18, h * 0.5) });
    }

    function frame(now) {
      const dt = Math.min(2.5, (now - last) / 16.67); last = now;
      const t = (now - t0) / 1000;
      ctx.globalCompositeOperation = 'destination-out'; // fade old frames to leave light trails
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      if (t < seconds && now >= nextLaunch) { const n = Math.random() < 0.35 ? 2 : 1; for (let i = 0; i < n; i++) launch(); nextLaunch = now + rand(260, 620); }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 0.12 * dt;
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, 7); ctx.fill();
        spark(r.x, r.y, rand(-0.2, 0.2), rand(0.2, 0.8), '#ffcf70', rand(8, 16), { drag: 1, g: 0.02 });
        if (r.vy >= -1 || r.y <= r.peak) { explode(r.x, r.y); rockets.splice(i, 1); }
      }

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vx *= p.drag ?? 0.98; p.vy = p.vy * (p.drag ?? 0.98) + (p.g ?? 0.05) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const a = Math.max(0, p.life / p.max) * (p.twinkle && Math.random() < 0.3 ? 0.3 : 1);
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.trail ? 1.6 : 2.1, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (t < seconds || rockets.length || parts.length) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [seconds]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 60 }} />;
}
