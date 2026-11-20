import { downloadFile, fmtMoney } from '../../adminApi.js';
import { PdfIcon } from '../../fieldKit.jsx';
import { useT } from '../../i18n/lang.jsx';
import '../../i18n/dict/sales.js';

export function InvoiceBar({ id, o, docNo, docOrder, onPdf, onEmail, onError }) {
  const tr = useT();
  return (
    <div className="od-inv">
      <span className="inv-ic">📄</span>
      <div className="od-inv-t"><b>{docNo}</b><small>{docOrder ? tr('Sales order') : tr('Sales invoice')} · {o.payStatus === 'Paid' ? tr('Paid') : tr('Payment due')} · {fmtMoney(o.total)}</small></div>
      <div className="od-inv-a">
        <button type="button" onClick={onPdf} title={tr('View the invoice as PDF')}><PdfIcon size={14} /> PDF</button>
        <button type="button" onClick={() => downloadFile(`/orders/${id}/invoice.pdf`, docNo + '.pdf').catch(e => onError(tr(e.message)))} title={tr('Download the invoice')}>⤓ {tr('Download')}</button>
        <button type="button" className="hot" onClick={onEmail} title={tr('Email the invoice to the customer')}>✉ {tr('Email')}</button>
      </div>
    </div>
  );
}
