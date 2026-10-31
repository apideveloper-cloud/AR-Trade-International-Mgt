// Purchasing & stock: vendors, purchases (goods received), stock, damage & returns, vendor payments.
// Each page lives in ./inventory; this file keeps the import path the menu uses.
import '../field.css';
import './inventory/inventory.css';

export { InvVendors } from './inventory/Vendors.jsx';
export { InvPurchases } from './inventory/Purchases.jsx';
export { InvStock } from './inventory/Stock.jsx';
export { InvDamage } from './inventory/DamageReturns.jsx';
export { InvPayments } from './inventory/Payments.jsx';
