/** Careers page hero with the open-role counters. */
export default function CareersHero({ open }) {
  const stats = [
    [open.length, 'Open roles'],
    [open.reduce((a, j) => a + j.vacancies, 0), 'Vacancies'],
    [new Set(open.map(j => j.dept)).size, 'Departments'],
  ];
  return (
    <div className="job-hero">
      <div className="cr-hero-text">
        <span className="mono cr-eyebrow">CAREERS AT AR TRADE</span>
        <h1 className="cr-title">Build your career with Bangladesh's trusted printing partner</h1>
        <p className="cr-lead">Join our sales, service, marketing and logistics teams in Dhaka. Apply online in two minutes — no account needed.</p>
      </div>
      <div className="cr-stats">{stats.map(([n, k]) => <div key={k} className="job-stat"><b>{n}</b><span>{k}</span></div>)}</div>
    </div>
  );
}
