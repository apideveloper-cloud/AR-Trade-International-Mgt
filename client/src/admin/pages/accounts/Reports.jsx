import { useState } from 'react';
import { fld, useTable } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { ListFilter, periodOf } from '../../ListFilter.jsx';
import { Empty, Pager, Summary, Toolbar, alertBox } from '../../ui.jsx';
import { Notice, Tabs, downloadCsv, useFld } from '../../fieldKit.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

const REPORTS = [['sales', 'Sales'], ['collection', 'Collections'], ['delivery', 'Deliveries'], ['expense', 'Expenses'], ['approvals', 'Approvals'], ['ledger', 'Ledger sync'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['route', 'Routes']];

export function AccReports() {
  const tr = useT();
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
    } catch (e) { alertBox(tr(e.message)); }
    setBusy(false);
  };
  const grid = { gridTemplateColumns: `repeat(${(r.columns || []).length}, minmax(110px, 1fr))` };
  return (
    <>
      <Summary items={(sm.data?.kpis || [{ label: 'Loading…', display: '…', delta: '' }]).map((k, i) => [tr(k.label), k.display, /^\d+ claims$/.test(k.delta) ? tr('{n} claims', { n: parseInt(k.delta, 10) }) : tr(k.delta), ['green', 'blue', 'violet', 'amber'][i % 4], ['cart', 'check', 'money', 'clock'][i % 4]])} />
      <Notice err={(sm.err || t.error) && tr(sm.err || t.error)} onRetry={t.reload} />
      <section className="a-card">
        <div className="fd-bar"><Tabs value={type} onChange={setType} items={[['sales', tr('Sales')], ['expenses', tr('Expenses')], ['attendance', tr('Attendance')]]} /><Tabs value={period} onChange={setPeriod} items={[['day', tr('Today')], ['week', tr('This week')], ['month', tr('This month')]]} /></div>
        {sm.data?.chart && <><h3 style={{ margin: 0 }}>{tr(sm.data.chart.title)} <small className="fd-sub">{tr(sm.data.label)}</small></h3>
          <HBars rows={sm.data.chart.bars.map(b => ({ label: b.label, value: b.value, text: b.display }))} hue={type === 'expenses' ? 50 : type === 'attendance' ? 200 : 150} inline /></>}
      </section>
      <section className="a-card">
        <div className="card-hd"><div><h3>{tr('Detailed report')}</h3><small className="fd-sub">{tr('Pick a report, choose the dates and download it for Excel')}</small></div></div>
        <Tabs value={name} onChange={n => t.set({ name: n, q: '' })} items={REPORTS.map(([k, l]) => [k, tr(l)])} />
      </section>
      <ListFilter t={t} noun="row" title={r.title ? tr('Search {name}', { name: tr(r.title).toLowerCase() }) : tr('Search report')} search={{ placeholder: 'Search this report…' }} range={{ label: 'Report date', def: 'month' }} />
      <Toolbar t={t} search={false}>
        {r.title && <b>{tr(r.title)}</b>}{r.period && <span className="fd-sub">{tr(r.period)}</span>}
        <button type="button" className="a-mini" style={{ width: 'auto', flex: 'none' }} disabled={busy || !r.total} onClick={csv}>{busy ? tr('Preparing…') : tr('⤓ Download CSV')}</button>
      </Toolbar>
      <section className="a-card">
        <div className="fd-tbl" style={{ opacity: t.loading ? 0.6 : 1 }}>
          <div className="fd-th" style={grid}>{(r.columns || []).map(c => <span key={c}>{tr(c)}</span>)}</div>
          {r.rows.map((row, i) => <div key={i} className="fd-tr" style={grid}>{row.map((c, j) => <span key={j}>{c}</span>)}</div>)}
        </div>
        <Empty t={t} />
      </section>
      <Pager t={t} />
    </>
  );
}
