// Job handlers of the price and stock tools: hourly sale expiry.
import { registerHandler, registerRecurring } from './jobs.js';
import { expireSales } from './saleExpiry.js';
import { snapshotPrices } from './priceHistory.js';

registerHandler('sale_expiry', async () => ({ expired: (await expireSales()).length }));
registerRecurring('sale_expiry', 3600e3);
registerHandler('price_snapshot', async () => snapshotPrices()); // price history without a trigger (see priceHistory.js)
registerRecurring('price_snapshot', 10 * 60e3);
