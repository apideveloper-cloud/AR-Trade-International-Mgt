// The admin console API (/api/admin). The route groups live in admin/*.js and the older adminContent / adminEngage / adminSystem files;
// they are registered on one router in this order (it matters: for example /staff/:id comes before /staff/roles, as it always did).
import { Router } from 'express';
import { mountChatLeadAdmin } from './chatLeads.js';
import { contentRouter } from './adminContent.js';
import { mountEngageRoutes } from './adminEngage.js';
import { mountSystemRoutes } from './adminSystem.js';
import { guard } from './admin/guard.js';
import { mountAuthRoutes } from './admin/auth.js';
import { mountDashboardRoutes } from './admin/dashboard.js';
import { mountOrderRoutes } from './admin/orders.js';
import { mountCatalogRoutes } from './admin/catalog.js';
import { mountCustomerRoutes } from './admin/customers.js';
import { mountTeamRoutes } from './admin/team.js';

export { guard }; // other route files (field, hub, inventory, audit, ...) import the guard from here

const router = Router();
mountAuthRoutes(router, guard);
mountDashboardRoutes(router, guard);
mountOrderRoutes(router, guard);
mountCatalogRoutes(router, guard);
mountCustomerRoutes(router, guard); // customers, password resets, service requests
router.use(contentRouter(guard));
mountEngageRoutes(router, guard);
mountChatLeadAdmin(router, guard);
mountTeamRoutes(router, guard);
mountSystemRoutes(router, guard);

export default router;
