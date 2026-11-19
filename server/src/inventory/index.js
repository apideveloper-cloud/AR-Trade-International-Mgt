// Purchasing & stock: vendors, goods receipts (purchase bills), stock ledger, damage, returns to vendors and vendor payments.
// Mounted at /api/inv. Reading needs inventory.view, every change needs inventory.manage (approvals: inventory.approve).
//   Vendor balance (what we owe) = opening balance + bills (receipts) - returns - payments.
//   Every change to products.stock made here also writes one row to stock_moves, so each number can be explained.
import { Router } from 'express';
import vendors from './vendors.js';
import ledger from './ledger.js';
import products from './products.js';
import receipts from './receipts.js';
import approvals from './approvals.js';
import damages from './damages.js';
import returns from './returns.js';
import payments from './payments.js';
import summary from './summary.js';

const router = Router();
// Same order the routes always had; the paths do not overlap, so order only matters for readability.
for (const r of [vendors, ledger, products, receipts, approvals, damages, returns, payments, summary]) router.use(r);

export { router as invRouter };
export { ensureInventory } from './schema.js';
