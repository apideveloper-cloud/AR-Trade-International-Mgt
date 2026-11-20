// Job handlers of the weekly growth digest and the daily NAP check.
import { registerHandler, registerRecurring } from './jobs.js';
import { sendGrowthDigest } from './digest.js';
import { runNapCheck } from './napCheck.js';

registerHandler('growth_digest', async () => sendGrowthDigest());
registerRecurring('growth_digest', 7 * 24 * 3600e3);
registerHandler('nap_check', async () => { const r = await runNapCheck(); return { at: r.at, issues: r.issues }; });
registerRecurring('nap_check', 24 * 3600e3);
