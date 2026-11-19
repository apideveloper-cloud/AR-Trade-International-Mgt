// Purchase requisitions, vendor quotes and purchase orders (code lives in src/field/purchase/*).
//   GET  /api/field/purchase/requests                 open requisitions (+ stock warning)
//   GET  /api/field/purchase/requests/:id             one requisition with its vendor quotes and the approval / budget line
//   POST /api/field/purchase/requests                 { productId?, productName, qty, needBy?, stockNow?, stockMin?, quotes?: [{ vendorId, unitPrice, deliveryDays, rating }] }
//   POST /api/field/purchase/requests/:id/quotes      { vendorId, unitPrice, deliveryDays?, rating? }  add / update a quote
//   GET  /api/field/purchase/vendors                  vendors for the "Change vendor" picker
//   POST /api/field/purchase/orders                   { prId, quoteId } -> draft PO (PO-0884) from the chosen quote
//   GET  /api/field/purchase/orders?status=           purchase officers see their own, manager / accountant / admin all
//   GET  /api/field/purchase/orders/:id               full PO (lines, summary, budget, approval trail, what the caller may do)
//   PUT  /api/field/purchase/orders/:id               edit a Draft: { vendorId, lines: [{ productId?, name, sku?, qty, unitPrice }], deliverBy, paymentTerms, deliverTo, note }
//   POST /api/field/purchase/orders/:id/submit        Draft -> Submitted (managers are notified)
//   POST /api/field/purchase/orders/:id/reopen        Submitted (before anyone approved it) or Rejected -> Draft again, revision + 1
//   DELETE /api/field/purchase/orders/:id             delete a Draft
// The approval steps live in approvals.js (Manager: Submitted -> ManagerApproved, Accountant: -> Approved).
import { Router } from 'express';
import requestRoutes from '../purchase/requests.js';
import orderReadRoutes from '../purchase/ordersRead.js';
import orderWriteRoutes from '../purchase/orders.js';

export { BUDGET, VAT_PCT, numberId } from '../purchase/calc.js';
export { PO_SELECT, poOut } from '../purchase/poOut.js';

const router = Router();
router.use(requestRoutes, orderReadRoutes, orderWriteRoutes);

export default router;
