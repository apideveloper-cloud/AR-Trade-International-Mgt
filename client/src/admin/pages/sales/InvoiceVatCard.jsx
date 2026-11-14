import { useEffect, useState } from 'react';
import { adm } from '../../adminApi.js';

/** VAT / taxes line of the invoice, typed per order. `msg` is '', 'saved' or 'cleared' so the hint always tells the truth. */
export function InvoiceVatCard({ id, o, setO, onChanged }) {
  const [vat, setVat] = useState({ text: '', busy: false, err: '', msg: '' });
  useEffect(() => { setVat(v => ({ ...v, text: o.vatAmount != null ? String(o.vatAmount) : '' })); }, [o.vatAmount, o.id]);
  const save = async clear => {
    setVat(v => ({ ...v, busy: true, err: '', msg: '' }));
    try {
      const n = await adm.put(`/orders/${id}/vat`, { amount: clear ? '' : vat.text.trim() });
      setO(n); setVat(v => ({ ...v, busy: false, msg: clear ? 'cleared' : 'saved', text: n.vatAmount != null ? String(n.vatAmount) : '' })); onChanged?.();
    } catch (x) { setVat(v => ({ ...v, busy: false, err: x.message })); }
  };
  return (
    <section className="od-card od-vat">
      <h4>Invoice VAT &amp; taxes</h4>
      <div className="od-vat-r">
        <label><input type="number" min="0" step="1" inputMode="numeric" aria-label="Invoice VAT and taxes amount in taka" value={vat.text} placeholder="Empty = excluded" onChange={e => setVat(v => ({ ...v, text: e.target.value, msg: '' }))} /></label>
        <button type="button" className="hot" disabled={vat.busy} onClick={() => save(false)}>{vat.busy ? 'Saving…' : 'Save'}</button>
        {o.vatAmount != null && <button type="button" disabled={vat.busy} onClick={() => save(true)}>Clear</button>}
      </div>
      <small aria-live="polite">{vat.err ? <b className="od-vat-err">{vat.err}</b> : vat.msg === 'saved' ? '✓ Saved. The invoice (PDF, print, email) now shows this.' : vat.msg === 'cleared' ? '✓ Cleared. The invoice now shows “Excluded”.' : 'Shown on this order’s invoice only. Empty shows “Excluded”. The order total and payments do not change.'}</small>
    </section>
  );
}
