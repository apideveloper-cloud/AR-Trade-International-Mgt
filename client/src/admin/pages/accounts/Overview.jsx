import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';
import { HBars } from '../../charts.jsx';
import { Summary } from '../../ui.jsx';
import { Chip, Notice, fDate, taka, useFld } from '../../fieldKit.jsx';
import { month0 } from './shared.jsx';
import '../../i18n/dict/accounts.js';
import { useT } from '../../i18n/lang.jsx';

export function AccOverview({ go }) {
  const tr = useT();
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
        [tr('Sales this month'), sales.data?.kpis?.[0]?.display ?? '…', sales.data?.label ? tr(sales.data.label) : '', 'green', 'cart'],
        [tr('Collected'), taka(col.data?.total), tr('{n} money receipts', { n: col.data?.count ?? 0 }), 'blue', 'money'],
        [tr('Receivable'), taka(col.data?.dues?.total), tr('unpaid invoices'), 'red', 'clock'],
        [tr('Expenses'), taka(exp.data?.total), tr('{n} claims in {month}', { n: exp.data?.count ?? 0, month: exp.data?.month || '' }), 'amber', 'tag'],
        [tr('Purchase to approve'), taka(poValue), poOpen.length === 1 ? tr('1 purchase order') : tr('{n} purchase orders', { n: poOpen.length }), 'violet', 'box'],
        [tr('Web orders to collect'), web ? taka(web.unpaidV) : '—', web ? tr('{n} unpaid web orders', { n: web.unpaidN }) : tr('not available for your role'), 'red', 'truck']
      ]} />
      <Notice err={err && tr(err)} />
      <div className="fd-two">
        <section className="a-card">
          <div className="card-hd"><div><h3>{tr('Receivable by age')}</h3><small className="fd-sub">{tr("How long customers' invoices have been unpaid")}</small></div><button type="button" className="a-mini" onClick={() => go('acc-receivables')}>{tr('Open receivables →')}</button></div>
          {aging.length ? <HBars rows={aging.map(a => ({ label: tr(a.label), value: a.amount, text: taka(a.amount) }))} hue={20} /> : <div className="a-empty">{tr('No unpaid invoices.')}</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>{tr('Collected by method')}</h3><small className="fd-sub">{col.data?.label && tr(col.data.label)}</small></div><button type="button" className="a-mini" onClick={() => go('acc-collections')}>{tr('Open collections →')}</button></div>
          {(col.data?.methods || []).length ? <HBars rows={col.data.methods.map(m => ({ label: tr(m.label), value: m.amount, text: taka(m.amount), sub: m.pct + '%' }))} hue={150} inline /> : <div className="a-empty">{tr('Nothing collected yet this month.')}</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>{tr('Expenses by category')}</h3><small className="fd-sub">{exp.data?.month}</small></div><button type="button" className="a-mini" onClick={() => go('acc-expenses')}>{tr('Open expenses →')}</button></div>
          {(exp.data?.categories || []).length ? <HBars rows={exp.data.categories.map(c => ({ label: tr(c.name), value: c.amount, text: taka(c.amount), sub: tr('{n} claims', { n: c.count }) }))} hue={60} inline /> : <div className="a-empty">{tr('No expenses this month.')}</div>}
        </section>
        <section className="a-card">
          <div className="card-hd"><div><h3>{tr('Waiting for a decision')}</h3><small className="fd-sub">{tr('Approvals in the field app and here')}</small></div><button type="button" className="a-mini" onClick={() => go('field-approvals')}>{tr('Open approvals →')}</button></div>
          <div className="fd-chips">
            {Object.entries(ap.data?.counts || {}).map(([k, n]) => <Chip key={k} tone={n ? 'amber' : 'off'}>{n} {tr(k === 'orders' ? 'sales orders' : k === 'purchase' ? 'purchase orders' : k)}</Chip>)}
            {!ap.data && <span className="spin" />}
          </div>
          {(col.data?.items || []).slice(0, 5).map(r => <div key={r.id} className="fd-line"><span><b>{r.customer}</b><small>{r.id} · {tr(r.method)} · {fDate(r.date)}</small></span><b>{taka(r.amount)}</b></div>)}
        </section>
      </div>
    </>
  );
}
