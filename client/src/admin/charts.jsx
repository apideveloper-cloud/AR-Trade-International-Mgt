import { useState } from 'react';
import { useT } from './i18n/lang.jsx';
import './i18n/dict/shell.js';

// Small dependency-free SVG charts for the admin dashboard.
export const short = v => { const n = Number(v) || 0; return (n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n))); };
const money = n => '৳ ' + Math.round(n || 0).toLocaleString('en-US');
const dlabel = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const niceMax = v => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

/** Revenue of the last days (solid area) and the forecast for the next days (dashed line with a rough range). */
export function ForecastChart({ series, forecast }) {
  const tr = useT();
  const [hover, setHover] = useState(null);
  const W = 760, H = 270, L = 46, R = 14, T = 16, B = 30;
  const all = [...series.map(x => ({ ...x, f: false })), ...forecast.map(x => ({ ...x, f: true }))];
  const N = all.length, iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(...all.map(x => (x.f ? x.hi : x.v)), 1));
  const x = i => L + (i / (N - 1)) * iw, y = v => T + ih - (v / max) * ih;
  const hist = all.slice(0, series.length), fut = all.slice(series.length - 1); // the forecast starts at today's point so the lines join
  const line = hist.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(hist.length - 1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
  const fLine = fut.map((p, i) => `${i ? 'L' : 'M'}${x(series.length - 1 + i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const band = [...forecast.map((p, i) => `${i ? 'L' : 'M'}${x(series.length + i).toFixed(1)},${y(p.hi).toFixed(1)}`), ...[...forecast].reverse().map((p, i) => `L${x(series.length + forecast.length - 1 - i).toFixed(1)},${y(p.lo).toFixed(1)}`), 'Z'].join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max);
  const xt = all.map((p, i) => [p, i]).filter(([, i]) => i % 10 === 0 || i === N - 1).filter(([, i]) => i === N - 1 || N - 1 - i >= 4);
  const h = hover != null ? all[hover] : null;
  const move = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(N - 1, Math.round(((px - L) / iw) * (N - 1)))));
  };
  return (
    <div className="ch-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="ch" role="img" aria-label={tr('Revenue of the last 60 days and the 7 day forecast')} onMouseMove={move} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="rvA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="oklch(0.62 0.16 250)" stopOpacity=".38" /><stop offset="1" stopColor="oklch(0.62 0.16 250)" stopOpacity=".02" /></linearGradient>
        </defs>
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="ch-grid" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="ch-ax">{short(t)}</text></g>)}
        <rect x={x(series.length - 1)} y={T} width={W - R - x(series.length - 1)} height={ih} className="ch-future" />
        <path d={area} fill="url(#rvA)" />
        <path d={line} className="ch-line" />
        <path d={band} className="ch-band" />
        <path d={fLine} className="ch-fline" />
        {forecast.map((p, i) => <circle key={p.d} cx={x(series.length + i)} cy={y(p.v)} r="3.4" className="ch-fdot" />)}
        <line x1={x(series.length - 1)} x2={x(series.length - 1)} y1={T} y2={T + ih} className="ch-today" />
        <text x={x(series.length - 1) - 6} y={T + 11} textAnchor="end" className="ch-tag">{tr('Today')}</text>
        <text x={W - R - 4} y={T + 11} textAnchor="end" className="ch-tag f">{tr('Forecast')}</text>
        {xt.map(([p, i]) => <text key={p.d} x={x(i)} y={H - 9} textAnchor={i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle'} className="ch-ax">{dlabel(p.d)}</text>)}
        {h && <g><line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} className="ch-cross" /><circle cx={x(hover)} cy={y(h.v)} r="5" className={'ch-pt' + (h.f ? ' f' : '')} /></g>}
      </svg>
      {h && (
        <div className="ch-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{dlabel(h.d)}{h.f ? ' · ' + tr('forecast') : ''}</b>
          <span>{money(h.v)}{h.f ? <small> ({tr('{lo} to {hi}', { lo: money(h.lo), hi: money(h.hi) })})</small> : ''}</span>
          <small>{h.f ? tr('~{n} orders', { n: h.n }) : tr(h.n === 1 ? '{n} order' : '{n} orders', { n: h.n })}</small>
        </div>
      )}
      <div className="ch-legend"><span><i className="a" />{tr('Revenue (actual)')}</span><span><i className="f" />{tr('Forecast, next {n} days', { n: forecast.length })}</span><span><i className="b" />{tr('Likely range')}</span></div>
    </div>
  );
}

/** Ring chart with a number in the middle. parts: [{ label, value, color }] */
export function Donut({ parts, center, sub }) {
  const tr = useT();
  const w = v => (typeof v === 'string' ? tr(v) : v);
  const total = parts.reduce((t, p) => t + p.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="dn">
      <svg viewBox="0 0 140 140" role="img" aria-label={center + ' ' + w(sub)}>
        <circle cx="70" cy="70" r={R} className="dn-bg" />
        {total > 0 && parts.filter(p => p.value > 0).map(p => {
          const len = (p.value / total) * C;
          const el = <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18" strokeDasharray={`${Math.max(len - 2, 0.5)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
          off += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="dn-n">{center}</text>
        <text x="70" y="86" textAnchor="middle" className="dn-s">{w(sub)}</text>
      </svg>
      <ul className="dn-l">{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{w(p.label)}<b>{p.value}</b><em>{total ? Math.round((p.value / total) * 100) : 0}%</em></li>)}</ul>
    </div>
  );
}

/** Horizontal bars. rows: [{ label, value, text, sub }] */
export function HBars({ rows, hue = 250, inline = false }) {
  const tr = useT();
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="hb">
      {rows.map((r, i) => {
        const Tag = r.onClick ? 'button' : 'div';
        return (
          <Tag key={r.label + i} type={r.onClick ? 'button' : undefined} onClick={r.onClick} title={r.onClick ? tr('Open the sales report') : undefined} className={'hb-r' + (r.onClick ? ' hb-btn' : '') + (r.img !== undefined ? ' hb-img' : '')}>
            {r.img !== undefined && <span className="hb-pic" style={{ backgroundImage: r.img ? `url('${r.img}')` : 'none' }}>{!r.img && '▣'}</span>}
            <div className="hb-c">
              <div className="hb-t"><span title={r.label}>{r.label}</span><b>{r.text}{inline && r.sub && <small className="hb-in"> · {r.sub}</small>}</b></div>
              <div className="hb-bar"><i style={{ width: Math.max(3, (r.value / max) * 100) + '%', background: `linear-gradient(90deg, oklch(0.72 0.14 ${hue + i * 14}), oklch(0.55 0.18 ${hue + i * 14}))` }} /></div>
              {!inline && r.sub && <small>{r.sub}</small>}
            </div>
          </Tag>
        );
      })}
    </div>
  );
}

/** Vertical bars. rows: [{ label, value, hot }] */
export function ColBars({ rows, hue = 250, unit = '' }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="cb" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
      {rows.map((r, i) => (
        <div key={r.label + i} title={`${r.label}: ${r.value}${unit}`}>
          <span>{r.value ? short(r.value) : ''}</span>
          <i className={r.hot ? 'hot' : ''} style={{ height: Math.max(r.value ? 6 : 2, (r.value / max) * 100) + '%', '--h': hue }} />
          <small>{r.label}</small>
        </div>
      ))}
    </div>
  );
}

/** Tiny trend line for a KPI card. */
export function Spark({ values, hue = 250 }) {
  const W = 110, H = 34, max = Math.max(...values, 1), n = values.length;
  const pts = values.map((v, i) => `${((i / Math.max(n - 1, 1)) * (W - 4) + 2).toFixed(1)},${(H - 3 - (v / max) * (H - 8)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sp" aria-hidden="true">
      <path d={`M${pts.join(' L')} L${W - 2},${H} L2,${H} Z`} fill={`oklch(0.7 0.14 ${hue} / .16)`} />
      <path d={`M${pts.join(' L')}`} fill="none" stroke={`oklch(0.55 0.18 ${hue})`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
