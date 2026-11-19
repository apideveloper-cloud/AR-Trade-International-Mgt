// Shared constants and SQL fragments for the inventory (purchasing & stock) modules.
export const VIEW = 'inventory.view', MANAGE = 'inventory.manage', APPROVE = 'inventory.approve';
// A purchase moves Pending -> Approved -> Stocked (or Rejected). It is a bill on the vendor's account once Approved, and adds to stock only when Stocked.
export const BILLED = "status IN ('Approved','Stocked')";
export const METHODS = ['Cash', 'Bank transfer', 'bKash', 'Nagad', 'Cheque'];
export const LOW = 5; // same "low stock" line the Products page uses
// What we owe a vendor (alias v): opening balance + billed purchases - returns - payments.
export const BAL = `(v.opening + COALESCE((SELECT SUM(total) FROM stock_receipts r WHERE r.vendor_id = v.id AND r.${BILLED}), 0) - COALESCE((SELECT SUM(total) FROM vendor_returns t WHERE t.vendor_id = v.id), 0) - COALESCE((SELECT SUM(amount) FROM vendor_payments p WHERE p.vendor_id = v.id), 0))`;
// Amount already paid against one purchase (alias r).
export const PAID = '(SELECT COALESCE(SUM(amount), 0) FROM vendor_payments p WHERE p.receipt_id = r.id)';
