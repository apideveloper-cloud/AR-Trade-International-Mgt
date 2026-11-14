import { downloadFile, fmtMoney } from '../../adminApi.js';
import { PdfIcon } from '../../fieldKit.jsx';

export function InvoiceBar({ id, o, docNo, docOrder, onPdf, onEmail, onError }) {
  return (
    <div className="od-inv">
      <span className="inv-ic">📄</span>
      <div className="od-inv-t"><b>{docNo}</b><small>{docOrder ? 'Sales order' : 'Sales invoice'} · {o.payStatus === 'Paid' ? 'Paid' : 'Payment due'} · {fmtMoney(o.total)}</small></div>
      <div className="od-inv-a">
        <button type="button" onClick={onPdf} title="View the invoice as PDF"><PdfIcon size={14} /> PDF</button>
        <button type="button" onClick={() => downloadFile(`/orders/${id}/invoice.pdf`, docNo + '.pdf').catch(e => onError(e.message))} title="Download the invoice">⤓ Download</button>
        <button type="button" className="hot" onClick={onEmail} title="Email the invoice to the customer">✉ Email</button>
      </div>
    </div>
  );
}
