// Job handlers of the nightly price check and the weekly digest (Search & Growth, Phase 2).
import { registerHandler, registerRecurring } from './jobs.js';
import { runCheck, sendDigest } from './priceCheck.js';

registerHandler('price_check', () => runCheck());
registerRecurring('price_check', 24 * 3600e3);
registerHandler('price_digest', () => sendDigest()); // never throws: a missing mail setup is a skipped run, not a failed job
registerRecurring('price_digest', 7 * 24 * 3600e3);
