// Job handler of the nightly JSON-LD validator (Search & Growth, Phase 5).
import { registerHandler, registerRecurring } from './jobs.js';
import { runSchemaCheck } from './schemaCheck.js';

registerHandler('schema_check', () => runSchemaCheck());
registerRecurring('schema_check', 24 * 3600e3);
