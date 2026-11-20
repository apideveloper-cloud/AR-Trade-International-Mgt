// Job handlers of the Search Console sync and URL Inspection. Both return { skipped: true, reason } while Google or the property is not ready.
import { registerHandler, registerRecurring } from './jobs.js';
import { runGscInspect, runGscSync } from './gscSync.js';

registerHandler('gsc_sync', () => runGscSync());
registerRecurring('gsc_sync', 24 * 3600e3);
registerHandler('gsc_inspect', () => runGscInspect());
registerRecurring('gsc_inspect', 6 * 3600e3);
