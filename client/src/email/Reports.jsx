import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmt, fmtDate } from '../api.js';
import { Note, NoProvider } from './EmailParts.jsx';
import { card, dash, pct } from './emailShared.js';

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
  const bar = (v, max, c) => (v == null ? <span className="em-s5">{dash}</span> : (
    <div className="em-s6"><span className="em-s7"><span style={{ display: 'block', height: '100%', width: Math.min(100, v * max) + '%', background: c, borderRadius: 999 }} /></span><b className="em-s8">{v}%</b></div>
  ));
  return (
    <>
      <NoProvider connected={d.connected} />
      <div className="em-s9">
        {kpis.map(([l, v, s]) => <div key={l} style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}><span className="em-s10">{l}</span><b className="em-s11">{v}</b><span className="em-s12">{s}</span></div>)}
      </div>
      <div style={{ ...card, overflow: 'hidden' }}>
        <div className="em-s13"><b className="em-s14">Performance by campaign &amp; automation</b><button onClick={exportCsv} className="em-s15">Export CSV</button></div>
        <div className="em-s16">
          <table className="em-s17">
            <thead className="em-s18"><tr>{['Name', 'Sent', 'Open rate', 'Click rate', 'Unsubs', 'Revenue'].map((h, i) => <th key={h} style={{ padding: '10px 16px', textAlign: i === 0 || i === 2 || i === 3 ? 'left' : 'right', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b7080', width: i === 2 || i === 3 ? 200 : undefined }}>{h}</th>)}</tr></thead>
            <tbody>
              {!d.rows.length && <tr><td colSpan={6} className="em-s19">Nothing sent yet.</td></tr>}
              {d.rows.map(r => (
                <tr key={r.name + r.kind}>
                  <td className="em-s20"><div className="em-s21"><b className="em-s22">{r.name}</b><span className="em-s23">{r.kind} · {r.when ? fmtDate(r.when) : r.running ? 'Running' : 'Paused'}{r.queued ? ` · ${r.queued} queued` : ''}</span></div></td>
                  <td className="em-s24">{r.sent.toLocaleString('en-US')}</td>
                  <td className="em-s20">{bar(pct(r.opens, r.sent), 1, 'linear-gradient(90deg,oklch(0.7 0.12 230),oklch(0.5 0.16 254))')}</td>
                  <td className="em-s20">{bar(pct(r.clicks, r.sent), 3, 'linear-gradient(90deg,oklch(0.78 0.12 160),oklch(0.55 0.13 160))')}</td>
                  <td className="em-s25">{r.unsubs}</td>
                  <td className="em-s26">{r.revenue != null ? fmt(r.revenue) : dash}</td>
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
