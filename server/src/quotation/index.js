// Quotations: price offers sent to customers, with a printable PDF in the company's quotation layout.
// Mounted at /api/quotes. Reading needs quotes.view, every change needs quotes.manage.
//   Total amount = sum of (quantity x unit price). Net payable = total + installation + transport + VAT - discount.
//   Status: Draft -> Sent -> Accepted / Rejected. An Accepted quotation is locked; a Draft or Rejected one can be deleted.
import { Router } from 'express';
import { listRoutes } from './routesList.js';
import { scanRoute } from './routesScan.js';
import { crudRoutes } from './routesCrud.js';
import { shareRoutes } from './routesShare.js';

const router = Router();
// order matters: fixed paths (/customers, /defaults, /scan) must be registered before /:id
listRoutes(router);
scanRoute(router);
crudRoutes(router);
shareRoutes(router);

export { router as quoteRouter };
export { ensureQuotes } from './schema.js';
export { words } from './totals.js';
export { termsFromText } from './terms.js';
export { fieldCustomers } from './store.js';
export { buildQuotePdf } from './pdf.js';
