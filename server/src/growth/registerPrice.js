// Job handlers of the price and stock tools: hourly sale expiry.
import { registerHandler, registerRecurring } from './jobs.js';
import { expireSales } from './saleExpiry.js';

registerHandler('sale_expiry', async () => ({ expired: (await expireSales()).length }));
registerRecurring('sale_expiry', 3600e3);
