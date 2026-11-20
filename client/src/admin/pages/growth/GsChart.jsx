import { useState } from 'react';
import { Section } from './parts.jsx';
import { nf } from './gsApi.js';

const W = 640, H = 220, L = 52, R = 12, T = 14, B = 30;
const short = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** B. Daily clicks or impressions as an SVG area chart, with a table view. */
export default function GsChart({ daily }) {
  const [metric, setMetric] = useState('clicks');
  const [table, setTable] = useState(false);
  const rows = (daily || []).slice(-90);
  if (!rows.length) return null;
  const vals = rows.map(r => Number(r[metric]) || 0);
  const max = Math.max(1, ...vals);
  const x = i => L + (rows.length < 2 ? 0 : (i * (W - L - R)) / (rows.length - 1));
  const y = v => T + (H - T - B) * (1 - v / max);
  const line = vals.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = line + ` L${x(rows.length - 1).toFixed(1)} ${H - B} L${x(0).toFixed(1)} ${H - B} Z`;
  const label = metric === 'clicks' ? 'Clicks' : 'Impressions';
  const total = vals.reduce((s, v) => s + v, 0);
  return (
    <Section title="Last 90 days" what="One point per day. Switch between people who clicked and the times your pages were shown."
      right={<div className="adgs-row">
        {['clicks', 'impressions'].map(m => (
          <button key={m} type="button" className={'a-btn sm' + (metric === m ? '' : ' ghost')} aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === 'clicks' ? 'Clicks' : 'Impressions'}</button>
        ))}
        <button type="button" className="a-btn ghost sm" aria-pressed={table} onClick={() => setTable(t => !t)}>{table ? 'Show as chart' : 'Show as table'}</button>
      </div>}>
      {!table ? (
        <svg className="adgs-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="adgs-ct adgs-cd">
          <title id="adgs-ct">{label} per day, last {rows.length} days</title>
          <desc id="adgs-cd">{label} per day from {short(rows[0].day)} to {short(rows[rows.length - 1].day)}. Total {nf(total)}. Highest day {nf(max)}.</desc>
          {[0, 0.5, 1].map(t => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} className="adgs-grid" />
              <text x={L - 6} y={y(max * t) + 4} textAnchor="end" className="adgs-ax">{nf(Math.round(max * t))}</text>
            </g>
          ))}
          <path d={area} className="adgs-area" />
          <path d={line} className="adgs-line" fill="none" />
          <text x={L} y={H - 8} className="adgs-ax">{short(rows[0].day)}</text>
          <text x={W - R} y={H - 8} textAnchor="end" className="adgs-ax">{short(rows[rows.length - 1].day)}</text>
          <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" className="adgs-ax">Day</text>
        </svg>
      ) : (
        <div className="adgr-scroll adgs-tall">
          <table className="adgr-tbl">
            <thead><tr><th>Day</th><th>Clicks</th><th>Impressions</th></tr></thead>
            <tbody>{[...rows].reverse().map(r => <tr key={r.day}><td>{short(r.day)}</td><td>{nf(r.clicks)}</td><td>{nf(r.impressions)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
