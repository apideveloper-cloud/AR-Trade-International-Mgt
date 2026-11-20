import { useState } from 'react';
import { adm, dateTimeF, useTable } from '../adminApi.js';
import { Drawer, Empty, Pager, Summary, alertBox, hueOf } from '../ui.jsx';
import { Chip, Fact, Notice, Skeleton, downloadCsv, initials } from '../fieldKit.jsx';
import { daysAgo, ymd } from '../ListFilter.jsx';
import { useApiData } from '../hooks/useApiData.js';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.js';
import { useT } from '../i18n/lang.jsx';
import '../i18n/dict/shell.js';
import '../filterCard.css';
import './audit/audit.css';

const methodTone = m => (m === 'DELETE' ? 'bad' : m === 'POST' ? 'ok' : m === 'GET' ? 'blue' : m === 'SYS' ? 'violet' : 'amber');

function EntryDrawer({ id, onClose }) {
  const tr = useT();
  const q = useApiData(() => adm.get('/audit/' + id), [id]);
  const d = q.data, err = q.error;
  return (
    <Drawer title={d ? tr(d.action) : tr('Log entry')} sub={d ? `${tr(d.entity)}${d.entityId ? ' ' + d.entityId : ''} · ${dateTimeF(d.at)}` : tr('Loading…')} onClose={onClose}>
      <Notice err={err} />
      {!d ? !err && <Skeleton rows={6} /> : (
        <>
          <div className={'au-res ' + (d.ok ? 'ok' : 'bad')}>{tr(d.ok ? '✓ Done' : '✕ Refused or failed')} <b>{d.status || ''}</b>{d.error && <span>{tr(d.error)}</span>}</div>
          <div className="fd-facts">
            <Fact k="Who">{d.staff || '—'}</Fact><Fact k="Role">{d.role && tr(d.role)}</Fact><Fact k="Module">{d.module && tr(d.module)}</Fact><Fact k="Action">{d.action && tr(d.action)}</Fact>
            <Fact k="Target">{[d.entity && tr(d.entity), d.entityId].filter(Boolean).join(' ')}</Fact><Fact k="When">{dateTimeF(d.at)}</Fact>
            <Fact k="Request"><span className="mono">{d.method} {d.path}</span></Fact><Fact k="IP address"><span className="mono">{d.ip}</span></Fact>
          </div>
          <Fact k="Browser">{d.agent}</Fact>
          <h4 className="au-h">{tr('What was sent')}</h4>
          {d.detail ? <pre className="au-pre">{JSON.stringify(d.detail, null, 2)}</pre> : <p className="au-none">{tr('Nothing was sent with this request.')}</p>}
          <small className="au-note">{tr('Passwords, tokens and keys are never stored. Long values (such as images) are replaced by their length.')}</small>
        </>
      )}
    </Drawer>
  );
}

export function Audit() {
  const tr = useT();
  const t = useTable('/audit', { q: '', staff: '', module: '', result: '', from: daysAgo(6), to: ymd(new Date()), size: 25 });
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const typeSearch = useDebouncedCallback(v => t.set({ q: v }), 350);
  const p = t.params, dt = t.data;
  const s = dt.summary || {};
  const ranges = [['today', 'Today', ymd(new Date()), ymd(new Date())], ['d7', 'Last 7 days', daysAgo(6), ymd(new Date())], ['d30', 'Last 30 days', daysAgo(29), ymd(new Date())], ['all', 'All time', '', '']];
  const current = (ranges.find(r => r[2] === (p.from || '') && r[3] === (p.to || '')) || [])[0];
  const active = ['q', 'staff', 'module', 'result'].filter(k => p[k]).length;
  const reset = () => t.set({ q: '', staff: '', module: '', result: '', from: daysAgo(6), to: ymd(new Date()) });
  const exportCsv = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams(Object.entries({ ...p, size: 5000, page: 1 }).filter(([, v]) => v !== '' && v != null)).toString();
      const all = await adm.get('/audit?' + qs);
      downloadCsv('audit-log.csv', ['When', 'Staff', 'Role', 'Module', 'Action', 'Target', 'Details', 'Result', 'Status', 'IP'], all.rows.map(r => [dateTimeF(r.at), r.staff, r.role, r.module, r.action, [r.entity, r.entityId].filter(Boolean).join(' '), r.summary, r.ok ? 'Done' : 'Failed: ' + r.error, r.status, r.ip]));
    } catch (e) { alertBox(tr(e.message)); }
    setBusy(false);
  };
  return (
    <>
      <Summary items={[
        ['Actions today', s.today ?? '…', tr(s.staffToday === 1 ? 'by {n} staff member' : 'by {n} staff members', { n: s.staffToday ?? 0 }), 'blue', 'check'],
        ['Failed today', s.failed ?? '…', 'refused or errors', 'red', 'alert'],
        ['Last 7 days', s.week ?? '…', 'operations recorded', 'violet', 'clock'],
        ['Kept for', tr('{n} days', { n: dt.keepDays || 365 }), 'older entries are deleted', 'amber', 'tag']
      ]} />
      <section className="os-card">
        <div className="os-hd">
          <span className="os-ic"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4-2v-4z" /></svg></span>
          <b>{tr('Audit filters')}</b>{active > 0 && <i className="os-badge">{tr('{n} active', { n: active })}</i>}
          <span className="os-seg" role="group" aria-label={tr('Date range')}>
            {ranges.map(([k, label, from, to]) => <button key={k} type="button" className={current === k ? 'on' : ''} onClick={() => t.set({ from, to })}>{tr(label)}</button>)}
          </span>
          <span className="os-sp" />
          <em className="os-found">{t.loading ? tr('Loading…') : tr(dt.total === 1 ? '{n} entry' : '{n} entries', { n: dt.total })}</em>
        </div>
        <div className="os-box">
          <div className="os-grid">
            <label className="os-f os-s c4">{tr('Search')}
              <span className="os-in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
                <input key={'q' + (p.q === '' ? '-e' : '')} defaultValue={p.q} placeholder={tr('Staff, action, order no., details…')} onChange={e => typeSearch(e.target.value)} /></span>
            </label>
            <label className="os-f c3">{tr('Staff')}<span className="os-in os-sel"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.7-3.6 3.6-5.6 7-5.6s6.3 2 7 5.6" /></svg><select value={p.staff} onChange={e => t.set({ staff: e.target.value })}><option value="">{tr('All staff')}</option>{(dt.staff || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></span></label>
            <label className="os-f c3">{tr('Module')}<span className="os-in os-sel"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg><select value={p.module} onChange={e => t.set({ module: e.target.value })}><option value="">{tr('All modules')}</option>{(dt.modules || []).map(m => <option key={m} value={m}>{tr(m)}</option>)}</select></span></label>
            <label className="os-f c2">{tr('Result')}<span className="os-in os-sel"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></svg><select value={p.result} onChange={e => t.set({ result: e.target.value })}><option value="">{tr('All')}</option><option value="ok">{tr('Done')}</option><option value="failed">{tr('Failed')}</option></select></span></label>
            <label className="os-f c3">{tr('Date from')}<span className="os-in os-dt"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg><input type="date" value={p.from || ''} max={p.to || undefined} onChange={e => t.set({ from: e.target.value })} /></span></label>
            <label className="os-f c3">{tr('Date to')}<span className="os-in os-dt"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg><input type="date" value={p.to || ''} min={p.from || undefined} onChange={e => t.set({ to: e.target.value })} /></span></label>
            <div className="os-f c3 os-end"><button type="button" className="os-clr" onClick={reset}>↺ {tr('Reset')}</button></div>
            <div className="os-f c3 os-end"><button type="button" className="au-exp" onClick={exportCsv} disabled={busy || !dt.total}>{tr(busy ? 'Preparing…' : '⤓ Export CSV')}</button></div>
          </div>
        </div>
      </section>
      <Notice err={t.error} onRetry={t.reload} />
      <div className="a-table ord au" style={{ opacity: t.loading ? .6 : 1 }}>
        <div style={{ minWidth: 900 }}>
          <div className="head" style={{ gridTemplateColumns: '138px minmax(150px,.9fr) minmax(170px,1.1fr) minmax(130px,.8fr) minmax(200px,1.6fr) 96px' }}><span>{tr('When')}</span><span>{tr('Staff')}</span><span>{tr('Action')}</span><span>{tr('Target')}</span><span>{tr('Details')}</span><span>{tr('Result')}</span></div>
          {dt.rows.map(r => (
            <button key={r.id} className="row" style={{ gridTemplateColumns: '138px minmax(150px,.9fr) minmax(170px,1.1fr) minmax(130px,.8fr) minmax(200px,1.6fr) 96px' }} onClick={() => setOpen(r.id)}>
              <span className="au-when">{dateTimeF(r.at)}</span>
              <span className="au-who"><i style={{ '--h': hueOf(r.staff) }}>{initials(r.staff)}</i><span><b>{r.staff || tr('Unknown')}</b><small>{r.role ? tr(r.role) : '—'}</small></span></span>
              <span className="au-act"><b>{tr(r.action)}</b><small><Chip tone={methodTone(r.method)}>{r.method}</Chip> {tr(r.module)}</small></span>
              <span className="au-tgt"><b>{tr(r.entity)}</b>{r.entityId && <small className="mono">{r.entityId}</small>}</span>
              <span className="au-sum" title={r.summary}>{r.summary || <em>—</em>}</span>
              <span>{r.ok ? <Chip tone="ok">{tr('Done')}</Chip> : <Chip tone="bad">{tr('Failed')} {r.status}</Chip>}</span>
            </button>
          ))}
        </div>
      </div>
      <Empty t={t} /><Pager t={t} />
      {open && <EntryDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
