// Email marketing: campaigns, automations, audience, preferences. Split into src/mkt/*; this file keeps the original import path and exports.
import { Router } from 'express';
import { registerInsightRoutes } from './mkt/routesInsight.js';
import { registerCampaignRoutes } from './mkt/routesCampaigns.js';
import { registerAudienceRoutes } from './mkt/routesAudience.js';
import { registerPrefsRoutes } from './mkt/routesPrefs.js';

const staff = Router();
const pub = Router();
registerInsightRoutes(staff);
registerCampaignRoutes(staff);
registerAudienceRoutes(staff);
registerPrefsRoutes(pub);

export { staff as mktRouter, pub as prefsRouter };
export { startMailWorker, stopMailWorker, onSubscribed } from './mkt/worker.js';
