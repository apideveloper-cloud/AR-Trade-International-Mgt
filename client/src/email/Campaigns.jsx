import { useEffect, useState } from 'react';
import { mktApi as api } from '../admin/adminApi.js';
import { fmt, fmtTime } from '../api.js';
import { CampaignForm } from './CampaignForm.jsx';
import { Pill } from './EmailParts.jsx';
import { act, dash, pct, TAG } from './emailShared.js';

/** Collapsed button that opens a small form to type in the results the email provider reported. */
function ResultsForm({ c, onDone }) {
  const [open, setOpen] = useState(false);
  const submit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target).entries());
    await act(() => api.put(`/campaigns/${c.id}/results`, d), () => { setOpen(false); onDone(); });
  };
  if (!open) return <button onClick={() => setOpen(true)} className="em-pill-btn em-results-open">Enter results from provider</button>;
  const start = { opens: c.opens, clicks: c.clicks, unsubs: c.unsubs, revenue: c.revenue, abA: c.ab?.[0], abB: c.ab?.[1] };
  return (
    <form onSubmit={submit} className="em-results-form">
      {[['opens', 'Opens'], ['clicks', 'Clicks'], ['unsubs', 'Unsubs'], ['revenue', 'Revenue ৳']].concat(c.subjB ? [['abA', 'Open % · A'], ['abB', 'Open % · B']] : []).map(([k, l]) => <label key={k} className="em-lbl em-lbl--sm">{l}<input name={k} type="number" min="0" defaultValue={start[k] ?? ''} className="em-inp em-inp--sm" /></label>)}
      <button className="em-results-save">Save</button>
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
    <div className="em-camp-layout">
      <CampaignForm tpls={tpls} onDone={load} />
      <div className="em-camp-list">
        {camps && !camps.length && <div className="em-card em-empty-card">No campaigns yet. Create the first one.</div>}
        {camps?.map(c => {
          const [tb, tf] = TAG[c.tag] || TAG.Offer;
          const sent = c.status === 'Sent';
          const win = c.ab ? (c.ab[1] > c.ab[0] ? 'B' : 'A') : null;
          const subjects = [['A', c.subjA], ...(c.subjB ? [['B', c.subjB]] : [])];
          return (
            <div key={c.id} className="em-card em-camp">
              <div className="em-camp-head">
                <span className="em-tag" style={{ background: tb, color: tf }}>{c.tag}</span>
                <b className="em-camp-name">{c.name}</b>
                <Pill ok={sent}>{c.status}</Pill>
                <span className="em-hint">{sent ? 'Sent ' : 'Sends '}{fmtTime(c.at)}</span>
              </div>
              <div className="em-subjects">
                {subjects.map(([k, t]) => (
                  <div key={k} className={'em-subj' + (win === k ? ' em-subj--win' : '')}>
                    <span className="mono em-subj-key">{k}</span><span className="em-subj-text">{t}</span>
                    {c.ab && <b className="em-subj-open">{c.ab[k === 'A' ? 0 : 1]}% open</b>}{win === k && <span className="em-win-badge">WINNER</span>}
                  </div>
                ))}
              </div>
              {tpl(c.template) && <span className="em-hint">Template: {tpl(c.template).name}</span>}
              {sent && (
                <>
                  <div className="em-camp-stats">
                    {[['Recipients', c.sent.toLocaleString('en-US')], ['Open rate', c.opens != null ? pct(c.opens, c.sent) + '%' : dash], ['Click rate', c.clicks != null ? pct(c.clicks, c.sent) + '%' : dash], ['Unsubs', c.unsubs], ['Revenue', c.revenue != null ? fmt(c.revenue) : dash]].map(([k, v]) => <div key={k} className="em-camp-stat"><span className="em-camp-stat-key">{k}</span><b className="em-camp-stat-val">{v}</b></div>)}
                  </div>
                  <ResultsForm c={c} onDone={load} />
                </>
              )}
              {c.status === 'Scheduled' && (
                <div className="em-camp-actions">
                  <button onClick={() => act(() => api.post(`/campaigns/${c.id}/send`), load)} className="em-pill-btn em-pill-btn--solid">Send now</button>
                  <button onClick={() => act(() => api.del('/campaigns/' + c.id), load)} className="em-pill-btn">Cancel</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
