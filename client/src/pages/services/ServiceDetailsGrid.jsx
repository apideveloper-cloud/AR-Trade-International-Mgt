import { Link } from 'react-router-dom';

/** Card grid linking to each servicing detail page (cover image is dynamic, so it stays inline). */
export default function ServiceDetailsGrid({ details }) {
  return (
    <div className="svc-details">
      <h2>Our servicing</h2>
      <div className="grid">
        {details.map(d => (
          <Link key={d.slug} to={'/services/' + d.slug} className="card">
            <span className="im" style={d.cover ? { backgroundImage: `url('${d.cover}')` } : undefined} />
            <span className="bd"><b>{d.title}</b><span>{d.excerpt}</span><em>Read details →</em></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
