// Delivery hub: dispatch board, rider app, returns, branches and public live tracking. Split into src/hub/*; this file keeps the original import path and exports.
import { Router } from 'express';
import { registerBoardRoutes } from './hub/routesBoard.js';
import { registerOrderRoutes } from './hub/routesOrders.js';
import { registerRiderRoutes } from './hub/routesRiders.js';
import { registerLiveRoutes } from './hub/routesLive.js';

const hub = Router();
const pub = Router();
registerBoardRoutes(hub);
registerOrderRoutes(hub);
registerRiderRoutes(hub);
registerLiveRoutes(pub);

export { hub as hubRouter, pub as liveRouter };
