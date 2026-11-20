// Job handlers of the Merchant Center sync. Both are no-ops (return { skipped: true }) while syncEnabled is false (checked inside the functions).
import { registerHandler, registerRecurring } from './jobs.js';
import { refreshMerchantStatus, runMerchantSync } from './merchantSync.js';

registerHandler('merchant_sync', payload => runMerchantSync({ full: payload?.full === true }));
registerRecurring('merchant_sync', 30 * 60e3);
registerHandler('merchant_status', () => refreshMerchantStatus());
registerRecurring('merchant_status', 6 * 3600e3);
