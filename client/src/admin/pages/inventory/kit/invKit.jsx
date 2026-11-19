import { taka } from '../../../fieldKit.jsx';

/** Small helpers shared by the Purchasing & stock pages. */
export const METHODS = ['Cash', 'Bank transfer', 'bKash', 'Nagad', 'Cheque'];
/** A whole number of at least 0 (empty or invalid text becomes 0). */
export const num = v => Math.max(0, Math.round(Number(v) || 0));
/** Options for a vendor drop-down in a ListFilter. */
export const vendorOptions = list => list.map(v => ({ v: v.id, t: v.name }));
export const AddBtn = ({ children, ...p }) => <button type="button" className="a-btn sm grad" {...p}>{children}</button>;
/** Cancel + save buttons for a modal footer. */
export const Foot = ({ onClose, busy, label }) => <><button type="button" className="a-btn ghost" onClick={onClose}>Cancel</button><button className="a-btn grad" disabled={busy}>{busy ? 'Saving…' : label}</button></>;
export const balTone = b => (b > 0 ? 'bad' : b < 0 ? 'blue' : 'ok');
export const balText = b => (b > 0 ? taka(b) + ' due' : b < 0 ? taka(-b) + ' advance' : 'Settled');
/** One line's amount after its own discount. */
export const lineTotal = l => Math.max(0, num(l.qty) * num(l.unitCost) - num(l.discount));
/** Purchase / return lines as the API expects them. */
export const linesBody = lines => lines.map(l => ({ productId: l.productId, qty: num(l.qty), unitCost: num(l.unitCost), discount: num(l.discount) }));
/** Vendor drop-down (an inactive vendor stays listed only while it is the selected one). */
export const VendorSelect = ({ vendors, value, onChange, required = true }) => (
  <select className="a-input" value={value} onChange={e => onChange(e.target.value)} required={required}>
    <option value="">Choose vendor…</option>{vendors.filter(v => v.active || String(v.id) === String(value)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
  </select>
);
