import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmt, fmtDate } from '../api.js';
import { Note, NoProvider, PanelHead } from './EmailParts.jsx';
import { dash, pct } from './emailShared.js';

const HEADS = ['Name', 'Sent', 'Open rate', 'Click rate', 'Unsubs', 'Revenue'];
const OPEN_BAR = 'linear-gradient(90deg,oklch(0.7 0.12 230),oklch(0.5 0.16 254))';
const CLICK_BAR = 'linear-gradient(90deg,oklch(0.78 0.12 160),oklch(0.55 0.13 160))';

/** A percentage with a small progress bar; `max` is the value that fills the bar. */
const bar = (v, max, c) => (v == null ? <span className="em-dim">{dash}</span> : (
  <div className="em-bar-row"><span className="em-bar-track"><span className="em-bar-fill" style={{ width: Math.min(100, v * max) + '%', background: c }} /></span><b className="em-bar-val">{v}%</b></div>
));

export default function Reports() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/reports').then(setD).catch(() => {}); }, []);
  if (!d) return <span className="spin" />;
  const T = d.totals;
  const kpis = [['Emails sent', T.sent.toLocaleString('en-US'), `${d.campaignsSent} campaigns sent`], ['Open rate', d.hasTracking ? pct(T.opens, T.sent) + '%' : dash, d.hasTracking ? T.opens + ' opens' : 'Needs provider tracking'], ['Click rate', d.hasTracking ? pct(T.clicks, T.sent) + '%' : dash, d.hasTracking ? T.clicks + ' clicks' : 'Needs provider tracking'], ['Unsubscribes', String(d.unsubscribed), 'Recorded in the preference log'], ['Revenue from email', T.revenue ? fmt(T.revenue) : dash, 'From results you enter']];
  const exportCsv = () => {
    const rows = [['name', 'type', 'sent', 'opens', 'clicks', 'unsubscribes', 'revenue_bdt'], ...d.rows.map(r => [r.name, r.kind, r.sent, r.opens ?? '', r.clicks ?? '', r.unsubs, r.revenue ?? ''])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.map(y => { const s = String(y); return '"' + (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"'; }).join(',')).join('\n')], { type: 'text/csv' })); a.download = 'ar-email-report.csv'; a.click();
  };
  return (
    <>
      <NoProvider connected={d.connected} />
      <div className="em-kpi-grid">
        {kpis.map(([l, v, s]) => <div key={l} className="em-card em-kpi"><span className="em-kpi-label">{l}</span><b className="em-kpi-value">{v}</b><span className="em-kpi-sub">{s}</span></div>)}
      </div>
      <div className="em-card em-card-clip">
        <PanelHead center><b className="em-panel-title">Performance by campaign &amp; automation</b><button onClick={exportCsv} className="em-pill-btn">Export CSV</button></PanelHead>
        <div className="em-scroll-x">
          <table className="em-table">
            <thead className="em-thead"><tr>{HEADS.map((h, i) => <th key={h} className={'em-th' + (i === 0 || i === 2 || i === 3 ? ' em-th--left' : '') + (i === 2 || i === 3 ? ' em-th--bar' : '')}>{h}</th>)}</tr></thead>
            <tbody>
              {!d.rows.length && <tr><td colSpan={6} className="em-empty-cell">Nothing sent yet.</td></tr>}
              {d.rows.map(r => (
                <tr key={r.name + r.kind}>
                  <td className="em-cell"><div className="em-cell-stack"><b className="em-title-sm">{r.name}</b><span className="em-meta">{r.kind} · {r.when ? fmtDate(r.when) : r.running ? 'Running' : 'Paused'}{r.queued ? ` · ${r.queued} queued` : ''}</span></div></td>
                  <td className="em-num em-num--bold">{r.sent.toLocaleString('en-US')}</td>
                  <td className="em-cell">{bar(pct(r.opens, r.sent), 1, OPEN_BAR)}</td>
                  <td className="em-cell">{bar(pct(r.clicks, r.sent), 3, CLICK_BAR)}</td>
                  <td className="em-num">{r.unsubs}</td>
                  <td className="em-money">{r.revenue != null ? fmt(r.revenue) : dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Note>Opens, clicks and revenue come from your email provider. Enter them on a sent campaign (Campaigns tab) until a provider is connected.</Note>
    </>
  );
}
