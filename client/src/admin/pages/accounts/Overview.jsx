import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { Summary } from '../../ui.jsx';
import { Chip, Notice, fDate, taka, useFld } from '../../fieldKit.jsx';
import { month0 } from './shared.jsx';

export function AccOverview({ go }) {
  const col = useFld('/reports/collection?period=month');
  const exp = useFld('/reports/expense?month=' + month0());
  const sales = useFld('/reports/summary?type=sales&period=month');
  const po = useFld('/purchase/orders');
  const ap = useFld('/approvals/summary');
  const [web, setWeb] = useState(null);
  useEffect(() => {
    let stale = false;
    adm.get('/overview').then(o => { if (!stale) setWeb(o.finance || null); }).catch(() => {});
    return () => { stale = true; };
  }, []);
  const poOpen = (po.data?.items || []).filter(p => ['submitted', 'manager_approved'].includes(p.status));
  const poValue = poOpen.reduce((t, p) => t + p.grand, 0);
  const aging = col.data?.dues?.aging || [];
  const err = col.err || exp.err || sales.err;
  return (
    <>
      <Summary items={[
        ['Sales this month', sales.data?.kpis?.[0]?.display ?? '…', sales.data?.label || '', 'green', 'cart'],
        ['Collected', taka(col.data?.total), `${col.data?.count ?? 0} money receipts`, 'blue', 'money'],
        ['Receivable', taka(col.data?.dues?.total), 'unpaid invoices', 'red', 'clock'],
        ['Expenses', taka(exp.data?.total), `${exp.data?.count ?? 0} claims in ${exp.data?.month || ''}`, 'amber', 'tag'],
        ['Purchase to approve', taka(poValue), `${poOpen.length} purchase order${poOpen.length === 1 ? '' : 's'}`, 'violet', 'box'],
        ['Web orders to collect', web ? taka(web.unpaidV) : '—', web ? `${web.unpaidN} unpaid web orders` : 'not available for your role', 'red', 'truck']
      ]} />
      <Notice err={err} />
      <div className="fd-two">
        <section className="a-card">
          <div className="card-hd"><div><h3>Receivable by age</h3><small className="fd-sub">How long customers' invoices have been unpaid</small></div><button type="button" className="a-mini" onClick={() => go('acc-receivables')}>Open receivables →</button></div>
          {aging.length ? <HBars rows={aging.map(a => ({ label: a.label, value: a.amount, text: taka(a.amount) }))} hue={20} /> : <div className="a-empty">No unpaid invoices.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Collected by method</h3><small className="fd-sub">{col.data?.label}</small></div><button type="button" className="a-mini" onClick={() => go('acc-collections')}>Open collections →</button></div>
          {(col.data?.methods || []).length ? <HBars rows={col.data.methods.map(m => ({ label: m.label, value: m.amount, text: taka(m.amount), sub: m.pct + '%' }))} hue={150} inline /> : <div className="a-empty">Nothing collected yet this month.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Expenses by category</h3><small className="fd-sub">{exp.data?.month}</small></div><button type="button" className="a-mini" onClick={() => go('acc-expenses')}>Open expenses →</button></div>
          {(exp.data?.categories || []).length ? <HBars rows={exp.data.categories.map(c => ({ label: c.name, value: c.amount, text: taka(c.amount), sub: c.count + ' claims' }))} hue={60} inline /> : <div className="a-empty">No expenses this month.</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>Waiting for a decision</h3><small className="fd-sub">Approvals in the field app and here</small></div><button type="button" className="a-mini" onClick={() => go('field-approvals')}>Open approvals →</button></div>
          <div className="fd-chips">
            {Object.entries(ap.data?.counts || {}).map(([k, n]) => <Chip key={k} tone={n ? 'amber' : 'off'}>{n} {k === 'orders' ? 'sales orders' : k === 'purchase' ? 'purchase orders' : k}</Chip>)}
            {!ap.data && <span className="spin" />}
          </div>
          {(col.data?.items || []).slice(0, 5).map(r => <div key={r.id} className="fd-line"><span><b>{r.customer}</b><small>{r.id} · {r.method} · {fDate(r.date)}</small></span><b>{taka(r.amount)}</b></div>)}
        </section>
      </div>
    </>
  );
}
