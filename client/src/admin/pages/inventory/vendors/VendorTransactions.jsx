import { invApi, slNo, useTable } from '../../../adminApi.js';
import { Summary, Toolbar } from '../../../ui.jsx';
import { ListFilter } from '../../../ListFilter.jsx';
import { Chip, Grid, Notice, fDate, taka } from '../../../fieldKit.jsx';
import { useVendors } from '../kit/useInv.js';
import { CsvButton, exportCsv } from '../kit/csvExport.jsx';
import { vendorOptions } from '../kit/invKit.jsx';

const TX_TONE = { Bill: 'amber', Return: 'blue', Payment: 'ok' };

/** Every bill, return and payment of every vendor in one list. */
export function VendorTransactions() {
  const t = useTable('/transactions', { q: '', vendor: '', type: '', from: '', to: '', min: '', max: '' }, [], invApi);
  const vendors = useVendors();
  const m = t.data.totals || {};
  const download = () => exportCsv('/transactions', t.params, 'vendor-transactions.csv', ['Date', 'Vendor', 'Type', 'Reference', 'Details', 'Bill', 'Paid / returned'], x => [x.date, x.vendor, x.type, x.ref, x.info, x.bill, x.settled]);
  return (
    <>
      <Summary items={[
        ['Transactions', t.data.total ?? '…', 'matching your filters', 'blue', 'cart'],
        ['Bills', taka(m.bills), 'approved purchases', 'amber', 'box'],
        ['Returned', taka(m.returns), 'goods sent back', 'violet', 'truck'],
        ['Paid', taka(m.paid), 'to vendors', 'green', 'check']
      ]} />
      <ListFilter t={t} noun="transaction" title="Search transactions" search={{ placeholder: 'Reference, vendor, invoice or method' }}
        selects={[{ key: 'vendor', label: 'Vendor', all: 'All vendors', icon: 'user', options: vendorOptions(vendors) }, { key: 'type', label: 'Type', all: 'Bills, returns & payments', icon: 'status', options: [{ v: 'Bill', t: 'Bills' }, { v: 'Return', t: 'Returns' }, { v: 'Payment', t: 'Payments' }] }]}
        range={{ label: 'Date' }} amount={{ label: 'Amount' }} />
      <Toolbar t={t} search={false} />
      <Notice err={t.error} onRetry={t.reload} />
      <section className="a-card">
        <div className="card-hd"><div><h3>Vendor transactions</h3><small className="fd-sub">Bills add to what we owe, returns and payments reduce it</small></div>
          <div className="bk-acts"><CsvButton onClick={download} disabled={!t.data.total} /></div></div>
        <Grid server={t} cols="44px 110px minmax(170px,1.3fr) 100px 150px minmax(140px,1.2fr) 120px 130px" head={['SL', 'Date', 'Vendor', 'Type', 'Reference', 'Details', 'Bill', 'Paid / returned']} empty="No transaction matches."
          rows={t.data.rows.map((x, i) => ({ key: x.type + x.ref, item: x, cells: [slNo(t, i), fDate(x.date), <b key="v">{x.vendor}</b>, <Chip key="t" tone={TX_TONE[x.type]}>{x.type}</Chip>, <span key="r" className="mono">{x.ref}</span>, <span key="i" className="qt-clip">{x.info || '—'}</span>, x.bill ? <b key="b">{taka(x.bill)}</b> : '—', x.settled ? <b key="s" className="iv-gain">{taka(x.settled)}</b> : '—'] }))} />
      </section>
    </>
  );
}
