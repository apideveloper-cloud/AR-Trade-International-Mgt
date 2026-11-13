import { useState } from 'react';
import { fld, useTable } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { ListFilter, periodOf } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar, alertBox } from '../../ui.jsx';
import { Notice, Tabs, downloadCsv, useFld } from '../../fieldKit.jsx';

const REPORTS = [['sales', 'Sales'], ['collection', 'Collections'], ['delivery', 'Deliveries'], ['expense', 'Expenses'], ['approvals', 'Approvals'], ['ledger', 'Ledger sync'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['route', 'Routes']];

export function AccReports() {
  const [type, setType] = useState('sales');
  const [period, setPeriod] = useState('month');
  const sm = useFld(`/reports/summary?type=${type}&period=${period}`);
  const t = useTable('/reports/export', { name: 'sales', size: 25, ...periodOf('month') }, [], fld);
  const r = t.data, name = t.params.name;
  const [busy, setBusy] = useState(false);
  const csv = async () => {
    setBusy(true);
    try {
      const { page: _p, size: _s, ...rest } = t.params;
      const qs = new URLSearchParams(Object.entries({ ...rest, format: 'json' }).filter(([, v]) => v !== '' && v != null));
      const all = await fld.get('/reports/export?' + qs);
      downloadCsv(`${name}-${t.params.from || 'all'}_${t.params.to || 'all'}.csv`, all.columns, all.rows);
    } catch (e) { alertBox(e.message); }
    setBusy(false);
  };
  const grid = { gridTemplateColumns: `repeat(${(r.columns || []).length}, minmax(110px, 1fr))` };
  return (
    <>
      <Summary items={(sm.data?.kpis || [{ label: 'Loading…', display: '…', delta: '' }]).map((k, i) => [k.label, k.display, k.delta, ['green', 'blue', 'violet', 'amber'][i % 4], ['cart', 'check', 'money', 'clock'][i % 4]])} />
      <Notice err={sm.err || t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={type} onChange={setType} items={[['sales', 'Sales'], ['expenses', 'Expenses'], ['attendance', 'Attendance']]} /><Tabs value={period} onChange={setPeriod} items={[['day', 'Today'], ['week', 'This week'], ['month', 'This month']]} /></div>
        {sm.data?.chart && <><h3 style={{ margin: 0 }}>{sm.data.chart.title} <small className="fd-sub">{sm.data.label}</small></h3>
          <HBars rows={sm.data.chart.bars.map(b => ({ label: b.label, value: b.value, text: b.display }))} hue={type === 'expenses' ? 50 : type === 'attendance' ? 200 : 150} inline /></>}
      </section>
      <section className="a-card">
        <div className="card-hd"><div><h3>Detailed report</h3><small className="fd-sub">Pick a report, choose the dates and download it for Excel</small></div></div>
        <Tabs value={name} onChange={n => t.set({ name: n, q: '' })} items={REPORTS} />
      </section>
      <ListFilter t={t} noun="row" title={`Search ${r.title ? r.title.toLowerCase() : 'report'}`} search={{ placeholder: 'Search this report…' }} range={{ label: 'Report date', def: 'month' }} />
      <Toolbar t={t} search={false}>
        {r.title && <b>{r.title}</b>}{r.period && <span className="fd-sub">{r.period}</span>}
        <button type="button" className="a-mini" style={{ width: 'auto', flex: 'none' }} disabled={busy || !r.total} onClick={csv}>{busy ? 'Preparing…' : '⤓ Download CSV'}</button>
      </Toolbar>
      <section className="a-card">
        <div className="fd-tbl" style={{ opacity: t.loading ? 0.6 : 1 }}>
          <div className="fd-th" style={grid}>{(r.columns || []).map(c => <span key={c}>{c}</span>)}</div>
          {r.rows.map((row, i) => <div key={i} className="fd-tr" style={grid}>{row.map((c, j) => <span key={j}>{c}</span>)}</div>)}
        </div>
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
