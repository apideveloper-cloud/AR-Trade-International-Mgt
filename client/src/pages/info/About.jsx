import ClientLogos from '../../components/ClientLogos.jsx';
import { DEFAULT_ABOUT, withDefaults } from '../../data.js';
import { useStore } from '../../store.jsx';
import './info.css';

/** Vision / Mission card. */
function VisionCard({ title, text }) {
  return <div className="white-card inf-vm"><span className="inf-vm-t">{title}</span><span className="inf-vm-d">{text}</span></div>;
}

/** About page: heading, stats, MD message, vision/mission, reasons to choose us, client logos. */
export function About() {
  const { content } = useStore();
  const ab = withDefaults(DEFAULT_ABOUT, content.about);
  return (
    <section className="inf-wrap inf-about">
      <div className="inf-grid-420 inf-hero-grid">
        <h1 className="inf-h1-about">{ab.heading}</h1>
        <p className="inf-intro">{ab.intro}</p>
      </div>
      <div className="stats-g">{content.stats.map(s => <div key={s.t}><b>{s.v}</b><span className="inf-stat-t">{s.t}</span></div>)}</div>
      <div className="inf-grid-420">
        <div className="inf-md">
          <span className="mono inf-md-kick">Message from the Managing Director</span>
          <p className="inf-md-msg">{ab.mdMessage}</p>
          <div className="inf-md-who"><b>{ab.mdName}</b><span>{ab.mdTitle}</span></div>
        </div>
        <div className="inf-stack">
          <VisionCard title="Vision" text={ab.vision} />
          <VisionCard title="Mission" text={ab.mission} />
        </div>
      </div>
      <div className="inf-col">
        <h2 className="inf-h2">Why choose us</h2>
        <div className="inf-why-grid">
          {content.whys.map((w, i) => <div className="why" key={w.t}><small>{String(i + 1).padStart(2, '0')}</small><b className="inf-why-t">{w.t}</b><span className="inf-why-d">{w.d}</span></div>)}
        </div>
      </div>
      <ClientLogos />
    </section>
  );
}
