import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmt, fmtTime } from '../api.js';
import { CampaignForm } from './CampaignForm.jsx';
import { act, card, dash, inp, lbl, pct, TAG } from './emailShared.js';

function ResultsForm({ c, onDone }) {
  const [open, setOpen] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    await act(() => api.put(`/campaigns/${c.id}/results`, d), () => { setOpen(false); onDone(); });
  };
  if (!open) return <button onClick={() => setOpen(true)} className="em-s41">Enter results from provider</button>;
  return (
    <form onSubmit={submit} className="em-s42">
      {[['opens', 'Opens'], ['clicks', 'Clicks'], ['unsubs', 'Unsubs'], ['revenue', 'Revenue ৳']].concat(c.subjB ? [['abA', 'Open % · A'], ['abB', 'Open % · B']] : []).map(([k, l]) => <label key={k} style={{ ...lbl, fontSize: 11 }}>{l}<input name={k} type="number" min="0" defaultValue={{ opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, abA: c.ab?.[0], abB: c.ab?.[1] }[k] ?? ''} style={{ ...inp, padding: '8px 10px' }} /></label>)}
      <button className="em-s43">Save</button>
    </form>
  );
}

export default function Campaigns() {
  const [camps, setCamps] = useState(null);
  const [tpls, setTpls] = useState([]);
  const load = () => api.get('/campaigns').then(setCamps).catch(() => {});
  useEffect(() => { load(); api.get('/templates').then(setTpls).catch(() => {}); }, []);
  const tpl = id => tpls.find(t => t.id === id);
  return (
    <div className="em-s44">
      <CampaignForm tpls={tpls} onDone={load} />
      <div className="em-s45">
        {camps && !camps.length && <div style={{ ...card, padding: 28, textAlign: 'center', color: '#6b7080' }}>No campaigns yet. Create the first one.</div>}
        {camps?.map(c => {
          const [tb, tf] = TAG[c.tag] || TAG.Offer;
          const sent = c.status === 'Sent';
          const win = c.ab ? (c.ab[1] > c.ab[0] ? 'B' : 'A') : null;
          const subjects = [['A', c.subjA], ...(c.subjB ? [['B', c.subjB]] : [])];
          return (
            <div key={c.id} style={{ ...card, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="em-s46">
                <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: tb, color: tf }}>{c.tag}</span>
                <b className="em-s47">{c.name}</b>
                <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: sent ? 'oklch(0.95 0.04 150)' : 'oklch(0.96 0.05 85)', color: sent ? 'oklch(0.4 0.12 150)' : 'oklch(0.45 0.1 70)' }}>{c.status}</span>
                <span className="em-s48">{sent ? 'Sent ' : 'Sends '}{fmtTime(c.at)}</span>
              </div>
              <div className="em-s49">
                {subjects.map(([k, t]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, background: win === k ? 'oklch(0.97 0.03 150)' : '#f6f8fc', borderRadius: 10, padding: '8px 10px' }}>
                    <span className="mono em-s50">{k}</span><span className="em-s51">{t}</span>
                    {c.ab && <b className="em-s52">{c.ab[k === 'A' ? 0 : 1]}% open</b>}{win === k && <span className="em-s53">WINNER</span>}
                  </div>
                ))}
              </div>
              {tpl(c.template) && <span className="em-s48">Template: {tpl(c.template).name}</span>}
              {sent && (
                <>
                  <div className="em-s54">
                    {[['Recipients', c.sent.toLocaleString('en-US')], ['Open rate', c.opens != null ? pct(c.opens, c.sent) + '%' : dash], ['Click rate', c.clicks != null ? pct(c.clicks, c.sent) + '%' : dash], ['Unsubs', c.unsubs], ['Revenue', c.revenue != null ? fmt(c.revenue) : dash]].map(([k, v]) => <div key={k} className="em-s55"><span className="em-s56">{k}</span><b className="em-s57">{v}</b></div>)}
                  </div>
                  <ResultsForm c={c} onDone={load} />
                </>
              )}
              {c.status === 'Scheduled' && (
                <div className="em-s58">
                  <button onClick={() => act(() => api.post(`/campaigns/${c.id}/send`), load)} className="em-s59">Send now</button>
                  <button onClick={() => act(() => api.del('/campaigns/' + c.id), load)} className="em-s15">Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
